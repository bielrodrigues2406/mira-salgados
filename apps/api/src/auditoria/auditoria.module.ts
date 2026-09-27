import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';
import { LogAuditoria } from './log-auditoria.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogAuditoria])],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
