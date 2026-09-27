export interface Produtor {
  id: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoProdutor {
  nome: string;
}

export interface AlteracaoProdutor {
  nome?: string;
  ativo?: boolean;
}

export interface ConsultaProdutores {
  page: number;
  pageSize: number;
  ativo?: boolean;
}
