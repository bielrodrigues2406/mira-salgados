import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { Produtor } from '../produtores/produtor.entity.js';
import { PrecoProduto } from './preco-produto.entity.js';
import { Produto } from './produto.entity.js';
import { ProdutosController } from './produtos.controller.js';
import { ProdutosService } from './produtos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Produto, PrecoProduto, Produtor]), AuditoriaModule],
  controllers: [ProdutosController],
  providers: [ProdutosService],
  exports: [ProdutosService],
})
export class ProdutosModule {}
