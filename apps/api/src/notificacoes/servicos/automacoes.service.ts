import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.errors.js';
import { Paginated } from '../../common/pagination/pagination.js';
import { ItemPedido } from '../../pedidos/itens/item-pedido.entity.js';
import { Pedido } from '../../pedidos/pedido.entity.js';
import { CONECTOR_WHATSAPP, type ConectorWhatsApp } from '../conector/conector-whatsapp.js';
import { TransporteSimuladoConector } from '../conector/transporte-simulado.conector.js';
import { obterDataHoraLocal } from '../dominio/calendario.js';
import { formatarAvisoPedido, formatarResumoDiario } from '../dominio/formatacao.js';
import { type ProjecaoPedido, projetarPedido } from '../dominio/projecao.js';
import {
  encomendaCorrespondeARegra,
  itensParaMensagem,
  preparosDestacadosDaRegra,
} from '../dominio/regras.js';
import type {
  AtualizarDestinoDto,
  AtualizarRegraDto,
  CriarDestinoDto,
  FiltroHistoricoNotificacoesDto,
  PausarConexaoDto,
  PreviaRegraDto,
  ReconciliarOutboxDto,
  TestarEnvioRealDto,
} from '../dto/automacoes.dto.js';
import {
  DestinoNotificacaoDto,
  EstadoConexaoDto,
  ItemHistoricoNotificacaoDto,
  type MensagemEquipeResposta,
  type PainelAutomacoesResposta,
  type PreviaRegraResposta,
  RegraNotificacaoDto,
} from '../dto/automacoes-resposta.dto.js';
import { DestinoNotificacao } from '../entities/destino-notificacao.entity.js';
import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { RegraNotificacao } from '../entities/regra-notificacao.entity.js';
import { AgendadorResumosService } from './agendador-resumos.service.js';
import { ConfiguracaoNotificacoesService } from './configuracao-notificacoes.service.js';
import { consumirReciboAntecipado } from './webhook-notificacoes.service.js';

function validarFusoHorario(fuso: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuso });
  } catch {
    throw new BusinessRuleError(
      'FUSO_HORARIO_INVALIDO',
      'Informe um fuso horário IANA válido, como America/Sao_Paulo.',
    );
  }
}

function exemploDePedido(dataLocal: string): ProjecaoPedido {
  return {
    pedidoId: 'exemplo',
    numero: 1043,
    status: 'CONFIRMADO',
    dataEntrega: dataLocal,
    horarioEntrega: '18:30',
    tipoEntrega: 'ENTREGA',
    itens: [
      { produtoId: 'ex-1', produtoNome: 'Esfiha de carne', preparo: 'ASSADO', unidades: 100 },
      { produtoId: 'ex-2', produtoNome: 'Coxinha de frango', preparo: 'FRITO', unidades: 100 },
    ],
  };
}

