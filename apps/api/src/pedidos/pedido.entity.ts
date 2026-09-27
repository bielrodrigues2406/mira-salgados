import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Cliente } from '../clientes/cliente.entity.js';
import type { Centavos } from '../common/utils/dinheiro.js';
import { centavosTransformer } from '../database/centavos.transformer.js';
import { Produtor } from '../produtores/produtor.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import {
  STATUS_PEDIDO,
  type StatusPedido,
  TIPOS_ENTREGA,
  type TipoEntrega,
} from './dominio/enums.js';

@Entity('pedidos')
@Unique('uq_pedidos_numero', ['numero'])
@Index('ix_pedidos_data_entrega_status', ['dataEntrega', 'status'])
@Index('ix_pedidos_cliente_status', ['clienteId', 'status'])
@Index('ix_pedidos_entregador_id', ['entregadorId'])
@Check('ck_pedidos_taxa_nao_negativa', 'taxa_entrega >= 0')
@Check('ck_pedidos_desconto_nao_negativo', 'desconto >= 0')
@Check(
  'ck_pedidos_retirada_sem_entrega',
  "tipo_entrega = 'ENTREGA' OR (taxa_entrega = 0 AND entregador_id IS NULL)",
)
@Check('ck_pedidos_observacao_preenchida', "btrim(observacao) <> ''")
export class Pedido {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_pedidos' })
  id: string;

  /** Número da encomenda mostrado à família ("#1043"), gerado pelo banco. */
  @Column({ type: 'integer', generated: 'identity', generatedIdentity: 'ALWAYS' })
  numero: number;

  @Column({ type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Cliente, { nullable: false })
  @JoinColumn({ name: 'cliente_id', foreignKeyConstraintName: 'fk_pedidos_cliente' })
  cliente?: Cliente;

  /** Quem registrou o pedido. */
  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_pedidos_usuario' })
  usuario?: Usuario;

  @Column({ type: 'enum', enum: STATUS_PEDIDO, enumName: 'status_pedido', default: 'RASCUNHO' })
  status: StatusPedido;

  @Column({ type: 'enum', enum: TIPOS_ENTREGA, enumName: 'tipo_entrega' })
  tipoEntrega: TipoEntrega;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: centavosTransformer,
  })
  taxaEntrega: Centavos;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: centavosTransformer,
  })
  desconto: Centavos;

  /** Produtor que fez a entrega; recebe a taxa no acerto (decisão D3). */
  @Column({ type: 'uuid', nullable: true })
  entregadorId: string | null;

  @ManyToOne(() => Produtor, { nullable: true })
  @JoinColumn({ name: 'entregador_id', foreignKeyConstraintName: 'fk_pedidos_entregador' })
  entregador?: Produtor | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observacao: string | null;

  /** AAAA-MM-DD, sem fuso: é o dia combinado com o cliente. */
  @Column({ type: 'date' })
  dataEntrega: string;

  /** HH:MM:SS; nulo quando o cliente não marcou horário. */
  @Column({ type: 'time', nullable: true })
  horarioEntrega: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
