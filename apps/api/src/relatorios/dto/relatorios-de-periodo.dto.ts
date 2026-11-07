import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type { ClienteComFiado } from '../fiados/fiados.service.js';
import type { Faturamento } from '../periodo/faturamento.js';
import type { ItemVendido, ProducaoDoProdutor } from '../periodo/relatorios-de-periodo.service.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class DiaDeFaturamentoDto {
  data: string;
  quantidadePedidos: number;
  faturamentoCentavos: number;
}

export class FaturamentoDto {
  de: string;
  ate: string;
  quantidadePedidos: number;
  unidades: number;
  faturamentoCentavos: number;
  descontosCentavos: number;
  recebidoCentavos: number;
  fiadoCentavos: number;
  aReceberCentavos: number;
  ticketMedioCentavos: number;
  porDia: DiaDeFaturamentoDto[];

  static de(de: string, ate: string, faturamento: Faturamento): FaturamentoDto {
    return Object.assign(new FaturamentoDto(), {
      de,
      ate,
      quantidadePedidos: faturamento.quantidadePedidos,
      unidades: faturamento.unidades,
      faturamentoCentavos: faturamento.faturamento,
      descontosCentavos: faturamento.descontos,
      recebidoCentavos: faturamento.recebido,
      fiadoCentavos: faturamento.fiado,
      aReceberCentavos: faturamento.aReceber,
      ticketMedioCentavos: faturamento.ticketMedio,
      porDia: faturamento.porDia.map((dia) =>
        Object.assign(new DiaDeFaturamentoDto(), {
          data: dia.data,
          quantidadePedidos: dia.quantidadePedidos,
          faturamentoCentavos: dia.faturamento,
        }),
      ),
    });
  }
}

export class ItemVendidoDto {
  posicao: number;
  produto: ReferenciaDto;
  preparo: Preparo;
  unidades: number;
  /** Quantidade vezes preço, antes dos descontos. */
  valorCentavos: number;
  quantidadePedidos: number;

  static de(item: ItemVendido): ItemVendidoDto {
    return Object.assign(new ItemVendidoDto(), {
      posicao: item.posicao,
      produto: { id: item.produto.id, nome: item.produto.nome },
      preparo: item.preparo,
      unidades: item.unidades,
      valorCentavos: item.valor,
      quantidadePedidos: item.quantidadePedidos,
    });
  }
}

export class ProducaoDoProdutorDto {
  produtor: ReferenciaDto;
  unidades: number;
  /** Quantidade vezes preço, antes dos descontos. */
  valorCentavos: number;
  /** O que o produtor tem a receber: o valor com a parte dos descontos, fiado incluído. */
  aReceberCentavos: number;
  quantidadePedidos: number;
  itens: { produto: ReferenciaDto; preparo: Preparo; unidades: number; valorCentavos: number }[];

  static de(producao: ProducaoDoProdutor, aReceber: number): ProducaoDoProdutorDto {
    return Object.assign(new ProducaoDoProdutorDto(), {
      produtor: { id: producao.produtor.id, nome: producao.produtor.nome },
      unidades: producao.unidades,
      valorCentavos: producao.valor,
      aReceberCentavos: aReceber,
      quantidadePedidos: producao.quantidadePedidos,
      itens: producao.itens.map((item) => ({
        produto: { id: item.produto.id, nome: item.produto.nome },
        preparo: item.preparo,
        unidades: item.unidades,
        valorCentavos: item.valor,
      })),
    });
  }
}

export class ClienteComFiadoDto {
  cliente: ReferenciaDto & { telefone: string | null };
  emAbertoCentavos: number;
  desde: string;
  pedidos: { id: string; numero: number; dataEntrega: string; emAbertoCentavos: number }[];

  static de(fiado: ClienteComFiado): ClienteComFiadoDto {
    return Object.assign(new ClienteComFiadoDto(), {
      cliente: {
        id: fiado.cliente.id,
        nome: fiado.cliente.nome,
        telefone: fiado.cliente.telefone,
      },
      emAbertoCentavos: fiado.emAberto,
      desde: fiado.desde,
      pedidos: fiado.pedidos.map((pedido) => ({
        id: pedido.id,
        numero: pedido.numero,
        dataEntrega: pedido.dataEntrega,
        emAbertoCentavos: pedido.emAberto,
      })),
    });
  }
}
