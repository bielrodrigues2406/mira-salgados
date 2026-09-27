import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { DadosPedido } from '../../../core/models/pedido';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../core/services/pedidos.service';
import { ProdutoresService } from '../../../core/services/produtores.service';
import { Icone } from '../../../shared/components/icone/icone';
import { hoje } from '../../../shared/utils/datas';
import {
  type OpcaoEntregador,
  PedidoFormulario,
  type SalvarPedido,
} from '../pedido-formulario/pedido-formulario';

const LIMITE_DE_PRODUTORES = 100;

/** Cria o rascunho; os itens entram em seguida, no detalhe do pedido. */
@Component({
  selector: 'ms-novo-pedido',
  imports: [Icone, PedidoFormulario, RouterLink],
  templateUrl: './novo-pedido.html',
  styleUrl: './novo-pedido.css',
})
export class NovoPedido {
  private readonly pedidos = inject(PedidosService);
  private readonly router = inject(Router);

  protected readonly inicial: DadosPedido = {
    clienteId: '',
    tipoEntrega: 'RETIRADA',
    dataEntrega: hoje(),
    horarioEntrega: null,
    taxaEntregaCentavos: 0,
    descontoCentavos: 0,
    entregadorId: null,
    observacao: null,
  };

  private readonly produtores = inject(ProdutoresService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_PRODUTORES,
    ativo: true,
  }));
  protected readonly entregadores = computed((): OpcaoEntregador[] =>
    this.produtores.hasValue()
      ? this.produtores.value().itens.map(({ id, nome }) => ({ id, nome }))
      : [],
  );

  protected readonly criar: SalvarPedido = async (dados) => {
    try {
      const pedido = await firstValueFrom(this.pedidos.criar(dados));
      await this.router.navigate(['/pedidos', pedido.id]);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected async cancelar(): Promise<void> {
    await this.router.navigateByUrl('/pedidos');
  }
}
