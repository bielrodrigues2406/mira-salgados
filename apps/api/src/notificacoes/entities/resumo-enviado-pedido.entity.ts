import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Pedido } from '../../pedidos/pedido.entity.js';
import { DestinoNotificacao } from './destino-notificacao.entity.js';
import { OutboxNotificacao } from './outbox-notificacao.entity.js';
import { RegraNotificacao } from './regra-notificacao.entity.js';

@Entity('resumos_enviados_pedidos')
@Unique('uq_resumos_enviados_outbox_pedido', ['outboxId', 'pedidoId'])
@Index('ix_resumos_enviados_consulta', ['dataReferencia', 'destinoId', 'pedidoId'])
@Index('ix_resumos_enviados_pedido_id', ['pedidoId'])
export class ResumoEnviadoPedido {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_resumos_enviados_pedidos' })
  id: string;

  @Column({ type: 'uuid' })
  outboxId: string;

  @ManyToOne(() => OutboxNotificacao, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outbox_id', foreignKeyConstraintName: 'fk_resumos_enviados_outbox' })
  outbox?: OutboxNotificacao;

  @Column({ type: 'uuid' })
  regraId: string;

  @ManyToOne(() => RegraNotificacao, { nullable: false })
  @JoinColumn({ name: 'regra_id', foreignKeyConstraintName: 'fk_resumos_enviados_regra' })
  regra?: RegraNotificacao;

  @Column({ type: 'uuid' })
  destinoId: string;

  @ManyToOne(() => DestinoNotificacao, { nullable: false })
  @JoinColumn({ name: 'destino_id', foreignKeyConstraintName: 'fk_resumos_enviados_destino' })
  destino?: DestinoNotificacao;

  @Column({ type: 'date' })
  dataReferencia: string;

  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id', foreignKeyConstraintName: 'fk_resumos_enviados_pedido' })
  pedido?: Pedido;

  @Column({ type: 'integer' })
  pedidoRevisao: number;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;
}
