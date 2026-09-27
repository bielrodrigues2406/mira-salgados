import { IsBoolean, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { BooleanoDeQuery } from '../../common/validation/transforms.js';

export class FiltroProdutosDto extends PaginationQueryDto {
  @IsOptional()
  @BooleanoDeQuery()
  @IsBoolean()
  ativo?: boolean;
}
