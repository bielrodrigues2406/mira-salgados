import type { TipoEntrega } from './pedido';
import type { Preparo } from './produto';

export type CanalNotificacao = 'WHATSAPP';
export type TipoRegraNotificacao = 'AVISO_IMEDIATO' | 'RESUMO_DIARIO';
export type FiltroEncomendaNotificacao = 'TODAS' | 'POR_PREPARO';
export type EscopoItensMensagem = 'TODOS' | 'APENAS_FILTRADOS';
export type StatusEnvioNotificacao =
  | 'PENDENTE'
  | 'ACEITO'
  | 'ENTREGUE'
  | 'FALHA'
  | 'INCERTO'
  | 'SUBSTITUIDO'
  | 'EXPIRADO'
  | 'CANCELADO';
export type TipoEventoNotificacao =
  'AVISO_IMEDIATO' | 'CORRECAO' | 'CANCELAMENTO' | 'RESUMO_DIARIO' | 'COMPLEMENTO' | 'TESTE';
export type ModoConectorNotificacao = 'DESLIGADO' | 'SIMULADO' | 'GOWA' | 'WAHA';
export type EstadoConexaoNotificacao =
  'DESLIGADO' | 'SIMULADO' | 'CONECTADO' | 'DESCONECTADO' | 'PAUSADO';
export type AcaoReconciliacaoNotificacao = 'MARCAR_ENTREGUE' | 'REENVIAR';

export interface EstadoConexao {
  canal: CanalNotificacao;
  modo: ModoConectorNotificacao;
  estado: EstadoConexaoNotificacao;
  pausado: boolean;
  motivoPausa: string | null;
  ultimoErro: string | null;
  ultimaVerificacaoEm: string | null;
  atualizadoEm: string;
}

export interface DestinoNotificacao {
  id: string;
  nome: string;
  canal: CanalNotificacao;
  identificadorExterno: string | null;
  ativo: boolean;
  aprovadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface RegraNotificacao {
  id: string;
  nome: string;
  tipo: TipoRegraNotificacao;
  ativa: boolean;
  destinoId: string;
  destinoNome: string | null;
  filtroEncomenda: FiltroEncomendaNotificacao;
  preparos: Preparo[];
  modalidades: TipoEntrega[];
  escopoItens: EscopoItensMensagem;
  enviarCorrecoes: boolean;
  enviarCancelamentos: boolean;
  debounceSegundos: number;
  diasSemana: number[];
  horarioResumo: string | null;
  fusoHorario: string;
  omitirDiasVazios: boolean;
  incluirConcluidos: boolean;
  enviarComplementos: boolean;
  toleranciaAtrasoMinutos: number;
  atualizadoEm: string;
}

export interface ItemHistoricoNotificacao {
  id: string;
  tipoEvento: TipoEventoNotificacao;
  status: StatusEnvioNotificacao;
  regraId: string | null;
  regraNome: string | null;
  destinoId: string;
  destinoNome: string | null;
  pedidoId: string | null;
  pedidoNumero: number | null;
  pedidoRevisao: number | null;
  dataReferencia: string | null;
  textoRenderizado: string | null;
  tentativas: number;
  maxTentativas: number;
  ultimoErro: string | null;
  disponivelEm: string;
  enviadoEm: string | null;
  entregueEm: string | null;
  copiadoManualmenteEm: string | null;
  criadoEm: string;
}

export interface PainelAutomacoes {
  estado: EstadoConexao;
  destinos: DestinoNotificacao[];
  regras: RegraNotificacao[];
  fila: {
    pendentes: number;
    incertos: number;
    falhas: number;
  };
}

export interface PreviaRegra {
  regraId: string;
  tipo: TipoRegraNotificacao;
  dataReferencia: string;
  usouExemplo: boolean;
  quantidadePedidos: number;
  texto: string;
}

export interface MensagemEquipe {
  pedidoId: string;
  numero: number;
  texto: string;
}

export interface AlteracaoDestino {
  nome?: string;
  identificadorExterno?: string | null;
  ativo?: boolean;
  aprovar?: boolean;
}

export interface AlteracaoRegra {
  nome?: string;
  ativa?: boolean;
  destinoId?: string;
  filtroEncomenda?: FiltroEncomendaNotificacao;
  preparos?: Preparo[];
  modalidades?: TipoEntrega[];
  escopoItens?: EscopoItensMensagem;
  enviarCorrecoes?: boolean;
  enviarCancelamentos?: boolean;
  debounceSegundos?: number;
  diasSemana?: number[];
  horarioResumo?: string | null;
  fusoHorario?: string;
  omitirDiasVazios?: boolean;
  incluirConcluidos?: boolean;
  enviarComplementos?: boolean;
  toleranciaAtrasoMinutos?: number;
}

export interface ConsultaHistoricoNotificacoes {
  page: number;
  pageSize: number;
  status?: StatusEnvioNotificacao;
  regraId?: string;
  data?: string;
}
