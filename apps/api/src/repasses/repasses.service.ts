import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { BusinessRuleError, NotFoundError } from '../common/errors/domain.errors.js';
import { Paginated } from '../common/pagination/pagination.js';
import { type Centavos, centavos, decimalParaCentavos } from '../common/utils/dinheiro.js';
import { Produtor } from '../produtores/produtor.entity.js';
import type { FiltroRepassesDto } from './dto/filtro-repasses.dto.js';
import type { NovoRepasseDto } from './dto/novo-repasse.dto.js';
import { Repasse } from './repasse.entity.js';

const RELACOES = { produtor: true, registradoPor: true, desfeitoPor: true } as const;

/**
 * Repasses aos produtores. Registrar é opcional e livre: um por dia, um por
 * semana ou nenhum. Qualquer conta registra e desfaz; tudo fica na auditoria.
 */
@Injectable()
export class RepassesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Repasse)
    private readonly repasses: Repository<Repasse>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroRepassesDto): Promise<Paginated<Repasse>> {
    const [itens, total] = await this.repasses.findAndCount({
      where: filtro.produtorId ? { produtorId: filtro.produtorId } : {},
      relations: RELACOES,
      order: { data: 'DESC', criadoEm: 'DESC', id: 'DESC' },
      skip: filtro.skip,
      take: filtro.pageSize,
    });
    return Paginated.of(itens, total, filtro);
  }

  registrar(dados: NovoRepasseDto, autorId: string): Promise<Repasse> {
    return this.dataSource.transaction(async (manager) => {
      if (!(await manager.getRepository(Produtor).existsBy({ id: dados.produtorId }))) {
        throw new BusinessRuleError('PRODUTOR_INVALIDO', 'Escolha um produtor cadastrado.');
      }
      const repositorio = manager.getRepository(Repasse);
      const repasse = await repositorio.save(
        repositorio.create({
          produtorId: dados.produtorId,
          valor: centavos(dados.valorCentavos),
          forma: dados.forma,
          data: dados.data,
          observacao: dados.observacao ?? null,
          registradoPorId: autorId,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'repasse',
        entidadeId: repasse.id,
        acao: 'CRIACAO',
        antes: null,
        depois: repasse,
        usuarioId: autorId,
      });
      return this.carregar(manager, repasse.id);
    });
  }

  /** Desfazer um lançamento errado: ele fica no histórico, fora das somas. */
  desfazer(id: string, autorId: string): Promise<Repasse> {
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Repasse);
      const repasse = await repositorio.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!repasse) throw new NotFoundError('Repasse');
      if (repasse.desfeitoEm !== null) {
        throw new BusinessRuleError('REPASSE_DESFEITO', 'Este repasse já foi desfeito.');
      }
      const antes = Object.assign(new Repasse(), repasse);
      repasse.desfeitoEm = new Date();
      repasse.desfeitoPorId = autorId;
      const salvo = await repositorio.save(repasse);
      await this.auditoria.registrar(manager, {
        entidade: 'repasse',
        entidadeId: id,
        acao: 'ESTORNO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return this.carregar(manager, id);
    });
  }

  /** Total já entregue a cada produtor, sem os repasses desfeitos. */
  async recebidoPorProdutor(): Promise<Map<string, Centavos>> {
    const linhas = await this.repasses
      .createQueryBuilder('repasse')
      .select('repasse.produtorId', 'produtorId')
      .addSelect('SUM(repasse.valor)', 'total')
      .where('repasse.desfeitoEm IS NULL')
      .groupBy('repasse.produtorId')
      .getRawMany<{ produtorId: string; total: string }>();
    return new Map(linhas.map((linha) => [linha.produtorId, decimalParaCentavos(linha.total)]));
  }

  private async carregar(manager: EntityManager, id: string): Promise<Repasse> {
    const repasse = await manager
      .getRepository(Repasse)
      .findOne({ where: { id }, relations: RELACOES });
    if (!repasse) throw new NotFoundError('Repasse');
    return repasse;
  }
}
