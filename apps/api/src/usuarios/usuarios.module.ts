import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { Usuario } from './usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), AuditoriaModule],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
