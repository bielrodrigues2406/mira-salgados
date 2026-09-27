import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Produtor } from '../../core/models/produtor';
import { Produtores } from './produtores';

const LISTA = '/api/v1/produtores?page=1&pageSize=20';

function produtor(nome: string, ativo = true): Produtor {
  return {
    id: `id-${nome}`,
    nome,
    ativo,
    produtosPadrao: [],
    criadoEm: '2026-10-01T10:00:00.000Z',
    atualizadoEm: '2026-10-01T10:00:00.000Z',
  };
}

describe('Produtores', () => {
  let fixture: ComponentFixture<Produtores>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [Produtores],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Produtores);
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

  async function responderLista(itens: Produtor[]): Promise<void> {
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

  it('mostra o esqueleto e depois a lista com a situação de cada produtor', async () => {
    montar();
    expect(tela.textContent).toContain('Carregando produtores');

    await responderLista([produtor('Célia'), produtor('Nair', false)]);

    const itens = [...tela.querySelectorAll('.item')].map((item) => item.textContent);
    expect(itens[0]).toContain('Célia');
    expect(itens[0]).toContain('Ativo');
    expect(itens[1]).toContain('Nair');
    expect(itens[1]).toContain('Inativo');
  });

  it('oferece o cadastro quando não há produtores', async () => {
    montar();
    await responderLista([]);

    botao('Cadastrar produtor').click();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Nenhum produtor cadastrado');
    expect(tela.querySelector('#novo-produtor-nome')).not.toBeNull();
  });

  it('mostra o erro de carregamento e tenta de novo', async () => {
    montar();
    (await aguardarRequisicao(LISTA)).flush(null, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();

    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar os produtores',
    );

    botao('Tentar novamente').click();
    await responderLista([produtor('Célia')]);

    expect(tela.textContent).toContain('Célia');
  });

  it('valida, cadastra e recarrega a lista', async () => {
    montar();
    await responderLista([]);
    botao('Novo produtor').click();
    await fixture.whenStable();

    enviar('#formulario-novo-produtor');
    await fixture.whenStable();
    expect(tela.textContent).toContain('Informe o nome.');

    preencher('#novo-produtor-nome', '  Rafael ');
    enviar('#formulario-novo-produtor');
    const criacao = backend.expectOne('/api/v1/produtores');
    expect(criacao.request.body).toEqual({ nome: 'Rafael' });
    criacao.flush({ data: produtor('Rafael') });
    await responderLista([produtor('Rafael')]);

    expect(tela.querySelector('#formulario-novo-produtor')).toBeNull();
    expect(tela.querySelector('[role="status"]')?.textContent).toContain(
      'Cadastro de Rafael salvo.',
    );
  });

  it('mostra nome repetido junto ao campo', async () => {
    montar();
    await responderLista([produtor('Célia')]);
    botao('Novo produtor').click();
    await fixture.whenStable();

    preencher('#novo-produtor-nome', 'célia');
    enviar('#formulario-novo-produtor');
    backend
      .expectOne('/api/v1/produtores')
      .flush(
        { error: { code: 'PRODUTOR_JA_EXISTE', message: 'Já existe um produtor com este nome.' } },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(tela.querySelector('#novo-produtor-nome-erro')?.textContent).toContain(
      'Já existe um produtor com este nome.',
    );
  });

  it('edita no lugar e envia só o que mudou', async () => {
    montar();
    await responderLista([produtor('Célia')]);

    botao('Editar Célia').click();
    await fixture.whenStable();
    const ativo = tela.querySelector<HTMLInputElement>('#edicao-produtor-ativo');
    expect(ativo?.checked).toBe(true);
    ativo?.click();
    enviar('form.edicao');

    const alteracao = backend.expectOne('/api/v1/produtores/id-C%C3%A9lia');
    expect(alteracao.request.method).toBe('PATCH');
    expect(alteracao.request.body).toEqual({ ativo: false });
    alteracao.flush({ data: produtor('Célia', false) });
    await responderLista([produtor('Célia', false)]);

    expect(tela.querySelector('form.edicao')).toBeNull();
    expect(tela.textContent).toContain('Inativo');
  });

  it('fecha a edição sem requisição quando nada mudou', async () => {
    montar();
    await responderLista([produtor('Célia')]);

    botao('Editar Célia').click();
    await fixture.whenStable();
    enviar('form.edicao');
    await fixture.whenStable();

    backend.expectNone((requisicao) => requisicao.method === 'PATCH');
    expect(tela.querySelector('form.edicao')).toBeNull();
  });
});
