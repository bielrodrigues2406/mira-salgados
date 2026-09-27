const UNIQUE_VIOLATION = '23505';

function driverErrorDe(erro: unknown): Record<string, unknown> | undefined {
  if (typeof erro !== 'object' || erro === null || !('driverError' in erro)) return undefined;
  const { driverError } = erro;
  return typeof driverError === 'object' && driverError !== null
    ? (driverError as Record<string, unknown>)
    : undefined;
}

/**
 * Indica se o erro é a violação de uma restrição de unicidade específica. Os
 * services verificam a duplicidade antes de gravar, mas duas requisições
 * simultâneas podem passar pela verificação; a restrição do banco decide, e
 * este teste permite responder com a mesma mensagem de negócio.
 */
export function ehViolacaoDeUnicidade(erro: unknown, restricao: string): boolean {
  const driverError = driverErrorDe(erro);
  return driverError?.['code'] === UNIQUE_VIOLATION && driverError['constraint'] === restricao;
}
