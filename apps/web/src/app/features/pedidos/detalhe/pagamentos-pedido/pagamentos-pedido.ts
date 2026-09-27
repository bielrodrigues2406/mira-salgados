import { Component, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import {
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  type Pagamento,
  type PedidoDetalhe,
} from '../../../../core/models/pedido';
import { mensagemDeErro } from '../../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { ErrosDoCampo } from '../../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../../shared/components/icone/icone';
import type { NomeIcone } from '../../../../shared/components/icone/icones';
import { MoedaPipe } from '../../../../shared/pipes/moeda.pipe';
import {
  centavosDeTexto,
  centavosParaTexto,
  formatarMoeda,
} from '../../../../shared/utils/dinheiro';
import { momentoCurto } from '../../../../shared/utils/datas';
import type { AlteracaoDoPedido } from '../alteracao';

const FORMAS: Record<FormaPagamento, { rotulo: string; icone: NomeIcone }> = {
  DINHEIRO: { rotulo: 'Dinheiro', icone: 'dinheiro' },
  PIX: { rotulo: 'PIX', icone: 'pix' },
  FIADO: { rotulo: 'Fiado', icone: 'fiado' },
};

@Component({
  selector: 'ms-pagamentos-pedido',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone, MoedaPipe],
  templateUrl: './pagamentos-pedido.html',
  styleUrl: './pagamentos-pedido.css',
})
export class PagamentosPedido {
  private readonly pedidos = inject(PedidosService);

  readonly pedido = input.required<PedidoDetalhe>();
  readonly alterado = output<AlteracaoDoPedido>();

  protected readonly formas = FORMAS_PAGAMENTO.map((forma) => ({ forma, ...FORMAS[forma] }));
  protected readonly aparencia = FORMAS;
  protected readonly momento = momentoCurto;
  protected readonly registrando = signal(false);
  protected readonly estornando = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroDoFormulario = signal<string | null>(null);

  protected readonly podeRegistrar = computed(
    () => this.pedido().status !== 'CANCELADO' && this.pedido().resumo.saldoDevedorCentavos > 0,
  );

  private readonly valores = signal<{ forma: FormaPagamento; valor: string }>({
    forma: 'DINHEIRO',
    valor: '',
  });
  protected readonly ehFiado = computed(() => this.valores().forma === 'FIADO');

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.valor, { message: 'Informe o valor.' });
      validate(campo.valor, ({ value }) => {
        if (value().trim() === '') return undefined;
        const centavos = centavosDeTexto(value());
        if (centavos === null) return { kind: 'formato', message: 'Use um valor como 100,00.' };
        return centavos > 0
          ? undefined
          : { kind: 'minimo', message: 'O valor precisa ser maior que zero.' };
      });
    },
    {
      submission: {
        action: async () => {
          const { forma, valor } = this.valores();
          const valorCentavos = centavosDeTexto(valor);
          if (valorCentavos === null) return undefined;
          this.erroDoFormulario.set(null);
          try {
            const pedido = await firstValueFrom(
              this.pedidos.registrarPagamento(this.pedido().id, { forma, valorCentavos }),
            );
            this.registrando.set(false);
            this.alterado.emit({
              pedido,
              aviso: `${FORMAS[forma].rotulo} de ${formatarMoeda(valorCentavos)} registrado.`,
            });
          } catch (falha) {
            this.erroDoFormulario.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  /** Abre o formulário já com o saldo em aberto, o caso mais comum. */
  protected abrir(): void {
    this.erro.set(null);
    this.erroDoFormulario.set(null);
    this.formulario().reset({
      forma: 'DINHEIRO',
      valor: centavosParaTexto(this.pedido().resumo.saldoDevedorCentavos),
    });
    this.registrando.set(true);
  }

  protected rotuloDoEstorno(pagamento: Pagamento): string {
    return `Estornar pagamento ${FORMAS[pagamento.forma].rotulo} de ${formatarMoeda(pagamento.valorCentavos)}`;
  }

  protected async estornar(pagamento: Pagamento): Promise<void> {
    this.erro.set(null);
    try {
      const pedido = await firstValueFrom(
        this.pedidos.estornarPagamento(this.pedido().id, pagamento.id),
      );
      this.estornando.set(null);
      this.alterado.emit({
        pedido,
        aviso: `${FORMAS[pagamento.forma].rotulo} de ${formatarMoeda(pagamento.valorCentavos)} estornado.`,
      });
    } catch (falha) {
      this.erro.set(mensagemDeErro(falha));
    }
  }
}
