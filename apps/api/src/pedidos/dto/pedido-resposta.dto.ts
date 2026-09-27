import type { ResumoFinanceiro } from '../dominio/calculos.js';
import { subtotalItem } from '../dominio/calculos.js';
import type {
  FormaPagamento,
  StatusPagamento,
  StatusPedido,
  TipoEntrega,
} from '../dominio/enums.js';
import { ehTerminal, transicoesPermitidas } from '../dominio/maquina-de-estados.js';
import { type PedidoAgregado, resumir } from '../agregado-pedido.js';
import type { ItemPedido } from '../itens/item-pedido.entity.js';
import type { Pagamento } from '../pagamentos/pagamento.entity.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';

interface Referencia {
  id: string;
  nome: string;
}

/** "10:30:00" do banco vira "10:30". */
export function horarioCurto(horario: string | null): string | null {
  return horario === null ? null : horario.slice(0, 5);
}

export class ResumoFinanceiroDto {
  subtotalCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  totalPagoCentavos: number;
  totalFiadoCentavos: number;
  saldoDevedorCentavos: number;

  static de(resumo: ResumoFinanceiro): ResumoFinanceiroDto {
    return Object.assign(new ResumoFinanceiroDto(), {
      subtotalCentavos: resumo.subtotal,
      descontoCentavos: resumo.desconto,
      totalCentavos: resumo.total,
      totalPagoCentavos: resumo.totalPago,
      totalFiadoCentavos: resumo.totalFiado,
      saldoDevedorCentavos: resumo.saldoDevedor,
    });
  }
}

export class ItemPedidoDto {
  id: string;
  produto: Referencia;
  produtor: Referencia;
  /** Para a tela indicar quando o item foi trocado de produtor. */
  produtorPadrao: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  precoUnitarioCentavos: number;
  subtotalCentavos: number;
  observacao: string | null;

  static de(item: ItemPedido): ItemPedidoDto {
    const { produto, produtor } = item;
    if (!produto?.produtorPadrao || !produtor) throw new Error('Item sem relações carregadas.');
    return Object.assign(new ItemPedidoDto(), {
      id: item.id,
      produto: { id: produto.id, nome: produto.nome },
      produtor: { id: produtor.id, nome: produtor.nome },
      produtorPadrao: { id: produto.produtorPadrao.id, nome: produto.produtorPadrao.nome },
      preparo: item.preparo,
      unidadeVenda: item.unidadeVenda,
      quantidade: item.quantidade,
      precoUnitarioCentavos: item.precoUnitario,
      subtotalCentavos: subtotalItem(item),
      observacao: item.observacao,
    });
  }
}

export class PagamentoDto {
  id: string;
  forma: FormaPagamento;
  valorCentavos: number;
  registradoPor: Referencia;
  criadoEm: string;
  estornadoEm: string | null;
  estornadoPor: Referencia | null;

  static de(pagamento: Pagamento): PagamentoDto {
    const { registradoPor, estornadoPor } = pagamento;
    if (!registradoPor) throw new Error('Pagamento sem autor carregado.');
    return Object.assign(new PagamentoDto(), {
      id: pagamento.id,
      forma: pagamento.forma,
      valorCentavos: pagamento.valor,
      registradoPor: { id: registradoPor.id, nome: registradoPor.nome },
      criadoEm: pagamento.criadoEm.toISOString(),
      estornadoEm: pagamento.estornadoEm?.toISOString() ?? null,
      estornadoPor: estornadoPor ? { id: estornadoPor.id, nome: estornadoPor.nome } : null,
    });
  }
}

export class PedidoDetalheDto {
  id: string;
  numero: number;
  status: StatusPedido;
  statusPagamento: StatusPagamento;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string | null;
  observacao: string | null;
  cliente: Referencia & { telefone: string | null; endereco: string | null; ativo: boolean };
  registradoPor: Referencia;
  resumo: ResumoFinanceiroDto;
  itens: ItemPedidoDto[];
  /** Todos os lançamentos, inclusive estornados, em ordem de registro. */
  pagamentos: PagamentoDto[];
  /** Próximos estados possíveis, para a tela oferecer só as ações válidas. */
  transicoesPermitidas: readonly StatusPedido[];
  editavel: boolean;
  criadoEm: string;
  atualizadoEm: string;

  static de({ pedido, itens, pagamentos }: PedidoAgregado): PedidoDetalheDto {
    const { cliente, usuario } = pedido;
    if (!cliente || !usuario) throw new Error('Pedido sem relações carregadas.');
    const resumo = resumir(pedido, itens, pagamentos);
    return Object.assign(new PedidoDetalheDto(), {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      statusPagamento: resumo.statusPagamento,
      tipoEntrega: pedido.tipoEntrega,
      dataEntrega: pedido.dataEntrega,
      horarioEntrega: horarioCurto(pedido.horarioEntrega),
      observacao: pedido.observacao,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        ativo: cliente.ativo,
      },
      registradoPor: { id: usuario.id, nome: usuario.nome },
      resumo: ResumoFinanceiroDto.de(resumo),
      itens: itens.map((item) => ItemPedidoDto.de(item)),
      pagamentos: pagamentos.map((pagamento) => PagamentoDto.de(pagamento)),
      transicoesPermitidas: transicoesPermitidas(pedido.status),
      editavel: !ehTerminal(pedido.status),
      criadoEm: pedido.criadoEm.toISOString(),
      atualizadoEm: pedido.atualizadoEm.toISOString(),
    });
  }
}
