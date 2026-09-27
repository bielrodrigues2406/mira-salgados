import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { Produto } from '../produtos/produto.entity.js';
import { Produtor } from './produtor.entity.js';
import { ProdutoresController } from './produtores.controller.js';
import { ProdutoresService } from './produtores.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Produtor, Produto]), AuditoriaModule],
  controllers: [ProdutoresController],
  providers: [ProdutoresService],
  exports: [ProdutoresService],
})
export class ProdutoresModule {}
