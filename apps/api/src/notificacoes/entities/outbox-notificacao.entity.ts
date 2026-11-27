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
  UpdateDateColumn,
} from 'typeorm';

import { Pedido } from '../../pedidos/pedido.entity.js';
import {
  STATUS_ENVIO_NOTIFICACAO,
  type StatusEnvioNotificacao,
  TIPOS_EVENTO_NOTIFICACAO,
  type TipoEventoNotificacao,
} from '../dominio/enums.js';
import { DestinoNotificacao } from './destino-notificacao.entity.js';
import { RegraNotificacao } from './regra-notificacao.entity.js';

export const RESTRICAO_CHAVE_DEDUPLICACAO = 'uq_outbox_notificacoes_chave_deduplicacao';

@Entity('outbox_notificacoes')
@Unique(RESTRICAO_CHAVE_DEDUPLICACAO, ['chaveDeduplicacao'])
@Index('ix_outbox_notificacoes_fila', ['status', 'disponivelEm'])
@Index('ix_outbox_notificacoes_pedido_destino', ['pedidoId', 'destinoId', 'status'])
@Index('ix_outbox_notificacoes_id_externo', ['idExterno'])
@Index('ix_outbox_notificacoes_criado_em', ['criadoEm'])
@Check('ck_outbox_notificacoes_chave_preenchida', "btrim(chave_deduplicacao) <> ''")
@Check('ck_outbox_notificacoes_tentativas', 'tentativas >= 0 AND max_tentativas >= 1')
export class OutboxNotificacao {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_outbox_notificacoes' })
  id: string;

  @Column({ type: 'varchar', length: 180 })
  chaveDeduplicacao: string;

  @Column({
    type: 'enum',
    enum: TIPOS_EVENTO_NOTIFICACAO,
    enumName: 'tipo_evento_notificacao',
  })
  tipoEvento: TipoEventoNotificacao;

  @Column({
    type: 'enum',
    enum: STATUS_ENVIO_NOTIFICACAO,
    enumName: 'status_envio_notificacao',
    default: 'PENDENTE',
  })
  status: StatusEnvioNotificacao;

  @Column({ type: 'uuid', nullable: true })
  regraId: string | null;

  @ManyToOne(() => RegraNotificacao, { nullable: true })
  @JoinColumn({ name: 'regra_id', foreignKeyConstraintName: 'fk_outbox_notificacoes_regra' })
  regra?: RegraNotificacao;

  @Column({ type: 'uuid' })
  destinoId: string;

  @ManyToOne(() => DestinoNotificacao, { nullable: false })
  @JoinColumn({ name: 'destino_id', foreignKeyConstraintName: 'fk_outbox_notificacoes_destino' })
  destino?: DestinoNotificacao;

  /**
   * Identificador externo (JID) do grupo no momento do enfileiramento.
   * Impede redirecionamento silencioso se o destino for editado depois.
   */
  @Column({ type: 'varchar', length: 160, nullable: true })
  destinoIdentificadorExterno: string | null;

  @Column({ type: 'uuid', nullable: true })
  pedidoId: string | null;

  @ManyToOne(() => Pedido, { nullable: true })
  @JoinColumn({ name: 'pedido_id', foreignKeyConstraintName: 'fk_outbox_notificacoes_pedido' })
  pedido?: Pedido;

  @Column({ type: 'integer', nullable: true })
  pedidoRevisao: number | null;

  /** Data de referência local (AAAA-MM-DD) do pedido ou resumo diário. */
  @Column({ type: 'date', nullable: true })
  dataReferencia: string | null;

  /** Limpo após 30 dias pela rotina de retenção (ADR 0019). */
  @Column({ type: 'text', nullable: true })
  textoRenderizado: string | null;

  @Column({ type: 'timestamptz' })
  disponivelEm: Date;

  /** Limite da janela de envio automático (usado por RESUMO_DIARIO). */
  @Column({ type: 'timestamptz', nullable: true })
  expiraEm: Date | null;

  /**
   * Preenchido atomicamente imediatamente antes da chamada ao conector externo.
   * Se o lease expirar com este campo preenchido, o item vira INCERTO e nunca
   * é reenviado automaticamente por outro worker.
   */
  @Column({ type: 'timestamptz', nullable: true })
  envioIniciadoEm: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reservadoAte: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  reservadoPor: string | null;

  @Column({ type: 'integer', default: 0 })
  tentativas: number;

  @Column({ type: 'integer', default: 5 })
  maxTentativas: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  idExterno: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ultimoErro: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  enviadoEm: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  entregueEm: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  copiadoManualmenteEm: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
