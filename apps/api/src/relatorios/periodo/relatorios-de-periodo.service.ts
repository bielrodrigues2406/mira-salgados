import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Paginated } from '../../common/pagination/pagination.js';
import { type Centavos, decimalParaCentavos } from '../../common/utils/dinheiro.js';
import { FORMAS_LIQUIDAS, STATUS_EM_VIGOR } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type {
  FiltroProducaoDto,
  IntervaloDto,
  IntervaloPaginadoDto,
} from '../dto/intervalo.dto.js';
import { UNIDADES_POR_CENTO } from '../producao/producao-do-dia.js';
import { type Faturamento, resumirFaturamento } from './faturamento.js';

interface Referencia {
  id: string;
  nome: string;
}

export interface ItemVendido {
  posicao: number;
  produto: Referencia;
  preparo: Preparo;
  unidades: number;
  /** Quantidade vezes preço, antes dos descontos. */
  valor: Centavos;
  quantidadePedidos: number;
}

export interface ProducaoDoProdutor {
  produtor: Referencia;
  unidades: number;
  valor: Centavos;
  quantidadePedidos: number;
  itens: { produto: Referencia; preparo: Preparo; unidades: number; valor: Centavos }[];
}

export interface ResumoDeVolume {
  unidades: number;
  valorCentavos: number;
}

interface DiaCru {
  data: string;
  quantidadePedidos: number;
  unidades: number;
  faturamento: string;
  descontos: string;
  recebido: string;
  fiado: string;
}

interface VolumeCru {
  total: number;
  unidades: number;
  valor: string;
}

interface ItemCru {
  produtoId: string;
  produtoNome: string;
  preparo: Preparo;
  unidades: number;
  valor: string;
  quantidadePedidos: number;
}

interface ProdutorCru {
  produtorId: string;
  produtorNome: string;
  unidades: number;
  valor: string;
  quantidadePedidos: number;
}

interface ItemDoProdutorCru extends ItemCru {
  produtorId: string;
}

// Pedidos confirmados e concluídos com entrega no intervalo; $1 são os status,
// $2 e $3 as datas e $4 as unidades por cento. As somas são feitas em numeric
// no banco e chegam como texto, convertidas para centavos sem ponto flutuante.
// Só trechos fixos entram no texto da consulta; valores vão como parâmetros.
const PRODUTOS = 'JOIN produtos produto ON produto.id = i.produto_id';
const PRODUTORES = 'JOIN produtores produtor ON produtor.id = i.produtor_id';

function itensDoPeriodo(juncao = ''): string {
  return `
  FROM itens_pedido i
  JOIN pedidos p ON p.id = i.pedido_id
  ${juncao}
  WHERE p.status = ANY($1::status_pedido[]) AND p.data_entrega BETWEEN $2 AND $3`;
}
const UNIDADES = `CASE WHEN i.unidade_venda = 'CENTO' THEN i.quantidade * $4 ELSE i.quantidade END`;

@Injectable()
export class RelatoriosDePeriodoService {
  constructor(private readonly dataSource: DataSource) {}

  async faturamento({ de, ate }: IntervaloDto): Promise<Faturamento> {
    const dias = await this.dataSource.query<DiaCru[]>(
      `
      WITH pedidos_do_periodo AS (
        SELECT p.data_entrega, p.desconto,
               COALESCE(itens.valor, 0) AS valor_itens,
               COALESCE(itens.unidades, 0) AS unidades,
               COALESCE(pagos.liquido, 0) AS recebido,
               COALESCE(pagos.fiado, 0) AS fiado
        FROM pedidos p
        LEFT JOIN LATERAL (
          SELECT SUM(i.quantidade * i.preco_unitario) AS valor, SUM(${UNIDADES}) AS unidades
          FROM itens_pedido i WHERE i.pedido_id = p.id
        ) itens ON true
        LEFT JOIN LATERAL (
          SELECT SUM(g.valor) FILTER (WHERE g.forma = ANY($5::forma_pagamento[])) AS liquido,
                 SUM(g.valor) FILTER (WHERE g.forma = 'FIADO') AS fiado
          FROM pagamentos g WHERE g.pedido_id = p.id AND g.estornado_em IS NULL
        ) pagos ON true
        WHERE p.status = ANY($1::status_pedido[]) AND p.data_entrega BETWEEN $2 AND $3
      )
      SELECT to_char(data_entrega, 'YYYY-MM-DD') AS data,
             COUNT(*)::int AS "quantidadePedidos",
             SUM(unidades)::int AS unidades,
             SUM(valor_itens - desconto) AS faturamento,
             SUM(desconto) AS descontos,
             SUM(recebido) AS recebido,
             SUM(fiado) AS fiado
      FROM pedidos_do_periodo
      GROUP BY data_entrega
      ORDER BY data_entrega`,
      [STATUS_EM_VIGOR, de, ate, UNIDADES_POR_CENTO, FORMAS_LIQUIDAS],
    );
    return resumirFaturamento(
      dias.map((dia) => ({
        data: dia.data,
        quantidadePedidos: dia.quantidadePedidos,
        unidades: dia.unidades,
        faturamento: decimalParaCentavos(dia.faturamento),
        descontos: decimalParaCentavos(dia.descontos),
        recebido: decimalParaCentavos(dia.recebido),
        fiado: decimalParaCentavos(dia.fiado),
      })),
    );
  }

