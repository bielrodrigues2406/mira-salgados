import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { COLLATION_PT_BR } from '../database/collation.js';
import { Produtor } from '../produtores/produtor.entity.js';

@Entity('produtos')
@Index('uq_produtos_nome', { synchronize: false })
@Index('ix_produtos_produtor_padrao_id', ['produtorPadraoId'])
@Check('ck_produtos_nome_preenchido', "btrim(nome) <> ''")
export class Produto {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_produtos' })
  id: string;

  @Column({ type: 'varchar', length: 80, collation: COLLATION_PT_BR })
  nome: string;

  /** Sugerido em cada item do pedido; pode ser trocado ali. */
  @Column({ type: 'uuid' })
  produtorPadraoId: string;

  @ManyToOne(() => Produtor, { nullable: false })
  @JoinColumn({
    name: 'produtor_padrao_id',
    foreignKeyConstraintName: 'fk_produtos_produtor_padrao',
  })
  produtorPadrao?: Produtor;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
