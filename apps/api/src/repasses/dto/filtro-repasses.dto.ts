import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';

export class FiltroRepassesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  produtorId?: string;
}
