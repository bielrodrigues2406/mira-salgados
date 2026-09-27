import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { FaixaDeHorario } from '../../../core/models/producao';
import { Chip } from '../../../shared/components/chip/chip';
import { ChipPreparo } from '../../../shared/components/chip-preparo/chip-preparo';
import { ChipStatus } from '../../../shared/components/chip-status/chip-status';
import { Icone } from '../../../shared/components/icone/icone';
import { contagem, numero, rotuloDaVenda } from '../textos';

/** Modo cronológico: uma faixa por horário, com os pedidos e o que fazer em cada um. */
@Component({
  selector: 'ms-linha-do-tempo',
  imports: [Chip, ChipPreparo, ChipStatus, Icone, RouterLink],
  templateUrl: './linha-do-tempo.html',
  styleUrl: './linha-do-tempo.css',
})
export class LinhaDoTempo {
  readonly faixas = input.required<readonly FaixaDeHorario[]>();

  protected readonly numero = numero;
  protected readonly rotuloDaVenda = rotuloDaVenda;

  protected resumo(faixa: FaixaDeHorario): string {
    const encomendas = contagem(faixa.pedidos.length, 'encomenda', 'encomendas');
    return `${encomendas} · ${contagem(faixa.unidades, 'salgado', 'salgados')}`;
  }
}
