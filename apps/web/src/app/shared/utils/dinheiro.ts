// Valores monetários trafegam em centavos inteiros, como na API. A conversão
// de texto para centavos não passa por ponto flutuante.

const COM_MILHAR = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
const COM_VIRGULA = /^\d+(?:,\d{1,2})?$/;
const COM_PONTO = /^\d+(?:\.\d{1,2})?$/;

function centavosDe(inteiro: string, fracao = ''): number {
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
}

/**
 * Lê um valor digitado em reais: "95", "95,5", "1.234,50" e também "1.20",
 * comum em teclados numéricos. Ponto seguido de três dígitos é separador de
 * milhar ("1.200" são mil e duzentos reais). Devolve null se não for um valor.
 */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '');
  if (COM_MILHAR.test(limpo) || COM_VIRGULA.test(limpo)) {
    const [inteiro = '0', fracao] = limpo.replace(/\./g, '').split(',');
    return centavosDe(inteiro, fracao);
  }
  if (COM_PONTO.test(limpo)) {
    const [inteiro = '0', fracao] = limpo.split('.');
    return centavosDe(inteiro, fracao);
  }
  return null;
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 95,00 */
export function formatarMoeda(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** 95,00, sem símbolo, para preencher campos. */
export function centavosParaTexto(centavos: number): string {
  const reais = Math.trunc(centavos / 100);
  return `${String(reais)},${String(centavos % 100).padStart(2, '0')}`;
}
