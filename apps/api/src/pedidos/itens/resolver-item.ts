import { type EntityManager, IsNull } from 'typeorm';

import { BusinessRuleError } from '../../common/errors/domain.errors.js';
import type { Centavos } from '../../common/utils/dinheiro.js';
import {
  PrecoProduto,
  type Preparo,
  type UnidadeVenda,
} from '../../produtos/preco-produto.entity.js';
import { Produto } from '../../produtos/produto.entity.js';
import { garantirProdutorAtivo } from '../validacoes.js';
import type { NovoItemDto } from './dto/novo-item.dto.js';

const ROTULOS = {
  FRITO: 'Frito',
  ASSADO: 'Assado',
  CONGELADO: 'Congelado',
  UNIDADE: 'Unidade',
  CENTO: 'Cento',
} as const;

export interface ItemResolvido {
  produtoId: string;
  produtorId: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  precoUnitario: Centavos;
  observacao: string | null;
}

export function validarQuantidadeDoItem(unidade: string, quantidade: number): void {
  if (unidade === 'UNIDADE' && !Number.isInteger(quantidade)) {
    throw new BusinessRuleError(
      'QUANTIDADE_INVALIDA',
      'Informe uma quantidade inteira de salgados.',
    );
  }
}

/**
 * Valida produto ativo, preço vigente, produtor ativo (quando informado) e
 * quantidade de um item, devolvendo os dados prontos para persistência.
 * Compartilhado entre adição unitária e criação atômica de encomenda confirmada.
 */
export async function resolverItemParaPedido(
  manager: EntityManager,
  dados: NovoItemDto,
): Promise<ItemResolvido> {
  validarQuantidadeDoItem(dados.unidadeVenda, dados.quantidade);

  const produto = await manager.getRepository(Produto).findOneBy({ id: dados.produtoId });
  if (!produto?.ativo) {
    throw new BusinessRuleError('PRODUTO_INVALIDO', 'Escolha um produto ativo.');
  }

  const preco = await manager.getRepository(PrecoProduto).findOneBy({
    produtoId: produto.id,
    preparo: dados.preparo,
    unidadeVenda: dados.unidadeVenda,
    vigenteAte: IsNull(),
  });
  if (!preco) {
    throw new BusinessRuleError(
      'PRECO_INEXISTENTE',
      `${produto.nome} não tem preço vigente para ${ROTULOS[dados.preparo]} · ${ROTULOS[dados.unidadeVenda]}.`,
    );
  }

  const produtorId = dados.produtorId ?? produto.produtorPadraoId;
  if (dados.produtorId) await garantirProdutorAtivo(manager, dados.produtorId);

  return {
    produtoId: produto.id,
    produtorId,
    preparo: dados.preparo,
    unidadeVenda: dados.unidadeVenda,
    quantidade: dados.quantidade,
    precoUnitario: preco.preco,
    observacao: dados.observacao ?? null,
  };
}
