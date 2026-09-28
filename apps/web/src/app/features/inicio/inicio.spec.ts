import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Painel } from '../../core/models/painel';
import { AuthService } from '../../core/services/auth.service';
import { hoje, somarDias } from '../../shared/utils/datas';
import { Inicio, saudacao } from './inicio';

const MIRA = { id: 'mira', nome: 'Mira' };
const COXINHA = { id: 'coxinha', nome: 'Coxinha' };

function painel(produz: boolean): Painel {
  const data = hoje();
  return {
    data,
    produtor: produz ? MIRA : null,
    hoje: {
      quantidadePedidos: 3,
      unidades: 650,
      aEntregar: [
        {
          id: 'p7',
          numero: 7,
          horario: '10:00',
          tipoEntrega: 'ENTREGA',
          enderecoEntrega: 'Rua das Flores, 10',
          cliente: { id: 'c1', nome: 'Ana Paula Ribeiro' },
          unidades: 300,
        },
        {
          id: 'p9',
          numero: 9,
          horario: null,
          tipoEntrega: 'RETIRADA',
          enderecoEntrega: null,
          cliente: { id: 'c2', nome: 'Buffet Sabor & Arte' },
          unidades: 100,
        },
      ],
      semPagamento: { valorCentavos: 28000, pedidos: [7] },
    },
    proximosDias: Array.from({ length: 7 }, (_, indice) => ({
      data: somarDias(data, indice),
      unidades: indice === 2 ? 800 : indice === 0 ? 650 : 0,
      minhasUnidades: produz ? (indice === 2 ? 400 : indice === 0 ? 300 : 0) : null,
      meusSalgados: produz
        ? indice === 0
          ? [{ produto: COXINHA, preparo: 'FRITO', unidades: 300 }]
          : []
        : null,
    })),
    ganhos: produz
      ? {
          semana: {
            de: data,
            ate: data,
            unidades: 400,
            produzidoCentavos: 38000,
            recebidoCentavos: 28500,
          },
          mes: {
            de: data,
            ate: data,
            unidades: 1200,
            produzidoCentavos: 114000,
            recebidoCentavos: 90000,
          },
        }
      : null,
    familia: {
      semana: {
        de: data,
        ate: data,
        unidades: 2000,
        faturamentoCentavos: 190000,
        caixaCentavos: 150000,
      },
      fiados: { totalEmAbertoCentavos: 5000, quantidadePedidos: 1 },
      rascunhos: 2,
    },
  };
}

describe('saudacao', () => {
  it('cumprimenta pela hora do dia', () => {
    expect(saudacao(new Date(2026, 9, 1, 8))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 9, 1, 14))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 9, 1, 20))).toBe('Boa noite');
  });
});

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let backend: HttpTestingController;
  let tela: HTMLElement;

  async function abrir(resposta: Painel): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: signal({ nome: 'Mira Rodrigues' }) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inicio);
    tela = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const requisicao = await vi.waitFor(() => {
      TestBed.tick();
      return backend.expectOne(`/api/v1/painel?data=${hoje()}`);
    });
    requisicao.flush({ data: resposta });
    await fixture.whenStable();
  }

  function textos(seletor: string): string[] {
    return [...tela.querySelectorAll(seletor)].map((elemento) =>
      elemento.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  afterEach(() => {
    backend.verify();
  });

  it('para quem produz: a própria produção, os próximos dias e os ganhos', async () => {
    await abrir(painel(true));

    expect(tela.querySelector('h1')?.textContent).toContain('Mira');
    expect(tela.querySelector('.destaque-rotulo')?.textContent).toContain('Você faz hoje');
    expect(tela.querySelector('.destaque-numero')?.textContent.trim()).toBe('300');
    expect(textos('.destaque-salgados li')).toEqual(['300 Coxinha']);
    expect(tela.textContent).toContain('Sua produção nos próximos dias');
    expect(textos('.proximo-numero')).toEqual(['–', '400', '–', '–', '–', '–']);
    expect(textos('.ganho-valor').slice(0, 2)).toEqual(['R$ 380,00', 'R$ 1.140,00']);
    expect(textos('.ganho dd').join(' ')).toContain('R$ 285,00 já recebido');
  });

  it('mostra as entregas de hoje e o que precisa de atenção', async () => {
    await abrir(painel(false));

    expect(textos('.entrega-horario')).toEqual(['10:00', 'Sem horário']);
    expect(textos('.entrega-cliente')).toEqual(['Ana Paula Ribeiro', 'Buffet Sabor & Arte']);
    expect(tela.querySelector('a.entrega')?.getAttribute('href')).toBe('/pedidos/p7');
    const avisos = textos('.aviso-texto');
    expect(avisos[0]).toContain('R$ 280,00 sem pagamento hoje (pedido #7)');
    expect(avisos[1]).toContain('2 rascunhos');
    expect(avisos[2]).toContain('R$ 50,00 em fiado a receber');
  });

  it('para quem não produz: o dia da família, sem ganhos', async () => {
    await abrir(painel(false));

    expect(tela.querySelector('.destaque-numero')?.textContent.trim()).toBe('650');
    expect(tela.textContent).not.toContain('Seus ganhos');
    expect(tela.textContent).toContain('Semana da família');
    expect(textos('.proximo-numero')).toEqual(['–', '800', '–', '–', '–', '–']);
  });
});
