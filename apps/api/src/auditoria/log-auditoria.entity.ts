import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Usuario } from '../usuarios/usuario.entity.js';
import type { SnapshotJson } from './sanitizar-snapshot.js';

export const ACOES_AUDITORIA = [
  'CRIACAO',
  'ATUALIZACAO',
  'DESATIVACAO',
  'TRANSICAO_STATUS',
  'EXCLUSAO',
  'ESTORNO',
  'SENHA_REDEFINIDA',
  'SENHA_TROCADA',
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

@Entity('logs_auditoria')
@Index('ix_logs_auditoria_entidade', ['entidade', 'entidadeId', 'criadoEm'])
@Index('ix_logs_auditoria_criado_em', ['criadoEm'])
@Index('ix_logs_auditoria_usuario_id', ['usuarioId'])
export class LogAuditoria {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_logs_auditoria' })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  entidade: string;

  @Column({ type: 'varchar', length: 64 })
  entidadeId: string;

  @Column({ type: 'varchar', length: 40 })
  acao: AcaoAuditoria;

  @Column({ type: 'jsonb', nullable: true })
  dadosAntes: SnapshotJson | null;

  @Column({ type: 'jsonb', nullable: true })
  dadosDepois: SnapshotJson | null;

  // Nulo quando a operação não tem autor autenticado, como o cadastro inicial.
  @Column({ type: 'uuid', nullable: true })
  usuarioId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_logs_auditoria_usuario' })
  usuario?: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;
}
