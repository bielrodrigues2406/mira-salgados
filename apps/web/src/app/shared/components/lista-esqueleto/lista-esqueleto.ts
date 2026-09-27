import { Component, computed, input } from '@angular/core';

// Larguras alternadas para que o esqueleto lembre uma lista real.
const LARGURAS = [62, 48, 70, 54];

/** Lista em esqueleto no primeiro carregamento; anuncia o carregamento a leitores de tela. */
@Component({
  selector: 'ms-lista-esqueleto',
  templateUrl: './lista-esqueleto.html',
  styleUrl: './lista-esqueleto.css',
})
export class ListaEsqueleto {
  /** Texto anunciado, como "Carregando produtores". */
  readonly rotulo = input.required<string>();
  readonly quantidade = input(4);
  readonly comAvatar = input(false);

  protected readonly linhas = computed(() =>
    Array.from({ length: this.quantidade() }, (_, indice) => LARGURAS[indice % LARGURAS.length]),
  );
}
