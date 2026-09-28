import { type ComponentFixture, TestBed } from '@angular/core/testing';

import type { Arquivo } from '../../utils/arquivo';
import { Compartilhar } from './compartilhar';

describe('Compartilhar', () => {
  let fixture: ComponentFixture<Compartilhar>;
  let tela: HTMLElement;

  async function montar(entradas: Record<string, unknown>): Promise<void> {
    fixture = TestBed.createComponent(Compartilhar);
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    tela = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return [...tela.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  }

  it('abre o WhatsApp com o texto e o celular', async () => {
    await montar({ mensagem: 'Oi', telefone: '11987654321' });

    const link = tela.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://wa.me/5511987654321?text=Oi');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(botao('Planilha')).toBeUndefined();
  });

  it('baixa a planilha gerada na hora do clique', async () => {
    const criarUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste');
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue();
    const arquivo: Arquivo = { nome: 'fiados.csv', conteudo: 'a;b', tipo: 'text/csv' };
    await montar({ gerarPlanilha: () => Promise.resolve(arquivo) });

    botao('Planilha')?.click();
    await fixture.whenStable();

    expect(criarUrl).toHaveBeenCalledOnce();
    expect(clique).toHaveBeenCalledOnce();
    expect(revogar).toHaveBeenCalledWith('blob:teste');
    vi.restoreAllMocks();
  });

  it('avisa quando a planilha não pode ser gerada', async () => {
    await montar({ gerarPlanilha: () => Promise.reject(new Error('rede')) });

    botao('Planilha')?.click();
    await fixture.whenStable();

    expect(tela.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível gerar a planilha',
    );
  });

  it('imprime pela janela do navegador', async () => {
    const imprimir = vi.spyOn(window, 'print').mockReturnValue();
    await montar({});

    botao('Imprimir')?.click();

    expect(imprimir).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
