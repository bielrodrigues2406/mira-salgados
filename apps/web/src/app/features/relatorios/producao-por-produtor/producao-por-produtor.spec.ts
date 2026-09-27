import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { ProducaoDoProdutor as Producao } from '../../../core/models/relatorios';
import { ProducaoPorProdutor } from './producao-por-produtor';

const MIRA = '11111111-1111-4111-8111-111111111111';
const CELIA = '22222222-2222-4222-8222-222222222222';

const PRODUCAO: Producao[] = [
  {
    produtor: { id: MIRA, nome: 'Mira' },
    unidades: 1200,
    valorCentavos: 114000,
    quantidadePedidos: 5,
    itens: [
      {
        produto: { id: 'coxinha', nome: 'Coxinha de frango' },
        preparo: 'FRITO',
        unidades: 1200,
        valorCentavos: 114000,
      },
    ],
  },
  {
    produtor: { id: CELIA, nome: 'Célia' },
    unidades: 1000,
    valorCentavos: 90000,
    quantidadePedidos: 3,
    itens: [
      {
        produto: { id: 'kibe', nome: 'Kibe' },
        preparo: 'FRITO',
        unidades: 1000,
        valorCentavos: 90000,
      },
    ],
  },
];

describe('ProducaoPorProdutor', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(filtro: (requisicao: TestRequest['request']) => boolean): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => filtro(r));
    });
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'producao', component: ProducaoPorProdutor }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navegacao = harness.navigateByUrl('/producao?de=2026-10-01&ate=2026-10-31');
    (await aguardar((r) => r.url === '/api/v1/produtores')).flush({
      data: [
        { id: MIRA, nome: 'Mira' },
        { id: CELIA, nome: 'Célia' },
      ],
      meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    });
    const relatorio = await aguardar((r) => r.url === '/api/v1/relatorios/producao');
    expect(relatorio.request.params.has('produtorId')).toBe(false);
    relatorio.flush({
      data: PRODUCAO,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      resumo: { unidades: 2200, valorCentavos: 204000 },
    });
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

  it('mostra cada produtor com volume, participação e valor em itens', () => {
    expect(textos('.nome h3')).toEqual(['Mira', 'Célia']);
    expect(textos('.nome .texto-legenda')).toEqual([
      '1.200 salgados · 5 pedidos',
      '1.000 salgados · 3 pedidos',
    ]);
    expect(textos('.participacao-valor')).toEqual(['54,5%', '45,5%']);
    expect(textos('.rodape .valor')).toEqual(['R$ 1.140,00', 'R$ 900,00']);
    expect(textos('p.texto-legenda')[0]).toBe(
      '2.200 salgados · R$ 2.040,00 em itens, antes dos descontos',
    );
  });

  it('filtra por produtor pela URL', async () => {
    const filtro = tela.querySelector<HTMLSelectElement>('#filtro-produtor');
    if (!filtro) throw new Error('Filtro não encontrado');
    filtro.value = CELIA;
    filtro.dispatchEvent(new Event('change'));

    const relatorio = await aguardar(
      (r) => r.url === '/api/v1/relatorios/producao' && r.params.get('produtorId') === CELIA,
    );
    relatorio.flush({
      data: [PRODUCAO[1]],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      resumo: { unidades: 1000, valorCentavos: 90000 },
    });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toContain(`produtor=${CELIA}`);
    expect(textos('.nome h3')).toEqual(['Célia']);
  });
});
