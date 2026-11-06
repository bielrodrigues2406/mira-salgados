import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Saldos } from '../../core/models/relatorios';
import type { Repasse } from '../../core/models/repasse';
import { hoje } from '../../shared/utils/datas';
import { Repasses } from './repasses';

const MIRA = { id: 'mira', nome: 'Mira' };
const GABRIEL = { id: 'gabriel', nome: 'Gabriel' };

function saldos(recebidoMira = 0): Saldos {
  return {
    data: hoje(),
    produtores: [
      {
        produtor: { ...GABRIEL, ativo: true },
        aReceberCentavos: 21000,
        recebidoCentavos: 21000,
        faltaCentavos: 0,
      },
      {
        produtor: { ...MIRA, ativo: true },
        aReceberCentavos: 20233,
        recebidoCentavos: recebidoMira,
        faltaCentavos: 20233 - recebidoMira,
      },
    ],
    totais: {
      aReceberCentavos: 41233,
      recebidoCentavos: 21000 + recebidoMira,
      faltaCentavos: 20233 - recebidoMira,
    },
  };
}

function repasse(dados: Partial<Repasse> = {}): Repasse {
  return {
    id: 'r1',
    produtor: GABRIEL,
    valorCentavos: 21000,
    forma: 'DINHEIRO',
    data: '2026-11-02',
    observacao: 'semana passada',
    registradoPor: { id: 'u1', nome: 'Gabriel Rodrigues' },
    criadoEm: '2026-11-02T20:00:00.000Z',
    desfeitoEm: null,
    desfeitoPor: null,
    ...dados,
  };
}

describe('Repasses', () => {
  let fixture: ComponentFixture<Repasses>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  function aguardar(filtro: (url: string) => boolean): Promise<TestRequest> {
    return vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne((r) => filtro(r.urlWithParams));
    });
  }

  async function montar(lista: Repasse[] = [repasse()]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Repasses],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Repasses);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    (await aguardar((url) => url.includes('/relatorios/saldos'))).flush({ data: saldos() });
    (await aguardar((url) => url.includes('/repasses?'))).flush({
      data: lista,
      meta: { page: 1, pageSize: 20, total: lista.length, totalPages: 1 },
    });
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = [...tela.querySelectorAll('button')].find(
      (b) =>
        b.textContent.trim() === texto ||
        b.getAttribute('aria-label')?.replace(/\s+/g, ' ') === texto,
    );
    if (!encontrado) throw new Error(`Botão "${texto}" não encontrado`);
    return encontrado;
  }

  function texto(): string {
    return tela.textContent.replace(/\s+/g, ' ');
  }

  // O pipe de moeda usa espaço sem quebra entre "R$" e o valor.
  function textoDe(seletor: string): string | undefined {
    return tela.querySelector(seletor)?.textContent.replace(/\s+/g, ' ').trim();
  }

  afterEach(() => {
    backend.verify();
  });

  it('mostra o que falta repassar a cada um, sem exigir registro', async () => {
    await montar();

    expect(textoDe('.totais-valor')).toBe('R$ 202,33');
    expect(texto()).toContain('R$ 412,33 em salgados · R$ 210,00 já repassado');
    const linhas = [...tela.querySelectorAll('.saldo h2')].map((h) => h.textContent.trim());
    expect(linhas).toEqual(['Gabriel', 'Mira']);
    const faltas = [...tela.querySelectorAll('.saldo-falta')].map((f) =>
      f.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(faltas).toEqual(['R$ 0,00 em dia', 'R$ 202,33 falta']);
    expect(texto()).toContain('Gabriel R$ 210,00');
    expect(texto()).toContain('semana passada');
  });

  it('registra um repasse com o que falta já preenchido e recarrega o saldo', async () => {
    await montar();

    const botoes = [...tela.querySelectorAll<HTMLButtonElement>('button.registrar')];
    botoes[1]?.click();
    await fixture.whenStable();
    const valor = tela.querySelector<HTMLInputElement>('#repasse-valor');
    expect(valor?.value).toBe('202,33');
    if (!valor) throw new Error('Campo de valor não encontrado');
    valor.value = '100,00';
    valor.dispatchEvent(new Event('input'));
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const envio = await aguardar((url) => url.endsWith('/api/v1/repasses'));
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body).toEqual({
      produtorId: 'mira',
      valorCentavos: 10000,
      forma: 'PIX',
      data: hoje(),
      observacao: null,
    });
    envio.flush({ data: repasse({ id: 'r2', produtor: MIRA, valorCentavos: 10000 }) });
    (await aguardar((url) => url.includes('/relatorios/saldos'))).flush({ data: saldos(10000) });
    (await aguardar((url) => url.includes('/repasses?'))).flush({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    await fixture.whenStable();

    expect(texto()).toContain('Repasse de R$ 100,00 para Mira registrado.');
    expect(textoDe('.totais-valor')).toBe('R$ 102,33');
  });

  it('desfaz um repasse depois de confirmar', async () => {
    await montar();

    botao('Desfazer repasse de R$ 210,00 para Gabriel').click();
    await fixture.whenStable();
    expect(texto()).toContain('O valor volta a faltar.');
    botao('Desfazer').click();

    const envio = await aguardar((url) => url.endsWith('/api/v1/repasses/r1'));
    expect(envio.request.method).toBe('DELETE');
    envio.flush({ data: repasse({ desfeitoEm: '2026-11-06T10:00:00.000Z' }) });
    (await aguardar((url) => url.includes('/relatorios/saldos'))).flush({ data: saldos() });
    (await aguardar((url) => url.includes('/repasses?'))).flush({
      data: [
        repasse({
          desfeitoEm: '2026-11-06T10:00:00.000Z',
          desfeitoPor: { id: 'u1', nome: 'Gabriel Rodrigues' },
        }),
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();

    expect(texto()).toContain('Repasse de R$ 210,00 para Gabriel desfeito.');
    expect(tela.querySelector('.selo-desfeito')?.textContent.trim()).toBe('Desfeito');
  });
});
