export const CANAIS_NOTIFICACAO = ['WHATSAPP'] as const;
export type CanalNotificacao = (typeof CANAIS_NOTIFICACAO)[number];

export const TIPOS_REGRA_NOTIFICACAO = ['AVISO_IMEDIATO', 'RESUMO_DIARIO'] as const;
export type TipoRegraNotificacao = (typeof TIPOS_REGRA_NOTIFICACAO)[number];

export const FILTROS_ENCOMENDA_NOTIFICACAO = ['TODAS', 'POR_PREPARO'] as const;
export type FiltroEncomendaNotificacao = (typeof FILTROS_ENCOMENDA_NOTIFICACAO)[number];

export const ESCOPOS_ITENS_MENSAGEM = ['TODOS', 'APENAS_FILTRADOS'] as const;
export type EscopoItensMensagem = (typeof ESCOPOS_ITENS_MENSAGEM)[number];

export const STATUS_ENVIO_NOTIFICACAO = [
  'PENDENTE',
  'ACEITO',
  'ENTREGUE',
  'FALHA',
  'INCERTO',
  'SUBSTITUIDO',
  'EXPIRADO',
  'CANCELADO',
] as const;
export type StatusEnvioNotificacao = (typeof STATUS_ENVIO_NOTIFICACAO)[number];

export const TIPOS_EVENTO_NOTIFICACAO = [
  'AVISO_IMEDIATO',
  'CORRECAO',
  'CANCELAMENTO',
  'RESUMO_DIARIO',
  'COMPLEMENTO',
  'TESTE',
] as const;
export type TipoEventoNotificacao = (typeof TIPOS_EVENTO_NOTIFICACAO)[number];

export const MODOS_CONECTOR_NOTIFICACAO = ['DESLIGADO', 'SIMULADO', 'GOWA', 'WAHA'] as const;
export type ModoConectorNotificacao = (typeof MODOS_CONECTOR_NOTIFICACAO)[number];

export const ESTADOS_CONEXAO_NOTIFICACAO = [
  'DESLIGADO',
  'SIMULADO',
  'CONECTADO',
  'DESCONECTADO',
  'PAUSADO',
] as const;
export type EstadoConexaoNotificacao = (typeof ESTADOS_CONEXAO_NOTIFICACAO)[number];

export const ACOES_RECONCILIACAO_NOTIFICACAO = ['MARCAR_ENTREGUE', 'REENVIAR'] as const;
export type AcaoReconciliacaoNotificacao = (typeof ACOES_RECONCILIACAO_NOTIFICACAO)[number];
