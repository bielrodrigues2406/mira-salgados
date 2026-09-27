import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import type { Cliente } from '../../core/models/cliente';
import { Clientes } from './clientes';

const ATIVOS = '/api/v1/clientes?page=1&pageSize=20&ativo=true';

function cliente(nome: string, dados: Partial<Cliente> = {}): Cliente {
  return {
    id: `id-${nome.replace(/\W/g, '')}`,
    nome,
    telefone: null,
    endereco: null,
    ativo: true,
    saldoDevedorCentavos: 0,
    temFiado: false,
    criadoEm: '2026-10-01T10:00:00.000Z',
    atualizadoEm: '2026-10-01T10:00:00.000Z',
    ...dados,
  };
}

const ANA = cliente('Ana Paula Ribeiro', {
  telefone: '11991342280',
  endereco: 'Rua Tupi, 88 — Pinheiros',
});
const ESCOLA = cliente('Escola Pequeno Príncipe', { telefone: '1130214455' });

describe('Clientes', () => {
  let fixture: ComponentFixture<Clientes>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [Clientes],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Clientes);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function aguardarRequisicao(url: string): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(url);
    });
  }

  async function responder(url: string, itens: Cliente[]): Promise<void> {
    (await aguardarRequisicao(url)).flush({
      data: itens,
      meta: { page: 1, pageSize: 20, total: itens.length, totalPages: 1 },
    });
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = [...tela.querySelectorAll('button')].find(
      (elemento) =>
        elemento.textContent.trim() === texto || elemento.getAttribute('aria-label') === texto,
    );
    if (!encontrado) throw new Error(`Botão "${texto}" não encontrado`);
    return encontrado;
  }

  function campo(rotulo: string): HTMLInputElement {
    const label = [...tela.querySelectorAll('label')].find((l) => l.textContent.trim() === rotulo);
    const alvo = label?.htmlFor ? tela.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
    if (!alvo) throw new Error(`Campo "${rotulo}" não encontrado`);
    return alvo;
  }

  function preencher(rotulo: string, valor: string): void {
    const entrada = campo(rotulo);
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
  }

  function enviar(): void {
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  afterEach(() => {
    backend.verify();
  });

  it('lista os ativos com telefone formatado e endereço ausente indicado', async () => {
    montar();
    expect(tela.textContent).toContain('Carregando clientes');

    await responder(ATIVOS, [ANA, ESCOLA]);

    expect(tela.textContent).toContain('2 clientes ativos');
    const itens = [...tela.querySelectorAll('.item')].map((item) => item.textContent);
    expect(itens[0]).toContain('(11) 99134-2280');
    expect(itens[0]).toContain('Rua Tupi, 88');
    expect(itens[1]).toContain('(11) 3021-4455');
    expect(itens[1]).toContain('Sem endereço cadastrado');
  });

  it('busca depois da pausa na digitação e oferece cadastro com o termo', async () => {
    montar();
    await responder(ATIVOS, [ANA]);

    const busca = tela.querySelector<HTMLInputElement>('#busca-clientes');
    if (!busca) throw new Error('Campo de busca não encontrado');
    busca.value = 'Marce';
    busca.dispatchEvent(new Event('input'));
    busca.value = 'Marcelo';
    busca.dispatchEvent(new Event('input'));
    await responder('/api/v1/clientes?page=1&pageSize=20&busca=Marcelo&ativo=true', []);

    expect(tela.textContent).toContain('Nenhum cliente encontrado');
    botao('Cadastrar cliente').click();
    await fixture.whenStable();
    expect(campo('Nome').value).toBe('Marcelo');
  });

  it('inclui inativos quando pedido', async () => {
    montar();
    await responder(ATIVOS, [ANA]);

    tela.querySelector<HTMLInputElement>('.alternar-caixa')?.click();
    await responder('/api/v1/clientes?page=1&pageSize=20', [
      ANA,
      cliente('Roberto Lima', { ativo: false }),
    ]);

    expect(tela.textContent).toContain('2 clientes');
    expect(tela.querySelectorAll('.item')[1]?.textContent).toContain('Inativo');
  });

  it('valida o telefone e cadastra só com os dígitos', async () => {
    montar();
    await responder(ATIVOS, []);
    botao('Novo cliente').click();
    await fixture.whenStable();

    preencher('Nome', 'Carla Menezes');
    preencher('Telefone', '9882-0114');
    enviar();
    await fixture.whenStable();
    expect(tela.textContent).toContain('Informe o DDD e o número, com 10 ou 11 dígitos.');
    backend.expectNone('/api/v1/clientes');

    preencher('Telefone', '(11) 98820-1147');
    enviar();
    const criacao = await aguardarRequisicao('/api/v1/clientes');
    expect(criacao.request.body).toEqual({
      nome: 'Carla Menezes',
      telefone: '11988201147',
      endereco: null,
    });
    criacao.flush({ data: cliente('Carla Menezes', { telefone: '11988201147' }) });
    await responder(ATIVOS, [cliente('Carla Menezes', { telefone: '11988201147' })]);

    expect(tela.querySelector('form')).toBeNull();
    expect(tela.querySelector('[role="status"]')?.textContent).toContain(
      'Cadastro de Carla Menezes salvo.',
    );
  });

  it('edita no lugar e apaga o telefone', async () => {
    montar();
    await responder(ATIVOS, [ANA]);

    tela.querySelector<HTMLButtonElement>('.item-botao')?.click();
    await fixture.whenStable();
    expect(campo('Telefone').value).toBe('(11) 99134-2280');

    preencher('Telefone', '');
    enviar();
    const alteracao = await aguardarRequisicao(`/api/v1/clientes/${ANA.id}`);
    expect(alteracao.request.method).toBe('PATCH');
    expect(alteracao.request.body).toEqual({ telefone: null });
    alteracao.flush({ data: { ...ANA, telefone: null } });
    await responder(ATIVOS, [{ ...ANA, telefone: null }]);

    expect(tela.textContent).toContain('Sem telefone');
  });

  it('mostra o erro de gravação sem fechar o formulário', async () => {
    montar();
    await responder(ATIVOS, []);
    botao('Novo cliente').click();
    await fixture.whenStable();

    preencher('Nome', 'Carla');
    enviar();
    (await aguardarRequisicao('/api/v1/clientes')).flush(null, {
      status: 0,
      statusText: 'Unknown Error',
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('form [role="alert"]')?.textContent).toContain('Sem conexão');
    });
  });

  it('desabilita a busca quando a lista não carrega', async () => {
    montar();
    (await aguardarRequisicao(ATIVOS)).flush(null, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();

    expect(tela.querySelector<HTMLInputElement>('#busca-clientes')?.disabled).toBe(true);
    expect(tela.textContent).toContain('Não foi possível carregar os clientes');
  });
});
