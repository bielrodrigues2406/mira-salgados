import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { Icone } from '../../../shared/components/icone/icone';

const DESTINO_APOS_LOGIN = '/pedidos';
const TROCA_DE_SENHA = '/trocar-senha';
const DIGITOS_DO_TELEFONE = /^\d{10,11}$/;

/**
 * Entrada pelo celular e senha. Não há cadastro aqui: contas são criadas por
 * um administrador, com senha provisória trocada no primeiro acesso.
 */
@Component({
  selector: 'ms-login',
  imports: [FormField, FormRoot, Icone],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly erro = signal<string | null>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('motivo') === 'sessao-expirada'
      ? 'Sua sessão expirou. Entre novamente.'
      : null,
  );
  protected readonly senhaVisivel = signal(false);

  private readonly credenciais = signal({ telefone: '', senha: '' });
  protected readonly formularioLogin = form(
    this.credenciais,
    (campo) => {
      required(campo.telefone, { message: 'Informe o celular.' });
      validate(campo.telefone, ({ value }) =>
        value() === '' || DIGITOS_DO_TELEFONE.test(value().replace(/\D/g, ''))
          ? undefined
          : { kind: 'telefone', message: 'Use o celular com DDD, como (11) 98765-4321.' },
      );
      required(campo.senha, { message: 'Informe a senha.' });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const { telefone, senha } = this.credenciais();
          try {
            const usuario = await firstValueFrom(this.auth.login(telefone, senha));
            await this.router.navigateByUrl(
              usuario.trocarSenha ? TROCA_DE_SENHA : DESTINO_APOS_LOGIN,
            );
          } catch (falha) {
            this.erro.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  protected alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }
}
