import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { AcertoDiario as Acerto } from '../../../core/models/relatorios';
import { hoje, somarDias } from '../../../shared/utils/datas';
import { Relatorios } from '../relatorios';
import { AcertoDiario } from './acerto-diario';

function acerto(data: string): Acerto {
  return {
    data,
    quantidadePedidos: 4,
    unidades: 1570,
    valorMovimentadoCentavos: 141700,
    caixa: { pixCentavos: 52200, dinheiroCentavos: 10000, totalCentavos: 62200 },
    fiado: { valorCentavos: 39000, pedidos: [1045] },
    semPagamento: { valorCentavos: 40500, pedidos: [1043, 1044] },
    totalProduzidoCentavos: 141700,
    produtores: [
      {
        produtor: { id: 'mira', nome: 'Mira' },
        unidades: 900,
        itens: [
          {
            produto: { id: 'coxinha', nome: 'Coxinha de frango' },
            preparo: 'FRITO',
            centos: 5,
            avulsas: 0,
            valorCentavos: 47500,
          },
        ],
        valorItensCentavos: 81260,
        descontoCentavos: 760,
        valorProduzidoCentavos: 80500,
      },
      {
        produtor: { id: 'celia', nome: 'Célia' },
        unidades: 670,
        itens: [
          {
            produto: { id: 'esfiha', nome: 'Esfiha de carne' },
            preparo: 'ASSADO',
            centos: 1,
            avulsas: 50,
            valorCentavos: 18000,
          },
        ],
        valorItensCentavos: 61200,
        descontoCentavos: 0,
        valorProduzidoCentavos: 61200,
      },
    ],
  };
}

describe('AcertoDiario', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(data: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) => r.url === '/api/v1/relatorios/acerto' && r.params.get('data') === data,
      );
    });
  }

  async function abrir(url: string, data = hoje(), resposta: Acerto = acerto(data)): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'relatorios',
              component: Relatorios,
              children: [
                { path: '', pathMatch: 'full', redirectTo: 'acerto' },
                { path: 'acerto', component: AcertoDiario },
              ],
            },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navegacao = harness.navigateByUrl(url);
    (await aguardar(data)).flush({ data: resposta });
    await navegacao;
    await harness.fixture.whenStable();
    tela = harness.fixture.nativeElement as HTMLElement;
  }

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((elemento) =>
      elemento.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  afterEach(() => {
    backend.verify();
  });

  it('abre na aba de acerto, em hoje, com síntese e caixa discriminado', async () => {
    await abrir('/relatorios');

    expect(TestBed.inject(Router).url).toBe('/relatorios/acerto');
    expect(tela.querySelector('.aba.ativa')?.getAttribute('aria-current')).toBe('page');
    expect(textos('.sintese-numero dd')).toEqual(['4', 'R$ 1.417,00']);
    expect(textos('.sintese-legenda')[0]).toContain('1.570 salgados');
    expect(textos('.forma-valor')).toEqual(['R$ 522,00', 'R$ 100,00', 'R$ 390,00', 'R$ 405,00']);
    expect(textos('.total-em-caixa-valor')).toEqual(['R$ 622,00']);
    expect(textos('.forma-textos .texto-legenda')).toEqual([
      'Crédito informal · pedido #1045',
      'Pedidos #1043 e #1044',
    ]);
    expect(tela.querySelector('.barra-caixa')?.getAttribute('aria-label')).toBe(
      'Distribuição do valor movimentado: 44% em caixa, 27% em fiado, 29% sem pagamento registrado',
    );
  });

  it('mostra o que cada produtor fez, sem dividir o caixa', async () => {
    await abrir('/relatorios/acerto');

    expect(textos('.cartao-produtor h3')).toEqual(['Mira', 'Célia']);
    expect(textos('.avatar')).toEqual(['MI', 'CÉ']);
    expect(textos('.valor-produzido')).toEqual(['R$ 805,00', 'R$ 612,00']);
    expect(textos('.linha-total.desconto .numerico')).toEqual(['− R$ 7,60']);
    expect(textos('.linha-detalhe .texto-legenda')).toEqual(['5 centos', '1 cento + 50 avulsas']);
    expect(tela.textContent).not.toContain('A receber do caixa');
    expect(tela.querySelector('a[href="/repasses"]')).not.toBeNull();
  });

  it('troca de dia pela URL e volta a hoje sem parâmetro', async () => {
    const ontem = somarDias(hoje(), -1);
    await abrir(`/relatorios/acerto?data=${ontem}`, ontem);

    tela.querySelector<HTMLButtonElement>('[aria-label="Próximo dia"]')?.click();
    (await aguardar(hoje())).flush({ data: acerto(hoje()) });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/relatorios/acerto');
  });

  it('dia sem encomendas explica o que entra no acerto', async () => {
    await abrir('/relatorios/acerto', hoje(), {
      ...acerto(hoje()),
      quantidadePedidos: 0,
      produtores: [],
    });

    expect(tela.textContent).toContain('Nenhuma encomenda nesta data');
  });
});
