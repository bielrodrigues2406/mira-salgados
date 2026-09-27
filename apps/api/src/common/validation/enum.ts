/** Converte uma lista fixa de valores no objeto que o @IsEnum do class-validator espera. */
export function comoEnum<T extends string>(valores: readonly T[]): Record<T, T> {
  return Object.fromEntries(valores.map((valor) => [valor, valor])) as Record<T, T>;
}