  /** Ranking de produto e preparo por unidades vendidas no intervalo. */
  async itensVendidos(filtro: IntervaloPaginadoDto): Promise<Paginated<ItemVendido>> {
    const parametros = [STATUS_EM_VIGOR, filtro.de, filtro.ate, UNIDADES_POR_CENTO];
    const agrupamento = `${itensDoPeriodo()} GROUP BY i.produto_id, i.preparo`;
    const [itens, [volume]] = await Promise.all([
      this.dataSource.query<ItemCru[]>(
        `
        SELECT produto.id AS "produtoId", produto.nome AS "produtoNome", i.preparo,
               SUM(${UNIDADES})::int AS unidades,
               SUM(i.quantidade * i.preco_unitario) AS valor,
               COUNT(DISTINCT p.id)::int AS "quantidadePedidos"
        ${itensDoPeriodo(PRODUTOS)}
        GROUP BY produto.id, produto.nome, i.preparo
        ORDER BY unidades DESC, produto.nome, i.preparo
        LIMIT $5 OFFSET $6`,
        [...parametros, filtro.pageSize, filtro.skip],
      ),
      this.volume(agrupamento, parametros),
    ]);
    return Paginated.of(
      itens.map((item, indice) => ({
        posicao: filtro.skip + indice + 1,
        produto: { id: item.produtoId, nome: item.produtoNome },
        preparo: item.preparo,
        unidades: item.unidades,
        valor: decimalParaCentavos(item.valor),
        quantidadePedidos: item.quantidadePedidos,
      })),
      volume?.total ?? 0,
      filtro,
      resumoDe(volume),
    );
  }

  /** Volume e valor por produtor no intervalo, com o que cada um fez. */
  async producaoPorProdutor(filtro: FiltroProducaoDto): Promise<Paginated<ProducaoDoProdutor>> {
    const parametros = [
      STATUS_EM_VIGOR,
      filtro.de,
      filtro.ate,
      UNIDADES_POR_CENTO,
      filtro.produtorId ?? null,
    ];
    const filtroDoProdutor = 'AND ($5::uuid IS NULL OR i.produtor_id = $5)';
    const [produtores, [volume]] = await Promise.all([
      this.dataSource.query<ProdutorCru[]>(
        `
        SELECT produtor.id AS "produtorId", produtor.nome AS "produtorNome",
               SUM(${UNIDADES})::int AS unidades,
               SUM(i.quantidade * i.preco_unitario) AS valor,
               COUNT(DISTINCT p.id)::int AS "quantidadePedidos"
        ${itensDoPeriodo(PRODUTORES)} ${filtroDoProdutor}
        GROUP BY produtor.id, produtor.nome
        ORDER BY unidades DESC, produtor.nome
        LIMIT $6 OFFSET $7`,
        [...parametros, filtro.pageSize, filtro.skip],
      ),
      this.volume(`${itensDoPeriodo()} ${filtroDoProdutor} GROUP BY i.produtor_id`, parametros),
    ]);

    const ids = produtores.map((produtor) => produtor.produtorId);
    const itens =
      ids.length === 0
        ? []
        : await this.dataSource.query<ItemDoProdutorCru[]>(
            `
            SELECT i.produtor_id AS "produtorId", produto.id AS "produtoId",
                   produto.nome AS "produtoNome", i.preparo,
                   SUM(${UNIDADES})::int AS unidades,
                   SUM(i.quantidade * i.preco_unitario) AS valor,
                   COUNT(DISTINCT p.id)::int AS "quantidadePedidos"
            ${itensDoPeriodo(PRODUTOS)}
              AND i.produtor_id = ANY($5::uuid[])
            GROUP BY i.produtor_id, produto.id, produto.nome, i.preparo
            ORDER BY unidades DESC, produto.nome, i.preparo`,
            [STATUS_EM_VIGOR, filtro.de, filtro.ate, UNIDADES_POR_CENTO, ids],
          );
    const itensPorProdutor = Map.groupBy(itens, (item) => item.produtorId);

    return Paginated.of(
      produtores.map((produtor) => ({
        produtor: { id: produtor.produtorId, nome: produtor.produtorNome },
        unidades: produtor.unidades,
        valor: decimalParaCentavos(produtor.valor),
        quantidadePedidos: produtor.quantidadePedidos,
        itens: (itensPorProdutor.get(produtor.produtorId) ?? []).map((item) => ({
          produto: { id: item.produtoId, nome: item.produtoNome },
          preparo: item.preparo,
          unidades: item.unidades,
          valor: decimalParaCentavos(item.valor),
        })),
      })),
      volume?.total ?? 0,
      filtro,
      resumoDe(volume),
    );
  }

  /** Quantos grupos há e o volume somado, para a paginação e o resumo. */
  private volume(agrupamento: string, parametros: unknown[]): Promise<VolumeCru[]> {
    return this.dataSource.query<VolumeCru[]>(
      `
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(grupo.unidades), 0)::int AS unidades,
             COALESCE(SUM(grupo.valor), 0) AS valor
      FROM (
        SELECT SUM(${UNIDADES}) AS unidades, SUM(i.quantidade * i.preco_unitario) AS valor
        ${agrupamento}
      ) grupo`,
      parametros,
    );
  }
}

function resumoDe(volume: VolumeCru | undefined): ResumoDeVolume {
  return {
    unidades: volume?.unidades ?? 0,
    valorCentavos: volume ? decimalParaCentavos(volume.valor) : 0,
  };
}
