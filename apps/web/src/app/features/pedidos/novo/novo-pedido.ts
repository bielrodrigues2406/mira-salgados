import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { DadosPedido } from '../../../core/models/pedido';
import { mensagemDeErro } from '../../../core/services/mensagem-de-erro';
import { PedidosService } from '../../../core/services/pedidos.service';
import { Icone } from '../../../shared/components/icone/icone';
import { hoje } from '../../../shared/utils/datas';
import { PedidoFormulario, type SalvarPedido } from '../pedido-formulario/pedido-formulario';

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
    descontoCentavos: 0,
    observacao: null,
  };

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
