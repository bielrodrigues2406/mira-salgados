import { type DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const PREFERENCIA = 'mira.tela-acesa';

/**
 * Mantém a tela do celular acesa (Screen Wake Lock) enquanto a produção está
 * aberta: quem está com a mão na massa não precisa tocar na tela para ela não
 * apagar. O navegador solta a trava quando a aba some; ao voltar, ela é pedida
 * de novo. A escolha fica guardada no aparelho.
 */
@Injectable({ providedIn: 'root' })
export class TelaAcesaService {
  private readonly documento = inject(DOCUMENT);
  private readonly navegador = this.documento.defaultView?.navigator;

  readonly suportada = this.navegador !== undefined && 'wakeLock' in this.navegador;
  /** Trava concedida pelo navegador neste momento. */
  readonly ativa = signal(false);
  /** O que a pessoa escolheu, guardado entre visitas. */
  readonly desejada = signal(this.lerPreferencia());

  private trava: WakeLockSentinel | null = null;
  private usos = 0;

  private readonly aoVoltar = (): void => {
    if (this.documento.visibilityState === 'visible' && this.desejada() && this.usos > 0) {
      void this.pedir();
    }
  };

  /** Liga para a tela que chama enquanto ela existir, se a pessoa quiser. */
  usarEnquantoExistir(destroyRef: DestroyRef): void {
    if (!this.suportada) return;
    this.usos += 1;
    if (this.usos === 1) this.documento.addEventListener('visibilitychange', this.aoVoltar);
    if (this.desejada()) void this.pedir();
    destroyRef.onDestroy(() => {
      this.usos -= 1;
      if (this.usos > 0) return;
      this.documento.removeEventListener('visibilitychange', this.aoVoltar);
      void this.soltar();
    });
  }

  alternar(): void {
    const ligar = !this.desejada();
    this.desejada.set(ligar);
    this.guardarPreferencia(ligar);
    void (ligar ? this.pedir() : this.soltar());
  }

  private async pedir(): Promise<void> {
    if (!this.navegador || this.trava) return;
    try {
      const trava = await this.navegador.wakeLock.request('screen');
      this.trava = trava;
      this.ativa.set(true);
      trava.addEventListener('release', () => {
        if (this.trava === trava) this.trava = null;
        this.ativa.set(false);
      });
    } catch {
      // Bateria fraca ou aba em segundo plano: o navegador pode recusar.
      this.ativa.set(false);
    }
  }

  private async soltar(): Promise<void> {
    const trava = this.trava;
    this.trava = null;
    this.ativa.set(false);
    await trava?.release();
  }

  private lerPreferencia(): boolean {
    try {
      return this.documento.defaultView?.localStorage.getItem(PREFERENCIA) === 'sim';
    } catch {
      return false;
    }
  }

  private guardarPreferencia(ligada: boolean): void {
    try {
      this.documento.defaultView?.localStorage.setItem(PREFERENCIA, ligada ? 'sim' : 'nao');
    } catch {
      // Modo privado sem armazenamento: vale só para esta visita.
    }
  }
}
