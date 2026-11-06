import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { Repasse } from './repasse.entity.js';
import { RepassesController } from './repasses.controller.js';
import { RepassesService } from './repasses.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Repasse]), AuditoriaModule],
  controllers: [RepassesController],
  providers: [RepassesService],
  exports: [RepassesService],
})
export class RepassesModule {}
