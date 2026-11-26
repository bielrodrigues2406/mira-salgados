import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type {
  EscopoItensMensagem,
  FiltroEncomendaNotificacao,
  TipoEventoNotificacao,
  TipoRegraNotificacao,
} from './enums.js';
import { hashProjecaoPedido, type ItemProjetado, type ProjecaoPedido } from './projecao.js';

export interface ConfiguracaoRegraNotificacao {
  id: string;
  tipo: TipoRegraNotificacao;
  ativa: boolean;
  destinoId: string;
  filtroEncomenda: FiltroEncomendaNotificacao;
  preparos: readonly Preparo[];
  modalidades: readonly TipoEntrega[];
  escopoItens: EscopoItensMensagem;
  enviarCorrecoes: boolean;
  enviarCancelamentos: boolean;
  debounceSegundos: number;
  diasSemana: readonly number[];
  horarioResumo: string | null;
  fusoHorario: string;
  omitirDiasVazios: boolean;
  incluirConcluidos: boolean;
  enviarComplementos: boolean;
  toleranciaAtrasoMinutos: number;
}

/** Verifica se uma encomenda atende aos filtros de modalidade e preparo da regra. */
export function encomendaCorrespondeARegra(
  projecao: ProjecaoPedido,
  regra: Pick<ConfiguracaoRegraNotificacao, 'filtroEncomenda' | 'preparos' | 'modalidades'>,
): boolean {
  if (projecao.itens.length === 0) return false;
  if (regra.modalidades.length > 0 && !regra.modalidades.includes(projecao.tipoEntrega)) {
    return false;
  }
  if (regra.filtroEncomenda === 'TODAS') return true;
  if (regra.preparos.length === 0) return false;
  return projecao.itens.some((item) => regra.preparos.includes(item.preparo));
}

/** Filtra os itens exibidos na mensagem conforme o escopo escolhido na regra. */
export function itensParaMensagem(
  projecao: ProjecaoPedido,
  regra: Pick<ConfiguracaoRegraNotificacao, 'filtroEncomenda' | 'preparos' | 'escopoItens'>,
): readonly ItemProjetado[] {
  if (regra.escopoItens === 'APENAS_FILTRADOS' && regra.filtroEncomenda === 'POR_PREPARO') {
    return projecao.itens.filter((item) => regra.preparos.includes(item.preparo));
  }
  return projecao.itens;
}

/** Preparos que ganham destaque visual (*negrito*) nas mensagens. */
export function preparosDestacadosDaRegra(
  regra: Pick<ConfiguracaoRegraNotificacao, 'filtroEncomenda' | 'preparos'>,
): readonly Preparo[] {
  if (regra.filtroEncomenda === 'POR_PREPARO' && regra.preparos.length > 0) {
    return regra.preparos;
  }
  return ['ASSADO'];
}

/**
 * Indica se a mudança entre `antes` e `depois` altera o estado notificável do
 * pedido e deve incrementar `notificacao_revisao`.
 *
 * Regras:
 * - Rascunhos puros nunca geram revisão.
 * - Transição `CONFIRMADO -> CONCLUIDO` não gera aviso imediato nem revisão
 *   (o resumo diário consulta o status atual para sinalizar `(concluído)`).
 * - Cancelamento de pedido que nunca foi confirmado não gera revisão.
 */
export function mudancaIncrementaRevisao(
  antes: ProjecaoPedido | null,
  depois: ProjecaoPedido,
): boolean {
  if (depois.status === 'RASCUNHO') return false;
  if (antes?.status === 'CONFIRMADO' && depois.status === 'CONCLUIDO') return false;
  if ((antes === null || antes.status === 'RASCUNHO') && depois.status === 'CANCELADO') {
    return false;
  }
  if (antes === null) return depois.status === 'CONFIRMADO';
  if (antes.status === 'RASCUNHO' && depois.status === 'CONFIRMADO') return true;
  if (antes.status !== 'CONFIRMADO' && depois.status !== 'CONFIRMADO') return false;
  return hashProjecaoPedido(antes) !== hashProjecaoPedido(depois);
}

