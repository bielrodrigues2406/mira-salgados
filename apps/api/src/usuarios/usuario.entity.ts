import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Produtor } from '../produtores/produtor.entity.js';
import { PAPEIS, type Papel } from './papeis.js';

@Entity('usuarios')
@Unique('uq_usuarios_telefone', ['telefone'])
@Unique('uq_usuarios_produtor', ['produtorId'])
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

  /** Produtor que esta pessoa é, quando ela produz: o painel mostra a produção dela. */
  @Column({ type: 'uuid', nullable: true })
  produtorId: string | null;

  @ManyToOne(() => Produtor, { nullable: true })
  @JoinColumn({ name: 'produtor_id', foreignKeyConstraintName: 'fk_usuarios_produtor' })
  produtor?: Produtor;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
