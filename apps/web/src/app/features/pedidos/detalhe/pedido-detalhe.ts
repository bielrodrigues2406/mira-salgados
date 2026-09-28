import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type {
  DadosPedido,
  PedidoDetalhe as Pedido,
  StatusPedido,
} from '../../../core/models/pedido';
import type { Produto } from '../../../core/models/produto';
import { ClientesService } from '../../../core/services/clientes.service';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../core/services/pedidos.service';
import { ProdutoresService } from '../../../core/services/produtores.service';
import { ProdutosService } from '../../../core/services/produtos.service';
import { ChipStatus } from '../../../shared/components/chip-status/chip-status';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { Icone } from '../../../shared/components/icone/icone';
import type { NomeIcone } from '../../../shared/components/icone/icones';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { dataCurta, hoje } from '../../../shared/utils/datas';
import { mensagemDeConfirmacao } from '../../../shared/utils/mensagens';
import { linkDoWhatsApp } from '../../../shared/utils/whatsapp';
import { PedidoFormulario, type SalvarPedido } from '../pedido-formulario/pedido-formulario';
import type { AlteracaoDoPedido } from './alteracao';
import { ItensPedido } from './itens-pedido/itens-pedido';
import { PagamentosPedido } from './pagamentos-pedido/pagamentos-pedido';
import { ResumoFinanceiro } from './resumo-financeiro/resumo-financeiro';

const LIMITE_DE_CADASTRO = 100;

interface AcaoDeStatus {
  status: StatusPedido;
  rotulo: string;
  icone: NomeIcone;
}

const AVANCOS: Partial<Record<StatusPedido, AcaoDeStatus>> = {
  CONFIRMADO: { status: 'CONFIRMADO', rotulo: 'Confirmar pedido', icone: 'confirmado' },
  CONCLUIDO: { status: 'CONCLUIDO', rotulo: 'Concluir pedido', icone: 'concluido' },
};

const AVISOS: Record<StatusPedido, string> = {
  RASCUNHO: 'Pedido voltou a rascunho.',
  CONFIRMADO: 'Pedido confirmado. Ele entra na produção do dia.',
  CONCLUIDO: 'Pedido concluído.',
  CANCELADO: 'Pedido cancelado.',
};

@Component({
  selector: 'ms-pedido-detalhe',
  imports: [
    ChipStatus,
    EstadoErro,
    Icone,
    ItensPedido,
    ListaEsqueleto,
    MoedaPipe,
    PagamentosPedido,
    PedidoFormulario,
    ResumoFinanceiro,
    RouterLink,
    TelefonePipe,
  ],
  templateUrl: './pedido-detalhe.html',
  styleUrl: './pedido-detalhe.css',
})
export class PedidoDetalhe {
  private readonly pedidos = inject(PedidosService);

  /** Da rota (/pedidos/:id), pela ligação de parâmetros a inputs. */
  readonly id = input.required<string>();

  protected readonly hoje = hoje();
  protected readonly recurso = this.pedidos.detalhar(() => this.id());
  protected readonly pedido = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly aviso = signal('');
  protected readonly erroDeStatus = signal<string | null>(null);
  protected readonly editando = signal(false);
  protected readonly confirmandoCancelamento = signal(false);
  protected readonly mudandoStatus = signal(false);

  protected readonly avanco = computed(() => {
    const permitidas = this.pedido()?.transicoesPermitidas ?? [];
    return permitidas.map((status) => AVANCOS[status]).find((acao) => acao !== undefined);
  });
  protected readonly podeCancelar = computed(
    () => this.pedido()?.transicoesPermitidas.includes('CANCELADO') ?? false,
  );
  protected readonly quando = computed(() => {
    const pedido = this.pedido();
    if (!pedido) return '';
    const horario = pedido.horarioEntrega ?? 'Sem horário';
    return pedido.dataEntrega === this.hoje ? `Hoje · ${horario}` : horario;
  });
  protected readonly dataDaEntrega = computed(() => {
    const pedido = this.pedido();
    return pedido ? dataCurta(pedido.dataEntrega) : '';
  });

