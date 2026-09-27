import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/services/auth.service';
import { TrocarSenha } from './trocar-senha';

describe('TrocarSenha', () => {
  let fixture: ComponentFixture<TrocarSenha>;
  let tela: HTMLElement;
  let auth: {
    precisaTrocarSenha: ReturnType<typeof signal<boolean>>;
    trocarSenha: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  async function montar(obrigatoria: boolean): Promise<void> {
    auth = {
      precisaTrocarSenha: signal(obrigatoria),
      trocarSenha: vi.fn(() => {
        auth.precisaTrocarSenha.set(false);
        return of({});
      }),
      logout: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [TrocarSenha],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    fixture = TestBed.createComponent(TrocarSenha);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function preencher(seletor: string, valor: string): void {
    const campo = tela.querySelector<HTMLInputElement>(seletor);
    if (!campo) throw new Error(`Campo ${seletor} não encontrado`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  async function enviar(atual: string, nova: string, confirmacao = nova): Promise<void> {
    preencher('#senha-atual', atual);
    preencher('#senha-nova', nova);
    preencher('#senha-confirmacao', confirmacao);
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('no primeiro acesso, pede a senha provisória e segue para os pedidos', async () => {
    await montar(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    expect(tela.querySelector('h1')?.textContent).toContain('Crie sua senha');
    expect(tela.textContent).toContain('Senha provisória');

    await enviar('abcd-efgh-jkmn', 'minha-senha-nova');

    expect(auth.trocarSenha).toHaveBeenCalledWith('abcd-efgh-jkmn', 'minha-senha-nova');
    expect(navegar).toHaveBeenCalledWith('/pedidos');
  });

  it('valida tamanho, repetição e confirmação antes de enviar', async () => {
    await montar(false);

    await enviar('senha-atual-longa', 'curta', 'outra');
    expect(tela.textContent).toContain('Use ao menos 12 caracteres.');
    expect(tela.textContent).toContain('As senhas não coincidem.');

    await enviar('senha-atual-longa', 'senha-atual-longa');
    expect(tela.textContent).toContain('A nova senha precisa ser diferente da atual.');
    expect(auth.trocarSenha).not.toHaveBeenCalled();
  });

  it('troca voluntária confirma na própria tela', async () => {
    await montar(false);

    await enviar('senha-atual-longa', 'minha-senha-nova');

    expect(tela.querySelector('.alerta-positivo')?.textContent).toContain('Senha trocada.');
    expect(tela.textContent).not.toContain('Sair');
  });

  it('mostra o erro da API quando a senha atual está errada', async () => {
    await montar(false);
    auth.trocarSenha.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: { code: 'SENHA_ATUAL_INCORRETA', message: 'Senha atual incorreta.' } },
          }),
      ),
    );

    await enviar('senha-errada-123', 'minha-senha-nova');
    fixture.detectChanges();

    expect(tela.querySelector('[role="alert"]')?.textContent).toContain('Senha atual incorreta.');
  });
});
