import { Component, computed, input } from '@angular/core';

import type { StatusPagamento, StatusPedido } from '../../../core/models/pedido';
import { Chip, type TomDoChip } from '../chip/chip';
import type { NomeIcone } from '../icone/icones';

interface Aparencia {
  rotulo: string;
  tom: TomDoChip;
  icone: NomeIcone;
}

export const APARENCIA_DO_STATUS: Record<StatusPedido, Aparencia> = {
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro', icone: 'rascunho' },
  CONFIRMADO: { rotulo: 'Confirmado', tom: 'acao', icone: 'confirmado' },
  CONCLUIDO: { rotulo: 'Concluído', tom: 'positivo', icone: 'concluido' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'negativo', icone: 'cancelado' },
};

export const APARENCIA_DO_PAGAMENTO: Record<StatusPagamento, Aparencia> = {
  PENDENTE: { rotulo: 'Pendente', tom: 'negativo', icone: 'pagamentoPendente' },
  PARCIAL: { rotulo: 'Parcial', tom: 'atencao', icone: 'pagamentoParcial' },
  PAGO: { rotulo: 'Pago', tom: 'positivo', icone: 'pagamentoPago' },
};

/** Estado do pedido ou do pagamento, sempre com ícone e texto além da cor. */
@Component({
  selector: 'ms-chip-status',
  imports: [Chip],
  templateUrl: './chip-status.html',
})
export class ChipStatus {
  readonly status = input<StatusPedido>();
  readonly pagamento = input<StatusPagamento>();
  /** Texto longo do pagamento, como no detalhe: "Pagamento parcial". */
  readonly extenso = input(false);

  protected readonly aparencia = computed((): Aparencia | undefined => {
    const status = this.status();
    if (status) return APARENCIA_DO_STATUS[status];
    const pagamento = this.pagamento();
    if (!pagamento) return undefined;
    const aparencia = APARENCIA_DO_PAGAMENTO[pagamento];
    return this.extenso()
      ? { ...aparencia, rotulo: `Pagamento ${aparencia.rotulo.toLowerCase()}` }
      : aparencia;
  });
}
