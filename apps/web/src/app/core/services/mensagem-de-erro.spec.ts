import { HttpErrorResponse } from '@angular/common/http';

import { mensagemDeErro } from './mensagem-de-erro';

describe('mensagemDeErro', () => {
  it('usa a mensagem enviada pela API', () => {
    const erro = new HttpErrorResponse({
      status: 401,
      error: { error: { code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail ou senha incorretos.' } },
    });

    expect(mensagemDeErro(erro)).toBe('E-mail ou senha incorretos.');
  });

  it('explica a falta de conexão', () => {
    expect(mensagemDeErro(new HttpErrorResponse({ status: 0 }))).toMatch(/Sem conexão/);
  });

  it('usa mensagem genérica quando a resposta não segue o envelope', () => {
    expect(mensagemDeErro(new HttpErrorResponse({ status: 502, error: '<html>' }))).toMatch(
      /Não foi possível/,
    );
    expect(mensagemDeErro(new Error('qualquer'))).toMatch(/Não foi possível/);
  });
});
