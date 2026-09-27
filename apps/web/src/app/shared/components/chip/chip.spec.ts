import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Chip } from './chip';

@Component({
  imports: [Chip],
  template: `<ms-chip tom="positivo" icone="confirmado" [compacto]="true">Ativo</ms-chip>`,
})
class Hospedeiro {}

describe('Chip', () => {
  it('aplica o tom, o tamanho e mostra texto com ícone', () => {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector('ms-chip');

    expect(chip?.classList).toContain('tom-positivo');
    expect(chip?.classList).toContain('compacto');
    expect(chip?.textContent.trim()).toBe('Ativo');
    expect(chip?.querySelector('svg')).not.toBeNull();
  });
});
