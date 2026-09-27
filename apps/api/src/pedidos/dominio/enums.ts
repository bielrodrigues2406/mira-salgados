export const STATUS_PEDIDO = ['RASCUNHO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const TIPOS_ENTREGA = ['RETIRADA', 'ENTREGA'] as const;
export type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

export const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'FIADO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_PAGAMENTO = ['PENDENTE', 'PARCIAL', 'PAGO'] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

/** Estados em que itens, valores e dados de entrega ainda podem mudar. */
export const STATUS_EDITAVEIS: readonly StatusPedido[] = ['RASCUNHO', 'CONFIRMADO'];

/** Estados que contam para saldo devedor, produção e acerto. */
export const STATUS_EM_VIGOR: readonly StatusPedido[] = ['CONFIRMADO', 'CONCLUIDO'];

/** Formas que são dinheiro de fato; o fiado é só um registro de crédito (decisão D1). */
export const FORMAS_LIQUIDAS: readonly FormaPagamento[] = ['DINHEIRO', 'PIX'];
