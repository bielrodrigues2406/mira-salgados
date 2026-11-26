import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type {
  AcaoReconciliacaoNotificacao,
  DestinoNotificacao,
  EstadoConexaoNotificacao,
  ItemHistoricoNotificacao,
  PreviaRegra,
  RegraNotificacao,
  StatusEnvioNotificacao,
  TipoEventoNotificacao,
} from '../../core/models/automacoes';
import type { TipoEntrega } from '../../core/models/pedido';
import type { Preparo } from '../../core/models/produto';
import { AutomacoesService } from '../../core/services/automacoes.service';
import { mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { Chip, type TomDoChip } from '../../shared/components/chip/chip';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import type { NomeIcone } from '../../shared/components/icone/icones';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { momentoCurto } from '../../shared/utils/datas';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';

const TAMANHO_HISTORICO = 10;

interface RascunhoDestino {
  nome: string;
  identificadorExterno: string;
  ativo: boolean;
}

interface RascunhoRegra {
  ativa: boolean;
  destinoId: string;
  filtroEncomenda: RegraNotificacao['filtroEncomenda'];
  preparos: Preparo[];
  modalidades: TipoEntrega[];
  escopoItens: RegraNotificacao['escopoItens'];
  enviarCorrecoes: boolean;
  enviarCancelamentos: boolean;
  debounceSegundos: number;
  diasSemana: number[];
  horarioResumo: string;
  fusoHorario: string;
  omitirDiasVazios: boolean;
  incluirConcluidos: boolean;
  enviarComplementos: boolean;
  toleranciaAtrasoMinutos: number;
}

interface AparenciaChip {
  tom: TomDoChip;
  icone: NomeIcone;
  rotulo: string;
}

const APARENCIA_CONEXAO: Record<EstadoConexaoNotificacao, AparenciaChip> = {
  SIMULADO: { tom: 'acao', icone: 'whatsapp', rotulo: 'Modo simulado' },
  CONECTADO: { tom: 'positivo', icone: 'confirmado', rotulo: 'Conectado' },
  PAUSADO: { tom: 'atencao', icone: 'pausado', rotulo: 'Pausado' },
  DESCONECTADO: { tom: 'negativo', icone: 'semConexao', rotulo: 'Desconectado' },
  DESLIGADO: { tom: 'neutro', icone: 'pausado', rotulo: 'Desligado' },
};

const APARENCIA_ENVIO: Record<StatusEnvioNotificacao, AparenciaChip> = {
  PENDENTE: { tom: 'atencao', icone: 'relogio', rotulo: 'Pendente' },
  ACEITO: { tom: 'acao', icone: 'confirmado', rotulo: 'Aceito' },
  ENTREGUE: { tom: 'positivo', icone: 'concluido', rotulo: 'Entregue' },
  INCERTO: { tom: 'atencao', icone: 'alerta', rotulo: 'Incerto' },
  FALHA: { tom: 'negativo', icone: 'alerta', rotulo: 'Falha' },
  EXPIRADO: { tom: 'neutro', icone: 'relogio', rotulo: 'Expirado' },
  SUBSTITUIDO: { tom: 'neutro', icone: 'historico', rotulo: 'Substituído' },
  CANCELADO: { tom: 'neutro', icone: 'cancelado', rotulo: 'Cancelado' },
};

const ROTULO_EVENTO: Record<TipoEventoNotificacao, string> = {
  AVISO_IMEDIATO: 'Aviso imediato',
  CORRECAO: 'Correção',
  CANCELAMENTO: 'Cancelamento',
  RESUMO_DIARIO: 'Resumo diário',
  COMPLEMENTO: 'Complemento',
  TESTE: 'Simulação',
};

const DIAS_SEMANA: readonly { valor: number; curto: string; longo: string }[] = [
  { valor: 0, curto: 'Dom', longo: 'Domingo' },
  { valor: 1, curto: 'Seg', longo: 'Segunda-feira' },
  { valor: 2, curto: 'Ter', longo: 'Terça-feira' },
  { valor: 3, curto: 'Qua', longo: 'Quarta-feira' },
  { valor: 4, curto: 'Qui', longo: 'Quinta-feira' },
  { valor: 5, curto: 'Sex', longo: 'Sexta-feira' },
  { valor: 6, curto: 'Sáb', longo: 'Sábado' },
];

const OPCOES_PREPARO: readonly { valor: Preparo; rotulo: string }[] = [
  { valor: 'ASSADO', rotulo: 'Assado' },
  { valor: 'FRITO', rotulo: 'Frito' },
  { valor: 'CONGELADO', rotulo: 'Congelado' },
];

const OPCOES_MODALIDADE: readonly { valor: TipoEntrega; rotulo: string }[] = [
  { valor: 'ENTREGA', rotulo: 'Entrega' },
  { valor: 'RETIRADA', rotulo: 'Retirada' },
];

const FILTROS_STATUS: readonly { valor: '' | StatusEnvioNotificacao; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos os status' },
  { valor: 'PENDENTE', rotulo: 'Pendentes' },
  { valor: 'ACEITO', rotulo: 'Aceitos' },
  { valor: 'ENTREGUE', rotulo: 'Entregues' },
  { valor: 'INCERTO', rotulo: 'Incertos' },
  { valor: 'FALHA', rotulo: 'Com falha' },
  { valor: 'EXPIRADO', rotulo: 'Expirados' },
  { valor: 'SUBSTITUIDO', rotulo: 'Substituídos' },
];

function rascunhoDeRegra(regra: RegraNotificacao): RascunhoRegra {
  return {
    ativa: regra.ativa,
    destinoId: regra.destinoId,
    filtroEncomenda: regra.filtroEncomenda,
    preparos: [...regra.preparos],
    modalidades: [...regra.modalidades],
    escopoItens: regra.escopoItens,
    enviarCorrecoes: regra.enviarCorrecoes,
    enviarCancelamentos: regra.enviarCancelamentos,
    debounceSegundos: regra.debounceSegundos,
    diasSemana: [...regra.diasSemana],
    horarioResumo: regra.horarioResumo ?? '07:00',
    fusoHorario: regra.fusoHorario,
    omitirDiasVazios: regra.omitirDiasVazios,
    incluirConcluidos: regra.incluirConcluidos,
    enviarComplementos: regra.enviarComplementos,
    toleranciaAtrasoMinutos: regra.toleranciaAtrasoMinutos,
  };
}

function rascunhoDeDestino(destino: DestinoNotificacao): RascunhoDestino {
  return {
    nome: destino.nome,
    identificadorExterno: destino.identificadorExterno ?? '',
    ativo: destino.ativo,
  };
}

/**
 * Painel de automações e notificações (WhatsApp) para administradores:
 * controle do canal, regras independentes (aviso imediato e resumo diário),
 * prévia/simulação e histórico com contingência de cópia e reconciliação.
 */
@Component({
  selector: 'ms-automacoes',
  imports: [Chip, EstadoErro, EstadoVazio, Icone, ListaEsqueleto, Paginacao, RouterLink],
  templateUrl: './automacoes.html',
  styleUrl: './automacoes.css',
})
export class Automacoes {
  private readonly servico = inject(AutomacoesService);

  protected readonly diasSemana = DIAS_SEMANA;
  protected readonly opcoesPreparo = OPCOES_PREPARO;
  protected readonly opcoesModalidade = OPCOES_MODALIDADE;
  protected readonly filtrosStatus = FILTROS_STATUS;
  protected readonly momentoCurto = momentoCurto;

  protected readonly painelRecurso = this.servico.painel();
  protected readonly estadoPainel = estadoDeRecurso(this.painelRecurso, () => false);
  protected readonly painel = computed(() =>
    this.painelRecurso.hasValue() ? this.painelRecurso.value() : undefined,
  );

  protected readonly paginaHistorico = signal(1);
  protected readonly filtroStatus = signal<'' | StatusEnvioNotificacao>('');
  protected readonly historicoRecurso = this.servico.historico(() => ({
    page: this.paginaHistorico(),
    pageSize: TAMANHO_HISTORICO,
    status: this.filtroStatus() || undefined,
  }));
  protected readonly estadoHistorico = estadoDeRecurso(
    this.historicoRecurso,
    ({ itens }) => itens.length === 0,
  );
  protected readonly itensHistorico = computed(() =>
    this.historicoRecurso.hasValue() ? this.historicoRecurso.value().itens : [],
  );
  protected readonly metaHistorico = computed(() =>
    this.historicoRecurso.hasValue() ? this.historicoRecurso.value().meta : undefined,
  );

  protected readonly rascunhoDestino = signal<RascunhoDestino | null>(null);
  protected readonly rascunhosRegras = signal<Record<string, RascunhoRegra>>({});
  protected readonly previa = signal<PreviaRegra | null>(null);
  protected readonly aviso = signal('');
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly ocupacao = signal<string | null>(null);

  constructor() {
    effect(() => {
      const atual = this.painel();
      if (!atual) return;
      const primeiroDestino = atual.destinos[0];
      if (primeiroDestino) {
        this.rascunhoDestino.set(rascunhoDeDestino(primeiroDestino));
      }
      const mapa: Record<string, RascunhoRegra> = {};
      for (const regra of atual.regras) {
        mapa[regra.id] = rascunhoDeRegra(regra);
      }
      this.rascunhosRegras.set(mapa);
    });
  }

  protected aparenciaConexao(estado: EstadoConexaoNotificacao): AparenciaChip {
    return APARENCIA_CONEXAO[estado];
  }

  protected aparenciaEnvio(status: StatusEnvioNotificacao): AparenciaChip {
    return APARENCIA_ENVIO[status];
  }

  protected rotuloEvento(tipo: TipoEventoNotificacao): string {
    return ROTULO_EVENTO[tipo];
  }

  protected rascunhoDaRegra(regra: RegraNotificacao): RascunhoRegra {
    return this.rascunhosRegras()[regra.id] ?? rascunhoDeRegra(regra);
  }

  protected atualizarCampoDestino<K extends keyof RascunhoDestino>(
    campo: K,
    valor: RascunhoDestino[K],
  ): void {
    this.rascunhoDestino.update((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  protected atualizarCampoRegra<K extends keyof RascunhoRegra>(
    regra: RegraNotificacao,
    campo: K,
    valor: RascunhoRegra[K],
  ): void {
    this.rascunhosRegras.update((mapa) => {
      const base = mapa[regra.id] ?? rascunhoDeRegra(regra);
      return { ...mapa, [regra.id]: { ...base, [campo]: valor } };
    });
  }

  protected alternarPreparo(regra: RegraNotificacao, preparo: Preparo): void {
    const atual = this.rascunhoDaRegra(regra);
    const existe = atual.preparos.includes(preparo);
    const proximos = existe
      ? atual.preparos.filter((item) => item !== preparo)
      : [...atual.preparos, preparo];
    this.atualizarCampoRegra(regra, 'preparos', proximos);
  }

  protected alternarModalidade(regra: RegraNotificacao, modalidade: TipoEntrega): void {
    const atual = this.rascunhoDaRegra(regra);
    const existe = atual.modalidades.includes(modalidade);
    const proximas = existe
      ? atual.modalidades.filter((item) => item !== modalidade)
      : [...atual.modalidades, modalidade];
    this.atualizarCampoRegra(regra, 'modalidades', proximas);
  }

  protected alternarDiaSemana(regra: RegraNotificacao, dia: number): void {
    const atual = this.rascunhoDaRegra(regra);
    const existe = atual.diasSemana.includes(dia);
    const proximos = existe
      ? atual.diasSemana.filter((item) => item !== dia)
      : [...atual.diasSemana, dia].sort((a, b) => a - b);
    this.atualizarCampoRegra(regra, 'diasSemana', proximos);
  }

  protected filtrarStatus(valor: string): void {
    this.filtroStatus.set(valor as '' | StatusEnvioNotificacao);
    this.paginaHistorico.set(1);
  }

  protected podeReconciliar(item: ItemHistoricoNotificacao): boolean {
    return item.status === 'INCERTO' || item.status === 'FALHA' || item.status === 'EXPIRADO';
  }

  protected inteiro(valor: string): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
  }

  protected async alternarPausa(): Promise<void> {
    const atual = this.painel()?.estado;
    if (!atual) return;
    await this.executar('conexao', async () => {
      if (atual.pausado) {
        await firstValueFrom(this.servico.retomarConexao());
        this.aviso.set('Envios retomados.');
      } else {
        await firstValueFrom(this.servico.pausarConexao());
        this.aviso.set('Envios pausados.');
      }
      this.painelRecurso.reload();
    });
  }

  protected async salvarDestino(destino: DestinoNotificacao): Promise<void> {
    const rascunho = this.rascunhoDestino();
    if (!rascunho) return;
    await this.executar(`destino:${destino.id}`, async () => {
      await firstValueFrom(
        this.servico.atualizarDestino(destino.id, {
          nome: rascunho.nome,
          identificadorExterno: rascunho.identificadorExterno.trim() || null,
          ativo: rascunho.ativo,
        }),
      );
      this.aviso.set('Destino salvo.');
      this.painelRecurso.reload();
    });
  }

  protected async salvarRegra(regra: RegraNotificacao): Promise<void> {
    const rascunho = this.rascunhoDaRegra(regra);
    await this.executar(`regra:${regra.id}`, async () => {
      await firstValueFrom(
        this.servico.atualizarRegra(regra.id, {
          ativa: rascunho.ativa,
          destinoId: rascunho.destinoId,
          filtroEncomenda: rascunho.filtroEncomenda,
          preparos: rascunho.preparos,
          modalidades: rascunho.modalidades,
          escopoItens: rascunho.escopoItens,
          enviarCorrecoes: rascunho.enviarCorrecoes,
          enviarCancelamentos: rascunho.enviarCancelamentos,
          debounceSegundos: rascunho.debounceSegundos,
          diasSemana: rascunho.diasSemana,
          horarioResumo: regra.tipo === 'RESUMO_DIARIO' ? rascunho.horarioResumo : null,
          fusoHorario: rascunho.fusoHorario,
          omitirDiasVazios: rascunho.omitirDiasVazios,
          incluirConcluidos: rascunho.incluirConcluidos,
          enviarComplementos: rascunho.enviarComplementos,
          toleranciaAtrasoMinutos: rascunho.toleranciaAtrasoMinutos,
        }),
      );
      this.aviso.set(`Regra ${regra.nome} salva.`);
      this.painelRecurso.reload();
    });
  }

  protected async verPrevia(regra: RegraNotificacao): Promise<void> {
    await this.executar(`previa:${regra.id}`, async () => {
      const resultado = await firstValueFrom(this.servico.gerarPrevia(regra.id));
      this.previa.set(resultado);
      this.aviso.set('Prévia atualizada.');
    });
  }

  protected async simular(regra: RegraNotificacao): Promise<void> {
    await this.executar(`simular:${regra.id}`, async () => {
      const registro = await firstValueFrom(this.servico.simularRegra(regra.id));
      if (registro.textoRenderizado) {
        this.previa.set({
          regraId: regra.id,
          tipo: regra.tipo,
          dataReferencia: registro.dataReferencia ?? '',
          usouExemplo: false,
          quantidadePedidos: 1,
          texto: registro.textoRenderizado,
        });
      }
      this.aviso.set('Simulação registrada no histórico.');
      this.painelRecurso.reload();
      this.historicoRecurso.reload();
    });
  }

  protected async reconciliar(
    item: ItemHistoricoNotificacao,
    acao: AcaoReconciliacaoNotificacao,
  ): Promise<void> {
    await this.executar(`reconciliar:${item.id}`, async () => {
      await firstValueFrom(this.servico.reconciliar(item.id, acao));
      this.aviso.set(
        acao === 'MARCAR_ENTREGUE'
          ? 'Registro marcado como entregue.'
          : 'Registro recolocado na fila para reenvio.',
      );
      this.painelRecurso.reload();
      this.historicoRecurso.reload();
    });
  }

  protected async copiarTexto(texto: string, itemId?: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.aviso.set('Mensagem copiada para a área de transferência.');
      if (itemId) {
        await firstValueFrom(this.servico.registrarCopia(itemId));
        this.historicoRecurso.reload();
      }
    } catch {
      this.erroAcao.set('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
    }
  }

  private async executar(chave: string, acao: () => Promise<void>): Promise<void> {
    this.erroAcao.set(null);
    this.ocupacao.set(chave);
    try {
      await acao();
    } catch (falha) {
      this.erroAcao.set(mensagemDeErro(falha));
    } finally {
      this.ocupacao.set(null);
    }
  }
}
