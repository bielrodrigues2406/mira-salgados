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

  it('entrega pede só o endereço, sem taxa nem entregador', async () => {
    await montar();
    expect(tela.textContent).not.toContain('Endereço de entrega');

    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Endereço de entrega');
    expect(tela.querySelectorAll('input:not([type="radio"]), select')).toHaveLength(5);
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
      enderecoEntrega: null,
    });
    criacao.flush({ data: { id: 'novo' } });

    await vi.waitFor(() => {
      expect(navegar).toHaveBeenCalledWith(['/pedidos', 'novo']);
    });
  });

  async function escolherCliente(cliente: object): Promise<void> {
    const busca = tela.querySelector<HTMLInputElement>('ms-seletor-cliente input');
    if (!busca) throw new Error('Busca de cliente não encontrada');
    busca.value = 'ana';
    busca.dispatchEvent(new Event('input'));
    (await aguardar((url) => url.includes('busca=ana'))).flush({
      data: [cliente],
      meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    tela.querySelector<HTMLButtonElement>('.resultado')?.click();
    await fixture.whenStable();
  }

  function enviar(): void {
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('entrega usa o endereço do cliente, ou outro só para este pedido', async () => {
    await montar();
    await escolherCliente({
      id: 'c1',
      nome: 'Ana',
      telefone: null,
      endereco: 'Rua das Flores, 10',
    });
    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Rua das Flores, 10');
    tela.querySelector<HTMLInputElement>('input[value="OUTRO"]')?.click();
    await fixture.whenStable();
    const outro = tela.querySelector<HTMLInputElement>('input[aria-label="Outro endereço"]');
    if (!outro) throw new Error('Campo de outro endereço não encontrado');
    outro.value = 'Salão de festas, Av. Brasil 500';
    outro.dispatchEvent(new Event('input'));
    enviar();

    const criacao = await aguardar((url) => url === '/api/v1/pedidos');
    expect(criacao.request.body).toMatchObject({
      tipoEntrega: 'ENTREGA',
      enderecoEntrega: 'Salão de festas, Av. Brasil 500',
    });
    criacao.flush({ data: { id: 'novo' } });
  });

  it('cadastra o cliente sem sair do pedido e já o escolhe', async () => {
    await montar();
    const busca = tela.querySelector<HTMLInputElement>('ms-seletor-cliente input');
    if (!busca) throw new Error('Busca de cliente não encontrada');
    busca.value = 'Dona Rosa';
    busca.dispatchEvent(new Event('input'));
    (await aguardar((url) => url.includes('busca=Dona'))).flush({
      data: [],
      meta: { page: 1, pageSize: 6, total: 0, totalPages: 0 },
    });
    await fixture.whenStable();

    [...tela.querySelectorAll<HTMLButtonElement>('button')]
      .find((botao) => botao.textContent.includes('como cliente novo'))
      ?.click();
    await fixture.whenStable();
    const nome = tela.querySelector<HTMLInputElement>('ms-cadastro-rapido-cliente input');
    expect(nome?.value).toBe('Dona Rosa');
    const campos = tela.querySelectorAll<HTMLInputElement>('ms-cadastro-rapido-cliente input');
    const telefone = campos[1];
    const endereco = campos[2];
    if (!telefone || !endereco) throw new Error('Campos do cadastro não encontrados');
    telefone.value = '(11) 91234-5678';
    telefone.dispatchEvent(new Event('input'));
    endereco.value = 'Rua A, 1';
    endereco.dispatchEvent(new Event('input'));
    // Enter no cadastro cadastra o cliente, sem enviar o pedido.
    endereco.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const cadastro = await aguardar((url) => url === '/api/v1/clientes');
    expect(cadastro.request.method).toBe('POST');
    expect(cadastro.request.body).toEqual({
      nome: 'Dona Rosa',
      telefone: '11912345678',
      endereco: 'Rua A, 1',
    });
    backend.expectNone('/api/v1/pedidos');
    cadastro.flush({
      data: { id: 'c9', nome: 'Dona Rosa', telefone: '11912345678', endereco: 'Rua A, 1' },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('ms-seletor-cliente .escolhido')?.textContent).toContain(
        'Dona Rosa',
      );
    });
    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();
    enviar();
    const criacao = await aguardar((url) => url === '/api/v1/pedidos');
    expect(criacao.request.body).toMatchObject({ clienteId: 'c9', enderecoEntrega: 'Rua A, 1' });
    criacao.flush({ data: { id: 'novo' } });
  });
});
