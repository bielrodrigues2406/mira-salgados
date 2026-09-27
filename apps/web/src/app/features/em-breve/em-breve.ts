import { Component, input } from '@angular/core';

import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';

/** Destino da navegação cujo módulo ainda não foi entregue. */
@Component({
  selector: 'ms-em-breve',
  imports: [EstadoVazio],
  templateUrl: './em-breve.html',
  styleUrl: './em-breve.css',
})
export class EmBreve {
  /** Preenchido pelo `data` da rota. */
  readonly titulo = input.required<string>();
}
