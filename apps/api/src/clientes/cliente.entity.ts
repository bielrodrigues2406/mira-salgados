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

@Entity('clientes')
// Índices trigram de busca, criados na migration (expressão e operador GIN que
// o TypeORM não descreve).
@Index('ix_clientes_nome_busca', { synchronize: false })
@Index('ix_clientes_telefone_busca', { synchronize: false })
@Check('ck_clientes_nome_preenchido', "btrim(nome) <> ''")
@Check('ck_clientes_telefone_digitos', "telefone ~ '^[0-9]{10,11}$'")
@Check('ck_clientes_endereco_preenchido', "btrim(endereco) <> ''")
export class Cliente {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_clientes' })
  id: string;

  @Column({ type: 'varchar', length: 120, collation: COLLATION_PT_BR })
  nome: string;

  /** DDD e número, só dígitos: 10 para fixo, 11 para celular. */
  @Column({ type: 'varchar', length: 11, nullable: true })
  telefone: string | null;

  /** Opcional para quem só faz retirada. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  endereco: string | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
