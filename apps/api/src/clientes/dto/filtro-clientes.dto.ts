import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { Aparar, BooleanoDeQuery } from '../../common/validation/transforms.js';

export class FiltroClientesDto extends PaginationQueryDto {
  /** Trecho do nome (sem distinção de maiúsculas e acentos) ou do telefone. */
  @IsOptional()
  @Aparar()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @IsOptional()
  @BooleanoDeQuery()
  @IsBoolean()
  ativo?: boolean;
}
