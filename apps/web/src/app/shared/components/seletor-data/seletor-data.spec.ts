import { TestBed } from '@angular/core/testing';

import { SeletorData } from './seletor-data';

describe('SeletorData', () => {
  function montar(): { tela: HTMLElement; emitidas: string[] } {
    const fixture = TestBed.createComponent(SeletorData);
    fixture.componentRef.setInput('data', '2026-10-02');
    fixture.componentRef.setInput('rotulo', 'Data do acerto');
    const emitidas: string[] = [];
    fixture.componentInstance.dataMudou.subscribe((data) => emitidas.push(data));
    fixture.detectChanges();
    return { tela: fixture.nativeElement as HTMLElement, emitidas };
  }

  it('mostra a data por extenso e rotula o campo para leitores de tela', () => {
    const { tela } = montar();

    expect(tela.textContent).toContain('Sex, 2 de outubro de 2026');
    const campo = tela.querySelector<HTMLInputElement>('input[type="date"]');
    expect(campo?.value).toBe('2026-10-02');
    expect(tela.querySelector(`label[for="${campo?.id ?? ''}"]`)?.textContent).toContain(
      'Data do acerto',
    );
  });

  it('anda um dia para trás e para frente, atravessando o mês', () => {
    const { tela, emitidas } = montar();

    tela.querySelector<HTMLButtonElement>('[aria-label="Dia anterior"]')?.click();
    tela.querySelector<HTMLButtonElement>('[aria-label="Próximo dia"]')?.click();

    expect(emitidas).toEqual(['2026-10-01', '2026-10-03']);
  });

  it('emite a data escolhida no calendário e ignora campo apagado', () => {
    const { tela, emitidas } = montar();
    const campo = tela.querySelector<HTMLInputElement>('input[type="date"]');
    if (!campo) throw new Error('Campo de data não encontrado');

    campo.value = '2026-09-15';
    campo.dispatchEvent(new Event('change'));
    campo.value = '';
    campo.dispatchEvent(new Event('change'));

    expect(emitidas).toEqual(['2026-09-15']);
  });
});
