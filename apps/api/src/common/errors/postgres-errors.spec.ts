import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { ehViolacaoDeUnicidade } from './postgres-errors.js';

function erroDoBanco(driverError: object): QueryFailedError {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('falha'), driverError));
}

describe('ehViolacaoDeUnicidade', () => {
  it('reconhece a violação da restrição informada', () => {
    const erro = erroDoBanco({ code: '23505', constraint: 'uq_produtores_nome' });
    expect(ehViolacaoDeUnicidade(erro, 'uq_produtores_nome')).toBe(true);
  });

  it('ignora outras restrições e outros erros', () => {
    const outraRestricao = erroDoBanco({ code: '23505', constraint: 'uq_usuarios_email' });
    const outroCodigo = erroDoBanco({ code: '23503', constraint: 'uq_produtores_nome' });
    expect(ehViolacaoDeUnicidade(outraRestricao, 'uq_produtores_nome')).toBe(false);
    expect(ehViolacaoDeUnicidade(outroCodigo, 'uq_produtores_nome')).toBe(false);
    expect(ehViolacaoDeUnicidade(new Error('x'), 'uq_produtores_nome')).toBe(false);
    expect(ehViolacaoDeUnicidade(null, 'uq_produtores_nome')).toBe(false);
  });
});
