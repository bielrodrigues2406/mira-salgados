import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { Faturamento as Resposta, Periodo } from '../../../core/models/relatorios';
import { hoje } from '../../../shared/utils/datas';
import { esteMes } from '../periodo';
import { Faturamento } from './faturamento';

function faturamento(periodo: Periodo): Resposta {
  return {
    ...periodo,
    quantidadePedidos: 3,
    unidades: 450,
    faturamentoCentavos: 42000,
    descontosCentavos: 1000,
    recebidoCentavos: 15000,
    fiadoCentavos: 4000,
    aReceberCentavos: 27000,
    ticketMedioCentavos: 14000,
    porDia: [
      { data: '2026-10-01', quantidadePedidos: 1, faturamentoCentavos: 18000 },
      { data: '2026-10-03', quantidadePedidos: 2, faturamentoCentavos: 24000 },
    ],
  };
}

describe('Faturamento', () => {
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function abrir(url: string, periodo: Periodo, resposta?: Resposta): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'faturamento', component: Faturamento }],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const navegacao = harness.navigateByUrl(url);
    const requisicao: TestRequest = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) =>
          r.url === '/api/v1/relatorios/faturamento' &&
          r.params.get('de') === periodo.de &&
          r.params.get('ate') === periodo.ate,
      );
    });
    requisicao.flush({ data: resposta ?? faturamento(periodo) });
    await navegacao;
    await harness.fixture.whenStable();
    tela = harness.fixture.nativeElement as HTMLElement;
  }

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((e) =>
      e.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  afterEach(() => {
    backend.verify();
  });

  it('abre no mês atual com as métricas do período', async () => {
    await abrir('/faturamento', esteMes(hoje()));

    expect(textos('.destaque-valor')).toEqual(['R$ 420,00']);
    expect(textos('.destaque-legenda')).toEqual(['3 encomendas · 450 salgados']);
    expect(textos('.metrica-valor')).toEqual(['R$ 150,00', 'R$ 270,00', 'R$ 140,00', 'R$ 10,00']);
    expect(textos('.metrica .texto-legenda')[1]).toBe('Inclui R$ 40,00 em fiado');
  });

  it('usa o período da URL e mostra cada dia com barra proporcional', async () => {
    const periodo = { de: '2026-10-01', ate: '2026-10-07' };
    await abrir('/faturamento?de=2026-10-01&ate=2026-10-07', periodo);

    expect(textos('.dia-data')).toEqual(['Qui, 1 out', 'Sáb, 3 out']);
    expect(textos('.dia-valor')).toEqual(['R$ 180,00', 'R$ 240,00']);
    const barras = [...tela.querySelectorAll<HTMLElement>('.dia-barra-preenchida')];
    expect(barras.map((b) => b.style.width)).toEqual(['75%', '100%']);
  });

  it('período sem encomendas explica o que entra no faturamento', async () => {
    const periodo = esteMes(hoje());
    await abrir('/faturamento', periodo, {
      ...faturamento(periodo),
      quantidadePedidos: 0,
      porDia: [],
    });

    expect(tela.textContent).toContain('Nenhuma encomenda no período');
  });
});
