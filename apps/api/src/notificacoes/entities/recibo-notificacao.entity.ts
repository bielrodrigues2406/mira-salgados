import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Recibos de entrega (`message.ack`) recebidos pelo webhook antes de a resposta
 * do envio síncrono gravar `id_externo` na outbox. Consumidos atomicamente
 * quando o envio grava `id_externo` e limpos pela rotina de retenção.
 */
@Entity('recibos_notificacao')
@Index('ix_recibos_notificacao_criado_em', ['criadoEm'])
@Check('ck_recibos_notificacao_id_preenchido', "btrim(id_externo) <> ''")
export class ReciboNotificacao {
  @PrimaryColumn({
    type: 'varchar',
    length: 160,
    primaryKeyConstraintName: 'pk_recibos_notificacao',
  })
  idExterno: string;

  @Column({ type: 'timestamptz' })
  recebidoEm: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;
}