/**
 * Classifica o tipo de evento imediato (ou null quando nada deve ser enviado)
 * para uma regra `AVISO_IMEDIATO`.
 */
export function classificarEventoImediato(
  antes: ProjecaoPedido | null,
  depois: ProjecaoPedido,
  regra: ConfiguracaoRegraNotificacao,
): Extract<TipoEventoNotificacao, 'AVISO_IMEDIATO' | 'CORRECAO' | 'CANCELAMENTO'> | null {
  if (!regra.ativa || regra.tipo !== 'AVISO_IMEDIATO') return null;
  if (depois.status === 'RASCUNHO') return null;
  if (antes?.status === 'CONFIRMADO' && depois.status === 'CONCLUIDO') return null;

  const antesElegivel =
    antes !== null && antes.status === 'CONFIRMADO' && encomendaCorrespondeARegra(antes, regra);
  const depoisElegivel =
    depois.status === 'CONFIRMADO' && encomendaCorrespondeARegra(depois, regra);

  if (depois.status === 'CANCELADO') {
    return antesElegivel && regra.enviarCancelamentos ? 'CANCELAMENTO' : null;
  }

  if (!antesElegivel && depoisElegivel) {
    return 'AVISO_IMEDIATO';
  }

  if (antesElegivel && !depoisElegivel) {
    return regra.enviarCorrecoes ? 'CORRECAO' : null;
  }

  if (antesElegivel && depoisElegivel) {
    if (hashProjecaoPedido(antes) === hashProjecaoPedido(depois)) return null;
    return regra.enviarCorrecoes ? 'CORRECAO' : null;
  }

  return null;
}

/**
 * Classifica evento de complemento pós-resumo para uma regra `RESUMO_DIARIO`
 * quando já houve resumo enviado para a data de origem ou destino do pedido.
 */
export function classificarEventoComplemento(
  antes: ProjecaoPedido | null,
  depois: ProjecaoPedido,
  regra: ConfiguracaoRegraNotificacao,
  contexto: {
    estavaNoResumo: boolean;
    dataDepoisJaResumida: boolean;
  },
): Extract<TipoEventoNotificacao, 'COMPLEMENTO' | 'CORRECAO' | 'CANCELAMENTO'> | null {
  if (!regra.ativa || regra.tipo !== 'RESUMO_DIARIO' || !regra.enviarComplementos) return null;
  if (depois.status === 'RASCUNHO') return null;
  if (antes?.status === 'CONFIRMADO' && depois.status === 'CONCLUIDO') return null;

  const depoisElegivelNaDataResumida =
    contexto.dataDepoisJaResumida &&
    depois.status === 'CONFIRMADO' &&
    encomendaCorrespondeARegra(depois, regra);

  if (depois.status === 'CANCELADO') {
    return contexto.estavaNoResumo ? 'CANCELAMENTO' : null;
  }

  if (contexto.estavaNoResumo) {
    if (antes && hashProjecaoPedido(antes) === hashProjecaoPedido(depois)) return null;
    return 'CORRECAO';
  }

  if (depoisElegivelNaDataResumida) {
    return 'COMPLEMENTO';
  }

  return null;
}

/**
 * Chave de deduplicação unificada por pedido e destino (omite `regraId` para
 * evitar duplicatas quando aviso imediato e complemento cobrirem a mesma
 * revisão para o mesmo grupo, ADR 0019).
 */
export function chaveDeduplicacaoPedido(
  destinoId: string,
  pedidoId: string,
  revisao: number,
): string {
  return `pedido:${pedidoId}:destino:${destinoId}:rev:${String(revisao)}`;
}

/** Chave de deduplicação de resumo diário agendado. */
export function chaveDeduplicacaoResumo(
  regraId: string,
  destinoId: string,
  dataLocal: string,
): string {
  return `resumo:regra:${regraId}:destino:${destinoId}:data:${dataLocal}`;
}
