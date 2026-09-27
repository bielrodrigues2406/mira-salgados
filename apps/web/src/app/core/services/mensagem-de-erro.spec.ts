import { HttpErrorResponse } from '@angular/common/http';

import { codigoDeErro, mensagemDeCarregamento, mensagemDeErro } from './mensagem-de-erro';

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

describe('mensagemDeCarregamento', () => {
  it('tranquiliza que nada foi alterado quando a conexão falha', () => {
    expect(mensagemDeCarregamento(new HttpErrorResponse({ status: 0 }))).toMatch(
      /Nenhum dado foi alterado/,
    );
    expect(mensagemDeCarregamento(undefined)).toMatch(/Nenhum dado foi alterado/);
  });

  it('usa a mensagem da API quando o servidor responde', () => {
    const erro = new HttpErrorResponse({
      status: 503,
      error: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço indisponível.' } },
    });

    expect(mensagemDeCarregamento(erro)).toBe('Serviço indisponível.');
  });
});

describe('codigoDeErro', () => {
  it('lê o código do envelope de erro da API', () => {
    const erro = new HttpErrorResponse({
      status: 409,
      error: { error: { code: 'PRODUTOR_JA_EXISTE', message: 'Já existe.' } },
    });

    expect(codigoDeErro(erro)).toBe('PRODUTOR_JA_EXISTE');
    expect(codigoDeErro(new HttpErrorResponse({ status: 0 }))).toBeUndefined();
    expect(codigoDeErro(new Error('x'))).toBeUndefined();
  });
});
