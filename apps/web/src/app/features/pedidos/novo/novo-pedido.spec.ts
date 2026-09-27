import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { hoje } from '../../../shared/utils/datas';
import { NovoPedido } from './novo-pedido';

describe('NovoPedido', () => {
  let fixture: ComponentFixture<NovoPedido>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(filtro: (url: string) => boolean): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => filtro(r.urlWithParams));
    });
  }

  async function montar(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [NovoPedido],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NovoPedido);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  it('exige cliente antes de criar', async () => {
    await montar();

    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(tela.textContent).toContain('Escolha o cliente.');
  });

  it('entrega não pede taxa nem entregador', async () => {
    await montar();

    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();

    expect(tela.querySelectorAll('input:not([type="radio"]), select')).toHaveLength(4);
    expect(tela.textContent).not.toContain('Taxa');
    expect(tela.textContent).not.toContain('Entregador');
  });

  it('busca o cliente, cria o rascunho e abre o detalhe para adicionar itens', async () => {
    await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const busca = tela.querySelector<HTMLInputElement>('ms-seletor-cliente input');
    if (!busca) throw new Error('Busca de cliente não encontrada');
    busca.value = 'buffet';
    busca.dispatchEvent(new Event('input'));
    (
      await aguardar((url) => url.includes('/api/v1/clientes') && url.includes('busca=buffet'))
    ).flush({
      data: [{ id: 'c1', nome: 'Buffet Sabor & Arte', telefone: '11974123308' }],
      meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    tela.querySelector<HTMLButtonElement>('.resultado')?.click();
    await fixture.whenStable();
    expect(tela.textContent).toContain('Trocar');
    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();

    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    const criacao = await aguardar((url) => url === '/api/v1/pedidos');
    expect(criacao.request.body).toEqual({
      clienteId: 'c1',
      tipoEntrega: 'ENTREGA',
      dataEntrega: hoje(),
      horarioEntrega: null,
      descontoCentavos: 0,
      observacao: null,
    });
    criacao.flush({ data: { id: 'novo' } });

    await vi.waitFor(() => {
      expect(navegar).toHaveBeenCalledWith(['/pedidos', 'novo']);
    });
  });
});
