import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';

import {
  calcularGeometria,
  duracaoDoGesto,
  ESTADO_REPOUSO,
  type EstadoEmpadinha,
  type PoseEmpadinha,
  quadroEstatico,
  quadroNoInstante,
  TEXTURA_CORPO,
  TEXTURA_TAMPA,
} from './empadinha-gestos';

export type { PoseEmpadinha } from './empadinha-gestos';

export type TamanhoEmpadinha = 'pequena' | 'media' | 'grande';

let proximoId = 0;

/**
 * Mascote Empadinha da Mira Salgados em SVG articulado fiel à prévia aprovada
 * (`design/empadinha/preview.html`). Cada gesto é curto, toca uma única vez
 * (sem loop contínuo) e exibe pose estática sob `prefers-reduced-motion: reduce`.
 * Sempre oculta na impressão.
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaMovimentoReduzido =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  readonly pose = input<PoseEmpadinha>('pronta');
  readonly tamanho = input<TamanhoEmpadinha>('media');
  /** Quando vazio, a ilustração é tratada como decorativa (aria-hidden). */
  readonly rotulo = input('');

  protected readonly idPrefixo = `emp-${String(++proximoId)}`;
  protected readonly texturaCorpo = TEXTURA_CORPO;
  protected readonly texturaTampa = TEXTURA_TAMPA;

  private readonly estadoAtual = signal<EstadoEmpadinha>(ESTADO_REPOUSO);
  protected readonly geometria = computed(() => calcularGeometria(this.estadoAtual()));

  private animacaoId = 0;

  constructor() {
    const aoMudarMovimento = (): void => {
      this.cancelarAnimacao();
      this.estadoAtual.set(quadroEstatico(this.pose()));
    };
    this.mediaMovimentoReduzido?.addEventListener('change', aoMudarMovimento);

    this.destroyRef.onDestroy(() => {
      this.cancelarAnimacao();
      this.mediaMovimentoReduzido?.removeEventListener('change', aoMudarMovimento);
    });

    effect(() => {
      this.reproduzir(this.pose());
    });
  }

  private reproduzir(pose: PoseEmpadinha): void {
    this.cancelarAnimacao();
    const duracao = duracaoDoGesto(pose);
    if (duracao === 0) {
      this.estadoAtual.set(ESTADO_REPOUSO);
      return;
    }
    if (
      this.mediaMovimentoReduzido?.matches ||
      typeof globalThis.requestAnimationFrame !== 'function'
    ) {
      this.estadoAtual.set(quadroEstatico(pose));
      return;
    }

    const inicio = performance.now();
    this.estadoAtual.set(quadroNoInstante(pose, 0));

    const avancar = (agora: number): void => {
      const decorrido = Math.max(0, agora - inicio);
      this.estadoAtual.set(quadroNoInstante(pose, decorrido));
      if (decorrido < duracao) {
        this.animacaoId = globalThis.requestAnimationFrame(avancar);
      } else {
        this.animacaoId = 0;
      }
    };

    this.animacaoId = globalThis.requestAnimationFrame(avancar);
  }

  private cancelarAnimacao(): void {
    if (this.animacaoId !== 0 && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.animacaoId);
    }
    this.animacaoId = 0;
  }
}
