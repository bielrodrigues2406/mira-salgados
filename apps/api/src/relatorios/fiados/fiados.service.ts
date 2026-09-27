import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Paginated } from '../../common/pagination/pagination.js';
import { type Centavos, decimalParaCentavos } from '../../common/utils/dinheiro.js';
import { FORMAS_LIQUIDAS, STATUS_EM_VIGOR } from '../../pedidos/dominio/enums.js';
import type { FiltroFiadosDto } from '../dto/intervalo.dto.js';

export interface PedidoComFiado {
  id: string;
  numero: number;
  dataEntrega: string;
  emAberto: Centavos;
}

export interface ClienteComFiado {
  cliente: { id: string; nome: string; telefone: string | null };
  emAberto: Centavos;
  /** Data de entrega do pedido mais antigo com fiado em aberto. */
  desde: string;
  pedidos: PedidoComFiado[];
}

export interface ResumoDosFiados {
  totalEmAbertoCentavos: number;
  quantidadePedidos: number;
}

interface ClienteCru {
  id: string;
  nome: string;
  telefone: string | null;
  emAberto: string;
  desde: string;
}

interface PedidoCru {
  id: string;
  numero: number;
  clienteId: string;
  dataEntrega: string;
  emAberto: string;
}

interface ResumoCru {
  clientes: number;
  pedidos: number;
  total: string;
}

// Fiado em aberto de cada pedido em vigor: o fiado registrado, limitado ao que
// ainda falta receber. Se o cliente pagou depois em dinheiro ou PIX, o fiado
// daquele pedido diminui junto com o saldo. $1 são os status, $2 as formas
// líquidas e $3 o cliente, opcional.
const FIADOS_EM_ABERTO = `
  WITH por_pedido AS (
    SELECT p.id, p.numero, p.cliente_id, p.data_entrega,
           LEAST(
             COALESCE(pagos.fiado, 0),
             COALESCE(itens.valor, 0) - p.desconto - COALESCE(pagos.liquido, 0)
           ) AS em_aberto
    FROM pedidos p
    LEFT JOIN LATERAL (
      SELECT SUM(i.quantidade * i.preco_unitario) AS valor
      FROM itens_pedido i WHERE i.pedido_id = p.id
    ) itens ON true
    LEFT JOIN LATERAL (
      SELECT SUM(g.valor) FILTER (WHERE g.forma = 'FIADO') AS fiado,
             SUM(g.valor) FILTER (WHERE g.forma = ANY($2::forma_pagamento[])) AS liquido
      FROM pagamentos g WHERE g.pedido_id = p.id AND g.estornado_em IS NULL
    ) pagos ON true
    WHERE p.status = ANY($1::status_pedido[]) AND ($3::uuid IS NULL OR p.cliente_id = $3)
  ),
  fiados AS (SELECT * FROM por_pedido WHERE em_aberto > 0)`;

@Injectable()
export class FiadosService {
  constructor(private readonly dataSource: DataSource) {}

  /** Clientes com fiado em aberto, do maior valor ao menor, e o total consolidado. */
  async emAberto(filtro: FiltroFiadosDto): Promise<Paginated<ClienteComFiado>> {
    const parametros = [STATUS_EM_VIGOR, FORMAS_LIQUIDAS, filtro.clienteId ?? null];
    const [clientes, [resumo]] = await Promise.all([
      this.dataSource.query<ClienteCru[]>(
        `${FIADOS_EM_ABERTO}
        SELECT c.id, c.nome, c.telefone, SUM(f.em_aberto) AS "emAberto",
               to_char(MIN(f.data_entrega), 'YYYY-MM-DD') AS desde
        FROM fiados f
        JOIN clientes c ON c.id = f.cliente_id
        GROUP BY c.id, c.nome, c.telefone
        ORDER BY "emAberto" DESC, c.nome
        LIMIT $4 OFFSET $5`,
        [...parametros, filtro.pageSize, filtro.skip],
      ),
      this.dataSource.query<ResumoCru[]>(
        `${FIADOS_EM_ABERTO}
        SELECT COUNT(DISTINCT cliente_id)::int AS clientes, COUNT(*)::int AS pedidos,
               COALESCE(SUM(em_aberto), 0) AS total
        FROM fiados`,
        parametros,
      ),
    ]);

    const ids = clientes.map((cliente) => cliente.id);
    const pedidos =
      ids.length === 0
        ? []
        : await this.dataSource.query<PedidoCru[]>(
            `${FIADOS_EM_ABERTO}
            SELECT id, numero, cliente_id AS "clienteId",
                   to_char(data_entrega, 'YYYY-MM-DD') AS "dataEntrega", em_aberto AS "emAberto"
            FROM fiados
            WHERE cliente_id = ANY($4::uuid[])
            ORDER BY data_entrega, numero`,
            [...parametros, ids],
          );
    const pedidosPorCliente = Map.groupBy(pedidos, (pedido) => pedido.clienteId);

    return Paginated.of(
      clientes.map((cliente) => ({
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
        emAberto: decimalParaCentavos(cliente.emAberto),
        desde: cliente.desde,
        pedidos: (pedidosPorCliente.get(cliente.id) ?? []).map((pedido) => ({
          id: pedido.id,
          numero: pedido.numero,
          dataEntrega: pedido.dataEntrega,
          emAberto: decimalParaCentavos(pedido.emAberto),
        })),
      })),
      resumo?.clientes ?? 0,
      filtro,
      {
        totalEmAbertoCentavos: resumo ? decimalParaCentavos(resumo.total) : 0,
        quantidadePedidos: resumo?.pedidos ?? 0,
      } satisfies ResumoDosFiados,
    );
  }
}
