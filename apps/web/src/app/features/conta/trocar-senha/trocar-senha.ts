import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';

const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 128;

/**
 * Troca da própria senha. Obrigatória no primeiro acesso com senha provisória
 * (nenhuma outra tela abre antes disso) e disponível depois pelo menu da conta.
 */
@Component({
  selector: 'ms-trocar-senha',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone],
  templateUrl: './trocar-senha.html',
  styleUrl: './trocar-senha.css',
})
export class TrocarSenha {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly obrigatoria = this.auth.precisaTrocarSenha;
  protected readonly erro = signal<string | null>(null);
  protected readonly concluida = signal(false);
  protected readonly senhasVisiveis = signal(false);

  private readonly senhas = signal({ atual: '', nova: '', confirmacao: '' });
  protected readonly formulario = form(
    this.senhas,
    (campo) => {
      required(campo.atual, { message: 'Informe a senha atual.' });
      required(campo.nova, { message: 'Crie a nova senha.' });
      minLength(campo.nova, SENHA_MINIMA, {
        message: `Use ao menos ${String(SENHA_MINIMA)} caracteres.`,
      });
      maxLength(campo.nova, SENHA_MAXIMA, {
        message: `Use no máximo ${String(SENHA_MAXIMA)} caracteres.`,
      });
      validate(campo.nova, (contexto) =>
        contexto.value() !== '' && contexto.value() === contexto.valueOf(campo.atual)
          ? { kind: 'repetida', message: 'A nova senha precisa ser diferente da atual.' }
          : undefined,
      );
      validate(campo.confirmacao, (contexto) =>
        contexto.value() === contexto.valueOf(campo.nova)
          ? undefined
          : { kind: 'confirmacao', message: 'As senhas não coincidem.' },
      );
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const eraObrigatoria = this.obrigatoria();
          const { atual, nova } = this.senhas();
          try {
            await firstValueFrom(this.auth.trocarSenha(atual, nova));
            if (eraObrigatoria) {
              await this.router.navigateByUrl('/inicio');
            } else {
              this.concluida.set(true);
              this.formulario().reset({ atual: '', nova: '', confirmacao: '' });
            }
          } catch (falha) {
            this.erro.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  protected alternarVisibilidade(): void {
    this.senhasVisiveis.update((visiveis) => !visiveis);
  }

  protected sair(): void {
    this.auth.logout().subscribe();
  }
}
