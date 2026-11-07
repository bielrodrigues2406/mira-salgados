import { Component, computed, input } from '@angular/core';

import { iniciais } from '../../../../core/layout/destinos';
import type { ParteDoProdutor } from '../../../../core/models/relatorios';
import { ChipPreparo } from '../../../../shared/components/chip-preparo/chip-preparo';
import { MoedaPipe } from '../../../../shared/pipes/moeda.pipe';
import { idUnico } from '../../../../shared/utils/id-unico';
import { composicao, contagem } from '../../../../shared/utils/textos';

/** Parte de um produtor no acerto: o que fez e quanto tem a receber pelo dia. */
@Component({
  selector: 'ms-cartao-produtor',
  imports: [ChipPreparo, MoedaPipe],
  templateUrl: './cartao-produtor.html',
  styleUrl: './cartao-produtor.css',
})
export class CartaoProdutor {
  readonly parte = input.required<ParteDoProdutor>();

  protected readonly idTitulo = idUnico('produtor');
  protected readonly composicao = composicao;
  protected readonly iniciais = computed(() => iniciais(this.parte().produtor.nome));
  protected readonly resumo = computed(() => {
    const parte = this.parte();
    return `${contagem(parte.unidades, 'salgado', 'salgados')} · ${contagem(parte.itens.length, 'item', 'itens')}`;
  });
}
