import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { PrecoProduto } from '../produtos/preco-produto.entity.js';
import { Produto } from '../produtos/produto.entity.js';
import { Produtor } from '../produtores/produtor.entity.js';
import { AgregadoPedidoService } from './agregado-pedido.js';
import { ItemPedido } from './itens/item-pedido.entity.js';
import { ItensController } from './itens/itens.controller.js';
import { ItensService } from './itens/itens.service.js';
import { Pagamento } from './pagamentos/pagamento.entity.js';
import { PagamentosController } from './pagamentos/pagamentos.controller.js';
import { PagamentosService } from './pagamentos/pagamentos.service.js';
import { Pedido } from './pedido.entity.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosConsultaService } from './pedidos-consulta.service.js';
import { SaldoDevedorService } from './saldo-devedor.service.js';

// Usa as entidades de clientes, produtos e produtores diretamente, sem importar
// os módulos deles: o de clientes importa este para mostrar o saldo devedor.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pedido,
      ItemPedido,
      Pagamento,
      Cliente,
      Produto,
      PrecoProduto,
      Produtor,
    ]),
    AuditoriaModule,
  ],
  controllers: [PedidosController, ItensController, PagamentosController],
  providers: [
    AgregadoPedidoService,
    PedidosService,
    PedidosConsultaService,
    ItensService,
    PagamentosService,
    SaldoDevedorService,
  ],
  exports: [SaldoDevedorService],
})
export class PedidosModule {}
