import { Component, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField, FormRoot, max, maxLength, min, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import type { ItemPedido, NovoItem, PedidoDetalhe } from '../../../../core/models/pedido';
import { type Produto, ROTULO_UNIDADE } from '../../../../core/models/produto';
import { mensagemDeErro } from '../../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { Chip } from '../../../../shared/components/chip/chip';
import { ChipPreparo } from '../../../../shared/components/chip-preparo/chip-preparo';
import { ErrosDoCampo } from '../../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../../shared/pipes/moeda.pipe';
import type { AlteracaoDoPedido } from '../alteracao';
import {
  ItemFormulario,
  type OpcaoProdutor,
  type SalvarItem,
} from '../item-formulario/item-formulario';

@Component({
  selector: 'ms-itens-pedido',
  imports: [Chip, ChipPreparo, ErrosDoCampo, FormField, FormRoot, Icone, ItemFormulario, MoedaPipe],
  templateUrl: './itens-pedido.html',
  styleUrl: './itens-pedido.css',
})
export class ItensPedido {
  private readonly pedidos = inject(PedidosService);

  readonly pedido = input.required<PedidoDetalhe>();
  readonly produtos = input.required<readonly Produto[]>();
  readonly produtores = input.required<readonly OpcaoProdutor[]>();
  readonly alterado = output<AlteracaoDoPedido>();

  protected readonly rotuloUnidade = ROTULO_UNIDADE;
  protected readonly adicionando = signal(false);
  protected readonly emEdicao = signal<ItemPedido | null>(null);
  protected readonly removendo = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly editavel = computed(() => this.pedido().editavel);

  private readonly edicao = signal({ quantidade: 1, produtorId: '', observacao: '' });
  protected readonly formularioEdicao = form(
    this.edicao,
    (campo) => {
      required(campo.quantidade, { message: 'Informe a quantidade.' });
      min(campo.quantidade, 1, { message: 'A quantidade mínima é 1.' });
      max(campo.quantidade, 1000, { message: 'A quantidade máxima é 1000.' });
      maxLength(campo.observacao, 300, { message: 'Use no máximo 300 caracteres.' });
    },
    {
      submission: {
        action: async () => {
          const item = this.emEdicao();
          if (!item) return undefined;
          const { quantidade, produtorId, observacao } = this.edicao();
          await this.gravar(
            this.pedidos.atualizarItem(this.pedido().id, item.id, {
              quantidade,
              produtorId,
              observacao: observacao.trim() || null,
            }),
            `${item.produto.nome} atualizado.`,
            () => {
              this.emEdicao.set(null);
            },
          );
          return undefined;
        },
      },
    },
  );

  protected produtoresDoItem(item: ItemPedido): readonly OpcaoProdutor[] {
    const ativos = this.produtores();
    return ativos.some((produtor) => produtor.id === item.produtor.id)
      ? ativos
      : [...ativos, item.produtor];
  }

  protected editar(item: ItemPedido): void {
    this.erro.set(null);
    this.removendo.set(null);
    this.adicionando.set(false);
    this.formularioEdicao().reset({
      quantidade: item.quantidade,
      produtorId: item.produtor.id,
      observacao: item.observacao ?? '',
    });
    this.emEdicao.set(item);
  }

  protected abrirNovo(): void {
    this.erro.set(null);
    this.emEdicao.set(null);
    this.adicionando.set(true);
  }

  protected async remover(item: ItemPedido): Promise<void> {
    await this.gravar(
      this.pedidos.removerItem(this.pedido().id, item.id),
      `${item.produto.nome} removido.`,
      () => {
        this.removendo.set(null);
      },
    );
  }

  protected readonly adicionar: SalvarItem = async (item: NovoItem) => {
    try {
      const pedido = await firstValueFrom(this.pedidos.adicionarItem(this.pedido().id, item));
      this.adicionando.set(false);
      const nome = this.produtos().find((produto) => produto.id === item.produtoId)?.nome ?? 'Item';
      this.alterado.emit({ pedido, aviso: `${nome} adicionado.` });
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  private async gravar(
    requisicao: ReturnType<PedidosService['removerItem']>,
    aviso: string,
    depois: () => void,
  ): Promise<void> {
    this.erro.set(null);
    try {
      const pedido = await firstValueFrom(requisicao);
      depois();
      this.alterado.emit({ pedido, aviso });
    } catch (falha) {
      this.erro.set(mensagemDeErro(falha));
    }
  }
}
