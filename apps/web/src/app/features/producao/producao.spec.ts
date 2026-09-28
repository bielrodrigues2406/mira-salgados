import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { ProducaoDoDia, ProducaoPorDia } from '../../core/models/producao';
import { hoje, somarDias } from '../../shared/utils/datas';
import { Producao } from './producao';

const MIRA = { id: 'mira', nome: 'Mira' };
const CELIA = { id: 'celia', nome: 'Célia' };
const COXINHA = { id: 'coxinha', nome: 'Coxinha de frango' };
const ESFIHA = { id: 'esfiha', nome: 'Esfiha de carne' };

function producao(data: string): ProducaoDoDia {
  return {
    data,
    quantidadePedidos: 2,
    quantidadeProdutores: 2,
    unidades: 1250,
    porPreparo: [
      { preparo: 'FRITO', unidades: 1200 },
      { preparo: 'ASSADO', unidades: 50 },
      { preparo: 'CONGELADO', unidades: 0 },
    ],
    porProdutor: [
      { produtor: MIRA, unidades: 1200 },
      { produtor: CELIA, unidades: 50 },
    ],
    faixas: [
      {
        horario: '10:00',
        unidades: 1050,
        pedidos: [
          {
            id: 'p1042',
            numero: 1042,
            status: 'CONFIRMADO',
            tipoEntrega: 'ENTREGA',
            observacao: null,
            enderecoEntrega: 'Rua das Flores, 10',
            cliente: { id: 'c1', nome: 'Ana Paula Ribeiro' },
            unidades: 1050,
            itens: [
              {
                id: 'i1',
                produto: COXINHA,
                produtor: MIRA,
                preparo: 'FRITO',
                unidadeVenda: 'CENTO',
                quantidade: 10,
                unidades: 1000,
                observacao: null,
              },
              {
                id: 'i2',
                produto: ESFIHA,
                produtor: CELIA,
                preparo: 'ASSADO',
                unidadeVenda: 'UNIDADE',
                quantidade: 50,
                unidades: 50,
                observacao: 'Metade sem cebola',
              },
            ],
          },
        ],
      },
      {
        horario: null,
        unidades: 200,
        pedidos: [
          {
            id: 'p1045',
            numero: 1045,
            status: 'CONCLUIDO',
            tipoEntrega: 'RETIRADA',
            observacao: 'Retirada pela entrada lateral.',
            enderecoEntrega: null,
            cliente: { id: 'c2', nome: 'Escola Pequeno Príncipe' },
            unidades: 200,
            itens: [
              {
                id: 'i3',
                produto: COXINHA,
                produtor: MIRA,
                preparo: 'FRITO',
                unidadeVenda: 'CENTO',
                quantidade: 2,
                unidades: 200,
                observacao: null,
              },
            ],
          },
        ],
      },
    ],
    consolidado: [
      {
        preparo: 'FRITO',
        unidades: 1200,
        linhas: [
          {
            produto: COXINHA,
            produtor: MIRA,
            unidades: 1200,
            centos: 12,
            avulsas: 0,
            pedidos: [1042, 1045],
          },
        ],
      },
      {
        preparo: 'ASSADO',
        unidades: 50,
        linhas: [
          {
            produto: ESFIHA,
            produtor: CELIA,
            unidades: 50,
            centos: 0,
            avulsas: 50,
            pedidos: [1042],
          },
        ],
      },
    ],
  };
}

const VAZIA: ProducaoDoDia = {
  ...producao(hoje()),
  quantidadePedidos: 0,
  quantidadeProdutores: 0,
  unidades: 0,
  faixas: [],
  consolidado: [],
};

