import { Component, input } from '@angular/core';

import { Icone } from '../icone/icone';
import type { NomeIcone } from '../icone/icones';

export type TomDoChip = 'positivo' | 'neutro' | 'frito' | 'assado' | 'congelado';

/**
 * Marcador de estado ou categoria. A cor nunca é o único sinal: o texto e o
 * ícone carregam o significado, como pede o design.
 */
@Component({
  selector: 'ms-chip',
  imports: [Icone],
  templateUrl: './chip.html',
  styleUrl: './chip.css',
  host: {
    '[class]': "'tom-' + tom()",
    '[class.compacto]': 'compacto()',
  },
})
export class Chip {
  readonly tom = input.required<TomDoChip>();
  readonly icone = input<NomeIcone>();
  /** 22 px de altura, para marcadores ao lado de nomes em listas. */
  readonly compacto = input(false);
}
