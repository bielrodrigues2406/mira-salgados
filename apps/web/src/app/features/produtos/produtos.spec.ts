import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Produto } from '../../core/models/produto';
import type { Produtor } from '../../core/models/produtor';
import { Produtos } from './produtos';

const PRODUTOS = '/api/v1/produtos?page=1&pageSize=20';
const PRODUTORES = '/api/v1/produtores?page=1&pageSize=100&ativo=true';

function produtor(nome: string): Produtor {
  return {
    id: `pr-${nome}`,
    nome,
    ativo: true,
    produtosPadrao: [],
    criadoEm: '2026-09-01T10:00:00.000Z',
    atualizadoEm: '2026-09-01T10:00:00.000Z',
  };
}

const COXINHA: Produto = {
  id: 'coxinha',
  nome: 'Coxinha de frango',
  ativo: true,
  produtorPadrao: { id: 'pr-Mira', nome: 'Mira', ativo: true },
  precosVigentes: [
    {
      id: 'p1',
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 9500,
      vigenteDesde: '2026-09-01T10:00:00.000Z',
      vigenteAte: null,
    },
    {
      id: 'p2',
      preparo: 'CONGELADO',
      unidadeVenda: 'CENTO',
      precoCentavos: 8000,
      vigenteDesde: '2026-09-01T10:00:00.000Z',
      vigenteAte: null,
    },
  ],
  criadoEm: '2026-09-01T10:00:00.000Z',
  atualizadoEm: '2026-09-01T10:00:00.000Z',
};

function pagina<T>(itens: T[]) {
  return { data: itens, meta: { page: 1, pageSize: 20, total: itens.length, totalPages: 1 } };
}

describe('Produtos', () => {
  let fixture: ComponentFixture<Produtos>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardarRequisicao(url: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(url);
    });
  }

  async function montar(produtos: Produto[], produtores = [produtor('Mira'), produtor('Célia')]) {
    TestBed.configureTestingModule({
      imports: [Produtos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Produtos);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    (await aguardarRequisicao(PRODUTORES)).flush(pagina(produtores));
    (await aguardarRequisicao(PRODUTOS)).flush(pagina(produtos));
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

  function texto(): string {
    return tela.textContent.replace(/\s+/g, ' ');
  }

  afterEach(() => {
    backend.verify();
  });

  it('mostra produtor padrão, preços vigentes e o atalho para produtores', async () => {
    await montar([COXINHA]);

    expect(texto()).toContain('2 ativos · quem prepara cada produto por padrão');
    expect(texto()).toContain('Coxinha de frango');
    expect(texto()).toContain('Produtor padrão Mira');
    const linhas = [...tela.querySelectorAll('tbody tr')].map((linha) =>
      [...linha.querySelectorAll('td')]
        .map((celula) => celula.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' '),
    );
    expect(linhas).toEqual(['Frito Cento R$ 95,00', 'Congelado Cento R$ 80,00']);
  });

  it('cadastra produto escolhendo o produtor padrão', async () => {
    await montar([]);
    expect(texto()).toContain('Nenhum produto cadastrado');

    botao('Novo produto').click();
    await fixture.whenStable();
    const nome = tela.querySelector<HTMLInputElement>('form input');
    const selecao = tela.querySelector<HTMLSelectElement>('form select');
    if (!nome || !selecao) throw new Error('Formulário incompleto');
    nome.value = 'Kibe';
    nome.dispatchEvent(new Event('input'));
    selecao.value = 'pr-Célia';
    selecao.dispatchEvent(new Event('input'));
    selecao.dispatchEvent(new Event('change'));
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const criacao = await aguardarRequisicao('/api/v1/produtos');
    expect(criacao.request.body).toEqual({ nome: 'Kibe', produtorPadraoId: 'pr-Célia' });
    criacao.flush({ data: { ...COXINHA, id: 'kibe', nome: 'Kibe', precosVigentes: [] } });
    (await aguardarRequisicao(PRODUTOS)).flush(pagina([]));
    await fixture.whenStable();

    expect(tela.querySelector('[role="status"]')?.textContent).toContain(
      'Cadastro de Kibe salvo. Adicione os preços.',
    );
  });

  it('avisa quando não há produtor ativo para escolher', async () => {
    await montar([], []);

    botao('Novo produto').click();
    await fixture.whenStable();

    expect(texto()).toContain('Nenhum produtor ativo. Cadastre um produtor');
    expect(tela.querySelector('form select')).toBeNull();
  });

  it('adiciona preço pelo cartão e recarrega a lista', async () => {
    await montar([COXINHA]);

    botao('Adicionar preço').click();
    await fixture.whenStable();
    const campo = tela.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
    if (!campo) throw new Error('Campo de preço não encontrado');
    campo.value = '96,00';
    campo.dispatchEvent(new Event('input'));
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const requisicao = await aguardarRequisicao('/api/v1/produtos/coxinha/precos');
    expect(requisicao.request.body).toEqual({
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 9600,
    });
    requisicao.flush({ data: COXINHA });
    (await aguardarRequisicao(PRODUTOS)).flush(pagina([COXINHA]));
    await fixture.whenStable();

    expect(tela.querySelector('[role="status"]')?.textContent).toContain(
      'Preço de Coxinha de frango, Frito · Cento, salvo.',
    );
  });

  it('pede confirmação antes de encerrar um preço', async () => {
    await montar([COXINHA]);

    botao('Encerrar preço Congelado · Cento').click();
    await fixture.whenStable();
    expect(texto()).toContain('Encerrar Congelado · Cento (R$ 80,00)?');

    botao('Encerrar').click();
    const requisicao = await aguardarRequisicao('/api/v1/produtos/coxinha/precos/p2');
    expect(requisicao.request.method).toBe('DELETE');
    requisicao.flush({ data: { ...COXINHA, precosVigentes: [COXINHA.precosVigentes[0]] } });
    (await aguardarRequisicao(PRODUTOS)).flush(pagina([COXINHA]));
    await fixture.whenStable();
  });

  it('carrega o histórico só quando aberto', async () => {
    await montar([COXINHA]);
    backend.expectNone((requisicao) => requisicao.url.includes('/precos'));

    botao('Histórico de preços').click();
    (await aguardarRequisicao('/api/v1/produtos/coxinha/precos?pageSize=50')).flush(
      pagina([
        { ...COXINHA.precosVigentes[0], vigenteAte: null },
        {
          id: 'p0',
          preparo: 'FRITO',
          unidadeVenda: 'CENTO',
          precoCentavos: 9000,
          vigenteDesde: '2026-08-01T10:00:00.000Z',
          vigenteAte: '2026-09-01T10:00:00.000Z',
        },
      ]),
    );
    await fixture.whenStable();

    const itens = [...tela.querySelectorAll('.historico-item')].map((item) =>
      item.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(itens[0]).toContain('Vigente desde');
    expect(itens[1]).toContain('R$ 90,00');
    expect(itens[1]).toContain('até');
  });
});
