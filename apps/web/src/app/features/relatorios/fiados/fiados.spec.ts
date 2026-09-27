import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ClienteComFiado } from '../../../core/models/relatorios';
import { Fiados } from './fiados';

const FIADOS: ClienteComFiado[] = [
  {
    cliente: { id: 'c1', nome: 'Escola Pequeno Príncipe', telefone: '1130214455' },
    emAbertoCentavos: 39000,
    desde: '2026-10-02',
    pedidos: [{ id: 'p1045', numero: 1045, dataEntrega: '2026-10-02', emAbertoCentavos: 39000 }],
  },
  {
    cliente: { id: 'c2', nome: 'Ana Paula Ribeiro', telefone: null },
    emAbertoCentavos: 17000,
    desde: '2026-09-20',
    pedidos: [
      { id: 'p1020', numero: 1020, dataEntrega: '2026-09-20', emAbertoCentavos: 14000 },
      { id: 'p1041', numero: 1041, dataEntrega: '2026-10-01', emAbertoCentavos: 3000 },
    ],
  },
];

describe('Fiados', () => {
  let fixture: ComponentFixture<Fiados>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function montar(itens: ClienteComFiado[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Fiados],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Fiados);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const requisicao: TestRequest = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => r.url === '/api/v1/relatorios/fiados');
    });
    expect(requisicao.request.params.has('clienteId')).toBe(false);
    requisicao.flush({
      data: itens,
      meta: { page: 1, pageSize: 20, total: itens.length, totalPages: 1 },
      resumo: { totalEmAbertoCentavos: 56000, quantidadePedidos: 3 },
    });
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((e) =>
      e.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  it('mostra o total em aberto e cada cliente com os pedidos', async () => {
    await montar(FIADOS);

    expect(textos('.destaque-valor')).toEqual(['R$ 560,00']);
    expect(textos('.destaque-legenda')).toEqual(['2 clientes · 3 pedidos']);
    expect(textos('.cliente-nome')).toEqual(['Escola Pequeno Príncipe', 'Ana Paula Ribeiro']);
    expect(textos('.cliente-valor')).toEqual(['R$ 390,00', 'R$ 170,00']);
    expect(textos('.cliente-textos .texto-legenda')).toEqual([
      'Desde Sex, 2 out',
      'Desde Dom, 20 set',
    ]);
    expect(tela.querySelectorAll('.telefone')).toHaveLength(1);
    expect(textos('a[href="/pedidos/p1020"] .pedido-valor')).toEqual(['R$ 140,00']);
  });

  it('sem fiados, diz que não há nada em aberto', async () => {
    await montar([]);

    expect(tela.textContent).toContain('Nenhum fiado em aberto');
  });
});
