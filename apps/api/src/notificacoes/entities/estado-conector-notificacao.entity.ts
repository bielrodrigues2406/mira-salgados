import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import {
  type CanalNotificacao,
  ESTADOS_CONEXAO_NOTIFICACAO,
  type EstadoConexaoNotificacao,
  MODOS_CONECTOR_NOTIFICACAO,
  type ModoConectorNotificacao,
} from '../dominio/enums.js';

@Entity('estado_conector_notificacao')
export class EstadoConectorNotificacao {
  @PrimaryColumn({
    type: 'varchar',
    length: 20,
    primaryKeyConstraintName: 'pk_estado_conector_notificacao',
  })
  canal: CanalNotificacao;

  @Column({
    type: 'enum',
    enum: MODOS_CONECTOR_NOTIFICACAO,
    enumName: 'modo_conector_notificacao',
    default: 'SIMULADO',
  })
  modo: ModoConectorNotificacao;

  @Column({
    type: 'enum',
    enum: ESTADOS_CONEXAO_NOTIFICACAO,
    enumName: 'estado_conexao_notificacao',
    default: 'SIMULADO',
  })
  estado: EstadoConexaoNotificacao;

  @Column({ type: 'boolean', default: false })
  pausado: boolean;

  @Column({ type: 'varchar', length: 240, nullable: true })
  motivoPausa: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ultimoErro: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  ultimaVerificacaoEm: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
