import { Component, input } from '@angular/core';

import type { LinhaConsolidada, ProducaoDoDia } from '../../../core/models/producao';
import { Chip } from '../../../shared/components/chip/chip';
import {
  APARENCIA_DO_PREPARO,
  ChipPreparo,
} from '../../../shared/components/chip-preparo/chip-preparo';
import { composicao, contagem, listaDePedidos, numero } from '../textos';

/** Modo consolidado: volume por produto, preparo e produtor, sem divisão por pedido. */
@Component({
  selector: 'ms-producao-consolidada',
  imports: [Chip, ChipPreparo],
  templateUrl: './producao-consolidada.html',
  styleUrl: './producao-consolidada.css',
})
export class ProducaoConsolidada {
  readonly producao = input.required<ProducaoDoDia>();

  protected readonly aparencia = APARENCIA_DO_PREPARO;
  protected readonly numero = numero;
  protected readonly contagem = contagem;

  protected detalhe(linha: LinhaConsolidada): string {
    return `${composicao(linha.centos, linha.avulsas)} · ${listaDePedidos(linha.pedidos)}`;
  }
}
