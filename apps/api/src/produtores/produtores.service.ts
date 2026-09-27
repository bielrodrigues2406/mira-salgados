import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ConflictError, NotFoundError } from '../common/errors/domain.errors.js';
import { ehViolacaoDeUnicidade } from '../common/errors/postgres-errors.js';
import { Paginated } from '../common/pagination/pagination.js';
import type { AtualizarProdutorDto } from './dto/atualizar-produtor.dto.js';
import type { CriarProdutorDto } from './dto/criar-produtor.dto.js';
import type { FiltroProdutoresDto } from './dto/filtro-produtores.dto.js';
import { Produtor } from './produtor.entity.js';

const UNICIDADE_DO_NOME = 'uq_produtores_nome';

function nomeEmUso(): ConflictError {
  return new ConflictError('PRODUTOR_JA_EXISTE', 'Já existe um produtor com este nome.');
}

// A verificação prévia cobre o caso comum; a restrição do banco cobre duas
// gravações simultâneas com o mesmo nome.
async function traduzirNomeDuplicado<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro, UNICIDADE_DO_NOME)) throw nomeEmUso();
    throw erro;
  }
}

@Injectable()
export class ProdutoresService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Produtor)
    private readonly produtores: Repository<Produtor>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroProdutoresDto): Promise<Paginated<Produtor>> {
    const consulta = this.produtores
      .createQueryBuilder('produtor')
      .orderBy('produtor.ativo', 'DESC')
      .addOrderBy('produtor.nome', 'ASC')
      .addOrderBy('produtor.id', 'ASC')
      .skip(filtro.skip)
      .take(filtro.pageSize);

    if (filtro.ativo !== undefined) {
      consulta.andWhere('produtor.ativo = :ativo', { ativo: filtro.ativo });
    }

    const [itens, total] = await consulta.getManyAndCount();
    return Paginated.of(itens, total, filtro);
  }

  async buscar(id: string): Promise<Produtor> {
    const produtor = await this.produtores.findOneBy({ id });
    if (!produtor) throw new NotFoundError('Produtor');
    return produtor;
  }

  criar(dados: CriarProdutorDto, autorId: string): Promise<Produtor> {
    return traduzirNomeDuplicado(
      this.dataSource.transaction(async (manager) => {
        const repositorio = manager.getRepository(Produtor);
        await this.garantirNomeDisponivel(manager, dados.nome);

        const produtor = await repositorio.save(repositorio.create({ nome: dados.nome }));
        await this.auditoria.registrar(manager, {
          entidade: 'produtor',
          entidadeId: produtor.id,
          acao: 'CRIACAO',
          antes: null,
          depois: produtor,
          usuarioId: autorId,
        });
        return produtor;
      }),
    );
  }

  atualizar(id: string, dados: AtualizarProdutorDto, autorId: string): Promise<Produtor> {
    return traduzirNomeDuplicado(
      this.dataSource.transaction(async (manager) => {
        const repositorio = manager.getRepository(Produtor);
        // O bloqueio da linha serializa edições concorrentes do mesmo produtor e
        // garante que o "antes" da auditoria é o estado realmente substituído.
        const produtor = await repositorio.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!produtor) throw new NotFoundError('Produtor');

        const antes = Object.assign(new Produtor(), produtor);
        if (dados.nome !== undefined && dados.nome !== produtor.nome) {
          await this.garantirNomeDisponivel(manager, dados.nome, id);
          produtor.nome = dados.nome;
        }
        if (dados.ativo !== undefined) produtor.ativo = dados.ativo;

        if (produtor.nome === antes.nome && produtor.ativo === antes.ativo) return produtor;

        const salvo = await repositorio.save(produtor);
        await this.auditoria.registrar(manager, {
          entidade: 'produtor',
          entidadeId: id,
          acao: antes.ativo && !salvo.ativo ? 'DESATIVACAO' : 'ATUALIZACAO',
          antes,
          depois: salvo,
          usuarioId: autorId,
        });
        return salvo;
      }),
    );
  }

  private async garantirNomeDisponivel(
    manager: EntityManager,
    nome: string,
    exceto?: string,
  ): Promise<void> {
    const consulta = manager
      .getRepository(Produtor)
      .createQueryBuilder('produtor')
      .where('lower(produtor.nome) = lower(:nome)', { nome });
    if (exceto) consulta.andWhere('produtor.id <> :exceto', { exceto });

    if (await consulta.getExists()) throw nomeEmUso();
  }
}
