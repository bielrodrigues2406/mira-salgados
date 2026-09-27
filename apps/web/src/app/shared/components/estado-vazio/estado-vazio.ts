import { Component, input } from '@angular/core';

import { idUnico } from '../../utils/id-unico';
import { Icone } from '../icone/icone';
import type { NomeIcone } from '../icone/icones';

/** Cartão de ausência de dados: diz o que falta e oferece o próximo passo. */
@Component({
  selector: 'ms-estado-vazio',
  imports: [Icone],
  templateUrl: './estado-vazio.html',
  styleUrl: './estado-vazio.css',
})
export class EstadoVazio {
  readonly icone = input.required<NomeIcone>();
  readonly titulo = input.required<string>();

  protected readonly idTitulo = idUnico('estado-vazio');
}
