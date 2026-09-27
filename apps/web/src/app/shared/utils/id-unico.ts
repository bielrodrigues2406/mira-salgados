let contador = 0;

/** Identificador único no documento, para ligar rótulos e descrições (aria-*). */
export function idUnico(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${String(contador)}`;
}
