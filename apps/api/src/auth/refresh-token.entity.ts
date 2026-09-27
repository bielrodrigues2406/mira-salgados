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

import { Usuario } from '../usuarios/usuario.entity.js';

// Cada login abre uma família de refresh tokens. Cada uso gera o próximo token
// da família e marca o anterior como usado. Um token usado que volta a aparecer
// indica cópia: a família inteira é revogada.
@Entity('refresh_tokens')
@Unique('uq_refresh_tokens_token_hash', ['tokenHash'])
@Index('ix_refresh_tokens_family_id', ['familyId'])
@Index('ix_refresh_tokens_usuario_id', ['usuarioId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_refresh_tokens' })
  id: string;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_refresh_tokens_usuario' })
  usuario?: Usuario;

  @Column({ type: 'uuid' })
  familyId: string;

  // Apenas o SHA-256 do token é persistido; o valor em si existe só no cookie.
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
