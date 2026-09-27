// Valores monetários trafegam na aplicação como inteiros em centavos. Somar
// números de ponto flutuante acumula erro de arredondamento, e o driver do
// PostgreSQL devolve `numeric` como texto justamente para não perder precisão.
declare const marcaCentavos: unique symbol;

export type Centavos = number & { readonly [marcaCentavos]: true };

// Até 13 dígitos inteiros: o valor em centavos continua abaixo de
// Number.MAX_SAFE_INTEGER e a aritmética inteira permanece exata.
const FORMATO_DECIMAL = /^(-?)(\d{1,13})(?:\.(\d{1,2}))?$/;

export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Valor em centavos precisa ser um inteiro seguro; recebido: ${valor}.`);
  }
  return valor as Centavos;
}

export const ZERO_CENTAVOS = centavos(0);

export function decimalParaCentavos(texto: string): Centavos {
  const correspondencia = FORMATO_DECIMAL.exec(texto.trim());
  if (!correspondencia) {
    throw new RangeError(`Valor monetário inválido: "${texto}".`);
  }
  const [, sinal = '', inteiro = '0', fracao = ''] = correspondencia;
  const valor = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return centavos(sinal === '-' ? -valor : valor);
}

export function centavosParaDecimal(valor: Centavos): string {
  const absoluto = Math.abs(valor);
  const reais = Math.trunc(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${valor < 0 ? '-' : ''}${reais}.${resto}`;
}

/** "R$ 1.234,50", para mensagens ao usuário. */
export function formatarReais(valor: Centavos): string {
  const [inteiro = '0', fracao = '00'] = centavosParaDecimal(valor).replace('-', '').split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}R$ ${comMilhar},${fracao}`;
}

export function somar(...valores: readonly Centavos[]): Centavos {
  return centavos(valores.reduce<number>((acumulado, valor) => acumulado + valor, 0));
}

export function subtrair(minuendo: Centavos, subtraendo: Centavos): Centavos {
  return centavos(minuendo - subtraendo);
}

export function multiplicar(valor: Centavos, quantidade: number): Centavos {
  if (!Number.isInteger(quantidade)) {
    throw new RangeError(`Quantidade precisa ser inteira; recebida: ${quantidade}.`);
  }
  return centavos(valor * quantidade);
}

/**
 * Distribui um total inteiro proporcionalmente aos pesos pelo método do maior
 * resto. Cada parte recebe o piso de `total * peso / somaDosPesos`; as unidades
 * que sobram vão, uma a uma, para as maiores frações descartadas (empate
 * resolvido pela ordem de entrada). A soma das partes é sempre igual ao total.
 *
 * Os produtos intermediários usam BigInt porque `total * peso` pode passar de
 * Number.MAX_SAFE_INTEGER mesmo com valores reais plausíveis.
 */
export function ratearInteiro(total: number, pesos: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError('O total do rateio precisa ser um inteiro não negativo.');
  }
  if (pesos.some((peso) => !Number.isSafeInteger(peso) || peso < 0)) {
    throw new RangeError('Os pesos do rateio precisam ser inteiros não negativos.');
  }

  const somaDosPesos = pesos.reduce((soma, peso) => soma + BigInt(peso), 0n);
  if (somaDosPesos === 0n) {
    if (total !== 0) {
      throw new RangeError('Não é possível ratear um total positivo sem pesos positivos.');
    }
    return pesos.map(() => 0);
  }

  const totalGrande = BigInt(total);
  const partes = pesos.map((peso, indice) => {
    const produto = totalGrande * BigInt(peso);
    return { indice, valor: produto / somaDosPesos, resto: produto % somaDosPesos };
  });

  let sobra = totalGrande - partes.reduce((soma, parte) => soma + parte.valor, 0n);
  const porMaiorResto = [...partes].sort((a, b) => {
    if (a.resto === b.resto) return a.indice - b.indice;
    return a.resto > b.resto ? -1 : 1;
  });
  for (const parte of porMaiorResto) {
    if (sobra === 0n) break;
    parte.valor += 1n;
    sobra -= 1n;
  }

  return partes.map((parte) => Number(parte.valor));
}

export function ratearCentavos(total: Centavos, pesos: readonly Centavos[]): Centavos[] {
  return ratearInteiro(total, pesos).map(centavos);
}
