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

const PRODUTOS = {
  data: [
    {
      id: 'prod-1',
      nome: 'Esfiha de carne',
      ativo: true,
      produtorPadrao: { id: 'pr-1', nome: 'Mira' },
      precosVigentes: [
        { id: 'preco-1', preparo: 'ASSADO', unidadeVenda: 'CENTO', precoCentavos: 11000 },
      ],
    },
  ],
  meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
};

const PRODUTORES = {
  data: [{ id: 'pr-1', nome: 'Mira', ativo: true }],
  meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
};

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
    (await aguardar((url) => url.startsWith('/api/v1/produtos'))).flush(PRODUTOS);
    (await aguardar((url) => url.startsWith('/api/v1/produtores'))).flush(PRODUTORES);
    await fixture.whenStable();
  }

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

  async function adicionarItem(quantidade = '50'): Promise<void> {
    const botaoAdicionar = [...tela.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent.includes('Adicionar item'),
    );
    if (!botaoAdicionar) throw new Error('Botão Adicionar item não encontrado');
    botaoAdicionar.click();
    await fixture.whenStable();

    const produtoSelect = tela.querySelector<HTMLSelectElement>('ms-item-formulario select');
    if (!produtoSelect) throw new Error('Select de produto não encontrado');
    produtoSelect.value = 'prod-1';
    produtoSelect.dispatchEvent(new Event('input'));
    produtoSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const campoQtd = tela.querySelector<HTMLInputElement>(
      'ms-item-formulario input[type="number"]',
    );
    if (!campoQtd) throw new Error('Campo de quantidade não encontrado');
    campoQtd.value = quantidade;
    campoQtd.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    tela
      .querySelector('ms-item-formulario form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  function enviar(): void {
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  afterEach(() => {
    backend.verify();
  });

  it('exige cliente e ao menos um item antes de salvar, sem botão de rascunho', async () => {
    await montar();
    expect(tela.textContent).not.toContain('Salvar como rascunho');
    expect(tela.textContent).toContain('Salvar encomenda');

    const busca = (): HTMLInputElement | null =>
      tela.querySelector<HTMLInputElement>('ms-seletor-cliente input');
    expect(busca()?.getAttribute('aria-invalid')).toBe('false');

    enviar();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Escolha o cliente.');
    expect(busca()?.getAttribute('aria-invalid')).toBe('true');

    await escolherCliente({ id: 'c1', nome: 'Ana', telefone: null, endereco: null });
    enviar();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Adicione ao menos um item à encomenda.');
    backend.expectNone('/api/v1/pedidos/confirmados');
  });

  it('cria encomenda confirmada em um clique com Idempotency-Key e abre o detalhe', async () => {
    await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await escolherCliente({
      id: 'c1',
      nome: 'Buffet Sabor & Arte',
      telefone: '11974123308',
      endereco: 'Rua das Flores, 10',
    });
    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();
    await adicionarItem('50');

    expect(tela.textContent).toContain('Esfiha de carne');
    expect(tela.textContent).toContain('50 salgados');

    enviar();
    const criacao = await aguardar((url) => url === '/api/v1/pedidos/confirmados');
    expect(criacao.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(criacao.request.body).toEqual({
      clienteId: 'c1',
      tipoEntrega: 'ENTREGA',
      enderecoEntrega: 'Rua das Flores, 10',
      dataEntrega: hoje(),
      horarioEntrega: null,
      descontoCentavos: 0,
      observacao: null,
      itens: [
        {
          produtoId: 'prod-1',
          preparo: 'ASSADO',
          unidadeVenda: 'CENTO',
          quantidade: 0.5,
          produtorId: 'pr-1',
          observacao: null,
        },
      ],
    });
    criacao.flush({ data: { id: 'novo-confirmado' } });

    await vi.waitFor(() => {
      expect(navegar).toHaveBeenCalledWith(['/pedidos', 'novo-confirmado']);
    });
  });

  it('mantém formulário e reutiliza Idempotency-Key no reenvio após falha, rotacionando se editar', async () => {
    await montar();
    await escolherCliente({ id: 'c1', nome: 'Ana', telefone: null, endereco: null });
    await adicionarItem('50');

    enviar();
    const primeira = await aguardar((url) => url === '/api/v1/pedidos/confirmados');
    const chave1 = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(
      { error: { code: 'INTERNAL_ERROR', message: 'Falha temporária no servidor.' } },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.textContent).toContain('Falha temporária no servidor.');
    });
    expect(tela.textContent).toContain('Esfiha de carne');

    // Reenvio idêntico reutiliza a mesma chave.
    enviar();
    const segunda = await aguardar((url) => url === '/api/v1/pedidos/confirmados');
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave1);
    segunda.flush(
      { error: { code: 'VALIDATION_FAILED', message: 'Erro de validação.' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();

    // Após editar os itens, a chave muda para evitar 409 Conflict.
    await adicionarItem('25');
    enviar();
    const terceira = await aguardar((url) => url === '/api/v1/pedidos/confirmados');
    expect(terceira.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    terceira.flush({ data: { id: 'ok' } });
  });

  it('cadastra cliente inline sem perder itens já adicionados', async () => {
    await montar();
    await adicionarItem('50');

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
    const campos = tela.querySelectorAll<HTMLInputElement>('ms-cadastro-rapido-cliente input');
    const telefone = campos[1];
    const endereco = campos[2];
    if (!telefone || !endereco) throw new Error('Campos do cadastro não encontrados');
    telefone.value = '(11) 91234-5678';
    telefone.dispatchEvent(new Event('input'));
    endereco.value = 'Rua A, 1';
    endereco.dispatchEvent(new Event('input'));
    endereco.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const cadastro = await aguardar((url) => url === '/api/v1/clientes');
    cadastro.flush({
      data: { id: 'c9', nome: 'Dona Rosa', telefone: '11912345678', endereco: 'Rua A, 1' },
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('ms-seletor-cliente .escolhido')?.textContent).toContain(
        'Dona Rosa',
      );
    });
    expect(tela.textContent).toContain('Esfiha de carne');

    tela.querySelector<HTMLInputElement>('input[value="ENTREGA"]')?.click();
    await fixture.whenStable();
    enviar();
    const criacao = await aguardar((url) => url === '/api/v1/pedidos/confirmados');
    expect(criacao.request.body).toMatchObject({ clienteId: 'c9', enderecoEntrega: 'Rua A, 1' });
    criacao.flush({ data: { id: 'novo' } });
  });
});
