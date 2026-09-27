import { TestBed } from '@angular/core/testing';

import type { PaginacaoMeta } from '../../../core/models/api';
import { Paginacao } from './paginacao';

describe('Paginacao', () => {
  function montar(meta: PaginacaoMeta) {
    const fixture = TestBed.createComponent(Paginacao);
    fixture.componentRef.setInput('meta', meta);
    fixture.detectChanges();
    const paginas: number[] = [];
    fixture.componentInstance.paginaMudou.subscribe((pagina) => paginas.push(pagina));
    return { tela: fixture.nativeElement as HTMLElement, paginas };
  }

  function botao(tela: HTMLElement, rotulo: string): HTMLButtonElement {
    const encontrado = tela.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`);
    if (!encontrado) throw new Error(`Botão ${rotulo} não encontrado`);
    return encontrado;
  }

  it('não aparece com uma única página', () => {
    const { tela } = montar({ page: 1, pageSize: 20, total: 3, totalPages: 1 });

    expect(tela.querySelector('nav')).toBeNull();
  });

  it('mostra a posição e emite a página escolhida', () => {
    const { tela, paginas } = montar({ page: 2, pageSize: 20, total: 50, totalPages: 3 });

    botao(tela, 'Página anterior').click();
    botao(tela, 'Próxima página').click();

    expect(tela.textContent).toContain('Página 2 de 3');
    expect(paginas).toEqual([1, 3]);
  });

  it('desabilita os extremos', () => {
    const { tela } = montar({ page: 1, pageSize: 20, total: 50, totalPages: 3 });

    expect(botao(tela, 'Página anterior').disabled).toBe(true);
    expect(botao(tela, 'Próxima página').disabled).toBe(false);
  });
});
