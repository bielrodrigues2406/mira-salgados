import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';

export class FiltroAuditoriaDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entidadeId?: string;

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
