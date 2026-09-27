import { describe, expect, it } from 'vitest';

import { SnakeNamingStrategy, toSnakeCase } from './snake-naming.strategy.js';

describe('toSnakeCase', () => {
  it.each([
    ['dataEntrega', 'data_entrega'],
    ['produtorPadraoId', 'produtor_padrao_id'],
    ['senhaHash', 'senha_hash'],
    ['HTTPStatus', 'http_status'],
    ['id', 'id'],
  ])('converte %s em %s', (entrada, esperado) => {
    expect(toSnakeCase(entrada)).toBe(esperado);
  });
});

describe('SnakeNamingStrategy', () => {
  const estrategia = new SnakeNamingStrategy();

  it('respeita o nome de tabela declarado', () => {
    expect(estrategia.tableName('ItemPedido', 'itens_pedido')).toBe('itens_pedido');
    expect(estrategia.tableName('ItemPedido', undefined)).toBe('item_pedido');
  });

  it('gera colunas e chaves estrangeiras em snake_case', () => {
    expect(estrategia.columnName('horarioEntrega', undefined, [])).toBe('horario_entrega');
    expect(estrategia.joinColumnName('produtorPadrao', 'id')).toBe('produtor_padrao_id');
  });
});
