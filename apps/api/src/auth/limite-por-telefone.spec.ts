import { describe, expect, it } from 'vitest';

import { FALHAS_PERMITIDAS, JANELA_MS, LimitePorTelefone } from './limite-por-telefone.js';

describe('LimitePorTelefone', () => {
  function limite(): { limite: LimitePorTelefone; avancar: (ms: number) => void } {
    let agora = 1_000_000;
    return {
      limite: new LimitePorTelefone(() => agora),
      avancar: (ms) => {
        agora += ms;
      },
    };
  }

  it('bloqueia o telefone depois das falhas permitidas, sem afetar os outros', () => {
    const { limite: barreira } = limite();
    for (let falha = 0; falha < FALHAS_PERMITIDAS; falha++) {
      barreira.verificar('11987654321');
      barreira.registrarFalha('11987654321');
    }

    expect(() => {
      barreira.verificar('11987654321');
    }).toThrow('Muitas tentativas');
    expect(() => {
      barreira.verificar('11900000000');
    }).not.toThrow();
  });

  it('libera quando a janela passa ou o login dá certo', () => {
    const { limite: barreira, avancar } = limite();
    for (let falha = 0; falha < FALHAS_PERMITIDAS; falha++) barreira.registrarFalha('1');
    avancar(JANELA_MS);
    expect(() => {
      barreira.verificar('1');
    }).not.toThrow();

    for (let falha = 0; falha < FALHAS_PERMITIDAS - 1; falha++) barreira.registrarFalha('2');
    barreira.limpar('2');
    barreira.registrarFalha('2');
    expect(() => {
      barreira.verificar('2');
    }).not.toThrow();
  });
});
