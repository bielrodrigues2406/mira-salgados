import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Usuario } from '../../core/models/usuario';
import { AuthService } from '../../core/services/auth.service';
import { Usuarios } from './usuarios';

const LISTA = '/api/v1/usuarios?page=1&pageSize=20';

function conta(nome: string, extra: Partial<Usuario> = {}): Usuario {
  return {
    id: `id-${nome}`,
    nome,
    telefone: '11987654321',
    papel: 'MEMBRO',
    trocarSenha: false,
    ativo: true,
    criadoEm: '2026-10-01T10:00:00.000Z',
    ...extra,
  };
}

const EU = conta('Gabriel Rodrigues', { papel: 'ADMIN', telefone: '11999990001' });

describe('Usuarios', () => {
  let fixture: ComponentFixture<Usuarios>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: signal(EU) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Usuarios);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  // Enquanto uma requisição do httpResource está aberta a aplicação não fica
  // estável; por isso a espera é pela requisição, não por whenStable.
  function aguardarRequisicao(url: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(url);
    });
  }

  async function responderLista(itens: Usuario[]): Promise<void> {
    (await aguardarRequisicao(LISTA)).flush({
      data: itens,
      meta: { page: 1, pageSize: 20, total: itens.length, totalPages: 1 },
    });
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = [...tela.querySelectorAll('button')].find(
      (elemento) =>
        elemento.textContent.trim() === texto || elemento.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`Botão "${texto}" não encontrado`);
    return encontrado;
  }

  function preencher(seletor: string, valor: string): void {
    const campo = tela.querySelector<HTMLInputElement>(seletor);
    if (!campo) throw new Error(`Campo ${seletor} não encontrado`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  function enviar(seletor: string): void {
    tela
      .querySelector<HTMLFormElement>(seletor)
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  afterEach(() => {
    backend.verify();
  });

  it('lista as contas com papel, situação e a marca da própria conta', async () => {
    montar();
    await responderLista([
      EU,
      conta('Célia', { trocarSenha: true }),
      conta('Nair', { ativo: false }),
    ]);

    const itens = [...tela.querySelectorAll('.item')].map((item) => item.textContent);
    expect(itens[0]).toContain('(você)');
    expect(itens[0]).toContain('Administrador');
    expect(itens[0]).toContain('(11) 99999-0001');
    expect(itens[1]).toContain('Membro');
    expect(itens[1]).toContain('Senha provisória');
    expect(itens[2]).toContain('Inativa');
  });

  it('cria a conta com senha provisória gerada e oferece o envio pelo WhatsApp', async () => {
    montar();
    await responderLista([EU]);

    botao('Nova conta').click();
    await fixture.whenStable();
    const senha = tela.querySelector('.senha-provisoria .senha')?.textContent.trim() ?? '';
    expect(senha).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/i);

    preencher('#nova-conta-nome', ' Célia Souza ');
    preencher('#nova-conta-telefone', '(11) 91234-5678');
    enviar('#formulario-nova-conta');
    await fixture.whenStable();

    const criacao = await aguardarRequisicao('/api/v1/usuarios');
    expect(criacao.request.method).toBe('POST');
    expect(criacao.request.body).toEqual({
      nome: 'Célia Souza',
      telefone: '11912345678',
      papel: 'MEMBRO',
      senha,
    });
    criacao.flush({ data: conta('Célia Souza', { telefone: '11912345678', trocarSenha: true }) });
    await responderLista([EU, conta('Célia Souza', { trocarSenha: true })]);

    const cartao = tela.querySelector('ms-acesso-provisorio');
    expect(cartao?.textContent).toContain(senha);
    const link = cartao?.querySelector<HTMLAnchorElement>('a');
    expect(link?.href).toMatch(/^https:\/\/wa\.me\/5511912345678\?text=/);
    expect(decodeURIComponent(link?.href ?? '')).toContain(`*${senha}*`);
  });

  it('valida o celular com DDD antes de enviar', async () => {
    montar();
    await responderLista([EU]);

    botao('Nova conta').click();
    await fixture.whenStable();
    preencher('#nova-conta-nome', 'Célia');
    preencher('#nova-conta-telefone', '91234-5678');
    enviar('#formulario-nova-conta');
    await fixture.whenStable();

    expect(tela.textContent).toContain('Use o celular com DDD');
    backend.expectNone((requisicao) => requisicao.method === 'POST');
  });

  it('mostra o telefone em uso no próprio campo', async () => {
    montar();
    await responderLista([EU]);

    botao('Nova conta').click();
    await fixture.whenStable();
    preencher('#nova-conta-nome', 'Célia');
    preencher('#nova-conta-telefone', '11999990001');
    enviar('#formulario-nova-conta');
    await fixture.whenStable();

    (await aguardarRequisicao('/api/v1/usuarios')).flush(
      { error: { code: 'TELEFONE_EM_USO', message: 'Já existe uma conta com este celular.' } },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('#nova-conta-telefone-erro')?.textContent).toContain(
        'Já existe uma conta com este celular.',
      );
    });
  });

  it('na própria conta, não oferece desativar nem trocar o papel', async () => {
    montar();
    await responderLista([EU, conta('Célia')]);

    botao('Editar Gabriel Rodrigues').click();
    await fixture.whenStable();
    expect(tela.textContent).toContain('Você não pode desativar');
    expect(tela.querySelector('.edicao input[type="checkbox"]')).toBeNull();

    botao('Cancelar').click();
    botao('Editar Célia').click();
    await fixture.whenStable();
    expect(tela.querySelector('.edicao input[type="checkbox"]')).not.toBeNull();
  });

  it('envia só o que mudou ao desativar uma conta', async () => {
    montar();
    await responderLista([EU, conta('Célia')]);

    botao('Editar Célia').click();
    await fixture.whenStable();
    tela.querySelector<HTMLInputElement>('.edicao input[type="checkbox"]')?.click();
    enviar('.edicao');
    await fixture.whenStable();

    const alteracao = await aguardarRequisicao('/api/v1/usuarios/id-C%C3%A9lia');
    expect(alteracao.request.method).toBe('PATCH');
    expect(alteracao.request.body).toEqual({ ativo: false });
    alteracao.flush({ data: conta('Célia', { ativo: false }) });
    await responderLista([EU, conta('Célia', { ativo: false })]);

    expect(tela.textContent).toContain('Alterações de Célia salvas.');
  });

  it('gera nova senha provisória só depois de confirmar', async () => {
    montar();
    await responderLista([EU, conta('Célia')]);

    botao('Nova senha provisória para Célia').click();
    await fixture.whenStable();
    backend.expectNone((requisicao) => requisicao.method === 'POST');
    expect(tela.textContent).toContain('As sessões abertas dessa conta são encerradas.');

    botao('Gerar senha').click();
    const redefinicao = await aguardarRequisicao('/api/v1/usuarios/id-C%C3%A9lia/senha');
    const { senha } = redefinicao.request.body as { senha: string };
    expect(senha).toHaveLength(14);
    redefinicao.flush({ data: conta('Célia', { trocarSenha: true }) });
    await responderLista([EU, conta('Célia', { trocarSenha: true })]);

    expect(tela.querySelector('ms-acesso-provisorio')?.textContent).toContain('Senha redefinida');
    expect(tela.querySelector('ms-acesso-provisorio')?.textContent).toContain(senha);
  });
});
