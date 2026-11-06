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

import type { Centavos } from '../common/utils/dinheiro.js';
import { centavosTransformer } from '../database/centavos.transformer.js';
import { Produtor } from '../produtores/produtor.entity.js';
import { Usuario } from '../usuarios/usuario.entity.js';

export const FORMAS_REPASSE = ['PIX', 'DINHEIRO'] as const;
export type FormaRepasse = (typeof FORMAS_REPASSE)[number];

@Entity('repasses')
@Index('ix_repasses_produtor_id', ['produtorId', 'data', 'criadoEm'])
@Check('ck_repasses_valor_positivo', 'valor > 0')
@Check('ck_repasses_desfeito_completo', '(desfeito_em IS NULL) = (desfeito_por IS NULL)')
export class Repasse {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_repasses' })
  id: string;

  @Column({ type: 'uuid' })
  produtorId: string;

  @ManyToOne(() => Produtor, { nullable: false })
  @JoinColumn({ name: 'produtor_id', foreignKeyConstraintName: 'fk_repasses_produtor' })
  produtor?: Produtor;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: centavosTransformer })
  valor: Centavos;

  @Column({ type: 'enum', enum: FORMAS_REPASSE, enumName: 'forma_repasse' })
  forma: FormaRepasse;

  /** Dia em que o dinheiro foi entregue, no calendário de quem registrou. */
  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  observacao: string | null;

  @Column({ type: 'uuid', name: 'registrado_por' })
  registradoPorId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'registrado_por', foreignKeyConstraintName: 'fk_repasses_registrado_por' })
  registradoPor?: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  /** Desfeito por engano de lançamento: fica no histórico, fora das somas. */
  @Column({ type: 'timestamptz', nullable: true })
  desfeitoEm: Date | null;

  @Column({ type: 'uuid', name: 'desfeito_por', nullable: true })
  desfeitoPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'desfeito_por', foreignKeyConstraintName: 'fk_repasses_desfeito_por' })
  desfeitoPor?: Usuario | null;
}
