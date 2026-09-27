import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Login } from './login';

const USUARIO = {
  id: '1',
  nome: 'Lúcia Andrade',
  email: 'lucia@exemplo.com',
  ativo: true,
  criadoEm: '2026-10-01T00:00:00.000Z',
};

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function montar(registroPublico = false): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Login);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    backend.expectOne('/api/v1/auth/configuracao').flush({ data: { registroPublico } });
    await fixture.whenStable();
  }

  function preencher(seletor: string, valor: string): void {
    const campo = tela.querySelector<HTMLInputElement>(seletor);
    if (!campo) throw new Error(`Campo ${seletor} não encontrado`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  function enviar(seletor = 'form'): void {
    tela
      .querySelector<HTMLFormElement>(seletor)
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  afterEach(() => {
    backend.verify();
  });

  it('valida os campos antes de enviar', async () => {
    await montar();

    enviar();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Informe o e-mail.');
    expect(tela.textContent).toContain('Informe a senha.');
    backend.expectNone('/api/v1/auth/login');
  });

  it('entra e segue para os pedidos com credenciais válidas', async () => {
    await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    preencher('#login-email', 'lucia@exemplo.com');
    preencher('#login-senha', 'senha-correta');
    enviar();
    await fixture.whenStable();

    backend.expectOne('/api/v1/auth/login').flush({
      data: { accessToken: 't', tokenType: 'Bearer', expiresIn: 900, usuario: USUARIO },
    });
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/pedidos');
  });

  it('mostra a mensagem da API acima da ação quando o login falha', async () => {
    await montar();

    preencher('#login-email', 'lucia@exemplo.com');
    preencher('#login-senha', 'senha-errada');
    enviar();
    await fixture.whenStable();

    backend
      .expectOne('/api/v1/auth/login')
      .flush(
        { error: { code: 'CREDENCIAIS_INVALIDAS', message: 'E-mail ou senha incorretos.' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
        'E-mail ou senha incorretos.',
      );
    });
  });

  it('alterna a visibilidade da senha com rótulo acessível', async () => {
    await montar();
    const botao = tela.querySelector<HTMLButtonElement>('.alternar-senha');

    expect(botao?.getAttribute('aria-label')).toBe('Mostrar senha');
    botao?.click();
    await fixture.whenStable();

    expect(tela.querySelector<HTMLInputElement>('#login-senha')?.type).toBe('text');
    expect(botao?.getAttribute('aria-label')).toBe('Ocultar senha');
  });

  it('só oferece a criação de conta quando o cadastro público está ligado', async () => {
    await montar(false);
    expect(tela.textContent).not.toContain('Criar conta');
  });

  it('confere a confirmação de senha no cadastro', async () => {
    await montar(true);
    tela.querySelector<HTMLButtonElement>('.alternar-cadastro')?.click();
    await fixture.whenStable();

    preencher('#cadastro-senha', 'uma-senha-bem-longa');
    preencher('#cadastro-confirmacao', 'outra-senha-diferente');
    await fixture.whenStable();

    expect(tela.textContent).toContain('As senhas não coincidem.');
  });
});
