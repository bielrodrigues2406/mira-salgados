import { Component, input, linkedSignal, output, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, required, validate } from '@angular/forms/signals';

import type { DadosPedido, TipoEntrega } from '../../../core/models/pedido';
import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';
import { centavosDeTexto, centavosParaTexto } from '../../../shared/utils/dinheiro';
import { idUnico } from '../../../shared/utils/id-unico';
import { type ClienteEscolhido, SeletorCliente } from '../seletor-cliente/seletor-cliente';

/** Grava os dados e devolve a mensagem de erro, ou null se deu certo. */
export type SalvarPedido = (dados: DadosPedido) => Promise<string | null>;

interface Valores {
  clienteId: string;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string;
  desconto: string;
  observacao: string;
}

function valoresDe(dados: DadosPedido): Valores {
  return {
    clienteId: dados.clienteId,
    tipoEntrega: dados.tipoEntrega,
    dataEntrega: dados.dataEntrega,
    horarioEntrega: dados.horarioEntrega ?? '',
    desconto: dados.descontoCentavos > 0 ? centavosParaTexto(dados.descontoCentavos) : '',
    observacao: dados.observacao ?? '',
  };
}

/** Valor opcional em reais: vazio é zero; texto inválido é null. */
function centavosOpcionais(texto: string): number | null {
  return texto.trim() === '' ? 0 : centavosDeTexto(texto);
}

/**
 * Dados do pedido: cliente, entrega ou retirada, desconto e observação.
 * Serve para criar e para editar. Entrega é só logística: não muda valores.
 */
@Component({
  selector: 'ms-pedido-formulario',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone, SeletorCliente],
  templateUrl: './pedido-formulario.html',
  styleUrl: './pedido-formulario.css',
})
export class PedidoFormulario {
  readonly inicial = input.required<DadosPedido>();
  readonly clienteInicial = input<ClienteEscolhido | null>(null);
  readonly rotuloSalvar = input('Salvar pedido');
  readonly salvar = input.required<SalvarPedido>();
  readonly cancelar = output();

  protected readonly id = idUnico('pedido');
  protected readonly erro = signal<string | null>(null);
  private readonly valores = linkedSignal(() => valoresDe(this.inicial()));

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.clienteId, { message: 'Escolha o cliente.' });
      required(campo.dataEntrega, { message: 'Informe a data de entrega.' });
      validate(campo.desconto, ({ value }) =>
        centavosOpcionais(value()) === null
          ? { kind: 'formato', message: 'Use um valor como 20,00.' }
          : undefined,
      );
      maxLength(campo.observacao, 500, { message: 'Use no máximo 500 caracteres.' });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          this.erro.set(await this.salvar()(this.dados()));
          return undefined;
        },
      },
    },
  );

  private dados(): DadosPedido {
    const valores = this.valores();
    return {
      clienteId: valores.clienteId,
      tipoEntrega: valores.tipoEntrega,
      dataEntrega: valores.dataEntrega,
      horarioEntrega: valores.horarioEntrega || null,
      descontoCentavos: centavosOpcionais(valores.desconto) ?? 0,
      observacao: valores.observacao.trim() || null,
    };
  }
}
