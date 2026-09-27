import { TestBed } from '@angular/core/testing';

import type { Periodo } from '../../../core/models/relatorios';
import { hoje } from '../../../shared/utils/datas';
import { esteMes } from '../periodo';
import { SeletorPeriodo } from './seletor-periodo';

describe('SeletorPeriodo', () => {
  function montar(periodo: Periodo = esteMes(hoje())): { tela: HTMLElement; emitidos: Periodo[] } {
    const fixture = TestBed.createComponent(SeletorPeriodo);
    fixture.componentRef.setInput('periodo', periodo);
    const emitidos: Periodo[] = [];
    fixture.componentInstance.periodoMudou.subscribe((novo) => emitidos.push(novo));
    fixture.detectChanges();
    return { tela: fixture.nativeElement as HTMLElement, emitidos };
  }

  function campo(tela: HTMLElement, rotulo: string): HTMLInputElement {
    const label = [...tela.querySelectorAll('label')].find((l) => l.textContent.trim() === rotulo);
    const encontrado = tela.querySelector<HTMLInputElement>(`#${label?.htmlFor ?? 'x'}`);
    if (!encontrado) throw new Error(`Campo ${rotulo} não encontrado`);
    return encontrado;
  }

  it('marca o atalho do período atual e emite o atalho escolhido', () => {
    const { tela, emitidos } = montar();
    const atalhos = [...tela.querySelectorAll<HTMLButtonElement>('.atalho')];

    expect(atalhos.map((a) => [a.textContent.trim(), a.getAttribute('aria-pressed')])).toEqual([
      ['Este mês', 'true'],
      ['Mês passado', 'false'],
      ['Últimos 7 dias', 'false'],
      ['Últimos 30 dias', 'false'],
    ]);
    atalhos[2]?.click();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0]?.ate).toBe(hoje());
  });

  it('emite datas digitadas quando formam um período válido', () => {
    const { tela, emitidos } = montar({ de: '2026-10-01', ate: '2026-10-31' });

    const inicio = campo(tela, 'De');
    inicio.value = '2026-10-10';
    inicio.dispatchEvent(new Event('change'));

    expect(emitidos).toEqual([{ de: '2026-10-10', ate: '2026-10-31' }]);
  });

  it('explica e não emite quando o fim vem antes do início', async () => {
    const fixture = TestBed.createComponent(SeletorPeriodo);
    fixture.componentRef.setInput('periodo', { de: '2026-10-01', ate: '2026-10-31' });
    const emitidos: Periodo[] = [];
    fixture.componentInstance.periodoMudou.subscribe((novo) => emitidos.push(novo));
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    const fim = campo(tela, 'Até');
    fim.value = '2026-09-01';
    fim.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(emitidos).toEqual([]);
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain('igual ou posterior');
    expect(fim.getAttribute('aria-invalid')).toBe('true');
  });
});
