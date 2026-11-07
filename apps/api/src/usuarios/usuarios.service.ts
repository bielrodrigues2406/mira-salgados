import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { AcaoAuditoria } from '../auditoria/log-auditoria.entity.js';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import {
  AuthenticationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../common/errors/domain.errors.js';
import { ehViolacaoDeUnicidade } from '../common/errors/postgres-errors.js';
import { Paginated } from '../common/pagination/pagination.js';
import { Produtor } from '../produtores/produtor.entity.js';
import type { AtualizarUsuarioDto, FiltroUsuariosDto } from './dto/usuarios.dto.js';
import type { Papel } from './papeis.js';
import { PasswordHasher } from './password-hasher.js';
import { Usuario } from './usuario.entity.js';

const UNICIDADE_DO_TELEFONE = 'uq_usuarios_telefone';

export interface NovoUsuario {
  nome: string;
  telefone: string;
  papel: Papel;
  produtorId?: string | null;
  senha: string;
  /** Senha definida por outra pessoa: precisa ser trocada no primeiro acesso. */
  provisoria: boolean;
}

function telefoneEmUso(): ConflictError {
  return new ConflictError('TELEFONE_EM_USO', 'Já existe uma conta com este telefone.');
}

async function traduzirDuplicados<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro, UNICIDADE_DO_TELEFONE)) throw telefoneEmUso();
    throw erro;
  }
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly hasher: PasswordHasher,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroUsuariosDto): Promise<Paginated<Usuario>> {
    const [usuarios, total] = await this.usuarios.findAndCount({
      where: filtro.ativo === undefined ? {} : { ativo: filtro.ativo },
      order: { ativo: 'DESC', nome: 'ASC' },
      skip: filtro.skip,
      take: filtro.pageSize,
    });
    return Paginated.of(usuarios, total, filtro);
  }

  async criar(dados: NovoUsuario, autorId: string | null): Promise<Usuario> {
    const senhaHash = await this.hasher.hash(dados.senha);
    return traduzirDuplicados(
      this.dataSource.transaction(async (manager) => {
        const repositorio = manager.getRepository(Usuario);
        if (await repositorio.existsBy({ telefone: dados.telefone })) throw telefoneEmUso();
        const produtorId = dados.produtorId ?? null;
        if (produtorId) await this.validarProdutor(manager, produtorId);

        const usuario = await repositorio.save(
          repositorio.create({
            nome: dados.nome,
            telefone: dados.telefone,
            papel: dados.papel,
            produtorId,
            trocarSenha: dados.provisoria,
            senhaHash,
          }),
        );
        await this.auditar(manager, usuario.id, 'CRIACAO', null, usuario, autorId);
        return usuario;
      }),
    );
  }

  /**
   * Alteração por um administrador. Ninguém desativa nem rebaixa a própria
   * conta, e o sistema nunca fica sem administrador ativo: as contas de
   * administrador são bloqueadas durante a verificação, para que duas
   * alterações simultâneas não removam os dois últimos.
   */
  atualizar(id: string, dados: AtualizarUsuarioDto, autorId: string): Promise<Usuario> {
    return traduzirDuplicados(
      this.dataSource.transaction(async (manager) => {
        const repositorio = manager.getRepository(Usuario);
        const usuario = await repositorio.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!usuario) throw new NotFoundError('Usuário');
        const antes = Object.assign(new Usuario(), usuario);

        const perdeAdmin =
          usuario.papel === 'ADMIN' &&
          usuario.ativo &&
          ((dados.papel !== undefined && dados.papel !== 'ADMIN') || dados.ativo === false);
        if (perdeAdmin && id === autorId) {
          throw new BusinessRuleError(
            'ALTERACAO_DA_PROPRIA_CONTA',
            'Você não pode desativar nem tirar o papel de administrador da sua própria conta.',
          );
        }
        if (perdeAdmin && (await this.outrosAdminsAtivos(manager, id)) === 0) {
          throw new BusinessRuleError(
            'ULTIMO_ADMINISTRADOR',
            'O sistema precisa de pelo menos um administrador ativo.',
          );
        }
        if (dados.telefone !== undefined && dados.telefone !== usuario.telefone) {
          if (await repositorio.existsBy({ telefone: dados.telefone })) throw telefoneEmUso();
          usuario.telefone = dados.telefone;
        }
        if (dados.nome !== undefined) usuario.nome = dados.nome;
        if (dados.papel !== undefined) usuario.papel = dados.papel;
        if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
        if (dados.produtorId !== undefined && dados.produtorId !== usuario.produtorId) {
          if (dados.produtorId) await this.validarProdutor(manager, dados.produtorId);
          usuario.produtorId = dados.produtorId;
        }

        const salvo = await repositorio.save(usuario);
        // Conta desativada perde as sessões abertas na hora.
        if (antes.ativo && !salvo.ativo) await this.revogarSessoes(manager, id);
        await this.auditar(manager, id, 'ATUALIZACAO', antes, salvo, autorId);
        return salvo;
      }),
    );
  }

  /** Senha provisória definida por um administrador; encerra as sessões da conta. */
  async redefinirSenha(id: string, senha: string, autorId: string): Promise<Usuario> {
    const senhaHash = await this.hasher.hash(senha);
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Usuario);
      const usuario = await repositorio.findOneBy({ id });
      if (!usuario) throw new NotFoundError('Usuário');

      await repositorio.update({ id }, { senhaHash, trocarSenha: true });
      await this.revogarSessoes(manager, id);
      await this.auditar(manager, id, 'SENHA_REDEFINIDA', null, null, autorId);
      return repositorio.findOneByOrFail({ id });
    });
  }

  /**
   * Troca feita pela própria pessoa, que confirma a senha atual. As outras
   * sessões da conta são encerradas; a sessão em uso continua.
   */
  async trocarPropriaSenha(
    id: string,
    senhaAtual: string,
    novaSenha: string,
    familiaAtual: string | null,
  ): Promise<Usuario> {
    const usuario = await this.usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.senhaHash')
      .where('usuario.id = :id', { id })
      .andWhere('usuario.ativo = true')
      .getOne();
    if (!usuario || !(await this.hasher.verify(usuario.senhaHash, senhaAtual))) {
      throw new AuthenticationError('SENHA_ATUAL_INCORRETA', 'A senha atual está incorreta.');
    }
    if (await this.hasher.verify(usuario.senhaHash, novaSenha)) {
      throw new BusinessRuleError('SENHA_REPETIDA', 'A nova senha precisa ser diferente da atual.');
    }
    const senhaHash = await this.hasher.hash(novaSenha);
    return this.dataSource.transaction(async (manager) => {
      await manager.update(Usuario, { id }, { senhaHash, trocarSenha: false });
      await this.revogarSessoes(manager, id, familiaAtual);
      await this.auditar(manager, id, 'SENHA_TROCADA', null, null, id);
      return manager.findOneByOrFail(Usuario, { id });
    });
  }

  /**
   * Recuperação pelo servidor, quando nenhum administrador consegue entrar:
   * a conta do telefone volta ativa, como administradora e com a senha nova.
   */
  async restaurarAdmin(telefone: string, senha: string): Promise<Usuario> {
    const senhaHash = await this.hasher.hash(senha);
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Usuario);
      const usuario = await repositorio.findOneBy({ telefone });
      if (!usuario) throw new NotFoundError('Usuário com este telefone');
      const antes = Object.assign(new Usuario(), usuario);

      await repositorio.update(
        { id: usuario.id },
        { senhaHash, papel: 'ADMIN', ativo: true, trocarSenha: false },
      );
      await this.revogarSessoes(manager, usuario.id);
      const depois = await repositorio.findOneByOrFail({ id: usuario.id });
      await this.auditar(manager, usuario.id, 'SENHA_REDEFINIDA', antes, depois, null);
      return depois;
    });
  }

  buscarAtivoPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.findOneBy({ id, ativo: true });
  }

  /** Único ponto que carrega o hash para o login, usado apenas pela autenticação. */
  buscarAtivoComSenha(telefone: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.senhaHash')
      .where('usuario.telefone = :telefone', { telefone })
      .andWhere('usuario.ativo = true')
      .getOne();
  }

  async atualizarSenhaHash(id: string, senhaHash: string): Promise<void> {
    await this.usuarios.update({ id }, { senhaHash });
  }

  existeAdminAtivo(): Promise<boolean> {
    return this.usuarios.existsBy({ papel: 'ADMIN', ativo: true });
  }

  /** Produtor ativo; várias contas podem ser o mesmo produtor. */
  private async validarProdutor(manager: EntityManager, produtorId: string): Promise<void> {
    const produtor = await manager.getRepository(Produtor).findOneBy({ id: produtorId });
    if (!produtor?.ativo) {
      throw new BusinessRuleError(
        'PRODUTOR_INDISPONIVEL',
        'O produtor escolhido não existe ou está inativo.',
      );
    }
  }

  private async outrosAdminsAtivos(manager: EntityManager, excetoId: string): Promise<number> {
    const admins = await manager
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .where("usuario.papel = 'ADMIN'")
      .andWhere('usuario.ativo = true')
      .andWhere('usuario.id <> :excetoId', { excetoId })
      .setLock('pessimistic_write')
      .getMany();
    return admins.length;
  }

  private async revogarSessoes(
    manager: EntityManager,
    usuarioId: string,
    excetoFamilia: string | null = null,
  ): Promise<void> {
    const consulta = manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: () => 'now()' })
      .where({ usuarioId, revokedAt: IsNull() });
    if (excetoFamilia) consulta.andWhere('family_id <> :excetoFamilia', { excetoFamilia });
    await consulta.execute();
  }

  private async auditar(
    manager: EntityManager,
    entidadeId: string,
    acao: AcaoAuditoria,
    antes: Usuario | null,
    depois: Usuario | null,
    usuarioId: string | null,
  ): Promise<void> {
    await this.auditoria.registrar(manager, {
      entidade: 'usuario',
      entidadeId,
      acao,
      antes,
      depois,
      usuarioId,
    });
  }
}
