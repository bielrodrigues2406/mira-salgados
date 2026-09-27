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
