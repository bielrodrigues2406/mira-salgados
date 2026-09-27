import { Component, computed, input, output } from '@angular/core';

import { dataCompleta, dataDoCalendario, somarDias } from '../../utils/datas';
import { idUnico } from '../../utils/id-unico';
import { Icone } from '../icone/icone';

/**
 * Dia anterior, data escolhida no calendário do aparelho e próximo dia. O
 * campo de data nativo fica sobre o texto formatado: tocar na data abre o
 * seletor do sistema, com teclado e leitor de tela funcionando como sempre.
 */
@Component({
  selector: 'ms-seletor-data',
  imports: [Icone],
  templateUrl: './seletor-data.html',
  styleUrl: './seletor-data.css',
})
export class SeletorData {
  /** AAAA-MM-DD */
  readonly data = input.required<string>();
  /** Nome do campo para leitores de tela, como "Data do acerto". */
  readonly rotulo = input.required<string>();
  readonly dataMudou = output<string>();

  protected readonly id = idUnico('seletor-data');
  protected readonly texto = computed(() => dataCompleta(this.data()));

  protected mover(dias: number): void {
    this.dataMudou.emit(somarDias(this.data(), dias));
  }

  /** No desktop o clique no texto do campo não abre o calendário por conta própria. */
  protected abrirCalendario(campo: HTMLInputElement): void {
    try {
      campo.showPicker();
    } catch {
      // Navegador sem showPicker ou já com o seletor aberto: o campo segue editável.
    }
  }

  protected escolher(valor: string): void {
    const data = dataDoCalendario(valor);
    if (data && data !== this.data()) this.dataMudou.emit(data);
  }
}
