import { Component, computed, input } from '@angular/core';

import type { Preparo } from '../../../core/models/produto';
import { Chip, type TomDoChip } from '../chip/chip';
import type { NomeIcone } from '../icone/icones';

interface Aparencia {
  rotulo: string;
  tom: TomDoChip;
  icone: NomeIcone;
}

export const APARENCIA_DO_PREPARO: Record<Preparo, Aparencia> = {
  FRITO: { rotulo: 'Frito', tom: 'frito', icone: 'frito' },
  ASSADO: { rotulo: 'Assado', tom: 'assado', icone: 'assado' },
  CONGELADO: { rotulo: 'Congelado', tom: 'congelado', icone: 'congelado' },
};

/** Preparo com cor, ícone e texto: forno e fritura são identificados de relance. */
@Component({
  selector: 'ms-chip-preparo',
  imports: [Chip],
  templateUrl: './chip-preparo.html',
})
export class ChipPreparo {
  readonly preparo = input.required<Preparo>();

  protected readonly aparencia = computed(() => APARENCIA_DO_PREPARO[this.preparo()]);
}
