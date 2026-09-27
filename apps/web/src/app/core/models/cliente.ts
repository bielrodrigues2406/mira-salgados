export interface Cliente {
  id: string;
  nome: string;
  /** Só dígitos, com DDD. */
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoCliente {
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export interface AlteracaoCliente extends Partial<NovoCliente> {
  ativo?: boolean;
}

export interface ConsultaClientes {
  page: number;
  pageSize: number;
  busca?: string;
  ativo?: boolean;
}
