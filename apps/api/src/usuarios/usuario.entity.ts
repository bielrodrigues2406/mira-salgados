import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('usuarios')
@Unique('uq_usuarios_email', ['email'])
@Check('ck_usuarios_email_minusculo', 'email = lower(email)')
export class Usuario {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_usuarios' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  // Fora do SELECT padrão: só a autenticação pede o hash, de forma explícita.
  @Column({ type: 'varchar', length: 255, select: false })
  senhaHash: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
