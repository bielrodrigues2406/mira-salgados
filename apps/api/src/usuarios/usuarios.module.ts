import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { PasswordHasher } from './password-hasher.js';
import { Usuario } from './usuario.entity.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), AuditoriaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, PasswordHasher],
  exports: [UsuariosService, PasswordHasher],
})
export class UsuariosModule {}
