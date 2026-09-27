import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { EstadoErro } from './estado-erro';

describe('EstadoErro', () => {
  function montar(erro: unknown, tentando = false) {
    const fixture = TestBed.createComponent(EstadoErro);
    fixture.componentRef.setInput('titulo', 'Não foi possível carregar os produtores');
    fixture.componentRef.setInput('erro', erro);
    fixture.componentRef.setInput('tentando', tentando);
    fixture.detectChanges();
    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  it('explica a falha de conexão e oferece nova tentativa', () => {
    const { fixture, tela } = montar(new HttpErrorResponse({ status: 0 }));
    let tentativas = 0;
    fixture.componentInstance.tentarNovamente.subscribe(() => (tentativas += 1));

    tela.querySelector('button')?.click();

    expect(tela.querySelector('[role="alert"]')?.textContent).toContain('A conexão com o servidor');
    expect(tentativas).toBe(1);
  });

  it('usa a mensagem da API quando o servidor responde', () => {
    const erro = new HttpErrorResponse({
      status: 500,
      error: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
    });

    expect(montar(erro).tela.textContent).toContain('Erro interno do servidor.');
  });

  it('mostra o progresso durante a nova tentativa', () => {
    const { tela } = montar(undefined, true);

    expect(tela.querySelector('[role="status"]')?.textContent).toContain('Tentando novamente');
    expect(tela.querySelector('button')).toBeNull();
  });
});
