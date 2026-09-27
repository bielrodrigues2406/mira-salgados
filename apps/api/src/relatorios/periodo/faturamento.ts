import { type Centavos, centavos, somar, subtrair } from '../../common/utils/dinheiro.js';

export interface DiaDeFaturamento {
  /** AAAA-MM-DD */
  data: string;
  quantidadePedidos: number;
  unidades: number;
  /** Itens menos descontos. */
  faturamento: Centavos;
  descontos: Centavos;
  /** DINHEIRO e PIX. */
  recebido: Centavos;
  fiado: Centavos;
}

export interface Faturamento {
  quantidadePedidos: number;
  unidades: number;
  faturamento: Centavos;
  descontos: Centavos;
  recebido: Centavos;
  fiado: Centavos;
  /** Faturado e ainda não recebido em dinheiro ou PIX, fiado incluído (D1). */
  aReceber: Centavos;
  /** Faturamento por pedido, arredondado ao centavo. */
  ticketMedio: Centavos;
  /** Só os dias com pedidos, em ordem de data. */
  porDia: DiaDeFaturamento[];
}

export function resumirFaturamento(dias: readonly DiaDeFaturamento[]): Faturamento {
  const quantidadePedidos = dias.reduce((total, dia) => total + dia.quantidadePedidos, 0);
  const faturamento = somar(...dias.map((dia) => dia.faturamento));
  const recebido = somar(...dias.map((dia) => dia.recebido));
  return {
    quantidadePedidos,
    unidades: dias.reduce((total, dia) => total + dia.unidades, 0),
    faturamento,
    descontos: somar(...dias.map((dia) => dia.descontos)),
    recebido,
    fiado: somar(...dias.map((dia) => dia.fiado)),
    aReceber: subtrair(faturamento, recebido),
    ticketMedio: centavos(
      quantidadePedidos === 0 ? 0 : Math.round(faturamento / quantidadePedidos),
    ),
    porDia: [...dias],
  };
}
