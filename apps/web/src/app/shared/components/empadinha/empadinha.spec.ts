import { ApplicationRef, createComponent, EnvironmentInjector, inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Empadinha } from './empadinha';

describe('Empadinha', () => {
  it('renderiza o sprite WebP da pose escolhida e oculta na impressão quando decorativa', async () => {
    const instancia = createComponent(Empadinha, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      bindings: [inputBinding('pose', () => 'ola'), inputBinding('tamanho', () => 'grande')],
    });
    const aplicacao = TestBed.inject(ApplicationRef);
    aplicacao.attachView(instancia.hostView);
    await aplicacao.whenStable();

    const elemento = instancia.location.nativeElement as HTMLElement;
    const imagem = elemento.querySelector('img');

    expect(elemento.classList).toContain('nao-imprimir');
    expect(elemento.classList).toContain('pose-ola');
    expect(elemento.classList).toContain('tamanho-grande');
    expect(elemento.getAttribute('aria-hidden')).toBe('true');
    expect(imagem?.getAttribute('src')).toBe('/empadinha/ola.webp');
    expect(imagem?.getAttribute('alt')).toBe('');

    instancia.destroy();
  });

  it('expõe texto alternativo quando um rótulo descritivo é informado', async () => {
    const instancia = createComponent(Empadinha, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      bindings: [
        inputBinding('pose', () => 'revisar'),
        inputBinding('rotulo', () => 'Empadinha conferindo alertas'),
      ],
    });
    const aplicacao = TestBed.inject(ApplicationRef);
    aplicacao.attachView(instancia.hostView);
    await aplicacao.whenStable();

    const elemento = instancia.location.nativeElement as HTMLElement;
    const imagem = elemento.querySelector('img');

    expect(elemento.getAttribute('aria-hidden')).toBeNull();
    expect(imagem?.getAttribute('src')).toBe('/empadinha/revisar.webp');
    expect(imagem?.getAttribute('alt')).toBe('Empadinha conferindo alertas');

    instancia.destroy();
  });
});
