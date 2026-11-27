import { createHash } from 'node:crypto';

import type { StatusPedido, TipoEntrega } from '../../pedidos/dominio/enums.js';
import { serializarCanonico } from '../../pedidos/dominio/idempotencia.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import { unidadesDe } from '../../relatorios/producao/producao-do-dia.js';

/**
 * Linha agregada permitida nas mensagens para a equipe. Nunca inclui preço,
 * produtor ou observação livre do item.
 */
export interface ItemProjetado {
  produtoId: string;
  produtoNome: string;
  preparo: Preparo;
  unidades: number;
}

/**
 * Projeção mínima de uma encomenda para avaliação de regras, hash de revisão e
 * formatação de texto. Contém estritamente os 7 campos permitidos (ADR 0019):
 * número, data, horário, modalidade, produto, preparo e quantidade em unidades
 * (além do identificador e status para máquina de decisão).
 */
export interface ProjecaoPedido {
  pedidoId: string;
  numero: number;
  status: StatusPedido;
  dataEntrega: string;
  /** HH:MM ou null quando sem horário. */
  horarioEntrega: string | null;
  tipoEntrega: TipoEntrega;
  itens: readonly ItemProjetado[];
}

export interface PedidoBrutoParaProjecao {
  id: string;
  numero: number;
  status: StatusPedido;
  dataEntrega: string;
  horarioEntrega: string | null;
  tipoEntrega: TipoEntrega;
}

export interface ItemBrutoParaProjecao {
  produtoId: string;
  produtoNome: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
}

const ORDEM_ALFABETICA = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const ORDEM_PREPARO: Record<Preparo, number> = { ASSADO: 0, FRITO: 1, CONGELADO: 2 };

function normalizarHorario(horario: string | null): string | null {
  if (horario === null) return null;
  const aparado = horario.trim();
  return aparado.length >= 5 ? aparado.slice(0, 5) : null;
}

/**
 * Projeta um pedido para o subconjunto estrito de dados operacionais, somando
 * unidades de linhas repetidas com o mesmo (produto, preparo).
 */
export function projetarPedido(
  pedido: PedidoBrutoParaProjecao,
  itens: readonly ItemBrutoParaProjecao[],
): ProjecaoPedido {
  const porChave = new Map<string, ItemProjetado>();

  for (const item of itens) {
    const chave = `${item.produtoId}|${item.preparo}`;
    const unidades = unidadesDe(item.unidadeVenda, item.quantidade);
    const existente = porChave.get(chave);
    if (existente) {
      existente.unidades += unidades;
    } else {
      porChave.set(chave, {
        produtoId: item.produtoId,
        produtoNome: item.produtoNome,
        preparo: item.preparo,
        unidades,
      });
    }
  }

  const agregados = [...porChave.values()].sort((a, b) => {
    const porPreparo = ORDEM_PREPARO[a.preparo] - ORDEM_PREPARO[b.preparo];
    if (porPreparo !== 0) return porPreparo;
    const porNome = ORDEM_ALFABETICA.compare(a.produtoNome, b.produtoNome);
    if (porNome !== 0) return porNome;
    return a.produtoId.localeCompare(b.produtoId);
  });

  return {
    pedidoId: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    dataEntrega: pedido.dataEntrega,
    horarioEntrega: normalizarHorario(pedido.horarioEntrega),
    tipoEntrega: pedido.tipoEntrega,
    itens: agregados,
  };
}

/**
 * Hash determinístico SHA-256 (64 hex) sobre os campos notificáveis do pedido.
 * Alterar cliente, endereço, desconto, produtor, observação ou pagamentos não
 * muda este hash.
 */
export function hashProjecaoPedido(projecao: ProjecaoPedido): string {
  const estadoNotificavel = {
    numero: projecao.numero,
    status: projecao.status,
    dataEntrega: projecao.dataEntrega,
    horarioEntrega: projecao.horarioEntrega,
    tipoEntrega: projecao.tipoEntrega,
    itens: projecao.itens.map((item) => ({
      produtoId: item.produtoId,
      preparo: item.preparo,
      unidades: item.unidades,
    })),
  };
  return createHash('sha256').update(serializarCanonico(estadoNotificavel)).digest('hex');
}
