import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { LinhaConsolidada } from '../../../core/models/producao';
import { hoje } from '../../../shared/utils/datas';
import { ProducaoDeHoje } from './producao-de-hoje';

const MIRA = { id: 'mira', nome: 'Mira' };
const CELIA = { id: 'celia', nome: 'Célia' };

function linha(produto: string, produtor: typeof MIRA, unidades: number): LinhaConsolidada {
  return {
    produto: { id: produto, nome: produto },
    produtor,
    unidades,
    centos: unidades / 100,
    avulsas: 0,
    pedidos: [1],
  };
}

const PRODUCAO = {
  porProdutor: [
    { produtor: MIRA, unidades: 1500 },
    { produtor: CELIA, unidades: 1 },
  ],
  consolidado: [
    {
      preparo: 'FRITO',
      unidades: 900,
      linhas: [
        linha('Coxinha de frango', MIRA, 500),
        linha('Bolinha de queijo', MIRA, 100),
        linha('Kibe', CELIA, 1),
        linha('Croquete', MIRA, 50),
        linha('Pastel', MIRA, 40),
      ],
    },
    {
      preparo: 'CONGELADO',
      unidades: 800,
      linhas: [linha('Coxinha de frango', MIRA, 300), linha('Risole', MIRA, 30)],
    },
  ],
};

describe('ProducaoDeHoje', () => {
  let fixture: ComponentFixture<ProducaoDeHoje>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function montar(resposta: { status?: number; dados?: object }): Promise<void> {
    TestBed.configureTestingModule({
      imports: [ProducaoDeHoje],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProducaoDeHoje);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const requisicao = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) => r.url === '/api/v1/relatorios/producao-do-dia' && r.params.get('data') === hoje(),
      );
    });
    if (resposta.status) {
      requisicao.flush(null, { status: resposta.status, statusText: 'Erro' });
    } else {
      requisicao.flush({ data: resposta.dados ?? { porProdutor: [], consolidado: [] } });
    }
    await fixture.whenStable();
  }

  function produtor(nome: string): HTMLButtonElement {
    const botao = [...tela.querySelectorAll<HTMLButtonElement>('button.produtor')].find(
      (b) => b.querySelector('.nome')?.textContent.trim() === nome,
    );
    if (!botao) throw new Error(`Produtor ${nome} não encontrado`);
    return botao;
  }

  function salgados(): string[][] {
    return [...tela.querySelectorAll('.salgado')].map((s) => [
      s.querySelector('.produto')?.textContent.trim() ?? '',
      s.querySelector('.preparo')?.textContent.trim() ?? '',
      s.querySelector('.salgado-quantidade')?.textContent.trim() ?? '',
    ]);
  }

  afterEach(() => {
    backend.verify();
  });

  it('começa fechado, com a carga de cada produtor e o link para a produção', async () => {
    await montar({ dados: PRODUCAO });

    expect(
      [...tela.querySelectorAll('.produtor')].map((p) =>
        [...p.children].map((filho) => filho.textContent.trim()),
      ),
    ).toEqual([
      ['Mira', '1.500', 'salgados'],
      ['Célia', '1', 'salgado'],
    ]);
    expect(produtor('Mira').getAttribute('aria-expanded')).toBe('false');
    expect(tela.querySelector('.salgados')).toBeNull();
    expect(tela.querySelector('a.ver')?.getAttribute('href')).toBe('/producao?modo=consolidado');
  });

  it('abre os salgados do produtor tocado, do maior para o menor, até cinco', async () => {
    await montar({ dados: PRODUCAO });

    produtor('Mira').click();
    await fixture.whenStable();

    expect(produtor('Mira').getAttribute('aria-expanded')).toBe('true');
    expect(salgados()).toEqual([
      ['Coxinha de frango', 'Frito', '500'],
      ['Coxinha de frango', 'Congelado', '300'],
      ['Bolinha de queijo', 'Frito', '100'],
      ['Croquete', 'Frito', '50'],
      ['Pastel', 'Frito', '40'],
    ]);
    expect(tela.querySelector('a.mais')?.textContent.trim()).toBe('+1 item · ver produção');
  });

  it('troca de produtor e fecha ao tocar de novo', async () => {
    await montar({ dados: PRODUCAO });

    produtor('Mira').click();
    await fixture.whenStable();
    produtor('Célia').click();
    await fixture.whenStable();
    expect(salgados()).toEqual([['Kibe', 'Frito', '1']]);
    expect(produtor('Mira').getAttribute('aria-expanded')).toBe('false');
    expect(tela.querySelector('a.mais')).toBeNull();

    produtor('Célia').click();
    await fixture.whenStable();
    expect(tela.querySelector('.salgados')).toBeNull();
  });

  it('some quando não há produção hoje', async () => {
    await montar({});

    expect(tela.querySelector('section')).toBeNull();
  });

  it('some quando a consulta falha, sem atrapalhar a lista', async () => {
    await montar({ status: 500 });

    expect(tela.querySelector('section')).toBeNull();
  });
});
