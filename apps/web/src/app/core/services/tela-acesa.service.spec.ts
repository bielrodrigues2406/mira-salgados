import { createEnvironmentInjector, DestroyRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TelaAcesaService } from './tela-acesa.service';

/** Trava falsa do navegador: registra pedidos e solturas. */
class TravaFalsa extends EventTarget {
  soltaPeloNavegador(): void {
    this.dispatchEvent(new Event('release'));
  }

  release(): Promise<void> {
    this.dispatchEvent(new Event('release'));
    return Promise.resolve();
  }
}

describe('TelaAcesaService', () => {
  let pedidos: number;
  let ultima: TravaFalsa | undefined;
  let recusar: boolean;

  function instalarWakeLock(): void {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: (): Promise<TravaFalsa> => {
          pedidos += 1;
          if (recusar) return Promise.reject(new Error('NotAllowedError'));
          ultima = new TravaFalsa();
          return Promise.resolve(ultima);
        },
      },
    });
  }

  /** Uma "tela" com ciclo de vida próprio, como a Produção. */
  function abrirTela(servico: TelaAcesaService): () => void {
    const ambiente = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    servico.usarEnquantoExistir(ambiente.get(DestroyRef));
    return () => {
      ambiente.destroy();
    };
  }

  async function esperar(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    pedidos = 0;
    ultima = undefined;
    recusar = false;
    localStorage.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('sem suporte no navegador, não oferece o botão nem faz nada', () => {
    const servico = TestBed.inject(TelaAcesaService);

    expect(servico.suportada).toBe(false);
    expect(() => {
      abrirTela(servico)();
    }).not.toThrow();
  });

  it('liga, guarda a escolha e solta ao sair da tela', async () => {
    instalarWakeLock();
    const servico = TestBed.inject(TelaAcesaService);
    const fechar = abrirTela(servico);
    expect(pedidos).toBe(0);

    servico.alternar();
    await esperar();
    expect(servico.ativa()).toBe(true);
    expect(localStorage.getItem('mira.tela-acesa')).toBe('sim');

    fechar();
    await esperar();
    expect(servico.ativa()).toBe(false);
    expect(servico.desejada()).toBe(true);
  });

  it('com a escolha guardada, liga sozinha ao abrir a tela', async () => {
    localStorage.setItem('mira.tela-acesa', 'sim');
    instalarWakeLock();
    const servico = TestBed.inject(TelaAcesaService);

    abrirTela(servico);
    await esperar();

    expect(pedidos).toBe(1);
    expect(servico.ativa()).toBe(true);
  });

  it('pede de novo quando a aba volta a aparecer', async () => {
    localStorage.setItem('mira.tela-acesa', 'sim');
    instalarWakeLock();
    const servico = TestBed.inject(TelaAcesaService);
    abrirTela(servico);
    await esperar();

    ultima?.soltaPeloNavegador();
    expect(servico.ativa()).toBe(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await esperar();

    expect(pedidos).toBe(2);
    expect(servico.ativa()).toBe(true);
  });

  it('recusa do navegador deixa desligada, sem erro', async () => {
    instalarWakeLock();
    recusar = true;
    const servico = TestBed.inject(TelaAcesaService);
    abrirTela(servico);

    servico.alternar();
    await esperar();

    expect(servico.ativa()).toBe(false);
  });

  it('desligar solta a trava e guarda a escolha', async () => {
    localStorage.setItem('mira.tela-acesa', 'sim');
    instalarWakeLock();
    const servico = TestBed.inject(TelaAcesaService);
    abrirTela(servico);
    await esperar();

    servico.alternar();
    await esperar();

    expect(servico.ativa()).toBe(false);
    expect(localStorage.getItem('mira.tela-acesa')).toBe('nao');
  });
});
