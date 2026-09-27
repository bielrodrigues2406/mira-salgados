import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PedidoDetalhe as Pedido } from '../../../core/models/pedido';
import { PedidoDetalhe } from './pedido-detalhe';

function pedido(dados: Partial<Pedido> = {}): Pedido {
  return {
    id: 'p1',
    numero: 1043,
    status: 'RASCUNHO',
    statusPagamento: 'PENDENTE',
    tipoEntrega: 'RETIRADA',
    dataEntrega: '2026-10-02',
    horarioEntrega: '11:30',
    observacao: 'Retirada pela entrada lateral.',
    cliente: {
      id: 'c1',
      nome: 'Buffet Sabor & Arte',
      telefone: '11974123308',
      endereco: null,
      ativo: true,
    },
    registradoPor: { id: 'u1', nome: 'Lúcia Andrade' },
    resumo: {
      subtotalCentavos: 28500,
      descontoCentavos: 0,
      totalCentavos: 28500,
      totalPagoCentavos: 0,
      totalFiadoCentavos: 0,
      saldoDevedorCentavos: 28500,
    },
    itens: [
      {
        id: 'i1',
        produto: { id: 'coxinha', nome: 'Coxinha de frango' },
        produtor: { id: 'pr-Rafael', nome: 'Rafael' },
        produtorPadrao: { id: 'pr-Mira', nome: 'Mira' },
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        quantidade: 3,
        precoUnitarioCentavos: 9500,
        subtotalCentavos: 28500,
        observacao: null,
      },
    ],
    pagamentos: [],
    transicoesPermitidas: ['CONFIRMADO', 'CANCELADO'],
    editavel: true,
    criadoEm: '2026-10-01T10:00:00.000Z',
    atualizadoEm: '2026-10-01T10:00:00.000Z',
    ...dados,
  };
}

const VAZIA = { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } };

describe('PedidoDetalhe', () => {
  let fixture: ComponentFixture<PedidoDetalhe>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(url: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => r.url === url);
    });
  }

  async function montar(inicial: Pedido): Promise<void> {
    TestBed.configureTestingModule({
      imports: [PedidoDetalhe],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PedidoDetalhe);
    fixture.componentRef.setInput('id', inicial.id);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    (await aguardar('/api/v1/pedidos/p1')).flush({ data: inicial });
    (await aguardar('/api/v1/clientes/c1')).flush({
      data: {
        id: 'c1',
        pedidosComSaldo: [
          { id: 'p0', numero: 1031, dataEntrega: '2026-09-20', saldoDevedorCentavos: 8500 },
        ],
      },
    });
    if (inicial.editavel) {
      (await aguardar('/api/v1/produtos')).flush(VAZIA);
      (await aguardar('/api/v1/produtores')).flush(VAZIA);
    }
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = [...tela.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === texto || b.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`Botão "${texto}" não encontrado`);
    return encontrado;
  }

  function texto(): string {
    return tela.textContent.replace(/\s+/g, ' ');
  }

  afterEach(() => {
    backend.verify();
  });

  it('mostra identificação, itens com troca de produtor e saldo em outra encomenda', async () => {
    await montar(pedido());

    expect(texto()).toContain('Pedido #1043');
    expect(texto()).toContain('Rascunho');
    expect(texto()).toContain('Padrão do produto: Mira');
    expect(texto()).toContain('R$ 85,00 no pedido #1031');
    expect(texto()).toContain('Confirmar pedido');
  });

  it('confirma o pedido e passa a oferecer a conclusão', async () => {
    await montar(pedido());

    botao('Confirmar pedido').click();
    const requisicao = await aguardar('/api/v1/pedidos/p1/status');
    expect(requisicao.request.body).toEqual({ status: 'CONFIRMADO' });
    requisicao.flush({
      data: pedido({ status: 'CONFIRMADO', transicoesPermitidas: ['CONCLUIDO', 'CANCELADO'] }),
    });
    (await aguardar('/api/v1/clientes/c1')).flush({ data: { id: 'c1', pedidosComSaldo: [] } });
    await fixture.whenStable();

    expect(texto()).toContain('Concluir pedido');
    expect(tela.querySelector('[role="status"]')?.textContent).toContain('Pedido confirmado.');
  });

  it('mostra a regra de negócio quando o cancelamento é recusado', async () => {
    await montar(pedido());

    botao('Cancelar pedido').click();
    await fixture.whenStable();
    tela.querySelector<HTMLButtonElement>('.confirmacao .botao-negativo')?.click();
    (await aguardar('/api/v1/pedidos/p1/status')).flush(
      {
        error: {
          code: 'PEDIDO_COM_PAGAMENTOS',
          message: 'Estorne os pagamentos antes de cancelar o pedido.',
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(texto()).toContain('Estorne os pagamentos antes de cancelar o pedido.');
    });
  });

  it('registra pagamento com o saldo sugerido', async () => {
    await montar(
      pedido({ status: 'CONFIRMADO', transicoesPermitidas: ['CONCLUIDO', 'CANCELADO'] }),
    );

    botao('Registrar pagamento').click();
    await fixture.whenStable();
    expect(tela.querySelector<HTMLInputElement>('#novo-pagamento-valor')?.value).toBe('285,00');
    tela
      .querySelector('ms-pagamentos-pedido form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));

    const requisicao = await aguardar('/api/v1/pedidos/p1/pagamentos');
    expect(requisicao.request.body).toEqual({ forma: 'DINHEIRO', valorCentavos: 28500 });
    requisicao.flush({ data: pedido({ statusPagamento: 'PAGO' }) });
    (await aguardar('/api/v1/clientes/c1')).flush({ data: { id: 'c1', pedidosComSaldo: [] } });
    await fixture.whenStable();

    expect(tela.querySelector('[role="status"]')?.textContent).toContain('Dinheiro de R$');
  });

  it('não oferece edição em pedido concluído', async () => {
    await montar(pedido({ status: 'CONCLUIDO', transicoesPermitidas: [], editavel: false }));

    expect(texto()).not.toContain('Adicionar item');
    expect(texto()).not.toContain('Editar');
  });
});
