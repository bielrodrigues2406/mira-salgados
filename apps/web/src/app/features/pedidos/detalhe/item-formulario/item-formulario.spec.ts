import { type ComponentFixture, TestBed } from '@angular/core/testing';

import type { NovoItem } from '../../../../core/models/pedido';
import type { Produto } from '../../../../core/models/produto';
import { ItemFormulario } from './item-formulario';

function produto(
  id: string,
  nome: string,
  padrao: string,
  precos: Produto['precosVigentes'],
): Produto {
  return {
    id,
    nome,
    ativo: true,
    produtorPadrao: { id: `pr-${padrao}`, nome: padrao, ativo: true },
    precosVigentes: precos,
    criadoEm: '',
    atualizadoEm: '',
  };
}

const preco = (
  id: string,
  preparo: 'FRITO' | 'CONGELADO',
  unidadeVenda: 'CENTO' | 'UNIDADE',
  precoCentavos: number,
) => ({
  id,
  preparo,
  unidadeVenda,
  precoCentavos,
  vigenteDesde: '',
  vigenteAte: null,
});

const PRODUTOS = [
  produto('coxinha', 'Coxinha de frango', 'Mira', [
    preco('c1', 'FRITO', 'CENTO', 9500),
    preco('c2', 'FRITO', 'UNIDADE', 120),
  ]),
  produto('kibe', 'Kibe', 'Célia', [preco('k1', 'CONGELADO', 'CENTO', 7500)]),
];

describe('ItemFormulario', () => {
  let fixture: ComponentFixture<ItemFormulario>;
  let tela: HTMLElement;
  let enviados: NovoItem[];

  async function montar(): Promise<void> {
    enviados = [];
    fixture = TestBed.createComponent(ItemFormulario);
    fixture.componentRef.setInput('produtos', PRODUTOS);
    fixture.componentRef.setInput('produtores', [
      { id: 'pr-Mira', nome: 'Mira' },
      { id: 'pr-Célia', nome: 'Célia' },
      { id: 'pr-Rafael', nome: 'Rafael' },
    ]);
    fixture.componentRef.setInput('salvar', (item: NovoItem) => {
      enviados.push(item);
      return Promise.resolve(null);
    });
    tela = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function escolherProduto(id: string): void {
    const selecao = tela.querySelector<HTMLSelectElement>('select');
    if (!selecao) throw new Error('Seleção de produto não encontrada');
    selecao.value = id;
    selecao.dispatchEvent(new Event('input'));
    selecao.dispatchEvent(new Event('change'));
  }

  it('sugere a primeira combinação e o produtor padrão do produto escolhido', async () => {
    await montar();

    escolherProduto('kibe');
    await fixture.whenStable();

    const combinacao = tela.querySelector<HTMLInputElement>('.combinacao input');
    const produtor = tela.querySelectorAll<HTMLSelectElement>('select')[1];
    expect(combinacao?.checked).toBe(true);
    expect(produtor?.value).toBe('pr-Célia');
    expect(tela.textContent).toContain('Padrão do produto: Célia');
  });

  it('mostra a conta e os salgados na cozinha antes de gravar', async () => {
    await montar();

    escolherProduto('coxinha');
    await fixture.whenStable();
    const quantidade = tela.querySelector<HTMLInputElement>('input[type="number"]');
    if (!quantidade) throw new Error('Campo de quantidade não encontrado');
    quantidade.value = '3';
    quantidade.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(tela.querySelector('.previa')?.textContent.replace(/\s+/g, ' ').trim()).toBe(
      '3 × R$ 95,00 = R$ 285,00 · 300 salgados',
    );
  });

  it('envia produto, combinação, quantidade e produtor', async () => {
    await montar();

    escolherProduto('coxinha');
    await fixture.whenStable();
    tela.querySelectorAll<HTMLInputElement>('.combinacao input')[1]?.click();
    tela.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(enviados).toEqual([
      {
        produtoId: 'coxinha',
        preparo: 'FRITO',
        unidadeVenda: 'UNIDADE',
        quantidade: 1,
        produtorId: 'pr-Mira',
        observacao: null,
      },
    ]);
  });
});
