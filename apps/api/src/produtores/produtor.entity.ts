import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { COLLATION_PT_BR } from '../database/collation.js';

@Entity('produtores')
// Índice único sobre lower(nome), criado na migration: o TypeORM não descreve
// índices de expressão, e synchronize: false o mantém fora da comparação.
@Index('uq_produtores_nome', { synchronize: false })
@Check('ck_produtores_nome_preenchido', "btrim(nome) <> ''")
export class Produtor {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_produtores' })
  id: string;

  @Column({ type: 'varchar', length: 80, collation: COLLATION_PT_BR })
  nome: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
