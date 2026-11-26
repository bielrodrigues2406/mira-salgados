import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditoriaService } from '../../src/auditoria/auditoria.service.js';
import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { TransporteSimuladoConector } from '../../src/notificacoes/conector/transporte-simulado.conector.js';
import { EstadoConectorNotificacao } from '../../src/notificacoes/entities/estado-conector-notificacao.entity.js';
import { OutboxNotificacao } from '../../src/notificacoes/entities/outbox-notificacao.entity.js';
import { ResumoEnviadoPedido } from '../../src/notificacoes/entities/resumo-enviado-pedido.entity.js';
import { AgendadorResumosService } from '../../src/notificacoes/servicos/agendador-resumos.service.js';
import { DespachanteOutboxService } from '../../src/notificacoes/servicos/despachante-outbox.service.js';
import { LimpezaRetencaoService } from '../../src/notificacoes/servicos/limpeza-retencao.service.js';
import { WebhookNotificacoesService } from '../../src/notificacoes/servicos/webhook-notificacoes.service.js';
import { criarServidorWebhookPrivado } from '../../src/notificacoes/worker-webhook.js';
import { ChaveIdempotencia } from '../../src/pedidos/chave-idempotencia.entity.js';
import { Pedido } from '../../src/pedidos/pedido.entity.js';
import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface PainelAutomacoes {
  estado: { estado: string; modo: string; pausado: boolean; motivoPausa: string | null };
  destinos: { id: string; nome: string; identificadorExterno: string | null; ativo: boolean }[];
  regras: {
    id: string;
    tipo: 'AVISO_IMEDIATO' | 'RESUMO_DIARIO';
    ativa: boolean;
    destinoId: string;
    filtroEncomenda: string;
    preparos: string[];
    escopoItens: string;
    debounceSegundos: number;
    horarioResumo: string | null;
    incluirConcluidos: boolean;
  }[];
  fila: { pendentes: number; incertos: number; falhas: number };
}

interface PedidoCriado {
  id: string;
  numero: number;
  itens: { id: string; preparo: string }[];
}

