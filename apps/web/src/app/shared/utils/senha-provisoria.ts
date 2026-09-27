// Sem letras e números que se confundem ao ditar ou ler no celular (0/o, 1/l/i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const GRUPOS = 3;
const POR_GRUPO = 4;

/**
 * Senha provisória legível, como "k7m2-p9xh-r3wq": 12 caracteres aleatórios de
 * 31 símbolos (cerca de 59 bits), gerados pelo gerador criptográfico do navegador.
 * Vale só até o primeiro acesso, quando a pessoa cria a própria senha.
 */
export function gerarSenhaProvisoria(
  aleatorio: (tamanho: number) => Uint32Array = sortear,
): string {
  const numeros = aleatorio(GRUPOS * POR_GRUPO);
  const caracteres = [...numeros].map((n) => ALFABETO[n % ALFABETO.length] ?? '');
  return Array.from({ length: GRUPOS }, (_, grupo) =>
    caracteres.slice(grupo * POR_GRUPO, (grupo + 1) * POR_GRUPO).join(''),
  ).join('-');
}

function sortear(tamanho: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(tamanho));
}
