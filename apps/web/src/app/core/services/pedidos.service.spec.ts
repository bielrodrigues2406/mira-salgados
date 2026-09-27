import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import type { ConsultaPedidos, PedidoDetalhe } from '../models/pedido';
import { PedidosService } from './pedidos.service';

describe('PedidosService', () => {
  let servico: PedidosService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(PedidosService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('envia vários status como parâmetros repetidos', () => {
    const consulta = signal<ConsultaPedidos>({
      page: 1,
      pageSize: 10,
      status: ['RASCUNHO', 'CONFIRMADO'],
      de: '2026-10-02',
      ordem: 'asc',
    });
    TestBed.runInInjectionContext(() => servico.listar(consulta));
    TestBed.tick();

    const requisicao = backend.expectOne((r) => r.url === '/api/v1/pedidos');
    expect(requisicao.request.params.getAll('status')).toEqual(['RASCUNHO', 'CONFIRMADO']);
    expect(requisicao.request.params.get('de')).toBe('2026-10-02');
  });

  it('usa as rotas do agregado para status, itens e pagamentos', async () => {
    const pedido = { id: 'p1' } as PedidoDetalhe;
    const chamadas = [
      [servico.alterarStatus('p1', 'CONFIRMADO'), 'PATCH', '/api/v1/pedidos/p1/status'],
      [servico.removerItem('p1', 'i1'), 'DELETE', '/api/v1/pedidos/p1/itens/i1'],
      [servico.estornarPagamento('p1', 'g1'), 'DELETE', '/api/v1/pedidos/p1/pagamentos/g1'],
    ] as const;

    for (const [requisicao, metodo, url] of chamadas) {
      const resposta = firstValueFrom(requisicao);
      const pendente = backend.expectOne(url);
      expect(pendente.request.method).toBe(metodo);
      pendente.flush({ data: pedido });
      expect(await resposta).toBe(pedido);
    }
  });
});
