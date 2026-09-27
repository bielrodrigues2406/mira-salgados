import { SENSITIVE_FIELDS } from '../common/logging/logger.config.js';

export type ValorJson =
  string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson };
export type SnapshotJson = Record<string, ValorJson>;

const CAMPOS_OMITIDOS = new Set<string>([...SENSITIVE_FIELDS, 'tokenHash']);

// O log de auditoria guarda o estado da entidade antes e depois da operação.
// Hashes de senha e tokens nunca entram no snapshot, mesmo que a entidade os
// carregue; datas viram texto ISO para o JSON ficar estável.
export function sanitizarSnapshot(entidade: object | null | undefined): SnapshotJson | null {
  if (entidade === null || entidade === undefined) return null;
  const texto = JSON.stringify(entidade, (chave, valor: unknown) =>
    CAMPOS_OMITIDOS.has(chave) ? undefined : valor,
  );
  return JSON.parse(texto) as SnapshotJson;
}
