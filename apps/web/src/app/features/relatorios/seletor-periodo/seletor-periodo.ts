import { Component, computed, input, linkedSignal, output } from '@angular/core';

import type { Periodo } from '../../../core/models/relatorios';
import { dataDoCalendario, hoje } from '../../../shared/utils/datas';
import { idUnico } from '../../../shared/utils/id-unico';
import { atalhosDePeriodo, erroDoPeriodo } from '../periodo';

/**
 * Atalhos de período e as duas datas. Só emite períodos válidos; enquanto as
 * datas digitadas não formam um intervalo aceito, mostra o motivo e mantém o
 * relatório no último período válido.
 */
@Component({
  selector: 'ms-seletor-periodo',
  templateUrl: './seletor-periodo.html',
  styleUrl: './seletor-periodo.css',
})
export class SeletorPeriodo {
  readonly periodo = input.required<Periodo>();
  readonly periodoMudou = output<Periodo>();

  protected readonly id = idUnico('periodo');
  protected readonly atalhos = atalhosDePeriodo(hoje());
  /** O que está nos campos, que pode ainda não ser um período válido. */
  protected readonly rascunho = linkedSignal(() => this.periodo());
  protected readonly erro = computed(() => {
    const { de, ate } = this.rascunho();
    if (!dataDoCalendario(de) || !dataDoCalendario(ate)) return 'Preencha as duas datas.';
    return erroDoPeriodo({ de, ate });
  });

  protected ehAtual(atalho: Periodo): boolean {
    const atual = this.periodo();
    return atalho.de === atual.de && atalho.ate === atual.ate;
  }

  protected escolher(periodo: Periodo): void {
    this.rascunho.set({ de: periodo.de, ate: periodo.ate });
    this.emitirSeValido();
  }

  protected alterar(campo: keyof Periodo, valor: string): void {
    this.rascunho.update((atual) => ({ ...atual, [campo]: valor }));
    this.emitirSeValido();
  }

  private emitirSeValido(): void {
    const rascunho = this.rascunho();
    const atual = this.periodo();
    if (this.erro() !== null) return;
    if (rascunho.de === atual.de && rascunho.ate === atual.ate) return;
    this.periodoMudou.emit({ de: rascunho.de, ate: rascunho.ate });
  }
}
