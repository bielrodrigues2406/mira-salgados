import { describe, expect, it } from 'vitest';

import { BusinessRuleError } from '../../common/errors/domain.errors.js';
import { STATUS_PEDIDO, type StatusPedido } from './enums.js';
import {
  ehTerminal,
  type EstadoParaTransicao,
  transicoesPermitidas,
  validarCondicoesDaTransicao,
  validarTransicao,
} from './maquina-de-estados.js';

const PERMITIDAS: [StatusPedido, StatusPedido][] = [
  ['RASCUNHO', 'CONFIRMADO'],
  ['RASCUNHO', 'CANCELADO'],
  ['CONFIRMADO', 'CONCLUIDO'],
  ['CONFIRMADO', 'CANCELADO'],
];

const TODAS = STATUS_PEDIDO.flatMap((de) => STATUS_PEDIDO.map((para) => [de, para] as const));

function erroDe(acao: () => void): BusinessRuleError {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof BusinessRuleError) return erro;
    throw erro;
  }
  throw new Error('Nenhum erro lançado');
}

const PRONTO: EstadoParaTransicao = {
  quantidadeItens: 1,
  pagamentosAtivos: 0,
};

describe('máquina de estados do pedido', () => {
  it.each(PERMITIDAS)('permite %s -> %s', (de, para) => {
    expect(() => {
      validarTransicao(de, para);
    }).not.toThrow();
  });

  it('recusa todas as outras combinações, inclusive permanecer no mesmo estado', () => {
    const proibidas = TODAS.filter(
      ([de, para]) => !PERMITIDAS.some(([a, b]) => a === de && b === para),
    );

    expect(proibidas).toHaveLength(12);
    for (const [de, para] of proibidas) {
      expect(
        erroDe(() => {
          validarTransicao(de, para);
        }).code,
      ).toBe('TRANSICAO_INVALIDA');
    }
  });

  it('explica a transição recusada', () => {
    const erro = erroDe(() => {
      validarTransicao('CONCLUIDO', 'CANCELADO');
    });

    expect(erro.message).toBe('Um pedido concluído não pode passar para cancelado.');
    expect(erro.details).toEqual({ de: 'CONCLUIDO', para: 'CANCELADO', permitidas: [] });
  });

  it('trata concluído e cancelado como estados terminais', () => {
    expect(STATUS_PEDIDO.filter(ehTerminal)).toEqual(['CONCLUIDO', 'CANCELADO']);
    expect(transicoesPermitidas('RASCUNHO')).toEqual(['CONFIRMADO', 'CANCELADO']);
  });

  it('exige ao menos um item para confirmar', () => {
    const erro = erroDe(() => {
      validarCondicoesDaTransicao('CONFIRMADO', { ...PRONTO, quantidadeItens: 0 });
    });
    expect(erro.code).toBe('PEDIDO_SEM_ITENS');
  });

  it('exige estorno dos pagamentos antes de cancelar (D4)', () => {
    const erro = erroDe(() => {
      validarCondicoesDaTransicao('CANCELADO', { ...PRONTO, pagamentosAtivos: 2 });
    });
    expect(erro.code).toBe('PEDIDO_COM_PAGAMENTOS');
    expect(() => {
      validarCondicoesDaTransicao('CANCELADO', { ...PRONTO, quantidadeItens: 0 });
    }).not.toThrow();
  });
});
