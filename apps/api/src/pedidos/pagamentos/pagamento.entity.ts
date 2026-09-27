import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Centavos } from '../../common/utils/dinheiro.js';
import { centavosTransformer } from '../../database/centavos.transformer.js';
import { Usuario } from '../../usuarios/usuario.entity.js';
import { FORMAS_PAGAMENTO, type FormaPagamento } from '../dominio/enums.js';
import { Pedido } from '../pedido.entity.js';

@Entity('pagamentos')
@Index('ix_pagamentos_pedido_id', ['pedidoId'])
@Check('ck_pagamentos_valor_positivo', 'valor > 0')
@Check('ck_pagamentos_estorno_completo', '(estornado_em IS NULL) = (estornado_por IS NULL)')
export class Pagamento {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_pagamentos' })
  id: string;

  @Column({ type: 'uuid' })
  pedidoId: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id', foreignKeyConstraintName: 'fk_pagamentos_pedido' })
  pedido?: Pedido;

  @Column({ type: 'enum', enum: FORMAS_PAGAMENTO, enumName: 'forma_pagamento' })
  forma: FormaPagamento;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: centavosTransformer })
  valor: Centavos;

  @Column({ type: 'uuid', name: 'registrado_por' })
  registradoPorId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'registrado_por', foreignKeyConstraintName: 'fk_pagamentos_registrado_por' })
  registradoPor?: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  /** Estorno lógico: o lançamento permanece, fora das somas. */
  @Column({ type: 'timestamptz', nullable: true })
  estornadoEm: Date | null;

  @Column({ type: 'uuid', name: 'estornado_por', nullable: true })
  estornadoPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'estornado_por', foreignKeyConstraintName: 'fk_pagamentos_estornado_por' })
  estornadoPor?: Usuario | null;
}
