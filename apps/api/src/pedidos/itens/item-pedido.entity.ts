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

import type { Centavos } from '../../common/utils/dinheiro.js';
import { centavosTransformer } from '../../database/centavos.transformer.js';
import {
  PREPAROS,
  type Preparo,
  UNIDADES_VENDA,
  type UnidadeVenda,
} from '../../produtos/preco-produto.entity.js';
import { Produto } from '../../produtos/produto.entity.js';
import { Produtor } from '../../produtores/produtor.entity.js';
import { Pedido } from '../pedido.entity.js';

@Entity('itens_pedido')
@Index('ix_itens_pedido_pedido_id', ['pedidoId'])
@Index('ix_itens_pedido_produtor_id', ['produtorId'])
@Index('ix_itens_pedido_produto_id', ['produtoId'])
@Check('ck_itens_pedido_quantidade_positiva', 'quantidade > 0')
@Check(
  'ck_itens_pedido_unidades_inteiras',
  "unidade_venda = 'CENTO' OR quantidade = trunc(quantidade)",
)
@Check('ck_itens_pedido_preco_positivo', 'preco_unitario > 0')
@Check('ck_itens_pedido_observacao_preenchida', "btrim(observacao) <> ''")
export class ItemPedido {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_itens_pedido' })
  id: string;

  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id', foreignKeyConstraintName: 'fk_itens_pedido_pedido' })
  pedido?: Pedido;

  @Column({ type: 'uuid' })
  produtoId: string;

  @ManyToOne(() => Produto, { nullable: false })
  @JoinColumn({ name: 'produto_id', foreignKeyConstraintName: 'fk_itens_pedido_produto' })
  produto?: Produto;

  /** Começa como o produtor padrão do produto e pode ser trocado por item. */
  @Column({ type: 'uuid' })
  produtorId: string;

  @ManyToOne(() => Produtor, { nullable: false })
  @JoinColumn({ name: 'produtor_id', foreignKeyConstraintName: 'fk_itens_pedido_produtor' })
  produtor?: Produtor;

  @Column({ type: 'enum', enum: PREPAROS, enumName: 'preparo' })
  preparo: Preparo;

  @Column({ type: 'enum', enum: UNIDADES_VENDA, enumName: 'unidade_venda' })
  unidadeVenda: UnidadeVenda;

  /** Na unidade de venda: 3 com unidade CENTO são 300 salgados. */
  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    transformer: { to: (valor: number) => valor, from: (valor: string) => Number(valor) },
  })
  quantidade: number;

  /** Copiado do preço vigente na criação; mudanças na tabela não retroagem. */
  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: centavosTransformer })
  precoUnitario: Centavos;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacao: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