  private readonly idDoCliente = computed(() => this.pedido()?.cliente.id);
  private readonly cliente = inject(ClientesService).detalhar(() => this.idDoCliente());
  /** Saldo do cliente em outros pedidos, sem contar este. */
  protected readonly outrasEncomendas = computed(() => {
    const pedido = this.pedido();
    if (!pedido || !this.cliente.hasValue()) return [];
    return this.cliente.value().pedidosComSaldo.filter((outro) => outro.id !== pedido.id);
  });

  // Booleano derivado: as listas de apoio só são buscadas de novo se o pedido
  // deixar de ser editável, não a cada gravação que substitui o pedido.
  private readonly editavel = computed(() => this.pedido()?.editavel ?? false);
  private readonly produtosAtivos = inject(ProdutosService).listar(() =>
    this.editavel() ? { page: 1, pageSize: LIMITE_DE_CADASTRO, ativo: true } : undefined,
  );
  protected readonly produtos = computed((): Produto[] =>
    this.produtosAtivos.hasValue()
      ? this.produtosAtivos.value().itens.filter((produto) => produto.precosVigentes.length > 0)
      : [],
  );
  private readonly produtoresAtivos = inject(ProdutoresService).listar(() =>
    this.editavel() ? { page: 1, pageSize: LIMITE_DE_CADASTRO, ativo: true } : undefined,
  );
  protected readonly produtores = computed(() =>
    this.produtoresAtivos.hasValue()
      ? this.produtoresAtivos.value().itens.map(({ id, nome }) => ({ id, nome }))
      : [],
  );

  protected readonly dadosAtuais = computed((): DadosPedido | undefined => {
    const pedido = this.pedido();
    if (!pedido) return undefined;
    return {
      clienteId: pedido.cliente.id,
      tipoEntrega: pedido.tipoEntrega,
      dataEntrega: pedido.dataEntrega,
      horarioEntrega: pedido.horarioEntrega,
      descontoCentavos: pedido.resumo.descontoCentavos,
      observacao: pedido.observacao,
      enderecoEntrega: pedido.enderecoEntrega,
    };
  });

  protected aplicar({ pedido, aviso }: AlteracaoDoPedido): void {
    this.recurso.set(pedido);
    this.aviso.set(aviso);
    this.cliente.reload();
  }

  protected async mudarStatus(status: StatusPedido): Promise<void> {
    const atual = this.pedido();
    if (!atual) return;
    this.erroDeStatus.set(null);
    this.mudandoStatus.set(true);
    try {
      const pedido = await firstValueFrom(this.pedidos.alterarStatus(atual.id, status));
      this.confirmandoCancelamento.set(false);
      this.aplicar({ pedido, aviso: AVISOS[status] });
    } catch (falha) {
      this.erroDeStatus.set(mensagemDeErro(falha));
    } finally {
      this.mudandoStatus.set(false);
    }
  }

  protected readonly salvarDados: SalvarPedido = async (dados) => {
    const atual = this.pedido();
    if (!atual) return null;
    try {
      const pedido = await firstValueFrom(this.pedidos.atualizar(atual.id, dados));
      this.editando.set(false);
      this.aplicar({ pedido, aviso: 'Dados do pedido salvos.' });
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected telefoneParaLigar(pedido: Pedido): string | null {
    return pedido.cliente.telefone ? `tel:+55${pedido.cliente.telefone}` : null;
  }

  /** Resumo do pedido para o cliente; sem celular cadastrado, a pessoa escolhe o contato. */
  protected resumoNoWhatsApp(pedido: Pedido): string {
    return linkDoWhatsApp(mensagemDeConfirmacao(pedido), pedido.cliente.telefone);
  }
}
