import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ConflictError } from '../common/errors/domain.errors.js';
import { Usuario } from './usuario.entity.js';

export interface NovoUsuario {
  nome: string;
  email: string;
  senhaHash: string;
}

// E-mail é comparado sem distinção de maiúsculas; a normalização acontece aqui,
// e a restrição ck_usuarios_email_minusculo garante o mesmo no banco.
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(dados: NovoUsuario, autorId: string | null): Promise<Usuario> {
    const email = normalizarEmail(dados.email);

    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Usuario);
      if (await repositorio.existsBy({ email })) {
        throw new ConflictError('EMAIL_EM_USO', 'Já existe um usuário com este e-mail.');
      }

      const usuario = await repositorio.save(
        repositorio.create({ nome: dados.nome.trim(), email, senhaHash: dados.senhaHash }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'usuario',
        entidadeId: usuario.id,
        acao: 'CRIACAO',
        antes: null,
        depois: usuario,
        usuarioId: autorId,
      });
      return usuario;
    });
  }

  buscarAtivoPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.findOneBy({ id, ativo: true });
  }

  /** Único ponto que carrega o hash da senha, usado apenas pela autenticação. */
  buscarAtivoComSenha(email: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.senhaHash')
      .where('usuario.email = :email', { email: normalizarEmail(email) })
      .andWhere('usuario.ativo = true')
      .getOne();
  }

  async atualizarSenhaHash(id: string, senhaHash: string): Promise<void> {
    await this.usuarios.update({ id }, { senhaHash });
  }
}
