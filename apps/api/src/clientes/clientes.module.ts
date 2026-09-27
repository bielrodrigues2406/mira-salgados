import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { PedidosModule } from '../pedidos/pedidos.module.js';
import { Cliente } from './cliente.entity.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente]), AuditoriaModule, PedidosModule],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
