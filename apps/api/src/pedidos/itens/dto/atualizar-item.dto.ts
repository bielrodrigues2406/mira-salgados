import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { ApararOuNulo } from '../../../common/validation/transforms.js';
import { QUANTIDADE_MAXIMA } from '../../dto/limites.js';
import { Opcional } from '../../../common/validation/opcional.js';

// Produto, preparo e unidade definem o preço copiado; trocá-los é remover o
// item e adicionar outro, com o preço vigente do novo.
export class AtualizarItemDto {
  @Opcional()
  @IsInt()
  @Min(1)
  @Max(QUANTIDADE_MAXIMA)
  quantidade?: number;

  @Opcional()
  @IsUUID()
  produtorId?: string;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(300)
  observacao?: string | null;
}
