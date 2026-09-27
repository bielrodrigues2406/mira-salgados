import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Icone } from '../../../shared/components/icone/icone';
import { AuthService } from '../../services/auth.service';
import { CADASTROS, DESTINOS, iniciais } from '../destinos';

@Component({
  selector: 'ms-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: { '(document:keydown.escape)': 'fecharMenu()' },
})
export class Shell {
  private readonly auth = inject(AuthService);

  protected readonly destinos = DESTINOS;
  protected readonly cadastros = CADASTROS;
  protected readonly usuario = this.auth.usuario;
  protected readonly iniciais = computed(() => iniciais(this.usuario()?.nome ?? ''));
  protected readonly menuAberto = signal(false);

  protected alternarMenu(): void {
    this.menuAberto.update((aberto) => !aberto);
  }

  protected fecharMenu(): void {
    this.menuAberto.set(false);
  }

  protected sair(): void {
    this.fecharMenu();
    this.auth.logout().subscribe();
  }
}
