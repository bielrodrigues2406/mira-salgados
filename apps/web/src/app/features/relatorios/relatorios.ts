import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface Aba {
  rota: string;
  rotulo: string;
}

/** Cada aba é uma rota filha: o endereço guarda a aba e os filtros de cada uma. */
export const ABAS_DE_RELATORIOS: readonly Aba[] = [
  { rota: 'acerto', rotulo: 'Acerto diário' },
  { rota: 'faturamento', rotulo: 'Faturamento' },
  { rota: 'producao', rotulo: 'Por produtor' },
  { rota: 'itens-vendidos', rotulo: 'Itens vendidos' },
  { rota: 'fiados', rotulo: 'Fiados' },
];

@Component({
  selector: 'ms-relatorios',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.css',
})
export class Relatorios {
  protected readonly abas = ABAS_DE_RELATORIOS;

  /** No celular as abas rolam na horizontal: a aba aberta fica sempre à vista. */
  protected aoAtivar(ativa: boolean, aba: HTMLElement): void {
    if (ativa && 'scrollIntoView' in aba)
      aba.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
