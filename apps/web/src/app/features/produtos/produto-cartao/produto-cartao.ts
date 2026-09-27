import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  type AlteracaoProduto,
  type PrecoProduto,
  type Produto,
  ROTULO_UNIDADE,
} from '../../../core/models/produto';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { ProdutosService } from '../../../core/services/produtos.service';
import { Chip } from '../../../shared/components/chip/chip';
import {
  APARENCIA_DO_PREPARO,
  ChipPreparo,
} from '../../../shared/components/chip-preparo/chip-preparo';
import { Icone } from '../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { idUnico } from '../../../shared/utils/id-unico';
import { PrecoFormulario, type SalvarPreco } from '../preco-formulario/preco-formulario';
import {
  type DadosProduto,
  type OpcaoProdutor,
  ProdutoFormulario,
  type SalvarProduto,
} from '../produto-formulario/produto-formulario';

/** Produto com produtor padrão, preços vigentes, novo preço e histórico. */
@Component({
  selector: 'ms-produto-cartao',
  imports: [Chip, ChipPreparo, DatePipe, Icone, MoedaPipe, PrecoFormulario, ProdutoFormulario],
  templateUrl: './produto-cartao.html',
  styleUrl: './produto-cartao.css',
})
export class ProdutoCartao {
  private readonly servico = inject(ProdutosService);

  readonly produto = input.required<Produto>();
  readonly produtores = input.required<readonly OpcaoProdutor[]>();
  /** Emitido depois de cada gravação, com a confirmação para anunciar. */
  readonly alterado = output<string>();

  protected readonly id = idUnico('produto-cartao');
  protected readonly rotuloUnidade = ROTULO_UNIDADE;
  protected readonly editando = signal(false);
  protected readonly precoAberto = signal(false);
  protected readonly historicoAberto = signal(false);
  protected readonly encerrando = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);

  protected readonly historico = this.servico.historico(() =>
    this.historicoAberto() ? this.produto().id : undefined,
  );
  protected readonly dadosAtuais = computed((): DadosProduto => ({
    nome: this.produto().nome,
    produtorPadraoId: this.produto().produtorPadrao.id,
    ativo: this.produto().ativo,
  }));

  protected combinacao(preco: PrecoProduto): string {
    return `${APARENCIA_DO_PREPARO[preco.preparo].rotulo} · ${ROTULO_UNIDADE[preco.unidadeVenda]}`;
  }

  protected editar(): void {
    this.precoAberto.set(false);
    this.editando.set(true);
  }

  protected abrirPreco(): void {
    this.erro.set(null);
    this.precoAberto.set(true);
  }

  protected alternarHistorico(): void {
    this.historicoAberto.update((aberto) => !aberto);
  }

  protected readonly salvarProduto: SalvarProduto = async (dados) => {
    const alteracao = alteracoes(this.produto(), dados);
    if (Object.keys(alteracao).length === 0) {
      this.editando.set(false);
      return null;
    }
    try {
      const produto = await firstValueFrom(this.servico.atualizar(this.produto().id, alteracao));
      this.editando.set(false);
      this.alterado.emit(`Alterações de ${produto.nome} salvas.`);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected readonly salvarPreco: SalvarPreco = async (preco) => {
    try {
      await firstValueFrom(this.servico.definirPreco(this.produto().id, preco));
      this.precoAberto.set(false);
      this.historico.reload();
      const combinacao = `${APARENCIA_DO_PREPARO[preco.preparo].rotulo} · ${ROTULO_UNIDADE[preco.unidadeVenda]}`;
      this.alterado.emit(`Preço de ${this.produto().nome}, ${combinacao}, salvo.`);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected async encerrar(preco: PrecoProduto): Promise<void> {
    this.erro.set(null);
    try {
      await firstValueFrom(this.servico.encerrarPreco(this.produto().id, preco.id));
      this.encerrando.set(null);
      this.historico.reload();
      this.alterado.emit(`Preço de ${this.produto().nome}, ${this.combinacao(preco)}, encerrado.`);
    } catch (falha) {
      this.erro.set(mensagemDeErro(falha));
    }
  }
}

function alteracoes(produto: Produto, dados: DadosProduto): AlteracaoProduto {
  const alteracao: AlteracaoProduto = {};
  if (dados.nome !== produto.nome) alteracao.nome = dados.nome;
  if (dados.produtorPadraoId !== produto.produtorPadrao.id) {
    alteracao.produtorPadraoId = dados.produtorPadraoId;
  }
  if (dados.ativo !== produto.ativo) alteracao.ativo = dados.ativo;
  return alteracao;
}
