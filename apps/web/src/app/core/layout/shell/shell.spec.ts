import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { Shell } from './shell';

const USUARIO = {
  id: '1',
  nome: 'Célia Souza',
  telefone: '11987654321',
  papel: 'MEMBRO',
  trocarSenha: false,
  ativo: true,
  produtorId: null,
  criadoEm: '2026-10-01T00:00:00.000Z',
};

describe('Shell', () => {
  async function abrir(
    url: string,
    opcoes: { admin?: boolean; trocarSenha?: boolean } = {},
  ): Promise<{ tela: HTMLElement; detectar: () => Promise<void> }> {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        // Rotas sem componente: o teste olha só a navegação do shell.
        provideRouter(
          ['inicio', 'pedidos', 'producao', 'produtos', 'produtores', 'clientes', 'usuarios'].map(
            (path) => ({ path, children: [] }),
          ),
        ),
        {
          provide: AuthService,
          useValue: {
            usuario: signal(USUARIO),
            ehAdmin: signal(opcoes.admin ?? false),
            precisaTrocarSenha: signal(opcoes.trocarSenha ?? false),
            logout: () => of(undefined),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return {
      tela: fixture.nativeElement as HTMLElement,
      detectar: () => fixture.whenStable(),
    };
  }

  function itensDaBarra(tela: HTMLElement): [string, boolean][] {
    return [...tela.querySelectorAll('nav.inferior .inferior-item')].map((item) => [
      item.textContent.trim(),
      item.classList.contains('ativo'),
    ]);
  }

  function botaoMais(tela: HTMLElement): HTMLButtonElement {
    const botao = tela.querySelector<HTMLButtonElement>('nav.inferior button');
    if (!botao) throw new Error('Botão Mais não encontrado');
    return botao;
  }

  it('a barra inferior tem Início, Pedidos, Produção e Mais', async () => {
    const { tela } = await abrir('/inicio');

    expect(itensDaBarra(tela)).toEqual([
      ['Início', true],
      ['Pedidos', false],
      ['Produção', false],
      ['Mais', false],
    ]);
    expect(tela.querySelector('nav.inferior a[href="/inicio"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('marca Mais quando a tela aberta é uma das que ele reúne', async () => {
    const { tela } = await abrir('/clientes');

    expect(itensDaBarra(tela).filter(([, ativo]) => ativo)).toEqual([['Mais', true]]);
  });

  it('Mais abre as outras telas, a troca de senha e a saída; Escape fecha', async () => {
    const { tela, detectar } = await abrir('/inicio');

    botaoMais(tela).click();
    await detectar();

    const painel = tela.querySelector('[role="dialog"]');
    expect(botaoMais(tela).getAttribute('aria-expanded')).toBe('true');
    expect(
      [...(painel?.querySelectorAll('.mais-destino') ?? [])].map((a) => a.textContent.trim()),
    ).toEqual(['Clientes', 'Produtos', 'Relatórios', 'Produtores']);
    expect(painel?.textContent).toContain('Trocar senha');
    expect(painel?.textContent).toContain('Sair');
    expect(painel?.textContent).toContain('(11) 98765-4321');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await detectar();
    expect(tela.querySelector('[role="dialog"]')).toBeNull();
  });

  it('administrador vê Usuários em Mais', async () => {
    const { tela, detectar } = await abrir('/inicio', { admin: true });

    botaoMais(tela).click();
    await detectar();

    expect(tela.querySelector('[role="dialog"]')?.textContent).toContain('Usuários');
  });

  it('com senha provisória, esconde a navegação', async () => {
    const { tela } = await abrir('/inicio', { trocarSenha: true });

    expect(tela.querySelector('nav.inferior')).toBeNull();
    expect(tela.querySelector('.lateral-navegacao')).toBeNull();
  });
});
