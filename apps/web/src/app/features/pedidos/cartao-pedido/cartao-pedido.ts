import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PedidoResumo } from '../../../core/models/pedido';
import { ChipStatus } from '../../../shared/components/chip-status/chip-status';
import { Icone } from '../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { quandoEntregar } from '../../../shared/utils/datas';

/** Cartão da lista: número, cliente e estado em cima; entrega e valores embaixo. */
@Component({
  selector: 'ms-cartao-pedido',
  imports: [ChipStatus, Icone, MoedaPipe, RouterLink],
  templateUrl: './cartao-pedido.html',
  styleUrl: './cartao-pedido.css',
})
export class CartaoPedido {
  readonly pedido = input.required<PedidoResumo>();
  /** Dia de hoje (AAAA-MM-DD), para destacar e escrever o horário. */
  readonly hoje = input.required<string>();

  protected readonly ehHoje = computed(() => this.pedido().dataEntrega === this.hoje());
  protected readonly quando = computed(() =>
    quandoEntregar(this.pedido().dataEntrega, this.pedido().horarioEntrega, this.hoje()),
  );
  protected readonly cancelado = computed(() => this.pedido().status === 'CANCELADO');
}
