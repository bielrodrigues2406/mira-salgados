import { type ComponentFixture, TestBed } from '@angular/core/testing';

import type { NovoPreco, PrecoProduto } from '../../../core/models/produto';
import { PrecoFormulario } from './preco-formulario';

const FRITO_CENTO: PrecoProduto = {
  id: 'p1',
  preparo: 'FRITO',
  unidadeVenda: 'CENTO',
  precoCentavos: 9500,
  vigenteDesde: '2026-09-01T10:00:00.000Z',
  vigenteAte: null,
};

describe('PrecoFormulario', () => {
  let fixture: ComponentFixture<PrecoFormulario>;
  let tela: HTMLElement;
  let enviados: NovoPreco[];

  async function montar(resposta: string | null = null): Promise<void> {
    enviados = [];
    fixture = TestBed.createComponent(PrecoFormulario);
    fixture.componentRef.setInput('vigentes', [FRITO_CENTO]);
    fixture.componentRef.setInput('salvar', (preco: NovoPreco) => {
      enviados.push(preco);
      return Promise.resolve(resposta);
    });
    tela = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function escolher(rotulo: string): void {
    const opcao = [...tela.querySelectorAll('label')].find((l) => l.textContent.trim() === rotulo);
    opcao?.querySelector('input')?.click();
  }

  function preencherPreco(valor: string): void {
    const campo = tela.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
    if (!campo) throw new Error('Campo de preço não encontrado');
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
  }

  function enviar(): void {
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('avisa quando o novo preço substitui o vigente da combinação', async () => {
    await montar();

    expect(tela.textContent).toContain('Substitui o preço vigente de Frito · Cento');
    expect(tela.textContent.replace(/\s/g, ' ')).toContain('R$ 95,00');

    escolher('Congelado');
    await fixture.whenStable();
    expect(tela.textContent).not.toContain('Substitui o preço vigente');
  });

  it('valida o valor antes de enviar', async () => {
    await montar();

    enviar();
    await fixture.whenStable();
    expect(tela.textContent).toContain('Informe o preço.');

    preencherPreco('9,5,0');
    await fixture.whenStable();
    expect(tela.textContent).toContain('Use um valor como 95,00.');

    preencherPreco('0');
    await fixture.whenStable();
    expect(tela.textContent).toContain('O preço precisa ser maior que zero.');
    expect(enviados).toEqual([]);
  });

  it('envia a combinação escolhida com o preço em centavos', async () => {
    await montar();

    escolher('Assado');
    escolher('Unidade');
    preencherPreco('1,40');
    enviar();
    await fixture.whenStable();

    expect(enviados).toEqual([{ preparo: 'ASSADO', unidadeVenda: 'UNIDADE', precoCentavos: 140 }]);
  });

  it('mostra o erro devolvido pela gravação', async () => {
    await montar('Este já é o preço vigente de Frito · Cento.');

    preencherPreco('95,00');
    enviar();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
        'Este já é o preço vigente',
      );
    });
  });
});