describe('Producao', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(data: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(
        (r) => r.url === '/api/v1/relatorios/producao-do-dia' && r.params.get('data') === data,
      );
    });
  }

  /** Abre a URL como no app, com data e modo vindos dos parâmetros de consulta. */
  async function abrir(
    url: string,
    dataPedida = hoje(),
    resposta: ProducaoDoDia = producao(dataPedida),
  ): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'producao', component: Producao }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    const navegacao = harness.navigateByUrl(url, Producao);
    (await aguardar(dataPedida)).flush({ data: resposta });
    await navegacao;
    await harness.fixture.whenStable();
    const rota = harness.routeNativeElement;
    if (!rota) throw new Error('A rota não renderizou.');
    tela = rota;
  }

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((elemento) =>
      elemento.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  function texto(): string {
    return tela.textContent.replace(/\s+/g, ' ');
  }

  function link(rotulo: string): HTMLAnchorElement {
    const encontrado = [...tela.querySelectorAll('a')].find(
      (a) => a.getAttribute('aria-label') === rotulo || a.textContent.trim() === rotulo,
    );
    if (!encontrado) throw new Error(`Link "${rotulo}" não encontrado`);
    return encontrado;
  }

  afterEach(() => {
    backend.verify();
  });

  it('abre em hoje, no modo cronológico, com faixas por horário e os sem horário no fim', async () => {
    await abrir('/producao');

    expect(texto()).toContain('Hoje');
    expect(texto()).toContain('2 encomendas confirmadas · 1.250 salgados · 2 produtores');
    expect(textos('.horario')).toEqual(['10:00', 'Sem horário']);
    expect(textos('.faixa-resumo')).toEqual([
      '1 encomenda · 1.050 salgados',
      '1 encomenda · 200 salgados',
    ]);
    expect(textos('.quantidade')).toEqual(['1.000', '50', '200']);
    expect(textos('.venda')).toEqual(['10 centos', 'Avulsas', '2 centos']);
    expect(texto()).toContain('Metade sem cebola');
    expect(texto()).toContain('Concluído');
    expect(texto()).toContain('Retirada pela entrada lateral.');
    expect(link('Cronológico').getAttribute('aria-current')).toBe('page');
    expect(tela.querySelector('a[href="/pedidos/p1042"]')).not.toBeNull();
    expect(link('Dia anterior').getAttribute('href')).toBe(
      `/producao?data=${somarDias(hoje(), -1)}`,
    );
  });

  it('mostra o consolidado com total do dia, preparos e composição por pedido', async () => {
    await abrir('/producao?modo=consolidado');

    expect(link('Consolidado').getAttribute('aria-current')).toBe('page');
    expect(tela.querySelector('.total-numero')?.textContent.trim()).toBe('1.250');
    expect(textos('.preparo dt')).toEqual(['Frito', 'Assado', 'Congelado']);
    expect(textos('.preparo-numero')).toEqual(['1.200', '50', '0']);
    expect(texto()).toContain('12 centos · pedidos #1042 e #1045');
    expect(texto()).toContain('50 avulsas · pedido #1042');
    expect(tela.querySelector('ms-linha-do-tempo')).toBeNull();
  });

  it('navega entre dias pela URL, sem data quando o destino é hoje', async () => {
    const ontem = somarDias(hoje(), -1);
    await abrir(`/producao?data=${ontem}&modo=consolidado`, ontem);

    expect(tela.querySelector('.marca-hoje')).toBeNull();
    expect(link('Dia anterior').getAttribute('href')).toBe(
      `/producao?data=${somarDias(ontem, -1)}&modo=consolidado`,
    );
    expect(link('Próximo dia').getAttribute('href')).toBe('/producao?modo=consolidado');
    expect(link('Hoje').getAttribute('href')).toBe('/producao?modo=consolidado');
  });

  it('ignora data inexistente na URL e usa hoje', async () => {
    await abrir('/producao?data=2026-02-30');

    expect(tela.querySelector('.marca-hoje')).not.toBeNull();
  });

  it('dia sem encomendas explica o que entra na produção', async () => {
    await abrir('/producao', hoje(), VAZIA);

    expect(texto()).toContain('Nada para produzir neste dia');
    expect(link('Ver pedidos').getAttribute('href')).toBe('/pedidos');
  });

  describe('modo semana', () => {
    function semana(de: string): ProducaoPorDia {
      const dias = Array.from({ length: 7 }, (_, indice) => ({
        data: somarDias(de, indice),
        quantidadePedidos: 0,
        unidades: 0,
        produtores: [] as ProducaoPorDia['dias'][number]['produtores'],
      }));
      dias[1] = {
        data: somarDias(de, 1),
        quantidadePedidos: 2,
        unidades: 550,
        produtores: [
          {
            produtor: MIRA,
            unidades: 500,
            salgados: [
              { produto: COXINHA, preparo: 'FRITO', unidades: 300 },
              { produto: COXINHA, preparo: 'CONGELADO', unidades: 200 },
            ],
          },
          {
            produtor: CELIA,
            unidades: 50,
            salgados: [{ produto: ESFIHA, preparo: 'ASSADO', unidades: 50 }],
          },
        ],
      };
      dias[3] = {
        data: somarDias(de, 3),
        quantidadePedidos: 1,
        unidades: 100,
        produtores: [
          {
            produtor: CELIA,
            unidades: 100,
            salgados: [{ produto: COXINHA, preparo: 'FRITO', unidades: 100 }],
          },
        ],
      };
      return { de, ate: somarDias(de, 6), unidades: 650, dias };
    }

    function aguardarPeriodo(de: string, ate: string): Promise<TestRequest> {
      return vi.waitFor(() => {
        TestBed.tick();
        return backend.expectOne(`/api/v1/relatorios/producao-por-dia?de=${de}&ate=${ate}`);
      });
    }

    async function abrirSemana(): Promise<void> {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: 'producao', component: Producao }], withComponentInputBinding()),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });
      backend = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create();
      const navegacao = harness.navigateByUrl('/producao?modo=semana', Producao);
      const requisicao = await vi.waitFor(() => {
        TestBed.tick();
        return backend.expectOne(
          '/api/v1/relatorios/producao-por-dia?de=' + hoje() + '&ate=' + somarDias(hoje(), 6),
        );
      });
      requisicao.flush({ data: semana(hoje()) });
      await navegacao;
      await harness.fixture.whenStable();
      const rota = harness.routeNativeElement;
      if (!rota) throw new Error('A rota não renderizou.');
      tela = rota;
    }

    it('mostra os sete dias com a carga de cada produtor por salgado', async () => {
      await abrirSemana();

      expect(tela.querySelector('h1')?.textContent).toContain('Produção do período');
      expect(link('Período').getAttribute('aria-current')).toBe('page');
      expect(tela.querySelectorAll('li.dia')).toHaveLength(7);
      expect(tela.querySelectorAll('li.dia.vazio')).toHaveLength(5);
      expect(textos('.carga-nome')).toEqual(['Mira', 'Célia', 'Célia']);
      expect(textos('.carga-total')).toEqual(['500', '50', '100']);
      expect(link('Próximo período').getAttribute('href')).toBe(
        `/producao?modo=semana&data=${somarDias(hoje(), 7)}&ate=${somarDias(hoje(), 13)}`,
      );
      expect(link('Ver pedidos do dia').getAttribute('href')).toBe(
        `/producao?data=${somarDias(hoje(), 1)}`,
      );
    });

    it('soma cada salgado no período, com a parte de cada produtor', async () => {
      await abrirSemana();

      expect(textos('.total-linha .total-numero')).toEqual(['400', '200', '50']);
      expect(textos('.total-nome')).toEqual([
        'Coxinha de frango',
        'Coxinha de frango (congelado)',
        'Esfiha de carne (assado)',
      ]);
      expect(textos('.total-linha')[0]).toContain('Mira 300 · Célia 100');
    });

    it('filtra um produtor e recalcula os totais', async () => {
      await abrirSemana();

      const celia = [...tela.querySelectorAll<HTMLButtonElement>('.filtro')].find((botao) =>
        botao.textContent.trim().startsWith('Célia'),
      );
      expect(celia?.textContent.replace(/\s+/g, ' ').trim()).toBe('Célia 150');
      celia?.click();
      await harness.fixture.whenStable();

      expect(textos('.carga-nome')).toEqual(['Célia', 'Célia']);
      expect(textos('.dia-total')).toEqual(['50', '100']);
      expect(textos('.total-linha .total-numero')).toEqual(['100', '50']);
      expect(texto()).toContain('150 salgados em 7 dias');
    });

    it('troca para 14 dias pelos atalhos do período', async () => {
      await abrirSemana();

      [...tela.querySelectorAll<HTMLButtonElement>('.atalho')]
        .find((botao) => botao.textContent.trim() === '14 dias')
        ?.click();
      const requisicao = await aguardarPeriodo(hoje(), somarDias(hoje(), 13));
      requisicao.flush({ data: semana(hoje()) });
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`/producao?modo=semana&ate=${somarDias(hoje(), 13)}`);
    });
  });

  it('escolhe o dia pelo calendário', async () => {
    await abrir('/producao');

    const campo = tela.querySelector<HTMLInputElement>('#producao-data');
    if (!campo) throw new Error('Calendário não encontrado');
    const destino = somarDias(hoje(), 10);
    campo.value = destino;
    campo.dispatchEvent(new Event('change'));
    (await aguardar(destino)).flush({ data: producao(destino) });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/producao?data=${destino}`);
  });
});
