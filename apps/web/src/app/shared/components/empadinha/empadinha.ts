import { Component, computed, input } from '@angular/core';

export type PoseEmpadinha = 'pronta' | 'conferindo' | 'marcando' | 'tudo-certo' | 'ola' | 'revisar';

export type TamanhoEmpadinha = 'pequena' | 'media' | 'grande';

/**
 * Mascote Empadinha da Mira Salgados em sprites WebP transparentes com
 * micro-animações leves apenas em transform/opacity e respeito a
 * prefers-reduced-motion. Sempre oculta na impressão.
 */
@Component({
  selector: 'ms-empadinha',
  templateUrl: './empadinha.html',
  styleUrl: './empadinha.css',
  host: {
    '[class]': "'nao-imprimir tamanho-' + tamanho() + ' pose-' + pose()",
    '[attr.aria-hidden]': "rotulo() ? null : 'true'",
  },
})
export class Empadinha {
  readonly pose = input<PoseEmpadinha>('pronta');
  readonly tamanho = input<TamanhoEmpadinha>('media');
  /** Quando vazio, a ilustração é tratada como decorativa (aria-hidden). */
  readonly rotulo = input('');

  protected readonly caminhoImagem = computed(() => `/empadinha/${this.pose()}.webp`);
}
