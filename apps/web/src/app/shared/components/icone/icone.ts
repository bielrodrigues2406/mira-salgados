import { Component, computed, input } from '@angular/core';

import { ICONES, type NomeIcone } from './icones';

// Traço de 1,5 px na tela em qualquer tamanho: no grid de 24 unidades a largura
// do traço é compensada pela escala (2,57 a 14 px, 2,25 a 16 px, 1,8 a 20 px).
const TRACO_EM_PIXELS = 1.5;
const GRID = 24;

@Component({
  selector: 'ms-icone',
  templateUrl: './icone.html',
  styleUrl: './icone.css',
})
export class Icone {
  readonly nome = input.required<NomeIcone>();
  readonly tamanho = input<14 | 16 | 20 | 24>(16);

  protected readonly formas = computed(() => ICONES[this.nome()]);
  protected readonly espessura = computed(() => (TRACO_EM_PIXELS * GRID) / this.tamanho());
}
