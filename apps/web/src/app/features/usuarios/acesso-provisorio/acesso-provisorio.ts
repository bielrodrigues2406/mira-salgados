import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';

import { Icone } from '../../../shared/components/icone/icone';
import { formatarTelefone } from '../../../shared/pipes/telefone.pipe';
import { linkDoWhatsApp, negrito } from '../../../shared/utils/whatsapp';

export interface AcessoProvisorio {
  nome: string;
  telefone: string;
  senha: string;
  /** Conta nova ou senha redefinida. */
  motivo: 'criada' | 'redefinida';
}

/**
 * Credenciais para entregar à pessoa, mostradas uma única vez depois de criar
 * a conta ou redefinir a senha. Saem por WhatsApp (conversa com o celular da
 * pessoa) ou copiadas; o sistema não guarda nem reexibe a senha provisória.
 */
@Component({
  selector: 'ms-acesso-provisorio',
  imports: [Icone],
  templateUrl: './acesso-provisorio.html',
  styleUrl: './acesso-provisorio.css',
})
export class AcessoProvisorioCartao {
  private readonly documento = inject(DOCUMENT);

  readonly acesso = input.required<AcessoProvisorio>();
  readonly fechar = output();

  protected readonly copiado = signal(false);
  protected readonly telefone = computed(() => formatarTelefone(this.acesso().telefone));
  protected readonly mensagem = computed(() => {
    const { nome, senha, motivo } = this.acesso();
    const endereco = this.documento.location.origin;
    return [
      `Olá, ${nome.split(' ')[0] ?? nome}! ${motivo === 'criada' ? 'Seu acesso ao Mira Salgados' : 'Sua nova senha provisória do Mira Salgados'}:`,
      '',
      `Endereço: ${endereco}`,
      `Celular: ${this.telefone()}`,
      `Senha provisória: ${negrito(senha)}`,
      '',
      'No primeiro acesso você cria a sua própria senha.',
    ].join('\n');
  });
  protected readonly linkWhatsApp = computed(() =>
    linkDoWhatsApp(this.mensagem(), this.acesso().telefone),
  );

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.mensagem().replaceAll('*', ''));
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }
}
