import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  email,
  form,
  FormField,
  FormRoot,
  maxLength,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { Icone } from '../../../shared/components/icone/icone';

const DESTINO_APOS_LOGIN = '/pedidos';

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
  protected readonly cadastroAberto = signal(false);
  protected readonly erroCadastro = signal<string | null>(null);

  /** A opção de criar conta só aparece quando a API aceita cadastro público. */
  protected readonly registroPublico = toSignal(
    this.auth.configuracao().pipe(
      map((configuracao) => configuracao.registroPublico),
      catchError(() => of(false)),
    ),
    { initialValue: false },
  );

  private readonly credenciais = signal({ email: '', senha: '' });
  protected readonly formularioLogin = form(
    this.credenciais,
    (campo) => {
      required(campo.email, { message: 'Informe o e-mail.' });
      email(campo.email, { message: 'Informe um e-mail válido.' });
      required(campo.senha, { message: 'Informe a senha.' });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const { email: endereco, senha } = this.credenciais();
          try {
            await firstValueFrom(this.auth.login(endereco, senha));
            await this.router.navigateByUrl(DESTINO_APOS_LOGIN);
          } catch (falha) {
            this.erro.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  private readonly novaConta = signal({ nome: '', email: '', senha: '', confirmacao: '' });
  protected readonly formularioCadastro = form(
    this.novaConta,
    (campo) => {
      required(campo.nome, { message: 'Informe o nome.' });
      maxLength(campo.nome, 120, { message: 'Use no máximo 120 caracteres.' });
      required(campo.email, { message: 'Informe o e-mail.' });
      email(campo.email, { message: 'Informe um e-mail válido.' });
      required(campo.senha, { message: 'Crie uma senha.' });
      minLength(campo.senha, 12, { message: 'Use ao menos 12 caracteres.' });
      maxLength(campo.senha, 128, { message: 'Use no máximo 128 caracteres.' });
      validate(campo.confirmacao, (contexto) =>
        contexto.value() === contexto.valueOf(campo.senha)
          ? undefined
          : { kind: 'confirmacao', message: 'As senhas não coincidem.' },
      );
    },
    {
      submission: {
        action: async () => {
          this.erroCadastro.set(null);
          const { nome, email: endereco, senha } = this.novaConta();
          try {
            await firstValueFrom(this.auth.registrar({ nome, email: endereco, senha }));
            await firstValueFrom(this.auth.login(endereco, senha));
            await this.router.navigateByUrl(DESTINO_APOS_LOGIN);
          } catch (falha) {
            this.erroCadastro.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  protected alternarSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected alternarCadastro(): void {
    this.cadastroAberto.update((aberto) => !aberto);
  }
}
