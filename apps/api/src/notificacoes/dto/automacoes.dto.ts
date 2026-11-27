import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { DataDoCalendario } from '../../common/validation/data.js';
import { comoEnum } from '../../common/validation/enum.js';
import { Opcional } from '../../common/validation/opcional.js';
import { Aparar, ApararOuNulo } from '../../common/validation/transforms.js';
import { TIPOS_ENTREGA, type TipoEntrega } from '../../pedidos/dominio/enums.js';
import { PREPAROS, type Preparo } from '../../produtos/preco-produto.entity.js';
import {
  ACOES_RECONCILIACAO_NOTIFICACAO,
  type AcaoReconciliacaoNotificacao,
  ESCOPOS_ITENS_MENSAGEM,
  type EscopoItensMensagem,
  FILTROS_ENCOMENDA_NOTIFICACAO,
  type FiltroEncomendaNotificacao,
  STATUS_ENVIO_NOTIFICACAO,
  type StatusEnvioNotificacao,
} from '../dominio/enums.js';

const HORARIO_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CriarDestinoDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(160)
  identificadorExterno?: string | null;

  @Opcional()
  @IsBoolean()
  ativo?: boolean;
}

export class AtualizarDestinoDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(160)
  identificadorExterno?: string | null;

  @Opcional()
  @IsBoolean()
  ativo?: boolean;

  @Opcional()
  @IsBoolean()
  aprovar?: boolean;
}

export class AtualizarRegraDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @Opcional()
  @IsBoolean()
  ativa?: boolean;

  @Opcional()
  @IsUUID()
  destinoId?: string;

  @Opcional()
  @IsEnum(comoEnum(FILTROS_ENCOMENDA_NOTIFICACAO))
  filtroEncomenda?: FiltroEncomendaNotificacao;

  @Opcional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(comoEnum(PREPAROS), { each: true })
  preparos?: Preparo[];

  @Opcional()
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsEnum(comoEnum(TIPOS_ENTREGA), { each: true })
  modalidades?: TipoEntrega[];

  @Opcional()
  @IsEnum(comoEnum(ESCOPOS_ITENS_MENSAGEM))
  escopoItens?: EscopoItensMensagem;

  @Opcional()
  @IsBoolean()
  enviarCorrecoes?: boolean;

  @Opcional()
  @IsBoolean()
  enviarCancelamentos?: boolean;

  @Opcional()
  @IsInt()
  @Min(0)
  @Max(600)
  debounceSegundos?: number;

  @Opcional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @Matches(HORARIO_HH_MM)
  horarioResumo?: string | null;

  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  fusoHorario?: string;

  @Opcional()
  @IsBoolean()
  omitirDiasVazios?: boolean;

  @Opcional()
  @IsBoolean()
  incluirConcluidos?: boolean;

  @Opcional()
  @IsBoolean()
  enviarComplementos?: boolean;

  @Opcional()
  @IsInt()
  @Min(0)
  @Max(1440)
  toleranciaAtrasoMinutos?: number;
}

export class PreviaRegraDto {
  @Opcional()
  @DataDoCalendario()
  data?: string;

  @Opcional()
  @IsBoolean()
  usarExemplo?: boolean;
}

export class TestarEnvioRealDto {
  @IsUUID()
  destinoId: string;

  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  identificadorExterno: string;

  @Opcional()
  @DataDoCalendario()
  data?: string;
}

export class PausarConexaoDto {
  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(240)
  motivo?: string | null;
}

export class FiltroHistoricoNotificacoesDto extends PaginationQueryDto {
  @Opcional()
  @IsEnum(comoEnum(STATUS_ENVIO_NOTIFICACAO))
  status?: StatusEnvioNotificacao;

  @Opcional()
  @IsUUID()
  regraId?: string;

  @Opcional()
  @DataDoCalendario()
  data?: string;
}

export class ReconciliarOutboxDto {
  @IsEnum(comoEnum(ACOES_RECONCILIACAO_NOTIFICACAO))
  acao: AcaoReconciliacaoNotificacao;
}