describe('notificações, outbox, worker e automações', () => {
  let app: NestExpressApplication;
  let admin: ClienteHttp;
  let membro: ClienteHttp;
  let cenario: Cenario;
  let esfiha: Ref;
  let conector: TransporteSimuladoConector;
  let despachante: DespachanteOutboxService;
  let agendador: AgendadorResumosService;
  let limpeza: LimpezaRetencaoService;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    conector = app.get(TransporteSimuladoConector);
    despachante = app.get(DespachanteOutboxService);
    agendador = app.get(AgendadorResumosService);
    limpeza = app.get(LimpezaRetencaoService);
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await limparBanco(app);
    conector.resetar();
    admin = await clienteAutenticado(app, 'ADMIN');
    membro = await clienteAutenticado(app, 'MEMBRO');
    cenario = await montarCenario(admin);

    // Acrescenta produto assado para testar regras de forno.
    esfiha = dadosDe<Ref>(
      await admin
        .post('/produtos', { nome: 'Esfiha de carne', produtorPadraoId: cenario.mira.id })
        .expect(201),
    );
    await admin
      .post(`/produtos/${esfiha.id}/precos`, {
        preparo: 'ASSADO',
        unidadeVenda: 'CENTO',
        precoCentavos: 11_000,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function painel(): Promise<PainelAutomacoes> {
    return dadosDe<PainelAutomacoes>(await admin.get('/automacoes').expect(200));
  }

  async function ligarRegra(
    tipo: 'AVISO_IMEDIATO' | 'RESUMO_DIARIO',
    extras: Record<string, unknown> = {},
  ): Promise<string> {
    const atual = await painel();
    const regra = atual.regras.find((item) => item.tipo === tipo);
    if (!regra) throw new Error(`Regra ${tipo} não encontrada`);
    await admin.patch(`/automacoes/regras/${regra.id}`, { ativa: true, ...extras }).expect(200);
    return regra.id;
  }

  async function criarEncomendaConfirmada(
    extras: Record<string, unknown> = {},
  ): Promise<PedidoCriado> {
    return dadosDe<PedidoCriado>(
      await membro
        .post('/pedidos/confirmados', {
          clienteId: cenario.ana.id,
          tipoEntrega: 'ENTREGA',
          enderecoEntrega: 'Rua Secreta, 999',
          observacao: 'Cliente VIP paga depois',
          descontoCentavos: 500,
          dataEntrega: '2026-10-02',
          horarioEntrega: '18:30',
          itens: [
            {
              produtoId: esfiha.id,
              preparo: 'ASSADO',
              unidadeVenda: 'CENTO',
              quantidade: 1,
            },
            {
              produtoId: cenario.coxinha.id,
              preparo: 'FRITO',
              unidadeVenda: 'CENTO',
              quantidade: 0.5,
            },
          ],
          ...extras,
        })
        .expect(201),
    );
  }

  it('inicializa padrões seguros (regras desligadas com assados), restringe /automacoes a ADMIN e libera cópia da equipe para MEMBRO sem PII', async () => {
    await membro.get('/automacoes').expect(403);

    const estadoInicial = await painel();
    expect(estadoInicial.estado.modo).toBe('SIMULADO');
    expect(estadoInicial.destinos).toHaveLength(1);
    expect(estadoInicial.destinos[0]?.nome).toBe('Equipe Mira');
    expect(estadoInicial.regras.every((r) => !r.ativa)).toBe(true);
    expect(estadoInicial.regras.every((r) => r.preparos.includes('ASSADO'))).toBe(true);

    const pedido = await criarEncomendaConfirmada();
    const copia = dadosDe<{ pedidoId: string; numero: number; texto: string }>(
      await membro.get(`/pedidos/${pedido.id}/mensagem-equipe`).expect(200),
    );

    expect(copia.pedidoId).toBe(pedido.id);
    expect(copia.texto).toContain(`*Nova encomenda #${String(pedido.numero)}*`);
    expect(copia.texto).toContain('• *100 Esfiha de carne (assado)*');
    expect(copia.texto).toContain('• 50 Coxinha de frango (frito)');
    // Minimização estrita: zero nome do cliente, endereço, observação ou valores.
    expect(copia.texto).not.toContain('Ana Paula');
    expect(copia.texto).not.toContain('Rua Secreta');
    expect(copia.texto).not.toContain('Cliente VIP');
    expect(copia.texto).not.toContain('R$');
  });

  it('enfileira atomicamente aviso imediato na confirmação e reverte tudo se a transação falhar', async () => {
    await ligarRegra('AVISO_IMEDIATO');

    // Simula falha na auditoria durante criação confirmada: nada pode sobrar na outbox.
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('falha-simulada-auditoria'));
    await membro
      .post('/pedidos/confirmados', {
        clienteId: cenario.ana.id,
        tipoEntrega: 'RETIRADA',
        dataEntrega: '2026-10-02',
        itens: [{ produtoId: esfiha.id, preparo: 'ASSADO', unidadeVenda: 'CENTO', quantidade: 1 }],
      })
      .expect(500);
    spy.mockRestore();

    expect(await dataSource.getRepository(OutboxNotificacao).count()).toBe(0);
    expect(await dataSource.getRepository(Pedido).count()).toBe(0);

    // Encomenda só de frito não gera aviso na regra de assados.
    await criarEncomendaConfirmada({
      itens: [
        { produtoId: cenario.coxinha.id, preparo: 'FRITO', unidadeVenda: 'CENTO', quantidade: 1 },
      ],
    });
    expect(await dataSource.getRepository(OutboxNotificacao).count()).toBe(0);

    // Encomenda mista com assado gera aviso imediato (disponivel_em imediato) sem PII.
    const misto = await criarEncomendaConfirmada();
    const registros = await dataSource.getRepository(OutboxNotificacao).find();
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      tipoEvento: 'AVISO_IMEDIATO',
      status: 'PENDENTE',
      pedidoId: misto.id,
      pedidoRevisao: 1,
    });
    expect(registros[0]?.textoRenderizado).toContain('• *100 Esfiha de carne (assado)*');
    expect(registros[0]?.textoRenderizado).toContain('• 50 Coxinha de frango (frito)');
    expect(registros[0]?.textoRenderizado).not.toContain('Ana Paula');
  });

  it('ignora edições não notificáveis, aplica debounce substituindo pendências e nunca dispara ao concluir', async () => {
    await ligarRegra('AVISO_IMEDIATO', { debounceSegundos: 30 });
    const pedido = await criarEncomendaConfirmada();

    // Despacha o aviso inicial (rev 1).
    const primeiro = await despachante.processarPendentes({ agora: new Date(Date.now() + 1000) });
    expect(primeiro.enviados).toBe(1);

    // Edições não notificáveis (desconto, observação, endereço, produtor, pagamento) não geram outbox.
    await membro
      .patch(`/pedidos/${pedido.id}`, {
        descontoCentavos: 1000,
        observacao: 'Nova observação interna',
        enderecoEntrega: 'Outro endereço',
      })
      .expect(200);
    const itemAssado = pedido.itens.find((item) => item.preparo === 'ASSADO');
    if (!itemAssado) throw new Error('Item assado ausente');
    await membro
      .patch(`/pedidos/${pedido.id}/itens/${itemAssado.id}`, {
        produtorId: cenario.celia.id,
        observacao: 'Sem cebola',
      })
      .expect(200);
    await membro
      .post(`/pedidos/${pedido.id}/pagamentos`, { forma: 'PIX', valorCentavos: 5000 })
      .expect(201);

    expect(await dataSource.getRepository(OutboxNotificacao).count()).toBe(1);

    // Duas edições notificáveis seguidas: a primeira fica SUBSTITUIDO e só a última é despachada após debounce.
    await membro.patch(`/pedidos/${pedido.id}`, { horarioEntrega: '19:00' }).expect(200);
    await membro
      .patch(`/pedidos/${pedido.id}/itens/${itemAssado.id}`, { quantidade: 1.5 })
      .expect(200);

    const fila = await dataSource.getRepository(OutboxNotificacao).find({
      order: { pedidoRevisao: 'ASC' },
    });
    expect(fila.map((item) => [item.pedidoRevisao, item.tipoEvento, item.status])).toEqual([
      [1, 'AVISO_IMEDIATO', 'ACEITO'],
      [2, 'CORRECAO', 'SUBSTITUIDO'],
      [3, 'CORRECAO', 'PENDENTE'],
    ]);

    // Antes dos 30s de debounce não despacha.
    const cedo = await despachante.processarPendentes({ agora: new Date() });
    expect(cedo.enviados).toBe(0);

    // Após 35s despacha apenas a revisão 3.
    const depois = await despachante.processarPendentes({ agora: new Date(Date.now() + 35_000) });
    expect(depois.enviados).toBe(1);
    expect(conector.enviados[1]?.texto).toContain('19:00');
    expect(conector.enviados[1]?.texto).toContain('• *150 Esfiha de carne (assado)*');

    // Concluir pedido nunca gera aviso imediato.
    await membro.patch(`/pedidos/${pedido.id}/status`, { status: 'CONCLUIDO' }).expect(200);
    expect(await dataSource.getRepository(OutboxNotificacao).count()).toBe(3);
  });

  it('gera resumo diário em America/Sao_Paulo com concluídos sinalizados, omite vazio, trata expiração e deduplica complemento + imediato', async () => {
    await ligarRegra('RESUMO_DIARIO', {
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      horarioResumo: '07:00',
      toleranciaAtrasoMinutos: 120,
      omitirDiasVazios: true,
      incluirConcluidos: true,
      enviarComplementos: true,
    });

    // Dia vazio (2026-10-01 07:30 BRT = 10:30 UTC): omitido sem criar outbox.
    const vazio = await agendador.processarResumosDoDia(new Date('2026-10-01T10:30:00.000Z'));
    expect(vazio).toEqual({ agendados: 0, expirados: 0, omitidos: 1 });
    expect(await dataSource.getRepository(OutboxNotificacao).count()).toBe(0);

    // Cria encomenda para 2026-10-02 e conclui antes do resumo.
    const concluido = await criarEncomendaConfirmada({
      dataEntrega: '2026-10-02',
      horarioEntrega: '11:30',
      tipoEntrega: 'RETIRADA',
    });
    await membro.patch(`/pedidos/${concluido.id}/status`, { status: 'CONCLUIDO' }).expect(200);

    // 2026-10-02 07:30 BRT (10:30 UTC): dentro da janela -> gera resumo sinalizando (concluído).
    const diaCheio = await agendador.processarResumosDoDia(new Date('2026-10-02T10:30:00.000Z'));
    expect(diaCheio).toEqual({ agendados: 1, expirados: 0, omitidos: 0 });
    const resumo = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      tipoEvento: 'RESUMO_DIARIO',
    });
    expect(resumo.status).toBe('PENDENTE');
    expect(resumo.textoRenderizado).toContain('(concluído)');
    expect(resumo.textoRenderizado).toContain('• *100 Esfiha de carne (assado)*');
    expect(resumo.textoRenderizado).not.toContain('Coxinha');
    expect(await dataSource.getRepository(ResumoEnviadoPedido).count()).toBe(1);

    // Liga também AVISO_IMEDIATO para o mesmo destino e cria nova encomenda para 2026-10-02:
    // a chave unificada garante exatamente UMA notificação (sem duplicar imediato + complemento).
    await ligarRegra('AVISO_IMEDIATO');
    const novaDoDia = await criarEncomendaConfirmada({
      dataEntrega: '2026-10-02',
      horarioEntrega: '19:00',
    });
    const doPedido = await dataSource.getRepository(OutboxNotificacao).findBy({
      pedidoId: novaDoDia.id,
    });
    expect(doPedido).toHaveLength(1);

    // Dia seguinte às 10:00 BRT (13:00 UTC), após janela de 120 min (07:00 + 2h = 09:00):
    // marca resumo como EXPIRADO sem enviar sozinho.
    await criarEncomendaConfirmada({ dataEntrega: '2026-10-03', horarioEntrega: '12:00' });
    const atrasado = await agendador.processarResumosDoDia(new Date('2026-10-03T13:00:00.000Z'));
    expect(atrasado).toEqual({ agendados: 0, expirados: 1, omitidos: 0 });
    const expirado = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      tipoEvento: 'RESUMO_DIARIO',
      dataReferencia: '2026-10-03',
    });
    expect(expirado.status).toBe('EXPIRADO');
  });

  it('evita duplicação com workers concorrentes (SKIP LOCKED), recupera lease expirado, protege INCERTO e trata reconexão', async () => {
    await ligarRegra('AVISO_IMEDIATO');
    await criarEncomendaConfirmada();
    await criarEncomendaConfirmada({ horarioEntrega: '19:30' });

    // Dois workers rodando em paralelo só podem enviar cada mensagem uma única vez.
    const agora = new Date(Date.now() + 1000);
    const [w1, w2] = await Promise.all([
      despachante.processarPendentes({ workerId: 'worker-a', limite: 2, agora }),
      despachante.processarPendentes({ workerId: 'worker-b', limite: 2, agora }),
    ]);
    expect(w1.enviados + w2.enviados).toBe(2);
    expect(conector.enviados).toHaveLength(2);

    // Simula timeout incerto: vira INCERTO e nunca é reenviado automaticamente.
    conector.enfileirarResultado({ tipo: 'INCERTO', mensagem: 'Timeout após envio ao gateway.' });
    await criarEncomendaConfirmada({ horarioEntrega: '20:00' });
    const resIncerto = await despachante.processarPendentes({
      agora: new Date(Date.now() + 2000),
    });
    expect(resIncerto.incertos).toBe(1);

    const incerto = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      status: 'INCERTO',
    });
    const segundaTentativaAuto = await despachante.processarPendentes({
      agora: new Date(Date.now() + 120_000),
    });
    expect(segundaTentativaAuto.processados).toBe(0);

    // Administrador reconcilia com REENVIAR (auditado sem expor textoRenderizado no snapshot).
    await admin
      .post(`/automacoes/historico/${incerto.id}/reconciliar`, { acao: 'REENVIAR' })
      .expect(200);
    const logsAuditoria = await dataSource.getRepository(LogAuditoria).findBy({
      entidade: 'outbox_notificacao',
      entidadeId: incerto.id,
    });
    expect(logsAuditoria).toHaveLength(1);
    expect(logsAuditoria[0]?.dadosDepois?.['textoRenderizado']).toBeUndefined();

    // Simula lease travado de um worker que caiu há 2 minutos: novo worker recupera e entrega.
    await dataSource.getRepository(OutboxNotificacao).update(incerto.id, {
      reservadoPor: 'worker-morto',
      reservadoAte: new Date(Date.now() - 120_000),
    });
    const recuperado = await despachante.processarPendentes({
      workerId: 'worker-novo',
      agora: new Date(Date.now() + 5000),
    });
    expect(recuperado.enviados).toBe(1);

    // Simula sessão desconectada: pausa sem queimar tentativas, copia manual e retoma.
    conector.definirEstado('DESCONECTADO');
    await criarEncomendaConfirmada({ horarioEntrega: '21:00' });
    const desconectado = await despachante.processarPendentes({
      agora: new Date(Date.now() + 10_000),
    });
    expect(desconectado.pausado).toBe(true);
    const pendenteAposQueda = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      status: 'PENDENTE',
    });
    expect(pendenteAposQueda.tentativas).toBe(0);

    await admin.post(`/automacoes/historico/${pendenteAposQueda.id}/copiado`, {}).expect(200);
    conector.definirEstado('SIMULADO');
    await admin.post('/automacoes/conexao/retomar', {}).expect(200);
    const retomado = await despachante.processarPendentes({
      agora: new Date(Date.now() + 15_000),
    });
    expect(retomado.enviados).toBe(1);
  });

  it('valida HMAC no listener privado de webhook, confirma entrega via message.ack e aplica retenção 30/90 dias', async () => {
    const regraId = await ligarRegra('AVISO_IMEDIATO');
    const teste = dadosDe<{ id: string }>(
      await admin.post(`/automacoes/regras/${regraId}/simular`, {}).expect(200),
    );
    const registro = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      id: teste.id,
    });
    expect(registro.status).toBe('ACEITO');
    expect(registro.idExterno).toBeTruthy();

    const segredo = 'segredo-webhook-teste-integracao-0123456789';
    const servidor = criarServidorWebhookPrivado(app.get(WebhookNotificacoesService), segredo);
    await new Promise<void>((resolve) => {
      servidor.listen(0, '127.0.0.1', resolve);
    });
    const porta = (servidor.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${String(porta)}/webhooks/whatsapp`;

    try {
      const corpoAck = JSON.stringify({
        event: 'message.ack',
        payload: { message_id: registro.idExterno, ack: 2 },
      });

      // Assinatura inválida retorna 401.
      const recusado = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=invalida' },
        body: corpoAck,
      });
      expect(recusado.status).toBe(401);

      // Assinatura HMAC válida promove ACEITO -> ENTREGUE.
      const hmacAck = createHmac('sha256', segredo).update(corpoAck).digest('hex');
      const aceito = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': `sha256=${hmacAck}`,
        },
        body: corpoAck,
      });
      expect(aceito.status).toBe(200);

      const atualizado = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
        id: teste.id,
      });
      expect(atualizado.status).toBe('ENTREGUE');
      expect(atualizado.entregueEm).toBeInstanceOf(Date);

      // Evento device.logged_out pausa e marca estado DESCONECTADO.
      const corpoLogout = JSON.stringify({
        event: 'device.logged_out',
        payload: { reason: 'Aparelho desconectado' },
      });
      const hmacLogout = createHmac('sha256', segredo).update(corpoLogout).digest('hex');
      const resLogout = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': `sha256=${hmacLogout}`,
        },
        body: corpoLogout,
      });
      expect(resLogout.status).toBe(200);

      const estado = await dataSource
        .getRepository(EstadoConectorNotificacao)
        .findOneByOrFail({ canal: 'WHATSAPP' });
      expect(estado.estado).toBe('DESCONECTADO');
      expect(estado.pausado).toBe(true);
    } finally {
      await new Promise<void>((resolve) => {
        servidor.close(() => {
          resolve();
        });
      });
    }

    // Retenção: 40 dias limpa texto; 100 dias remove registro; chave de idempotência vencida é apagada.
    const pedido = await criarEncomendaConfirmada();
    await dataSource.getRepository(ChaveIdempotencia).save(
      dataSource.getRepository(ChaveIdempotencia).create({
        usuarioId:
          (await dataSource.query<{ id: string }[]>('SELECT id FROM usuarios LIMIT 1'))[0]?.id ??
          '',
        rota: 'POST /pedidos/confirmados',
        chave: 'chave-antiga-expirada',
        hashRequisicao: 'a'.repeat(64),
        pedidoId: pedido.id,
        expiraEm: new Date(Date.now() - 60_000),
      }),
    );

    const quarentaDiasAtras = new Date(Date.now() - 40 * 86_400_000);
    await dataSource.query('UPDATE outbox_notificacoes SET criado_em = $1 WHERE id = $2', [
      quarentaDiasAtras,
      teste.id,
    ]);

    const retencao1 = await limpeza.executar();
    expect(retencao1.textosLimpos).toBe(1);
    expect(retencao1.outboxRemovidos).toBe(0);
    expect(retencao1.chavesIdempotenciaRemovidas).toBe(1);

    const textoLimpo = await dataSource.getRepository(OutboxNotificacao).findOneByOrFail({
      id: teste.id,
    });
    expect(textoLimpo.textoRenderizado).toBeNull();

    const cemDiasAtras = new Date(Date.now() - 100 * 86_400_000);
    await dataSource.query('UPDATE outbox_notificacoes SET criado_em = $1 WHERE id = $2', [
      cemDiasAtras,
      teste.id,
    ]);
    const retencao2 = await limpeza.executar();
    expect(retencao2.outboxRemovidos).toBe(1);
    expect(
      await dataSource.getRepository(OutboxNotificacao).findOneBy({ id: teste.id }),
    ).toBeNull();
  });
});
