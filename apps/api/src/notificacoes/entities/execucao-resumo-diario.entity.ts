import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { DestinoNotificacao } from './destino-notificacao.entity.js';
import { OutboxNotificacao } from './outbox-notificacao.entity.js';
import { RegraNotificacao } from './regra-notificacao.entity.js';

export const RESTRICAO_EXECUCAO_RESUMO_UNICA = 'uq_execucoes_resumo_diario_chave';

export const DESFECHOS_EXECUCAO_RESUMO = ['AGENDADO', 'OMITIDO', 'EXPIRADO'] as const;
export type DesfechoExecucaoResumo = (typeof DESFECHOS_EXECUCAO_RESUMO)[number];

/**
 * Marca que o resumo diário de uma regra para um destino e data local já foi
 * avaliado (enviado, omitido por dia vazio ou expirado), impedindo que um dia
 * vazio omitido dispare resumo tardio e complemento duplicado para o primeiro
 * pedido criado depois.
 */
@Entity('execucoes_resumo_diario')
@Unique(RESTRICAO_EXECUCAO_RESUMO_UNICA, ['regraId', 'destinoId', 'dataReferencia'])
@Index('ix_execucoes_resumo_diario_data', ['dataReferencia', 'regraId', 'destinoId'])
@Index('ix_execucoes_resumo_diario_criado_em', ['criadoEm'])
@Check('ck_execucoes_resumo_diario_desfecho', "desfecho IN ('AGENDADO', 'OMITIDO', 'EXPIRADO')")
export class ExecucaoResumoDiario {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_execucoes_resumo_diario' })
  id: string;

  @Column({ type: 'uuid' })
  regraId: string;

  @ManyToOne(() => RegraNotificacao, { nullable: false })
  @JoinColumn({ name: 'regra_id', foreignKeyConstraintName: 'fk_execucoes_resumo_diario_regra' })
  regra?: RegraNotificacao;

  @Column({ type: 'uuid' })
  destinoId: string;

  @ManyToOne(() => DestinoNotificacao, { nullable: false })
  @JoinColumn({
    name: 'destino_id',
    foreignKeyConstraintName: 'fk_execucoes_resumo_diario_destino',
  })
  destino?: DestinoNotificacao;

  @Column({ type: 'date' })
  dataReferencia: string;

  @Column({ type: 'varchar', length: 20 })
  desfecho: DesfechoExecucaoResumo;

  @Column({ type: 'uuid', nullable: true })
  outboxId: string | null;

  @ManyToOne(() => OutboxNotificacao, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'outbox_id', foreignKeyConstraintName: 'fk_execucoes_resumo_diario_outbox' })
  outbox?: OutboxNotificacao;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;
}
