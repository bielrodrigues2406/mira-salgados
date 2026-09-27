import { Component, computed, input, output } from '@angular/core';

import { mensagemDeCarregamento } from '../../../core/services/mensagem-de-erro';
import { idUnico } from '../../utils/id-unico';
import { Icone } from '../icone/icone';

/** Falha ao carregar dados, com nova tentativa. Nada foi alterado no servidor. */
@Component({
  selector: 'ms-estado-erro',
  imports: [Icone],
  templateUrl: './estado-erro.html',
  styleUrl: './estado-erro.css',
})
export class EstadoErro {
  readonly titulo = input.required<string>();
  readonly erro = input<unknown>();
  /** Nova tentativa em andamento, depois de uma falha. */
  readonly tentando = input(false);
  readonly tentarNovamente = output();

  protected readonly mensagem = computed(() => mensagemDeCarregamento(this.erro()));
  protected readonly idTitulo = idUnico('estado-erro');
}
