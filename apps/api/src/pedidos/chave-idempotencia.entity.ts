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

import { Usuario } from '../usuarios/usuario.entity.js';
import { Pedido } from './pedido.entity.js';

export const RESTRICAO_CHAVE_IDEMPOTENCIA = 'uq_chaves_idempotencia_escopo';

@Entity('chaves_idempotencia')
@Unique(RESTRICAO_CHAVE_IDEMPOTENCIA, ['usuarioId', 'rota', 'chave'])
@Index('ix_chaves_idempotencia_expira_em', ['expiraEm'])
@Check('ck_chaves_idempotencia_chave_preenchida', "btrim(chave) <> ''")
export class ChaveIdempotencia {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_chaves_idempotencia' })
  id: string;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_chaves_idempotencia_usuario' })
  usuario?: Usuario;

  @Column({ type: 'varchar', length: 80 })
  rota: string;

  @Column({ type: 'varchar', length: 128 })
  chave: string;

  @Column({ type: 'char', length: 64 })
  hashRequisicao: string;

  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id', foreignKeyConstraintName: 'fk_chaves_idempotencia_pedido' })
  pedido?: Pedido;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @Column({ type: 'timestamptz' })
  expiraEm: Date;
}
