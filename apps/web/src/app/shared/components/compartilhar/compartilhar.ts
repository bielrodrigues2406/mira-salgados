import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';

import { type Arquivo, baixar } from '../../utils/arquivo';
import { linkDoWhatsApp } from '../../utils/whatsapp';
import { Icone } from '../icone/icone';

/**
 * Ações de saída de uma tela: mensagem pronta no WhatsApp, planilha (CSV) e
 * impressão, que também salva em PDF pelo próprio navegador. Some na impressão.
 */
@Component({
  selector: 'ms-compartilhar',
  imports: [Icone],
  templateUrl: './compartilhar.html',
  styleUrl: './compartilhar.css',
})
export class Compartilhar {
  private readonly documento = inject(DOCUMENT);

  /** Texto para o WhatsApp; sem ele, o botão não aparece. */
  readonly mensagem = input<string | null>(null);
  /** Com telefone, abre a conversa com a pessoa; sem, deixa escolher o contato. */
  readonly telefone = input<string | null>(null);
  readonly rotuloWhatsApp = input('WhatsApp');
  /** Monta a planilha na hora do clique; pode buscar todas as páginas antes. */
  readonly gerarPlanilha = input<(() => Arquivo | Promise<Arquivo>) | null>(null);
  readonly imprimivel = input(true);

  protected readonly link = computed(() => {
    const mensagem = this.mensagem();
    return mensagem ? linkDoWhatsApp(mensagem, this.telefone()) : null;
  });
  protected readonly preparando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async baixarPlanilha(): Promise<void> {
    const gerar = this.gerarPlanilha();
    if (!gerar) return;
    this.preparando.set(true);
    this.erro.set(null);
    try {
      baixar(await gerar(), this.documento);
    } catch {
      this.erro.set('Não foi possível gerar a planilha. Tente de novo.');
    } finally {
      this.preparando.set(false);
    }
  }

  protected imprimir(): void {
    this.documento.defaultView?.print();
  }
}
