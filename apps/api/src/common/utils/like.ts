/**
 * Escapa os curingas do LIKE para buscar o termo literalmente. A consulta deve
 * declarar ESCAPE '\'. Sem isso, "%" digitado na busca listaria tudo e "_"
 * casaria qualquer caractere.
 */
export function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}
