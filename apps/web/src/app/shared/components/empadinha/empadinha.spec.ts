import { ApplicationRef, createComponent, EnvironmentInjector, inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Empadinha, type PoseEmpadinha } from './empadinha';
import {
  calcularGeometria,
  duracaoDoGesto,
  GESTOS_EMPADINHA,
  quadroEstatico,
  quadroNoInstante,
} from './empadinha-gestos';

describe('Empadinha', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('articula a mão livre de forma independente no aceno e para ao concluir a duração curta', () => {
    let proximoQuadroId = 1;
    const quadrosAtivos = new Map<number, FrameRequestCallback>();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        const id = proximoQuadroId++;
        quadrosAtivos.set(id, cb);
        return id;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        quadrosAtivos.delete(id);
      }),
    );
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    const instancia = createComponent(Empadinha, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      bindings: [inputBinding('pose', () => 'acenar'), inputBinding('tamanho', () => 'grande')],
    });
    const aplicacao = TestBed.inject(ApplicationRef);
    aplicacao.attachView(instancia.hostView);
    aplicacao.tick();

    const avancarPara = (instante: number): void => {
      const pendentes = [...quadrosAtivos.entries()];
      quadrosAtivos.clear();
      for (const [, cb] of pendentes) {
        cb(instante);
      }
      aplicacao.tick();
    };

    const elemento = instancia.location.nativeElement as HTMLElement;
    expect(elemento.classList).toContain('nao-imprimir');
    expect(elemento.classList).toContain('pose-acenar');
    expect(elemento.classList).toContain('tamanho-grande');
    expect(elemento.getAttribute('aria-hidden')).toBe('true');

    const luvaInicial = elemento
      .querySelector('[data-parte="luva-livre"]')
      ?.getAttribute('transform');
    expect(elemento.querySelector('[data-parte="palma"]')).toBeNull();

    // Avança até o pico do aceno (655 ms): mão livre sobe e mostra a palma aberta.
    avancarPara(1655);
    const luvaAceno = elemento
      .querySelector('[data-parte="luva-livre"]')
      ?.getAttribute('transform');
    expect(luvaAceno).not.toBe(luvaInicial);
    expect(elemento.querySelector('[data-parte="palma"]')).not.toBeNull();

    // Avança além do fim do gesto (1510 ms): retorna ao repouso e NÃO agenda novo quadro (sem loop).
    const duracao = duracaoDoGesto('acenar');
    expect(quadrosAtivos.size).toBeGreaterThan(0);
    avancarPara(1000 + duracao + 50);
    expect(quadrosAtivos.size).toBe(0);
    expect(elemento.querySelector('[data-parte="luva-livre"]')?.getAttribute('transform')).toBe(
      luvaInicial,
    );

    instancia.destroy();
  });

  it('inclui o gesto folhear com folha virando frente e verso na prancheta', () => {
    const frente = calcularGeometria(quadroNoInstante('folhear', 820));
    const virandoNaFrente = calcularGeometria(quadroNoInstante('folhear', 1000));
    const verso = calcularGeometria(quadroNoInstante('folhear', 1210));
    const fim = calcularGeometria(quadroNoInstante('folhear', 2120));

    expect(frente.folhaFrenteVisivel).toBe(true);
    expect(frente.folhaVirandoVerso).toBe(false);
    expect(frente.folhaVersoVisivel).toBe(false);
    expect(virandoNaFrente.folhaFrenteVisivel).toBe(true);
    expect(virandoNaFrente.folhaVirandoVerso).toBe(true);
    expect(verso.folhaFrenteVisivel).toBe(false);
    expect(verso.folhaVersoVisivel).toBe(true);
    expect(verso.folhaVirandoVerso).toBe(true);
    expect(fim.folhaFrenteVisivel).toBe(false);
    expect(fim.folhaVersoVisivel).toBe(false);
  });

  it('respeita prefers-reduced-motion exibindo a pose estática sem iniciar animação e expõe rótulo acessível', () => {
    const callbacksRaf: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        callbacksRaf.push(cb);
        return callbacksRaf.length;
      }),
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );

    const instancia = createComponent(Empadinha, {
      environmentInjector: TestBed.inject(EnvironmentInjector),
      bindings: [
        inputBinding('pose', () => 'marcar'),
        inputBinding('rotulo', () => 'Empadinha marcando item na prancheta'),
      ],
    });
    const aplicacao = TestBed.inject(ApplicationRef);
    aplicacao.attachView(instancia.hostView);
    aplicacao.tick();

    const elemento = instancia.location.nativeElement as HTMLElement;
    const svg = elemento.querySelector('svg');

    // No gesto animado, marcar começa com check=0 (sem tique). Em movimento reduzido,
    // exibe imediatamente a pose estática (check=1) e não anima ao longo do tempo.
    expect(elemento.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Empadinha marcando item na prancheta');
    expect(elemento.querySelector('[data-parte="tique"]')).not.toBeNull();

    const luvaAntes = elemento
      .querySelector('[data-parte="luva-livre"]')
      ?.getAttribute('transform');
    for (const cb of callbacksRaf.splice(0)) {
      cb(10_000);
    }
    aplicacao.tick();
    expect(elemento.querySelector('[data-parte="luva-livre"]')?.getAttribute('transform')).toBe(
      luvaAntes,
    );
    expect(callbacksRaf).toHaveLength(0);

    instancia.destroy();
  });

  it('possui definições e poses estáticas válidas para todos os gestos da prévia', () => {
    const poses: PoseEmpadinha[] = [
      'pronta',
      'conferir',
      'marcar',
      'folhear',
      'acenar',
      'concluir',
      'revisar',
    ];
    for (const pose of poses) {
      const geometria = calcularGeometria(quadroEstatico(pose));
      expect(geometria.corpoTransform).toContain('translate');
      expect(geometria.luvaLivreTransform).toContain('translate');
    }
    expect(Object.keys(GESTOS_EMPADINHA).sort()).toEqual([
      'acenar',
      'concluir',
      'conferir',
      'folhear',
      'marcar',
      'revisar',
    ]);
  });
});
