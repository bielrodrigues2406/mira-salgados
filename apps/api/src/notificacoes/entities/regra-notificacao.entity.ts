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

import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import {
  ESCOPOS_ITENS_MENSAGEM,
  type EscopoItensMensagem,
  FILTROS_ENCOMENDA_NOTIFICACAO,
  type FiltroEncomendaNotificacao,
  TIPOS_REGRA_NOTIFICACAO,
  type TipoRegraNotificacao,
} from '../dominio/enums.js';
import { DestinoNotificacao } from './destino-notificacao.entity.js';

@Entity('regras_notificacao')
@Index('ix_regras_notificacao_tipo_ativa', ['tipo', 'ativa'])
@Index('ix_regras_notificacao_destino_id', ['destinoId'])
@Check('ck_regras_notificacao_nome_preenchido', "btrim(nome) <> ''")
@Check('ck_regras_notificacao_debounce', 'debounce_segundos >= 0 AND debounce_segundos <= 600')
@Check(
  'ck_regras_notificacao_tolerancia',
  'tolerancia_atraso_minutos >= 0 AND tolerancia_atraso_minutos <= 1440',
)
@Check('ck_regras_notificacao_horario_resumo', "horario_resumo ~ '^[0-2][0-9]:[0-5][0-9]$'")
export class RegraNotificacao {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_regras_notificacao' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({
    type: 'enum',
    enum: TIPOS_REGRA_NOTIFICACAO,
    enumName: 'tipo_regra_notificacao',
  })
  tipo: TipoRegraNotificacao;

  @Column({ type: 'boolean', default: false })
  ativa: boolean;

  @Column({ type: 'uuid' })
  destinoId: string;

  @ManyToOne(() => DestinoNotificacao, { nullable: false })
  @JoinColumn({ name: 'destino_id', foreignKeyConstraintName: 'fk_regras_notificacao_destino' })
  destino?: DestinoNotificacao;

  @Column({
    type: 'enum',
    enum: FILTROS_ENCOMENDA_NOTIFICACAO,
    enumName: 'filtro_encomenda_notificacao',
    default: 'POR_PREPARO',
  })
  filtroEncomenda: FiltroEncomendaNotificacao;

  @Column({ type: 'jsonb' })
  preparos: Preparo[];

  /** Lista vazia significa todas as modalidades (Entrega e Retirada). */
  @Column({ type: 'jsonb' })
  modalidades: TipoEntrega[];

  @Column({
    type: 'enum',
    enum: ESCOPOS_ITENS_MENSAGEM,
    enumName: 'escopo_itens_mensagem',
    default: 'TODOS',
  })
  escopoItens: EscopoItensMensagem;

  @Column({ type: 'boolean', default: true })
  enviarCorrecoes: boolean;

  @Column({ type: 'boolean', default: true })
  enviarCancelamentos: boolean;

  @Column({ type: 'integer', default: 30 })
  debounceSegundos: number;

  /** 0 = domingo ... 6 = sábado. Usado em regras RESUMO_DIARIO. */
  @Column({ type: 'jsonb' })
  diasSemana: number[];

  /** HH:MM no fuso configurado; usado em regras RESUMO_DIARIO. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  horarioResumo: string | null;

  @Column({ type: 'varchar', length: 60, default: 'America/Sao_Paulo' })
  fusoHorario: string;

  @Column({ type: 'boolean', default: true })
  omitirDiasVazios: boolean;

  @Column({ type: 'boolean', default: true })
  incluirConcluidos: boolean;

  @Column({ type: 'boolean', default: true })
  enviarComplementos: boolean;

  @Column({ type: 'integer', default: 120 })
  toleranciaAtrasoMinutos: number;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
