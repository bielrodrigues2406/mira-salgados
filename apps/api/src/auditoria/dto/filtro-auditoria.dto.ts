import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { ACOES_AUDITORIA, type AcaoAuditoria } from '../log-auditoria.entity.js';

export class FiltroAuditoriaDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entidadeId?: string;

  @IsOptional()
  @IsIn(ACOES_AUDITORIA)
  acao?: AcaoAuditoria;

  /** Quem fez a alteração. */
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  /** Início do intervalo, inclusivo (ISO 8601). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  de?: Date;

  /** Fim do intervalo, exclusivo (ISO 8601). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  ate?: Date;
}
