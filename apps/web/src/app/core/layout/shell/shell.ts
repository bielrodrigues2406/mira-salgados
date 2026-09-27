import { Component, computed, inject, signal } from '@angular/core';
import { isActive, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Icone } from '../../../shared/components/icone/icone';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { AuthService } from '../../services/auth.service';
import { ADMINISTRACAO, CADASTROS, DESTINOS, iniciais } from '../destinos';

@Component({
  selector: 'ms-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone, TelefonePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: { '(document:keydown.escape)': 'fecharMenu()' },
})
export class Shell {
  private readonly auth = inject(AuthService);

  private readonly router = inject(Router);

  protected readonly destinos = DESTINOS;
  protected readonly cadastros = CADASTROS;
  protected readonly administracao = ADMINISTRACAO;
  protected readonly ehAdmin = this.auth.ehAdmin;
  protected readonly precisaTrocarSenha = this.auth.precisaTrocarSenha;
  /**
   * Na barra inferior não há grupo de cadastros: Produtores é aberto a partir de
   * Produtos, que continua marcado. aria-current="page" fica só na rota exata.
   */
  protected readonly destinosInferiores = DESTINOS.map((destino) => {
    const naRota = isActive(destino.rota, this.router);
    const relacionadas = (destino.relacionadas ?? []).map((rota) => isActive(rota, this.router));
    const atual = computed((): 'page' | 'true' | null => {
      if (naRota()) return 'page';
      return relacionadas.some((ativa) => ativa()) ? 'true' : null;
    });
    return { ...destino, atual };
  });
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
