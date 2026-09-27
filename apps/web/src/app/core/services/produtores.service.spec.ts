import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import type { ConsultaProdutores, Produtor } from '../models/produtor';
import { ProdutoresService } from './produtores.service';

const CELIA: Produtor = {
  id: 'a1',
  nome: 'Célia',
  ativo: true,
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
};

describe('ProdutoresService', () => {
  let servico: ProdutoresService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servico = TestBed.inject(ProdutoresService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lista com os parâmetros da consulta e refaz ao mudar a página', async () => {
    const consulta = signal<ConsultaProdutores>({ page: 1, pageSize: 20 });
    const recurso = TestBed.runInInjectionContext(() => servico.listar(consulta));
    TestBed.tick();

    const meta = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
    backend.expectOne('/api/v1/produtores?page=1&pageSize=20').flush({ data: [CELIA], meta });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(recurso.value()).toEqual({ itens: [CELIA], meta });

    consulta.set({ page: 2, pageSize: 20, ativo: true });
    TestBed.tick();
    backend.expectOne('/api/v1/produtores?page=2&pageSize=20&ativo=true');
  });

  it('cria e atualiza desembrulhando o envelope', async () => {
    const criado = firstValueFrom(servico.criar({ nome: 'Célia' }));
    const requisicaoCriar = backend.expectOne('/api/v1/produtores');
    expect(requisicaoCriar.request.method).toBe('POST');
    expect(requisicaoCriar.request.body).toEqual({ nome: 'Célia' });
    requisicaoCriar.flush({ data: CELIA });
    expect(await criado).toEqual(CELIA);

    const atualizado = firstValueFrom(servico.atualizar('a1', { ativo: false }));
    const requisicaoAtualizar = backend.expectOne('/api/v1/produtores/a1');
    expect(requisicaoAtualizar.request.method).toBe('PATCH');
    expect(requisicaoAtualizar.request.body).toEqual({ ativo: false });
    requisicaoAtualizar.flush({ data: { ...CELIA, ativo: false } });
    expect((await atualizado).ativo).toBe(false);
  });
});
