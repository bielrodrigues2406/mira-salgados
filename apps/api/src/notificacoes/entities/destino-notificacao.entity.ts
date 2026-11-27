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

import { Usuario } from '../../usuarios/usuario.entity.js';
import type { CanalNotificacao } from '../dominio/enums.js';

@Entity('destinos_notificacao')
@Index('ix_destinos_notificacao_ativo', ['ativo'])
@Check('ck_destinos_notificacao_nome_preenchido', "btrim(nome) <> ''")
@Check('ck_destinos_notificacao_identificador_preenchido', "btrim(identificador_externo) <> ''")
export class DestinoNotificacao {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_destinos_notificacao' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 20, default: 'WHATSAPP' })
  canal: CanalNotificacao;

  /** JID do grupo/contato no WhatsApp ou identificador simulado. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  identificadorExterno: string | null;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  aprovadoEm: Date | null;

  @Column({ type: 'uuid', nullable: true })
  aprovadoPorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({
    name: 'aprovado_por_id',
    foreignKeyConstraintName: 'fk_destinos_notificacao_aprovado_por',
  })
  aprovadoPor?: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
