import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { ItemVendido } from '../../../core/models/relatorios';
import { ItensVendidos } from './itens-vendidos';

const ITENS: ItemVendido[] = [
  {
    posicao: 1,
    produto: { id: 'coxinha', nome: 'Coxinha de frango' },
    preparo: 'FRITO',
    unidades: 1350,
    valorCentavos: 128250,
    quantidadePedidos: 6,
  },
  {
    posicao: 2,
    produto: { id: 'kibe', nome: 'Kibe' },
    preparo: 'CONGELADO',
    unidades: 450,
    valorCentavos: 35100,
    quantidadePedidos: 1,
  },
];

describe('ItensVendidos', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(pagina: number): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) =>
          r.url === '/api/v1/relatorios/itens-vendidos' &&
          r.params.get('de') === '2026-10-01' &&
          r.params.get('page') === String(pagina),
      );
    });
  }

  function responder(requisicao: TestRequest, pagina: number): void {
    requisicao.flush({
      data: ITENS,
      meta: { page: pagina, pageSize: 20, total: 42, totalPages: 3 },
      resumo: { unidades: 1800, valorCentavos: 163350 },
    });
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'itens-vendidos', component: ItensVendidos }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navegacao = harness.navigateByUrl('/itens-vendidos?de=2026-10-01&ate=2026-10-31');
    responder(await aguardar(1), 1);
    await navegacao;
    await harness.fixture.whenStable();
    tela = harness.fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    backend.verify();
  });

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((e) =>
      e.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  it('mostra o ranking com volume, valor e participação no período', () => {
    expect(textos('p.texto-legenda')).toEqual(['1.800 salgados vendidos no período']);
    expect(textos('.colocacao')).toEqual(['1º', '2º']);
    expect(textos('.item-produto')).toEqual(['Coxinha de frango', 'Kibe']);
    expect(textos('.quantidade')).toEqual(['1.350', '450']);
    expect(textos('.item-detalhe .texto-legenda')).toEqual([
      'R$ 1.282,50 · 6 pedidos',
      'R$ 351,00 · 1 pedido',
    ]);
    const barras = [...tela.querySelectorAll<HTMLElement>('.barra-preenchida')];
    expect(barras.map((b) => b.style.width)).toEqual(['75%', '25%']);
  });

  it('pede a página seguinte e volta à primeira quando o período muda', async () => {
    tela.querySelector<HTMLButtonElement>('[aria-label="Próxima página"]')?.click();
    responder(await aguardar(2), 2);
    await harness.fixture.whenStable();

    await harness.navigateByUrl('/itens-vendidos?de=2026-10-01&ate=2026-10-15');
    const primeira = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => r.params.get('ate') === '2026-10-15');
    });
    expect(primeira.request.params.get('page')).toBe('1');
    responder(primeira, 1);
  });
});
