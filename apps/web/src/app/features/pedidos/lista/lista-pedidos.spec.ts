import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PedidoResumo } from '../../../core/models/pedido';
import { hoje, somarDias } from '../../../shared/utils/datas';
import { ListaPedidos } from './lista-pedidos';

const HOJE = hoje();

function pedido(numero: number, dados: Partial<PedidoResumo> = {}): PedidoResumo {
  return {
    id: `p${String(numero)}`,
    numero,
    status: 'CONFIRMADO',
    statusPagamento: 'PENDENTE',
    tipoEntrega: 'RETIRADA',
    dataEntrega: HOJE,
    horarioEntrega: null,
    cliente: { id: 'c1', nome: 'Ana Paula Ribeiro' },
    quantidadeItens: 1,
    totalCentavos: 9500,
    totalPagoCentavos: 0,
    saldoDevedorCentavos: 9500,
    temDesconto: false,
    temFiado: false,
    ...dados,
  };
}

function pagina(itens: PedidoResumo[]) {
  return { data: itens, meta: { page: 1, pageSize: 10, total: itens.length, totalPages: 1 } };
}

describe('ListaPedidos', () => {
  let fixture: ComponentFixture<ListaPedidos>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [ListaPedidos],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ListaPedidos);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function requisicoes(): TestRequest[] {
    TestBed.tick();
    return backend.match((r) => r.url === '/api/v1/pedidos');
  }

  /** Responde às quatro consultas: contador de hoje, hoje, próximas e anteriores. */
  async function responder(
    secoes: { hoje?: PedidoResumo[]; proximas?: PedidoResumo[]; anteriores?: PedidoResumo[] },
    vencemHoje = 0,
  ): Promise<TestRequest[]> {
    const pendentes = await vi.waitFor(() => {
      const encontradas = requisicoes();
      if (encontradas.length < 4) throw new Error(`só ${String(encontradas.length)} requisições`);
      return encontradas;
    });
    for (const requisicao of pendentes) {
      const params = requisicao.request.params;
      if (params.get('pageSize') === '1') {
        requisicao.flush({
          data: [],
          meta: { page: 1, pageSize: 1, total: vencemHoje, totalPages: 1 },
        });
      } else if (params.get('de') === HOJE && params.get('ate') === HOJE) {
        requisicao.flush(pagina(secoes.hoje ?? []));
      } else if (params.get('de') === somarDias(HOJE, 1)) {
        requisicao.flush(pagina(secoes.proximas ?? []));
      } else {
        requisicao.flush(pagina(secoes.anteriores ?? []));
      }
    }
    // O cartão da produção de hoje faz a sua própria consulta; aqui, dia sem produção.
    for (const producao of backend.match((r) => r.url === '/api/v1/relatorios/producao-do-dia')) {
      producao.flush({ data: { quantidadePedidos: 0, porProdutor: [], consolidado: [] } });
    }
    await fixture.whenStable();
    return pendentes;
  }

  afterEach(() => {
    backend.verify();
  });

  it('agrupa em hoje, próximas e anteriores, com o contador do dia', async () => {
    montar();
    expect(tela.textContent).toContain('Carregando encomendas');

    await responder(
      {
        hoje: [
          pedido(1043, { horarioEntrega: '11:30', statusPagamento: 'PARCIAL', temDesconto: true }),
        ],
        proximas: [pedido(1046, { dataEntrega: somarDias(HOJE, 1), horarioEntrega: '09:00' })],
        anteriores: [pedido(1040, { dataEntrega: somarDias(HOJE, -1), status: 'CANCELADO' })],
      },
      3,
    );

    expect(tela.textContent).toContain('3 encomendas vencem hoje');
    const secoes = [...tela.querySelectorAll('.secao h2')].map((h) => h.textContent.trim());
    expect(secoes[0]).toMatch(/^Hoje · /);
    expect(secoes.slice(1)).toEqual(['Próximas', 'Anteriores']);
    const primeiro = tela.querySelector('ms-cartao-pedido')?.textContent ?? '';
    expect(primeiro).toContain('#1043');
    expect(primeiro).toContain('11:30');
    expect(primeiro).toContain('Parcial');
    expect(primeiro).toContain('Desconto');
    const cancelado = [...tela.querySelectorAll('ms-cartao-pedido')].at(-1)?.textContent ?? '';
    expect(cancelado).not.toContain('Pendente');
  });

  it('convida a registrar o primeiro pedido quando não há nenhum', async () => {
    montar();
    await responder({});

    expect(tela.textContent).toContain('Nenhum pedido ainda');
  });

  it('mostra quanto falta pagar e filtra só os que devem', async () => {
    montar();
    await responder({
      hoje: [
        pedido(1, {
          statusPagamento: 'PARCIAL',
          totalPagoCentavos: 5000,
          saldoDevedorCentavos: 4500,
        }),
        pedido(2, { statusPagamento: 'PAGO', totalPagoCentavos: 9500, saldoDevedorCentavos: 0 }),
      ],
    });
    expect(
      [...tela.querySelectorAll('.falta')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    ).toEqual(['falta R$ 45,00']);

    tela.querySelector<HTMLButtonElement>('.filtros')?.click();
    await fixture.whenStable();
    [...tela.querySelectorAll<HTMLButtonElement>('.opcao')]
      .find((opcao) => opcao.textContent.includes('Falta pagar'))
      ?.click();

    const secoes = await vi.waitFor(() => {
      const encontradas = requisicoes();
      if (encontradas.length < 3) throw new Error('filtro ainda não aplicado');
      return encontradas;
    });
    expect(secoes.map((r) => r.request.params.get('faltaPagar'))).toEqual(['true', 'true', 'true']);
    for (const requisicao of secoes) requisicao.flush(pagina([]));
    await fixture.whenStable();
    expect(tela.querySelector('.contador')?.textContent.trim()).toBe('1');
  });

  it('filtra por estado em todas as seções', async () => {
    montar();
    await responder({ hoje: [pedido(1)] });

    tela.querySelector<HTMLButtonElement>('.filtros')?.click();
    await fixture.whenStable();
    [...tela.querySelectorAll<HTMLButtonElement>('.opcao')]
      .find((opcao) => opcao.textContent.includes('Concluído'))
      ?.click();

    const secoes = await vi.waitFor(() => {
      const encontradas = requisicoes();
      if (encontradas.length < 3) throw new Error('filtro ainda não aplicado');
      return encontradas;
    });
    expect(secoes.map((r) => r.request.params.getAll('status'))).toEqual([
      ['CONCLUIDO'],
      ['CONCLUIDO'],
      ['CONCLUIDO'],
    ]);
    for (const requisicao of secoes) requisicao.flush(pagina([]));
    await fixture.whenStable();
    expect(tela.textContent).toContain('Nenhuma encomenda encontrada');
  });
});
