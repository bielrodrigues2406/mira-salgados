import { ApplicationRef, createComponent, EnvironmentInjector, inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Chip } from './chip';

describe('Chip', () => {
  it('aplica o tom, o tamanho e mostra texto com ícone', async () => {
    const chip = createComponent(Chip, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      projectableNodes: [[document.createTextNode('Ativo')]],
      bindings: [
        inputBinding('tom', () => 'positivo'),
        inputBinding('icone', () => 'confirmado'),
        inputBinding('compacto', () => true),
      ],
    });
    const aplicacao = TestBed.inject(ApplicationRef);
    aplicacao.attachView(chip.hostView);
    await aplicacao.whenStable();
    const elemento = chip.location.nativeElement as HTMLElement;

    expect(elemento.classList).toContain('tom-positivo');
    expect(elemento.classList).toContain('compacto');
    expect(elemento.textContent.trim()).toBe('Ativo');
    expect(elemento.querySelector('svg')).not.toBeNull();

    chip.destroy();
  });
});
