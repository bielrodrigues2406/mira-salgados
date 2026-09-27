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
