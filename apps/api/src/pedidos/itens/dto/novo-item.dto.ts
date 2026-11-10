import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { comoEnum } from '../../../common/validation/enum.js';
import { ApararOuNulo } from '../../../common/validation/transforms.js';
import {
  PREPAROS,
  type Preparo,
  UNIDADES_VENDA,
  type UnidadeVenda,
} from '../../../produtos/preco-produto.entity.js';
import { QUANTIDADE_MAXIMA } from '../../dto/limites.js';
import { Opcional } from '../../../common/validation/opcional.js';

export class NovoItemDto {
  @IsUUID()
  produtoId: string;

  @IsEnum(comoEnum(PREPAROS))
  preparo: Preparo;

  @IsEnum(comoEnum(UNIDADES_VENDA))
  unidadeVenda: UnidadeVenda;

  /** Na unidade de venda: 3 centos, 50 unidades. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(QUANTIDADE_MAXIMA)
  quantidade: number;

  /** Omitido, vale o produtor padrão do produto. */
  @Opcional()
  @IsUUID()
  produtorId?: string;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(300)
  observacao?: string | null;
}
