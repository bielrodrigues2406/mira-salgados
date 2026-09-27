import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Centavos } from '../common/utils/dinheiro.js';
import { centavosTransformer } from '../database/centavos.transformer.js';
import { Produto } from './produto.entity.js';

export const PREPAROS = ['FRITO', 'ASSADO', 'CONGELADO'] as const;
export type Preparo = (typeof PREPAROS)[number];

export const UNIDADES_VENDA = ['UNIDADE', 'CENTO'] as const;
export type UnidadeVenda = (typeof UNIDADES_VENDA)[number];

@Entity('precos_produto')
// Índice único parcial (WHERE vigente_ate IS NULL), criado na migration.
@Index('uq_precos_produto_vigente', { synchronize: false })
@Index('ix_precos_produto_historico', { synchronize: false })
@Check('ck_precos_produto_preco_positivo', 'preco > 0')
@Check('ck_precos_produto_periodo', 'vigente_ate IS NULL OR vigente_ate >= vigente_desde')
export class PrecoProduto {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_precos_produto' })
  id: string;

  @Column({ type: 'uuid' })
  produtoId: string;

  @ManyToOne(() => Produto, { nullable: false })
  @JoinColumn({ name: 'produto_id', foreignKeyConstraintName: 'fk_precos_produto_produto' })
  produto?: Produto;

  @Column({ type: 'enum', enum: PREPAROS, enumName: 'preparo' })
  preparo: Preparo;

  @Column({ type: 'enum', enum: UNIDADES_VENDA, enumName: 'unidade_venda' })
  unidadeVenda: UnidadeVenda;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: centavosTransformer })
  preco: Centavos;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  vigenteDesde: Date;

  /** Nulo enquanto o preço vale; preenchido quando é substituído ou encerrado. */
  @Column({ type: 'timestamptz', nullable: true })
  vigenteAte: Date | null;
}
