import { Pipe, type PipeTransform } from '@angular/core';

import { formatarMoeda } from '../utils/dinheiro';

/** Centavos inteiros para "R$ 95,00". */
@Pipe({ name: 'moeda' })
export class MoedaPipe implements PipeTransform {
  transform(centavos: number): string {
    return formatarMoeda(centavos);
  }
}
