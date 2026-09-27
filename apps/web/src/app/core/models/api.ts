// Envelopes definidos pela API (docs/adr/0005-erros-validacao-e-envelope.md).

export interface PaginacaoMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginacaoMeta;
  /** Totais da coleção inteira, nos relatórios paginados. */
  resumo?: unknown;
}

export interface ErroDeCampo {
  field: string;
  messages: string[];
}

export interface ApiErro {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Coleção paginada já desembrulhada do envelope. */
export interface Pagina<T> {
  itens: T[];
  meta: PaginacaoMeta;
}

/** Página de relatório, com os totais do período inteiro. */
export interface PaginaComResumo<T, R> extends Pagina<T> {
  resumo: R;
}
