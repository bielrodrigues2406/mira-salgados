import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import type { Cliente, ConsultaClientes } from '../models/cliente';
import { ClientesService } from './clientes.service';

const ANA: Cliente = {
  id: 'c1',
  nome: 'Ana Paula Ribeiro',
  telefone: '11991342280',
  endereco: null,
  ativo: true,
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
};

describe('ClientesService', () => {
  let servico: ClientesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(ClientesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('envia a busca e o filtro de situação só quando definidos', () => {
    const consulta = signal<ConsultaClientes>({ page: 1, pageSize: 20, ativo: true });
    TestBed.runInInjectionContext(() => servico.listar(consulta));
    TestBed.tick();
    backend.expectOne('/api/v1/clientes?page=1&pageSize=20&ativo=true');

    consulta.set({ page: 1, pageSize: 20, busca: 'ana' });
    TestBed.tick();
    backend.expectOne('/api/v1/clientes?page=1&pageSize=20&busca=ana');
  });

  it('cria e atualiza desembrulhando o envelope', async () => {
    const criado = firstValueFrom(
      servico.criar({ nome: 'Ana Paula Ribeiro', telefone: '11991342280', endereco: null }),
    );
    backend.expectOne('/api/v1/clientes').flush({ data: ANA });
    expect(await criado).toEqual(ANA);

    const atualizado = firstValueFrom(servico.atualizar('c1', { telefone: null }));
    const requisicao = backend.expectOne('/api/v1/clientes/c1');
    expect(requisicao.request.method).toBe('PATCH');
    expect(requisicao.request.body).toEqual({ telefone: null });
    requisicao.flush({ data: { ...ANA, telefone: null } });
    expect((await atualizado).telefone).toBeNull();
  });
});
