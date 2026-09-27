import { Component, input, output } from '@angular/core';

import type { PaginacaoMeta } from '../../../core/models/api';
import { Icone } from '../icone/icone';

/** Navegação entre páginas; some quando tudo cabe em uma página. */
@Component({
  selector: 'ms-paginacao',
  imports: [Icone],
  templateUrl: './paginacao.html',
  styleUrl: './paginacao.css',
})
export class Paginacao {
  readonly meta = input.required<PaginacaoMeta>();
  readonly paginaMudou = output<number>();

  protected irPara(pagina: number): void {
    this.paginaMudou.emit(pagina);
  }
}
