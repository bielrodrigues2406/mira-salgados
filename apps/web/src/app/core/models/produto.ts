export const PREPAROS = ['FRITO', 'ASSADO', 'CONGELADO'] as const;
export type Preparo = (typeof PREPAROS)[number];

export const UNIDADES_VENDA = ['UNIDADE', 'CENTO'] as const;
export type UnidadeVenda = (typeof UNIDADES_VENDA)[number];

export const ROTULO_UNIDADE: Record<UnidadeVenda, string> = {
  UNIDADE: 'Unidade',
  CENTO: 'Cento',
};

export interface PrecoProduto {
  id: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  precoCentavos: number;
  vigenteDesde: string;
  vigenteAte: string | null;
}

export interface Produto {
  id: string;
  nome: string;
  ativo: boolean;
  produtorPadrao: { id: string; nome: string; ativo: boolean };
  /** Na ordem do cardápio: preparo, depois cento antes de unidade. */
  precosVigentes: PrecoProduto[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoProduto {
  nome: string;
  produtorPadraoId: string;
}

export interface AlteracaoProduto extends Partial<NovoProduto> {
  ativo?: boolean;
}

export interface NovoPreco {
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  precoCentavos: number;
}

export interface ConsultaProdutos {
  page: number;
  pageSize: number;
  ativo?: boolean;
}
