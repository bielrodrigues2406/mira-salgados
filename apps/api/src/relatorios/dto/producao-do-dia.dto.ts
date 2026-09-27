import type { StatusPedido, TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import type { ProducaoDoDia } from '../producao/producao-do-dia.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class ItemNaProducaoDto {
  id: string;
  produto: ReferenciaDto;
  produtor: ReferenciaDto;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  unidades: number;
  observacao: string | null;
}

export class PedidoNaProducaoDto {
  id: string;
  numero: number;
  status: StatusPedido;
  tipoEntrega: TipoEntrega;
  observacao: string | null;
  cliente: ReferenciaDto;
  unidades: number;
  itens: ItemNaProducaoDto[];
}

export class FaixaDeHorarioDto {
  /** HH:MM, ou null na faixa dos pedidos sem horário. */
  horario: string | null;
  unidades: number;
  pedidos: PedidoNaProducaoDto[];
}

export class LinhaConsolidadaDto {
  produto: ReferenciaDto;
  produtor: ReferenciaDto;
  unidades: number;
  centos: number;
  avulsas: number;
  pedidos: number[];
}

export class GrupoDePreparoDto {
  preparo: Preparo;
  unidades: number;
  linhas: LinhaConsolidadaDto[];
}

export class ProducaoDoDiaDto {
  data: string;
  quantidadePedidos: number;
  quantidadeProdutores: number;
  unidades: number;
  porPreparo: { preparo: Preparo; unidades: number }[];
  faixas: FaixaDeHorarioDto[];
  consolidado: GrupoDePreparoDto[];

  // Cópia campo a campo: a resposta não carrega nada além do contrato.
  static de(data: string, producao: ProducaoDoDia): ProducaoDoDiaDto {
    return Object.assign(new ProducaoDoDiaDto(), {
      data,
      quantidadePedidos: producao.quantidadePedidos,
      quantidadeProdutores: producao.quantidadeProdutores,
      unidades: producao.unidades,
      porPreparo: producao.porPreparo.map(({ preparo, unidades }) => ({ preparo, unidades })),
      faixas: producao.faixas.map((faixa) =>
        Object.assign(new FaixaDeHorarioDto(), {
          horario: faixa.horario,
          unidades: faixa.unidades,
          pedidos: faixa.pedidos.map((pedido) =>
            Object.assign(new PedidoNaProducaoDto(), {
              id: pedido.id,
              numero: pedido.numero,
              status: pedido.status,
              tipoEntrega: pedido.tipoEntrega,
              observacao: pedido.observacao,
              cliente: referencia(pedido.cliente),
              unidades: pedido.unidades,
              itens: pedido.itens.map((item) =>
                Object.assign(new ItemNaProducaoDto(), {
                  id: item.id,
                  produto: referencia(item.produto),
                  produtor: referencia(item.produtor),
                  preparo: item.preparo,
                  unidadeVenda: item.unidadeVenda,
                  quantidade: item.quantidade,
                  unidades: item.unidades,
                  observacao: item.observacao,
                }),
              ),
            }),
          ),
        }),
      ),
      consolidado: producao.consolidado.map((grupo) =>
        Object.assign(new GrupoDePreparoDto(), {
          preparo: grupo.preparo,
          unidades: grupo.unidades,
          linhas: grupo.linhas.map((linha) =>
            Object.assign(new LinhaConsolidadaDto(), {
              produto: referencia(linha.produto),
              produtor: referencia(linha.produtor),
              unidades: linha.unidades,
              centos: linha.centos,
              avulsas: linha.avulsas,
              pedidos: [...linha.pedidos],
            }),
          ),
        }),
      ),
    });
  }
}

function referencia({ id, nome }: ReferenciaDto): ReferenciaDto {
  return { id, nome };
}
