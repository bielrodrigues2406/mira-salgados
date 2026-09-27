import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface Aba {
  rota: string;
  rotulo: string;
}

/** Cada aba é uma rota filha: o endereço guarda a aba e os filtros de cada uma. */
export const ABAS_DE_RELATORIOS: readonly Aba[] = [{ rota: 'acerto', rotulo: 'Acerto diário' }];

@Component({
  selector: 'ms-relatorios',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.css',
})
export class Relatorios {
  protected readonly abas = ABAS_DE_RELATORIOS;
}
