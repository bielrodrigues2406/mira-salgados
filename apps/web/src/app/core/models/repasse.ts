interface Referencia {
  id: string;
  nome: string;
}

export type FormaRepasse = 'PIX' | 'DINHEIRO';

/** Dinheiro entregue a um produtor. Desfeito fica no histórico, fora do saldo. */
export interface Repasse {
  id: string;
  produtor: Referencia;
  valorCentavos: number;
  forma: FormaRepasse;
  /** AAAA-MM-DD */
  data: string;
  observacao: string | null;
  registradoPor: Referencia;
  criadoEm: string;
  desfeitoEm: string | null;
  desfeitoPor: Referencia | null;
}

export interface NovoRepasse {
  produtorId: string;
  valorCentavos: number;
  forma: FormaRepasse;
  data: string;
  observacao?: string | null;
}

export interface ConsultaRepasses {
  page: number;
  pageSize: number;
  produtorId?: string;
}
