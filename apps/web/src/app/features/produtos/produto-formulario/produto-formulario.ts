import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, FormRoot, maxLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';
import { idUnico } from '../../../shared/utils/id-unico';

export interface DadosProduto {
  nome: string;
  produtorPadraoId: string;
  ativo: boolean;
}

export interface OpcaoProdutor {
  id: string;
  nome: string;
  ativo: boolean;
}

export const PRODUTO_VAZIO: DadosProduto = { nome: '', produtorPadraoId: '', ativo: true };

/** Grava os dados e devolve a mensagem de erro, ou null se deu certo. */
export type SalvarProduto = (dados: DadosProduto) => Promise<string | null>;

@Component({
  selector: 'ms-produto-formulario',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone, RouterLink],
  templateUrl: './produto-formulario.html',
  styleUrl: './produto-formulario.css',
})
export class ProdutoFormulario {
  readonly titulo = input.required<string>();
  readonly inicial = input<DadosProduto>(PRODUTO_VAZIO);
  /** Produtores ativos, que podem ser escolhidos como padrão. */
  readonly produtores = input.required<readonly OpcaoProdutor[]>();
  /** Produtor atual, que continua na lista mesmo se foi desativado depois. */
  readonly produtorAtual = input<OpcaoProdutor>();
  readonly edicao = input(false);
  readonly rotuloSalvar = input('Salvar produto');
  readonly salvar = input.required<SalvarProduto>();
  readonly cancelar = output();

  protected readonly id = idUnico('produto');
  protected readonly erro = signal<string | null>(null);
  private readonly campoNome = viewChild.required<ElementRef<HTMLInputElement>>('campoNome');

  protected readonly opcoes = computed(() => {
    const atual = this.produtorAtual();
    const ativos = this.produtores();
    return atual && !ativos.some((produtor) => produtor.id === atual.id)
      ? [...ativos, atual]
      : ativos;
  });

  private readonly valores = linkedSignal(() => ({ ...this.inicial() }));

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.nome, { message: 'Informe o nome.' });
      maxLength(campo.nome, 80, { message: 'Use no máximo 80 caracteres.' });
      required(campo.produtorPadraoId, { message: 'Escolha o produtor padrão.' });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const { nome, produtorPadraoId, ativo } = this.valores();
          this.erro.set(await this.salvar()({ nome: nome.trim(), produtorPadraoId, ativo }));
          return undefined;
        },
      },
    },
  );

  constructor() {
    afterNextRender(() => {
      this.campoNome().nativeElement.focus();
    });
  }
}
