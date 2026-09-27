import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { PAPEIS, type Papel } from './papeis.js';

@Entity('usuarios')
@Unique('uq_usuarios_telefone', ['telefone'])
@Check('ck_usuarios_telefone_digitos', "telefone ~ '^[0-9]{10,11}$'")
export class Usuario {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_usuarios' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  /** Celular com DDD, só dígitos: é o login. Null só em contas anteriores ao telefone. */
  @Column({ type: 'varchar', length: 11, nullable: true })
  telefone: string | null;

  @Column({ type: 'enum', enum: PAPEIS, enumName: 'papel_usuario', default: 'MEMBRO' })
  papel: Papel;

  /** Senha provisória definida por um administrador: precisa ser trocada no primeiro acesso. */
  @Column({ type: 'boolean', default: false })
  trocarSenha: boolean;

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
