import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ChaveIdempotencia } from '../../pedidos/chave-idempotencia.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
export const RETENCAO_TEXTO_DIAS = 30;
export const RETENCAO_METADADOS_DIAS = 90;

export interface ResultadoLimpezaRetencao {
  textosLimpos: number;
  outboxRemovidos: number;
  chavesIdempotenciaRemovidas: number;
}

/**
 * Política automática de retenção (ADR 0019):
 * - Limpa `texto_renderizado` após 30 dias (para registros não pendentes).
 * - Remove metadados e chaves de deduplicação da outbox após 90 dias.
 * - Remove chaves de idempotência expiradas da criação de pedidos.
 */
@Injectable()
export class LimpezaRetencaoService {
  constructor(private readonly dataSource: DataSource) {}

  async executar(agora = new Date()): Promise<ResultadoLimpezaRetencao> {
    const limiteTexto = new Date(agora.getTime() - RETENCAO_TEXTO_DIAS * UM_DIA_MS);
    const limiteMetadados = new Date(agora.getTime() - RETENCAO_METADADOS_DIAS * UM_DIA_MS);

    return this.dataSource.transaction(async (manager) => {
      const limpos = await manager
        .createQueryBuilder()
        .update(OutboxNotificacao)
        .set({ textoRenderizado: null })
        .where('texto_renderizado IS NOT NULL')
        .andWhere('status <> :pendente', { pendente: 'PENDENTE' })
        .andWhere('criado_em < :limiteTexto', { limiteTexto })
        .execute();

      const removidos = await manager
        .createQueryBuilder()
        .delete()
        .from(OutboxNotificacao)
        .where('status <> :pendente', { pendente: 'PENDENTE' })
        .andWhere('criado_em < :limiteMetadados', { limiteMetadados })
        .execute();

      const chaves = await manager
        .createQueryBuilder()
        .delete()
        .from(ChaveIdempotencia)
        .where('expira_em < :agora', { agora })
        .execute();

      return {
        textosLimpos: limpos.affected ?? 0,
        outboxRemovidos: removidos.affected ?? 0,
        chavesIdempotenciaRemovidas: chaves.affected ?? 0,
      };
    });
  }
}
