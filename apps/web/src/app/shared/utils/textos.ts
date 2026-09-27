import type { UnidadeVenda } from '../../core/models/produto';

const NUMERO = new Intl.NumberFormat('pt-BR');

/** "1.570" */
export function numero(valor: number): string {
  return NUMERO.format(valor);
}

/** "1 encomenda", "4 encomendas" */
export function contagem(valor: number, singular: string, plural: string): string {
  return `${numero(valor)} ${valor === 1 ? singular : plural}`;
}

/** Como o item foi vendido, abaixo da quantidade em unidades: "2 centos" ou "Avulsas". */
export function rotuloDaVenda(unidadeVenda: UnidadeVenda, quantidade: number): string {
  if (unidadeVenda === 'CENTO') return contagem(quantidade, 'cento', 'centos');
  return quantidade === 1 ? 'Avulsa' : 'Avulsas';
}

/** "3 centos", "1 cento + 50 avulsas", "20 avulsas" */
export function composicao(centos: number, avulsas: number): string {
  const partes: string[] = [];
  if (centos > 0) partes.push(contagem(centos, 'cento', 'centos'));
  if (avulsas > 0) partes.push(contagem(avulsas, 'avulsa', 'avulsas'));
  return partes.join(' + ');
}

/** "pedido #1042", "pedidos #1042 e #1043", "pedidos #1, #2 e #3" */
export function listaDePedidos(numeros: readonly number[]): string {
  const marcados = numeros.map((valor) => `#${String(valor)}`);
  const ultimo = marcados.pop();
  if (ultimo === undefined) return '';
  if (marcados.length === 0) return `pedido ${ultimo}`;
  return `pedidos ${marcados.join(', ')} e ${ultimo}`;
}

/** Décimos de ponto percentual para texto: 568 é "56,8%". */
export function percentualDeDecimos(decimos: number): string {
  return `${String(Math.floor(decimos / 10))},${String(decimos % 10)}%`;
}

/**
 * Percentuais inteiros que somam 100, pelo maior resto, para legendas de
 * barras: arredondar cada um separadamente pode dar 99 ou 101.
 */
export function percentuaisInteiros(valores: readonly number[]): number[] {
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  if (total <= 0) return valores.map(() => 0);
  const partes = valores.map((valor, indice) => {
    const exato = (valor * 100) / total;
    return { indice, piso: Math.floor(exato), resto: exato - Math.floor(exato) };
  });
  let sobra = 100 - partes.reduce((soma, parte) => soma + parte.piso, 0);
  for (const parte of [...partes].sort((a, b) => b.resto - a.resto || a.indice - b.indice)) {
    if (sobra <= 0) break;
    parte.piso += 1;
    sobra -= 1;
  }
  return partes.map((parte) => parte.piso);
}
