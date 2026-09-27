import { Component, input } from '@angular/core';
import type { FieldState } from '@angular/forms/signals';

import { Icone } from '../icone/icone';

/** Mensagens de validação de um campo, exibidas depois que ele foi tocado. */
@Component({
  selector: 'ms-erros-do-campo',
  imports: [Icone],
  templateUrl: './erros-do-campo.html',
  styleUrl: './erros-do-campo.css',
})
export class ErrosDoCampo {
  readonly estado = input.required<FieldState<unknown>>();
}
