import { Component, computed, input } from '@angular/core';

import type { PedidoDetalhe } from '../../../../core/models/pedido';
import { Icone } from '../../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../../shared/pipes/moeda.pipe';

@Component({
  selector: 'ms-resumo-financeiro',
  imports: [Icone, MoedaPipe],
  templateUrl: './resumo-financeiro.html',
  styleUrl: './resumo-financeiro.css',
})
export class ResumoFinanceiro {
  readonly pedido = input.required<PedidoDetalhe>();

  protected readonly resumo = computed(() => this.pedido().resumo);
  /** Percentual recebido, arredondado para baixo: 99,6% ainda não é "100%". */
  protected readonly percentualRecebido = computed(() => {
    const { totalCentavos, totalPagoCentavos } = this.resumo();
    if (totalCentavos <= 0) return 100;
    return Math.min(100, Math.floor((totalPagoCentavos * 100) / totalCentavos));
  });
  protected readonly quantidadeItens = computed(() => this.pedido().itens.length);
}
