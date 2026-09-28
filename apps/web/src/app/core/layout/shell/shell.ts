import { Component, computed, inject, signal } from '@angular/core';
import { isActive, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Icone } from '../../../shared/components/icone/icone';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { AuthService } from '../../services/auth.service';
import { ADMINISTRACAO, CADASTROS, DESTINOS, INFERIORES, iniciais, MAIS } from '../destinos';

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
  protected readonly inferiores = INFERIORES;
  protected readonly ehAdmin = this.auth.ehAdmin;
  protected readonly precisaTrocarSenha = this.auth.precisaTrocarSenha;
  protected readonly usuario = this.auth.usuario;
  protected readonly iniciais = computed(() => iniciais(this.usuario()?.nome ?? ''));
  protected readonly menuAberto = signal(false);

  /** Destinos de "Mais": os de todos e, para administradores, os de administração. */
  protected readonly mais = computed(() => (this.ehAdmin() ? [...MAIS, ...ADMINISTRACAO] : MAIS));
  private readonly rotasDeMais = [...MAIS, ...ADMINISTRACAO, { rota: '/trocar-senha' }].map(
    ({ rota }) => isActive(rota, this.router),
  );
  /** "Mais" fica marcado quando a tela aberta é uma das que ele reúne. */
  protected readonly naAreaDeMais = computed(() => this.rotasDeMais.some((ativa) => ativa()));

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
