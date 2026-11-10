import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  max,
  maxLength,
  min,
  required,
  validate,
} from '@angular/forms/signals';

import type { NovoItem } from '../../../../core/models/pedido';
import type { Produto } from '../../../../core/models/produto';
import { APARENCIA_DO_PREPARO } from '../../../../shared/components/chip-preparo/chip-preparo';
import { ErrosDoCampo } from '../../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../../shared/pipes/moeda.pipe';
import { idUnico } from '../../../../shared/utils/id-unico';

export interface OpcaoProdutor {
  id: string;
  nome: string;
}

/** Grava o item e devolve a mensagem de erro, ou null se deu certo. */
export type SalvarItem = (item: NovoItem) => Promise<string | null>;

const UNIDADES_POR_CENTO = 100;

/**
 * Novo item: o produto define as combinações com preço vigente e o produtor
 * sugerido; o preço é copiado pelo servidor no momento da gravação.
 */
@Component({
  selector: 'ms-item-formulario',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone, MoedaPipe],
  templateUrl: './item-formulario.html',
  styleUrl: './item-formulario.css',
})
export class ItemFormulario {
  /** Produtos ativos com preços vigentes. */
  readonly produtos = input.required<readonly Produto[]>();
  readonly produtores = input.required<readonly OpcaoProdutor[]>();
  readonly salvar = input.required<SalvarItem>();
  readonly cancelar = output();

  protected readonly id = idUnico('item');
  protected readonly erro = signal<string | null>(null);
  private readonly campoProduto = viewChild<ElementRef<HTMLSelectElement>>('campoProduto');

  private readonly valores = signal({
    produtoId: '',
    precoId: '',
    quantidade: 1,
    produtorId: '',
    observacao: '',
  });

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.produtoId, { message: 'Escolha o produto.' });
      required(campo.precoId, { message: 'Escolha o preparo e a unidade.' });
      required(campo.quantidade, { message: 'Informe a quantidade.' });
      min(campo.quantidade, 1, { message: 'A quantidade mínima é 1.' });
      max(
        campo.quantidade,
        () => (this.precoEscolhido()?.unidadeVenda === 'CENTO' ? 100000 : 1000),
        { message: 'Quantidade acima do limite permitido.' },
      );
      validate(campo.quantidade, ({ value }) =>
        Number.isInteger(value())
          ? null
          : { kind: 'inteira', message: 'Informe uma quantidade inteira de salgados.' },
      );
      required(campo.produtorId, { message: 'Escolha quem prepara.' });
      maxLength(campo.observacao, 300, { message: 'Use no máximo 300 caracteres.' });
    },
    {
      submission: {
        action: async () => {
          const item = this.item();
          if (!item) return undefined;
          this.erro.set(null);
          this.erro.set(await this.salvar()(item));
          return undefined;
        },
      },
    },
  );

  protected readonly produto = computed(() =>
    this.produtos().find((produto) => produto.id === this.valores().produtoId),
  );
  protected readonly precos = computed(() =>
    (this.produto()?.precosVigentes ?? []).map((preco) => ({
      ...preco,
      rotulo: `${APARENCIA_DO_PREPARO[preco.preparo].rotulo} · ${preco.unidadeVenda === 'CENTO' ? 'Preço para 100 salgados' : 'Preço por salgado'}`,
    })),
  );
  protected readonly precoEscolhido = computed(() =>
    this.precos().find((preco) => preco.id === this.valores().precoId),
  );
  /** Conta mostrada antes de gravar, com a quantidade na cozinha em unidades. */
  protected readonly previa = computed(() => {
    const preco = this.precoEscolhido();
    const quantidade = this.valores().quantidade;
    if (!preco || !Number.isInteger(quantidade) || quantidade <= 0) return null;
    return {
      quantidade,
      precoCentavos: preco.precoCentavos,
      subtotalCentavos: Math.round(
        (preco.precoCentavos * quantidade) /
          (preco.unidadeVenda === 'CENTO' ? UNIDADES_POR_CENTO : 1),
      ),
      salgados: quantidade,
    };
  });
  protected readonly rotuloDaQuantidade = computed(() => {
    return 'Quantidade de salgados';
  });
  protected readonly produtoresDoItem = computed(() => {
    const padrao = this.produto()?.produtorPadrao;
    const ativos = this.produtores();
    return padrao && !ativos.some((produtor) => produtor.id === padrao.id)
      ? [...ativos, padrao]
      : ativos;
  });

  constructor() {
    afterNextRender(() => this.campoProduto()?.nativeElement.focus());
  }

  /** Ao trocar de produto, sugere a primeira combinação e o produtor padrão dele. */
  protected aoTrocarProduto(): void {
    const produto = this.produto();
    this.valores.update((atuais) => ({
      ...atuais,
      precoId: produto?.precosVigentes[0]?.id ?? '',
      produtorId: produto?.produtorPadrao.id ?? '',
    }));
  }

  private item(): NovoItem | undefined {
    const preco = this.precoEscolhido();
    const { produtoId, quantidade, produtorId, observacao } = this.valores();
    if (!preco) return undefined;
    return {
      produtoId,
      preparo: preco.preparo,
      unidadeVenda: preco.unidadeVenda,
      quantidade: preco.unidadeVenda === 'CENTO' ? quantidade / UNIDADES_POR_CENTO : quantidade,
      produtorId,
      observacao: observacao.trim() || null,
    };
  }
}
