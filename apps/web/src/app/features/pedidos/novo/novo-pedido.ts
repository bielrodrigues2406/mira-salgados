import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, FormRoot, maxLength, required, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import type { DadosPedidoConfirmado, NovoItem, TipoEntrega } from '../../../core/models/pedido';
import type { Produto } from '../../../core/models/produto';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../core/services/pedidos.service';
import { ProdutoresService } from '../../../core/services/produtores.service';
import { ProdutosService } from '../../../core/services/produtos.service';
import { Chip } from '../../../shared/components/chip/chip';
import { ChipPreparo } from '../../../shared/components/chip-preparo/chip-preparo';
import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';
import {
  type ClienteEscolhido,
  SeletorCliente,
} from '../../../shared/components/seletor-cliente/seletor-cliente';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { hoje } from '../../../shared/utils/datas';
import { centavosDeTexto } from '../../../shared/utils/dinheiro';
import { idUnico } from '../../../shared/utils/id-unico';
import { ItemFormulario, type SalvarItem } from '../detalhe/item-formulario/item-formulario';

const LIMITE_DE_CADASTRO = 100;
const UNIDADES_POR_CENTO = 100;

interface ValoresCabecalho {
  clienteId: string;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string;
  desconto: string;
  observacao: string;
  enderecoModo: 'CLIENTE' | 'OUTRO';
  enderecoOutro: string;
}

interface ItemLocal {
  chave: string;
  item: NovoItem;
  produtoNome: string;
  produtorNome: string;
  salgados: number;
  subtotalCentavos: number;
}

function centavosOpcionais(texto: string): number | null {
  return texto.trim() === '' ? 0 : centavosDeTexto(texto);
}

function gerarChaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mira-${String(Date.now())}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Cria uma encomenda já confirmada com dados e itens num único salvamento.
 * Mantém o formulário preenchido em caso de erro e reutiliza a mesma
 * Idempotency-Key enquanto os dados da tentativa não mudarem.
 */
@Component({
  selector: 'ms-novo-pedido',
  imports: [
    Chip,
    ChipPreparo,
    ErrosDoCampo,
    FormField,
    FormRoot,
    Icone,
    ItemFormulario,
    MoedaPipe,
    RouterLink,
    SeletorCliente,
  ],
  templateUrl: './novo-pedido.html',
  styleUrl: './novo-pedido.css',
})
export class NovoPedido {
  private readonly pedidos = inject(PedidosService);
  private readonly router = inject(Router);

  protected readonly id = idUnico('nova-encomenda');
  protected readonly erro = signal<string | null>(null);
  protected readonly erroItens = signal<string | null>(null);
  protected readonly adicionandoItem = signal(false);
  protected readonly enderecoDoCliente = signal<string | null>(null);
  protected readonly itens = signal<readonly ItemLocal[]>([]);

  private sequenciaItem = 0;
  private chaveTentativa: string | null = null;
  private assinaturaTentativa: string | null = null;

  private readonly valores = signal<ValoresCabecalho>({
    clienteId: '',
    tipoEntrega: 'RETIRADA',
    dataEntrega: hoje(),
    horarioEntrega: '',
    desconto: '',
    observacao: '',
    enderecoModo: 'CLIENTE',
    enderecoOutro: '',
  });

