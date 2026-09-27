import { Component, input } from '@angular/core';

import { Icone } from '../../shared/components/icone/icone';

/** Destino da navegação cujo módulo ainda não foi entregue. */
@Component({
  selector: 'ms-em-breve',
  imports: [Icone],
  templateUrl: './em-breve.html',
  styleUrl: './em-breve.css',
})
export class EmBreve {
  /** Preenchido pelo `data` da rota. */
  readonly titulo = input.required<string>();
}
