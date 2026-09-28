export const ACOES_AUDITORIA = [
  'CRIACAO',
  'ATUALIZACAO',
  'DESATIVACAO',
  'TRANSICAO_STATUS',
  'EXCLUSAO',
  'ESTORNO',
  'SENHA_REDEFINIDA',
  'SENHA_TROCADA',
] as const;
export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson };
export type Snapshot = Record<string, ValorJson>;

/** Um registro do histórico, com os nomes legíveis dos ids que ele cita. */
export interface RegistroDeAlteracao {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  dadosAntes: Snapshot | null;
  dadosDepois: Snapshot | null;
  usuarioId: string | null;
  autor: { id: string; nome: string } | null;
  referencias: Record<string, string>;
  criadoEm: string;
}

export interface ConsultaAlteracoes {
  page: number;
  pageSize: number;
  entidade?: string;
  usuarioId?: string;
  /** Instantes ISO: início inclusivo, fim exclusivo. */
  de?: string;
  ate?: string;
}
