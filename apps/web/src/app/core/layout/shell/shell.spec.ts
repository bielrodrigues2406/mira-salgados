import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { Shell } from './shell';

describe('Shell', () => {
  async function abrir(url: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        // Rotas sem componente: o teste olha só a navegação do shell.
        provideRouter([
          { path: 'produtos', children: [] },
          { path: 'produtores', children: [] },
          { path: 'clientes', children: [] },
        ]),
        {
          provide: AuthService,
          useValue: { usuario: signal(null), logout: () => of(undefined) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function marcados(tela: HTMLElement): [string, string | null][] {
    return [...tela.querySelectorAll('nav.inferior a.ativo')].map((link) => [
      link.textContent.trim(),
      link.getAttribute('aria-current'),
    ]);
  }

  it('marca o destino da rota atual como página', async () => {
    expect(marcados(await abrir('/clientes'))).toEqual([['Clientes', 'page']]);
  });

  it('mantém Produtos marcado em Produtores, sem anunciar como a mesma página', async () => {
    expect(marcados(await abrir('/produtores'))).toEqual([['Produtos', 'true']]);
  });
});
