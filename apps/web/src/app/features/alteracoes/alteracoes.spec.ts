import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RegistroDeAlteracao } from '../../core/models/auditoria';
import { Alteracoes } from './alteracoes';

const CONTAS = '/api/v1/usuarios?page=1&pageSize=100';

function registro(parcial: Partial<RegistroDeAlteracao>): RegistroDeAlteracao {
  return {
    id: 'r1',
    entidade: 'pedido',
    entidadeId: 'p36',
    acao: 'ATUALIZACAO',
    dadosAntes: { status: 'RASCUNHO' },
    dadosDepois: { status: 'CONFIRMADO' },
    usuarioId: 'u1',
    autor: { id: 'u1', nome: 'Gabriel' },
    referencias: { p36: 'Pedido #36' },
    criadoEm: new Date().toISOString(),
    ...parcial,
  };
}

describe('Alteracoes', () => {
  let fixture: ComponentFixture<Alteracoes>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(filtro: (requisicao: TestRequest['request']) => boolean): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((requisicao) => filtro(requisicao));
    });
  }

  function listagem(requisicao: TestRequest['request']): boolean {
    return requisicao.url === '/api/v1/auditoria';
  }

  async function responder(itens: RegistroDeAlteracao[]): Promise<TestRequest['request']> {
    const requisicao = await aguardar(listagem);
    requisicao.flush({
      data: itens,
      meta: { page: 1, pageSize: 30, total: itens.length, totalPages: 1 },
    });
    await fixture.whenStable();
    return requisicao.request;
  }

  async function montar(itens: RegistroDeAlteracao[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Alteracoes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Alteracoes);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    (await aguardar((requisicao) => requisicao.urlWithParams === CONTAS)).flush({
      data: [{ id: 'u1', nome: 'Gabriel' }],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    await responder(itens);
  }

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((elemento) =>
      elemento.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  afterEach(() => {
    backend.verify();
  });

  it('agrupa por dia e mostra o que mudou, por quem, com link para o pedido', async () => {
    await montar([registro({ acao: 'TRANSICAO_STATUS' })]);

    expect(textos('.dia-titulo')).toEqual(['Hoje']);
    expect(textos('.registro-titulo')).toEqual(['Pedido #36 mudou de status']);
    expect(tela.textContent).toContain('por Gabriel');
    expect(textos('.antes')).toEqual(['Rascunho']);
    expect(textos('.depois')).toEqual(['Confirmado']);
    expect(tela.querySelector('.abrir-pedido')?.getAttribute('href')).toBe('/pedidos/p36');
  });

  it('criações mostram os dados só ao abrir', async () => {
    await montar([
      registro({
        entidade: 'cliente',
        entidadeId: 'c1',
        acao: 'CRIACAO',
        dadosAntes: null,
        dadosDepois: { nome: 'Ana', telefone: '11987654321' },
        referencias: { c1: 'Ana' },
      }),
    ]);

    expect(tela.querySelector('.mudancas')).toBeNull();
    tela.querySelector<HTMLButtonElement>('.ver-dados')?.click();
    await fixture.whenStable();
    expect(textos('.mudanca dt')).toEqual(['Nome', 'Telefone']);
  });

  it('filtra por área e volta para a primeira página', async () => {
    await montar([registro({})]);

    const area = tela.querySelector<HTMLSelectElement>('#filtro-area');
    if (!area) throw new Error('Filtro não encontrado');
    area.value = 'pagamento';
    area.dispatchEvent(new Event('change'));
    const requisicao = await responder([]);

    expect(requisicao.params.get('entidade')).toBe('pagamento');
    expect(requisicao.params.get('page')).toBe('1');
    expect(tela.textContent).toContain('Nada com esses filtros');
  });
});
