/** Arquivo gerado no navegador, pronto para baixar. */
export interface Arquivo {
  nome: string;
  conteudo: string;
  tipo: string;
}

type Celula = string | number | null | undefined;

// Ponto e vírgula e vírgula decimal: é o que o Excel e o Planilhas em
// português abrem direto, em colunas. O BOM faz o Excel ler os acentos em UTF-8.
const SEPARADOR = ';';
const BOM = '﻿';

function celula(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  // Fórmulas começam com =, +, - ou @: um apóstrofo impede a planilha de executá-las.
  const seguro = /^[=+\-@]/.test(texto) && typeof valor === 'string' ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function csv(
  nome: string,
  cabecalho: readonly string[],
  linhas: readonly Celula[][],
): Arquivo {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(celula).join(SEPARADOR));
  return {
    nome: nome.endsWith('.csv') ? nome : `${nome}.csv`,
    conteudo: BOM + conteudo.join('\r\n') + '\r\n',
    tipo: 'text/csv;charset=utf-8',
  };
}

/** 1234,56: valor em reais com vírgula, sem símbolo, para a planilha somar. */
export function reaisNoCsv(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  return `${sinal}${String(Math.trunc(absoluto / 100))},${String(absoluto % 100).padStart(2, '0')}`;
}

/** Dispara o download com um link temporário; nada sai do aparelho. */
export function baixar(arquivo: Arquivo, documento: Document = document): void {
  const url = URL.createObjectURL(new Blob([arquivo.conteudo], { type: arquivo.tipo }));
  const link = documento.createElement('a');
  link.href = url;
  link.download = arquivo.nome;
  documento.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
