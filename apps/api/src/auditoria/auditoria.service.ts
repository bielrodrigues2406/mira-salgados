import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';

import { Paginated } from '../common/pagination/pagination.js';
import type { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';
import { type AcaoAuditoria, LogAuditoria } from './log-auditoria.entity.js';
import { idsCitados, nomesCitados } from './referencias.js';
import { sanitizarSnapshot } from './sanitizar-snapshot.js';

export interface RegistroAuditoria {
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  antes: object | null;
  depois: object | null;
  usuarioId: string | null;
}

/** Registro com o nome de quem fez e os nomes dos ids que ele cita. */
export interface LogLegivel {
  log: LogAuditoria;
  autor: { id: string; nome: string } | null;
  referencias: Record<string, string>;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(LogAuditoria)
    private readonly logs: Repository<LogAuditoria>,
    private readonly dataSource: DataSource,
  ) {}

  // Recebe o EntityManager da transação da operação auditada. Gravar o log numa
  // transação separada permitiria um registro de auditoria sem a alteração
  // correspondente (ou o contrário) quando uma das duas falha.
  async registrar(manager: EntityManager, registro: RegistroAuditoria): Promise<void> {
    const log = Object.assign(new LogAuditoria(), {
      entidade: registro.entidade,
      entidadeId: registro.entidadeId,
      acao: registro.acao,
      dadosAntes: sanitizarSnapshot(registro.antes),
      dadosDepois: sanitizarSnapshot(registro.depois),
      usuarioId: registro.usuarioId,
    });
    await manager.save(log);
  }

  async listar(filtro: FiltroAuditoriaDto): Promise<Paginated<LogLegivel>> {
    const consulta = this.logs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.usuario', 'usuario')
      .orderBy('log.criadoEm', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .skip(filtro.skip)
      .take(filtro.pageSize);

    if (filtro.entidade)
      consulta.andWhere('log.entidade = :entidade', { entidade: filtro.entidade });
    if (filtro.entidadeId) {
      consulta.andWhere('log.entidadeId = :entidadeId', { entidadeId: filtro.entidadeId });
    }
    if (filtro.acao) consulta.andWhere('log.acao = :acao', { acao: filtro.acao });
    if (filtro.usuarioId) {
      consulta.andWhere('log.usuarioId = :usuarioId', { usuarioId: filtro.usuarioId });
    }
    if (filtro.de) consulta.andWhere('log.criadoEm >= :de', { de: filtro.de });
    if (filtro.ate) consulta.andWhere('log.criadoEm < :ate', { ate: filtro.ate });

    const [itens, total] = await consulta.getManyAndCount();
    const nomes = await nomesCitados(this.dataSource, itens);
    return Paginated.of(
      itens.map((log) => ({
        log,
        autor: log.usuario ? { id: log.usuario.id, nome: log.usuario.nome } : null,
        referencias: Object.fromEntries(
          idsCitados(log).flatMap(([, id]) => {
            const nome = nomes.get(id);
            return nome ? [[id, nome]] : [];
          }),
        ),
      })),
      total,
      filtro,
    );
  }
}