@Injectable()
export class AutomacoesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configuracao: ConfiguracaoNotificacoesService,
    private readonly agendador: AgendadorResumosService,
    private readonly auditoria: AuditoriaService,
    @Inject(CONECTOR_WHATSAPP) private readonly conector: ConectorWhatsApp,
  ) {}

  async obterPainel(): Promise<PainelAutomacoesResposta> {
    const { estado, destinos, regras } = await this.dataSource.transaction((manager) =>
      this.configuracao.garantirPadroes(manager),
    );

    const contagens = await this.dataSource.query<{ status: string; total: string }[]>(
      `
      SELECT status::text AS status, count(*)::text AS total
      FROM outbox_notificacoes
      WHERE status IN ('PENDENTE', 'INCERTO', 'FALHA')
      GROUP BY status
      `,
    );
    const mapa = new Map(contagens.map((linha) => [linha.status, Number(linha.total)]));

    return {
      estado: EstadoConexaoDto.de(estado),
      destinos: destinos.map((destino) => DestinoNotificacaoDto.de(destino)),
      regras: regras.map((regra) => RegraNotificacaoDto.de(regra)),
      fila: {
        pendentes: mapa.get('PENDENTE') ?? 0,
        incertos: mapa.get('INCERTO') ?? 0,
        falhas: mapa.get('FALHA') ?? 0,
      },
    };
  }

  criarDestino(dados: CriarDestinoDto, autorId: string): Promise<DestinoNotificacaoDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.configuracao.garantirPadroes(manager);
      const repo = manager.getRepository(DestinoNotificacao);
      const salvo = await repo.save(
        repo.create({
          nome: dados.nome,
          canal: 'WHATSAPP',
          identificadorExterno: dados.identificadorExterno ?? null,
          ativo: dados.ativo ?? true,
          aprovadoEm: dados.identificadorExterno ? new Date() : null,
          aprovadoPorId: dados.identificadorExterno ? autorId : null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'destino_notificacao',
        entidadeId: salvo.id,
        acao: 'CRIACAO',
        antes: null,
        depois: salvo,
        usuarioId: autorId,
      });
      return DestinoNotificacaoDto.de(salvo);
    });
  }

  atualizarDestino(
    id: string,
    dados: AtualizarDestinoDto,
    autorId: string,
  ): Promise<DestinoNotificacaoDto> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DestinoNotificacao);
      const destino = await repo.findOneBy({ id });
      if (!destino) throw new NotFoundError('Destino');

      const antes = Object.assign(new DestinoNotificacao(), destino);
      if (dados.nome !== undefined) destino.nome = dados.nome;
      if (dados.identificadorExterno !== undefined) {
        destino.identificadorExterno = dados.identificadorExterno;
      }
      if (dados.ativo !== undefined) destino.ativo = dados.ativo;
      if (dados.aprovar === true) {
        if (!destino.identificadorExterno) {
          throw new BusinessRuleError(
            'DESTINO_SEM_IDENTIFICADOR',
            'Informe o identificador do grupo antes de aprovar o destino.',
          );
        }
        destino.aprovadoEm = new Date();
        destino.aprovadoPorId = autorId;
      } else if (dados.aprovar === false) {
        destino.aprovadoEm = null;
        destino.aprovadoPorId = null;
      }

      const salvo = await repo.save(destino);

      const mudouGrupo = antes.identificadorExterno !== salvo.identificadorExterno;
      const desativouDestino = antes.ativo && !salvo.ativo;
      if (mudouGrupo || desativouDestino) {
        await manager
          .createQueryBuilder()
          .update(OutboxNotificacao)
          .set({
            status: 'CANCELADO',
            ultimoErro: mudouGrupo
              ? 'Grupo do destino alterado antes do envio.'
              : 'Destino desativado antes do envio.',
            reservadoAte: null,
            reservadoPor: null,
          })
          .where('destino_id = :destinoId', { destinoId: salvo.id })
          .andWhere('status = :status', { status: 'PENDENTE' })
          .andWhere('envio_iniciado_em IS NULL')
          .execute();
      }

      await this.auditoria.registrar(manager, {
        entidade: 'destino_notificacao',
        entidadeId: salvo.id,
        acao: 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return DestinoNotificacaoDto.de(salvo);
    });
  }

  atualizarRegra(
    id: string,
    dados: AtualizarRegraDto,
    autorId: string,
  ): Promise<RegraNotificacaoDto> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RegraNotificacao);
      const regra = await repo.findOne({ where: { id }, relations: { destino: true } });
      if (!regra) throw new NotFoundError('Regra de notificação');

      const antes = Object.assign(new RegraNotificacao(), regra);
      if (dados.nome !== undefined) regra.nome = dados.nome;
      if (dados.ativa !== undefined) regra.ativa = dados.ativa;
      if (dados.destinoId !== undefined && dados.destinoId !== regra.destinoId) {
        const destino = await manager.getRepository(DestinoNotificacao).findOneBy({
          id: dados.destinoId,
        });
        if (!destino) throw new NotFoundError('Destino');
        regra.destinoId = destino.id;
        regra.destino = destino;
      }
      if (dados.filtroEncomenda !== undefined) regra.filtroEncomenda = dados.filtroEncomenda;
      if (dados.preparos !== undefined) regra.preparos = [...dados.preparos];
      if (dados.modalidades !== undefined) regra.modalidades = [...dados.modalidades];
      if (dados.escopoItens !== undefined) regra.escopoItens = dados.escopoItens;
      if (dados.enviarCorrecoes !== undefined) regra.enviarCorrecoes = dados.enviarCorrecoes;
      if (dados.enviarCancelamentos !== undefined) {
        regra.enviarCancelamentos = dados.enviarCancelamentos;
      }
      if (dados.debounceSegundos !== undefined) regra.debounceSegundos = dados.debounceSegundos;
      if (dados.diasSemana !== undefined) {
        regra.diasSemana = [...dados.diasSemana].sort((a, b) => a - b);
      }
      if (dados.horarioResumo !== undefined) regra.horarioResumo = dados.horarioResumo;
      if (dados.fusoHorario !== undefined) {
        validarFusoHorario(dados.fusoHorario);
        regra.fusoHorario = dados.fusoHorario;
      }
      if (dados.omitirDiasVazios !== undefined) regra.omitirDiasVazios = dados.omitirDiasVazios;
      if (dados.incluirConcluidos !== undefined) regra.incluirConcluidos = dados.incluirConcluidos;
      if (dados.enviarComplementos !== undefined) {
        regra.enviarComplementos = dados.enviarComplementos;
      }
      if (dados.toleranciaAtrasoMinutos !== undefined) {
        regra.toleranciaAtrasoMinutos = dados.toleranciaAtrasoMinutos;
      }

      if (regra.filtroEncomenda === 'POR_PREPARO' && regra.preparos.length === 0) {
        throw new BusinessRuleError(
          'REGRA_SEM_PREPARO',
          'Escolha ao menos um preparo ou troque o filtro para todas as encomendas.',
        );
      }
      if (regra.tipo === 'RESUMO_DIARIO' && regra.ativa) {
        if (!regra.horarioResumo) {
          throw new BusinessRuleError(
            'RESUMO_SEM_HORARIO',
            'Defina o horário antes de ativar o resumo diário.',
          );
        }
        if (regra.diasSemana.length === 0) {
          throw new BusinessRuleError(
            'RESUMO_SEM_DIAS',
            'Escolha ao menos um dia da semana antes de ativar o resumo diário.',
          );
        }
      }
      if (regra.ativa && regra.destino && !regra.destino.ativo) {
        throw new BusinessRuleError(
          'DESTINO_INATIVO',
          'Ative o destino escolhido antes de ligar esta regra.',
        );
      }

      const salvo = await repo.save(regra);

      if (antes.destinoId !== salvo.destinoId) {
        await manager
          .createQueryBuilder()
          .update(OutboxNotificacao)
          .set({
            status: 'CANCELADO',
            ultimoErro: 'Destino da regra alterado antes do envio.',
            reservadoAte: null,
            reservadoPor: null,
          })
          .where('regra_id = :regraId', { regraId: salvo.id })
          .andWhere('status = :status', { status: 'PENDENTE' })
          .andWhere('envio_iniciado_em IS NULL')
          .execute();
      }

      await this.auditoria.registrar(manager, {
        entidade: 'regra_notificacao',
        entidadeId: salvo.id,
        acao: 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });

      const recarregada = await repo.findOne({
        where: { id: salvo.id },
        relations: { destino: true },
      });
      return RegraNotificacaoDto.de(recarregada ?? salvo);
    });
  }

  async gerarPrevia(id: string, dados: PreviaRegraDto = {}): Promise<PreviaRegraResposta> {
    const regra = await this.dataSource
      .getRepository(RegraNotificacao)
      .findOne({ where: { id }, relations: { destino: true } });
    if (!regra) throw new NotFoundError('Regra de notificação');

    const local = obterDataHoraLocal(new Date(), regra.fusoHorario);
    const dataReferencia = dados.data ?? local.data;

    if (regra.tipo === 'RESUMO_DIARIO') {
      const reais = dados.usarExemplo
        ? []
        : await this.agendador.carregarPedidosParaResumo(
            this.dataSource.manager,
            dataReferencia,
            regra,
          );
      if (reais.length > 0) {
        return {
          regraId: regra.id,
          tipo: regra.tipo,
          dataReferencia,
          usouExemplo: false,
          quantidadePedidos: reais.length,
          texto: formatarResumoDiario(
            dataReferencia,
            reais.map((item) => item.entrada),
            { destacarPreparos: preparosDestacadosDaRegra(regra) },
          ),
        };
      }

      const exemplo = exemploDePedido(dataReferencia);
      const itens = itensParaMensagem(exemplo, regra);
      return {
        regraId: regra.id,
        tipo: regra.tipo,
        dataReferencia,
        usouExemplo: true,
        quantidadePedidos: 1,
        texto: formatarResumoDiario(
          dataReferencia,
          [{ projecao: exemplo, itens: itens.length > 0 ? itens : exemplo.itens }],
          { destacarPreparos: preparosDestacadosDaRegra(regra) },
        ),
      };
    }

    if (!dados.usarExemplo) {
      const pedidoRecente = await this.buscarUltimoPedidoElegivel(regra);
      if (pedidoRecente) {
        return {
          regraId: regra.id,
          tipo: regra.tipo,
          dataReferencia: pedidoRecente.dataEntrega,
          usouExemplo: false,
          quantidadePedidos: 1,
          texto: formatarAvisoPedido('AVISO_IMEDIATO', pedidoRecente, {
            itens: itensParaMensagem(pedidoRecente, regra),
            destacarPreparos: preparosDestacadosDaRegra(regra),
          }),
        };
      }
    }

    const exemplo = exemploDePedido(dataReferencia);
    const itens = itensParaMensagem(exemplo, regra);
    return {
      regraId: regra.id,
      tipo: regra.tipo,
      dataReferencia,
      usouExemplo: true,
      quantidadePedidos: 1,
      texto: formatarAvisoPedido('AVISO_IMEDIATO', exemplo, {
        itens: itens.length > 0 ? itens : exemplo.itens,
        destacarPreparos: preparosDestacadosDaRegra(regra),
      }),
    };
  }

  /**
   * Simulação local estritamente segura: usa sempre dados fictícios e um
   * transporte simulado isolado, nunca chama o conector externo nem envia
   * mensagens ao grupo real (independentemente de modo, pausa ou regra ativa).
   */
  async simularRegra(
    id: string,
    dados: PreviaRegraDto,
    autorId: string,
  ): Promise<ItemHistoricoNotificacaoDto> {
    const regra = await this.dataSource
      .getRepository(RegraNotificacao)
      .findOne({ where: { id }, relations: { destino: true } });
    if (!regra) throw new NotFoundError('Regra de notificação');
    if (!regra.destino) throw new NotFoundError('Destino');

    const previa = await this.gerarPrevia(id, { data: dados.data, usarExemplo: true });
    const chave = `simulacao:${regra.id}:${randomUUID()}`;
    const destinoSimulado = 'simulado:previa';
    const transporteFalso = new TransporteSimuladoConector();
    const retorno = await transporteFalso.enviarTexto(destinoSimulado, previa.texto, chave);
    const agora = new Date();

    const salvo = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxNotificacao);
      const registro = await repo.save(
        repo.create({
          chaveDeduplicacao: chave,
          tipoEvento: 'TESTE',
          status: retorno.tipo === 'ENTREGUE' ? 'ENTREGUE' : 'ACEITO',
          regraId: regra.id,
          destinoId: regra.destinoId,
          destinoIdentificadorExterno: destinoSimulado,
          pedidoId: null,
          pedidoRevisao: null,
          dataReferencia: previa.dataReferencia,
          textoRenderizado: previa.texto,
          disponivelEm: agora,
          expiraEm: null,
          envioIniciadoEm: agora,
          reservadoAte: null,
          reservadoPor: null,
          tentativas: 1,
          maxTentativas: 1,
          idExterno:
            retorno.tipo === 'ACEITO' || retorno.tipo === 'ENTREGUE' ? retorno.idExterno : null,
          ultimoErro: null,
          enviadoEm: agora,
          entregueEm: retorno.tipo === 'ENTREGUE' ? agora : null,
          copiadoManualmenteEm: null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'outbox_notificacao',
        entidadeId: registro.id,
        acao: 'CRIACAO',
        antes: null,
        depois: registro,
        usuarioId: autorId,
      });
      return registro;
    });

    salvo.regra = regra;
    salvo.destino = regra.destino;
    return ItemHistoricoNotificacaoDto.de(salvo);
  }

  /**
   * Teste real pelo conector configurado: exige destino explícito (ID e JID
   * conferindo com o cadastro salvo), canal ativo/não pausado/conectado e usa
   * sempre dados fictícios para nunca expor encomendas reais em testes.
   */
  async testarEnvioReal(
    id: string,
    dados: TestarEnvioRealDto,
    autorId: string,
  ): Promise<ItemHistoricoNotificacaoDto> {
    const regra = await this.dataSource.getRepository(RegraNotificacao).findOneBy({ id });
    if (!regra) throw new NotFoundError('Regra de notificação');

    const destino = await this.dataSource.getRepository(DestinoNotificacao).findOneBy({
      id: dados.destinoId,
    });
    if (!destino) throw new NotFoundError('Destino');
    if (!destino.ativo) {
      throw new BusinessRuleError(
        'DESTINO_INATIVO',
        'Ative o destino escolhido antes de enviar um teste real.',
      );
    }
    if (
      !destino.identificadorExterno ||
      destino.identificadorExterno !== dados.identificadorExterno
    ) {
      throw new BusinessRuleError(
        'DESTINO_NAO_CONFERE',
        'O identificador do grupo informado não corresponde ao destino salvo.',
      );
    }

    const { estado } = await this.dataSource.transaction((manager) =>
      this.configuracao.garantirPadroes(manager),
    );
    if (estado.modo === 'DESLIGADO') {
      throw new BusinessRuleError(
        'CANAL_DESLIGADO',
        'O canal de notificações está desligado e não aceita envios reais.',
      );
    }
    if (estado.pausado) {
      throw new BusinessRuleError(
        'CANAL_PAUSADO',
        'Retome os envios do canal antes de enviar um teste real.',
      );
    }
    if (estado.estado === 'DESCONECTADO') {
      throw new BusinessRuleError(
        'CANAL_DESCONECTADO',
        'Conecte o WhatsApp antes de enviar um teste real.',
      );
    }

    const previa = await this.gerarPrevia(id, { data: dados.data, usarExemplo: true });
    const chave = `teste-real:${regra.id}:${randomUUID()}`;
    const destinoExterno = destino.identificadorExterno;
    const retorno = await this.conector.enviarTexto(destinoExterno, previa.texto, chave);
    const agora = new Date();

    const salvo = await this.dataSource.transaction(async (manager) => {
      let idExterno: string | null = null;
      let status: OutboxNotificacao['status'];
      let enviadoEm: Date | null = null;
      let entregueEm: Date | null = null;
      let ultimoErro: string | null = null;

      if (retorno.tipo === 'ACEITO' || retorno.tipo === 'ENTREGUE') {
        idExterno = retorno.idExterno.slice(0, 160);
        const reciboAntecipado = await consumirReciboAntecipado(manager, idExterno);
        entregueEm = retorno.tipo === 'ENTREGUE' ? agora : reciboAntecipado;
        status = entregueEm ? 'ENTREGUE' : 'ACEITO';
        enviadoEm = agora;
      } else if (retorno.tipo === 'INCERTO') {
        status = 'INCERTO';
        ultimoErro = retorno.mensagem.slice(0, 500);
      } else {
        status = 'FALHA';
        ultimoErro = retorno.mensagem.slice(0, 500);
      }

      const repo = manager.getRepository(OutboxNotificacao);
      const registro = await repo.save(
        repo.create({
          chaveDeduplicacao: chave,
          tipoEvento: 'TESTE',
          status,
          regraId: regra.id,
          destinoId: destino.id,
          destinoIdentificadorExterno: destinoExterno,
          pedidoId: null,
          pedidoRevisao: null,
          dataReferencia: previa.dataReferencia,
          textoRenderizado: previa.texto,
          disponivelEm: agora,
          expiraEm: null,
          envioIniciadoEm: agora,
          reservadoAte: null,
          reservadoPor: null,
          tentativas: 1,
          maxTentativas: 1,
          idExterno,
          ultimoErro,
          enviadoEm,
          entregueEm,
          copiadoManualmenteEm: null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'outbox_notificacao',
        entidadeId: registro.id,
        acao: 'CRIACAO',
        antes: null,
        depois: registro,
        usuarioId: autorId,
      });
      return registro;
    });

    salvo.regra = regra;
    salvo.destino = destino;
    return ItemHistoricoNotificacaoDto.de(salvo);
  }

  pausarConexao(dados: PausarConexaoDto, autorId: string): Promise<EstadoConexaoDto> {
    return this.dataSource.transaction(async (manager) => {
      const { estado } = await this.configuracao.garantirPadroes(manager);
      const antes = Object.assign(new EstadoConectorNotificacao(), estado);
      estado.pausado = true;
      estado.motivoPausa = dados.motivo ?? 'Envios pausados pelo administrador.';
      if (estado.estado !== 'DESCONECTADO' && estado.estado !== 'DESLIGADO') {
        estado.estado = 'PAUSADO';
      }
      const salvo = await manager.getRepository(EstadoConectorNotificacao).save(estado);
      await this.auditoria.registrar(manager, {
        entidade: 'estado_conector_notificacao',
        entidadeId: salvo.canal,
        acao: 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return EstadoConexaoDto.de(salvo);
    });
  }

  async retomarConexao(autorId: string): Promise<EstadoConexaoDto> {
    const verificado = await this.conector.obterEstado();
    return this.dataSource.transaction(async (manager) => {
      const { estado } = await this.configuracao.garantirPadroes(manager);
      const antes = Object.assign(new EstadoConectorNotificacao(), estado);
      estado.pausado = false;
      estado.motivoPausa = null;
      estado.ultimoErro = null;
      estado.ultimaVerificacaoEm = new Date();
      estado.estado = estado.modo === 'DESLIGADO' ? 'DESLIGADO' : verificado.estado;
      const salvo = await manager.getRepository(EstadoConectorNotificacao).save(estado);
      await this.auditoria.registrar(manager, {
        entidade: 'estado_conector_notificacao',
        entidadeId: salvo.canal,
        acao: 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return EstadoConexaoDto.de(salvo);
    });
  }

  async listarHistorico(
    filtro: FiltroHistoricoNotificacoesDto,
  ): Promise<Paginated<ItemHistoricoNotificacaoDto>> {
    const consulta = this.dataSource
      .getRepository(OutboxNotificacao)
      .createQueryBuilder('outbox')
      .leftJoinAndSelect('outbox.destino', 'destino')
      .leftJoinAndSelect('outbox.regra', 'regra')
      .leftJoinAndSelect('outbox.pedido', 'pedido')
      .orderBy('outbox.criadoEm', 'DESC')
      .addOrderBy('outbox.id', 'DESC')
      .skip(filtro.skip)
      .take(filtro.pageSize);

    if (filtro.status) {
      consulta.andWhere('outbox.status = :status', { status: filtro.status });
    }
    if (filtro.regraId) {
      consulta.andWhere('outbox.regraId = :regraId', { regraId: filtro.regraId });
    }
    if (filtro.data) {
      consulta.andWhere('outbox.dataReferencia = :data', { data: filtro.data });
    }

    const [itens, total] = await consulta.getManyAndCount();
    return Paginated.of(
      itens.map((item) => ItemHistoricoNotificacaoDto.de(item)),
      total,
      filtro,
    );
  }

  reconciliarOutbox(
    id: string,
    dados: ReconciliarOutboxDto,
    autorId: string,
  ): Promise<ItemHistoricoNotificacaoDto> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutboxNotificacao);
      const item = await repo.findOne({
        where: { id },
        relations: { destino: true, regra: true, pedido: true },
      });
      if (!item) throw new NotFoundError('Registro de notificação');

      const antes = Object.assign(new OutboxNotificacao(), item);
      const agora = new Date();

      if (dados.acao === 'MARCAR_ENTREGUE') {
        if (!['INCERTO', 'ACEITO', 'FALHA', 'EXPIRADO'].includes(item.status)) {
          throw new BusinessRuleError(
            'RECONCILIACAO_NAO_PERMITIDA',
            'Este registro não pode ser marcado como entregue no estado atual.',
          );
        }
        item.status = 'ENTREGUE';
        item.entregueEm = agora;
        item.ultimoErro = null;
        item.reservadoAte = null;
        item.reservadoPor = null;
      } else {
        if (item.tipoEvento === 'TESTE') {
          throw new BusinessRuleError(
            'REENVIO_NAO_PERMITIDO',
            'Simulações e testes não podem ser reenviados pela fila; execute um novo teste.',
          );
        }
        if (!['INCERTO', 'FALHA', 'EXPIRADO'].includes(item.status)) {
          throw new BusinessRuleError(
            'REENVIO_NAO_PERMITIDO',
            'Somente registros incertos, expirados ou com falha podem ser reenviados.',
          );
        }
        if (!item.textoRenderizado) {
          throw new BusinessRuleError(
            'TEXTO_NAO_DISPONIVEL',
            'O texto deste registro já foi removido pela política de retenção.',
          );
        }
        if (
          !item.destino?.ativo ||
          !item.destino.identificadorExterno ||
          !item.destinoIdentificadorExterno ||
          item.destinoIdentificadorExterno !== item.destino.identificadorExterno
        ) {
          throw new BusinessRuleError(
            'DESTINO_ALTERADO',
            'O grupo deste destino foi alterado ou desativado desde o enfileiramento; o registro não pode ser reenviado.',
          );
        }
        item.status = 'PENDENTE';
        item.disponivelEm = agora;
        item.expiraEm = null;
        item.envioIniciadoEm = null;
        item.idExterno = null;
        item.tentativas = 0;
        item.ultimoErro = null;
        item.reservadoAte = null;
        item.reservadoPor = null;
      }

      const salvo = await repo.save(item);
      await this.auditoria.registrar(manager, {
        entidade: 'outbox_notificacao',
        entidadeId: salvo.id,
        acao: 'TRANSICAO_STATUS',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return ItemHistoricoNotificacaoDto.de(salvo);
    });
  }

  async registrarCopiaManual(id: string): Promise<ItemHistoricoNotificacaoDto> {
    const repo = this.dataSource.getRepository(OutboxNotificacao);
    const item = await repo.findOne({
      where: { id },
      relations: { destino: true, regra: true, pedido: true },
    });
    if (!item) throw new NotFoundError('Registro de notificação');
    item.copiadoManualmenteEm = new Date();
    const salvo = await repo.save(item);
    return ItemHistoricoNotificacaoDto.de(salvo);
  }

  /**
   * Mensagem operacional para contingência (copiar e colar no grupo da equipe)
   * a partir do detalhe do pedido. Estritamente limitada aos 7 campos permitidos.
   */
  async mensagemParaEquipe(pedidoId: string): Promise<MensagemEquipeResposta> {
    const pedido = await this.dataSource.getRepository(Pedido).findOneBy({ id: pedidoId });
    if (!pedido) throw new NotFoundError('Pedido');

    const itens = await this.dataSource.getRepository(ItemPedido).find({
      where: { pedidoId: pedido.id },
      relations: { produto: true },
      order: { criadoEm: 'ASC', id: 'ASC' },
    });
    const projecao = projetarPedido(
      {
        id: pedido.id,
        numero: pedido.numero,
        status: pedido.status,
        dataEntrega: pedido.dataEntrega,
        horarioEntrega: pedido.horarioEntrega,
        tipoEntrega: pedido.tipoEntrega,
      },
      itens.map((item) => ({
        produtoId: item.produtoId,
        produtoNome: item.produto?.nome ?? 'Produto',
        preparo: item.preparo,
        unidadeVenda: item.unidadeVenda,
        quantidade: item.quantidade,
      })),
    );

    const evento = pedido.status === 'CANCELADO' ? 'CANCELAMENTO' : 'AVISO_IMEDIATO';
    const texto = formatarAvisoPedido(evento, projecao, {
      itens: projecao.itens,
      destacarPreparos: ['ASSADO'],
    });
    return { pedidoId: pedido.id, numero: pedido.numero, texto };
  }

  private async buscarUltimoPedidoElegivel(
    regra: RegraNotificacao,
  ): Promise<ProjecaoPedido | null> {
    const recentes = await this.dataSource.getRepository(Pedido).find({
      where: { status: 'CONFIRMADO' },
      order: { criadoEm: 'DESC' },
      take: 20,
    });
    for (const pedido of recentes) {
      const itens = await this.dataSource.getRepository(ItemPedido).find({
        where: { pedidoId: pedido.id },
        relations: { produto: true },
        order: { criadoEm: 'ASC', id: 'ASC' },
      });
      const projecao = projetarPedido(
        {
          id: pedido.id,
          numero: pedido.numero,
          status: pedido.status,
          dataEntrega: pedido.dataEntrega,
          horarioEntrega: pedido.horarioEntrega,
          tipoEntrega: pedido.tipoEntrega,
        },
        itens.map((item) => ({
          produtoId: item.produtoId,
          produtoNome: item.produto?.nome ?? 'Produto',
          preparo: item.preparo,
          unidadeVenda: item.unidadeVenda,
          quantidade: item.quantidade,
        })),
      );
      if (encomendaCorrespondeARegra(projecao, regra)) return projecao;
    }
    return null;
  }
}