  private readonly produtosAtivos = inject(ProdutosService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_CADASTRO,
    ativo: true,
  }));
  protected readonly produtos = computed((): Produto[] =>
    this.produtosAtivos.hasValue()
      ? this.produtosAtivos.value().itens.filter((produto) => produto.precosVigentes.length > 0)
      : [],
  );

  private readonly produtoresAtivos = inject(ProdutoresService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_CADASTRO,
    ativo: true,
  }));
  protected readonly produtores = computed(() =>
    this.produtoresAtivos.hasValue()
      ? this.produtoresAtivos.value().itens.map(({ id, nome }) => ({ id, nome }))
      : [],
  );

  protected readonly ehEntrega = computed(() => this.valores().tipoEntrega === 'ENTREGA');
  protected readonly digitaEndereco = computed(
    () => this.enderecoDoCliente() === null || this.valores().enderecoModo === 'OUTRO',
  );
  protected readonly subtotalCentavos = computed(() =>
    this.itens().reduce((soma, item) => soma + item.subtotalCentavos, 0),
  );
  protected readonly descontoCentavos = computed(
    () => centavosOpcionais(this.valores().desconto) ?? 0,
  );
  protected readonly totalCentavos = computed(() =>
    Math.max(0, this.subtotalCentavos() - this.descontoCentavos()),
  );
  protected readonly descontoAcimaDoSubtotal = computed(
    () => this.itens().length > 0 && this.descontoCentavos() > this.subtotalCentavos(),
  );

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.clienteId, { message: 'Escolha o cliente.' });
      required(campo.dataEntrega, { message: 'Informe a data de entrega.' });
      validate(campo.desconto, ({ value }) => {
        const valor = centavosOpcionais(value());
        if (valor === null) return { kind: 'formato', message: 'Use um valor como 20,00.' };
        if (this.itens().length > 0 && valor > this.subtotalCentavos()) {
          return {
            kind: 'limite',
            message: 'O desconto não pode passar do valor dos itens.',
          };
        }
        return undefined;
      });
      maxLength(campo.observacao, 500, { message: 'Use no máximo 500 caracteres.' });
      maxLength(campo.enderecoOutro, 200, { message: 'Use no máximo 200 caracteres.' });
    },
    {
      submission: {
        action: async () => {
          await this.salvar();
          return undefined;
        },
      },
    },
  );

  protected readonly adicionarItemLocal: SalvarItem = (novoItem) => {
    const produto = this.produtos().find((p) => p.id === novoItem.produtoId);
    const preco = produto?.precosVigentes.find(
      (p) => p.preparo === novoItem.preparo && p.unidadeVenda === novoItem.unidadeVenda,
    );
    if (!produto || !preco) {
      return Promise.resolve('Escolha um produto com preço vigente.');
    }
    const produtorNome =
      this.produtores().find((p) => p.id === novoItem.produtorId)?.nome ??
      produto.produtorPadrao.nome;
    const salgados =
      novoItem.unidadeVenda === 'CENTO'
        ? Math.round(novoItem.quantidade * UNIDADES_POR_CENTO)
        : novoItem.quantidade;
    const subtotalCentavos = Math.round(
      (preco.precoCentavos * salgados) /
        (novoItem.unidadeVenda === 'CENTO' ? UNIDADES_POR_CENTO : 1),
    );

    this.sequenciaItem += 1;
    this.itens.update((atuais) => [
      ...atuais,
      {
        chave: `local-${String(this.sequenciaItem)}`,
        item: novoItem,
        produtoNome: produto.nome,
        produtorNome,
        salgados,
        subtotalCentavos,
      },
    ]);
    this.erroItens.set(null);
    this.erro.set(null);
    this.adicionandoItem.set(false);
    return Promise.resolve(null);
  };

  protected removerItemLocal(chave: string): void {
    this.itens.update((atuais) => atuais.filter((item) => item.chave !== chave));
    this.erro.set(null);
  }

  protected aoEscolherCliente(cliente: ClienteEscolhido | null): void {
    this.enderecoDoCliente.set(cliente?.endereco ?? null);
  }

  protected async cancelar(): Promise<void> {
    await this.router.navigateByUrl('/pedidos');
  }

  private async salvar(): Promise<void> {
    this.erro.set(null);
    this.erroItens.set(null);

    if (this.itens().length === 0) {
      this.erroItens.set('Adicione ao menos um item à encomenda.');
      return;
    }

    const payload = this.montarPayload();
    const assinatura = JSON.stringify(payload);
    if (this.chaveTentativa === null || this.assinaturaTentativa !== assinatura) {
      this.chaveTentativa = gerarChaveIdempotencia();
      this.assinaturaTentativa = assinatura;
    }

    try {
      const pedido = await firstValueFrom(
        this.pedidos.criarConfirmado(payload, this.chaveTentativa),
      );
      await this.router.navigate(['/pedidos', pedido.id]);
    } catch (falha) {
      this.erro.set(mensagemDeErro(falha));
    }
  }

  private montarPayload(): DadosPedidoConfirmado {
    const valores = this.valores();
    return {
      clienteId: valores.clienteId,
      tipoEntrega: valores.tipoEntrega,
      enderecoEntrega: this.enderecoEntrega(valores),
      dataEntrega: valores.dataEntrega,
      horarioEntrega: valores.horarioEntrega || null,
      descontoCentavos: centavosOpcionais(valores.desconto) ?? 0,
      observacao: valores.observacao.trim() || null,
      itens: this.itens().map(({ item }) => item),
    };
  }

  private enderecoEntrega(valores: ValoresCabecalho): string | null {
    if (valores.tipoEntrega !== 'ENTREGA') return null;
    const doCliente = this.enderecoDoCliente();
    if (valores.enderecoModo === 'CLIENTE' && doCliente) return doCliente;
    return valores.enderecoOutro.trim() || null;
  }
}
