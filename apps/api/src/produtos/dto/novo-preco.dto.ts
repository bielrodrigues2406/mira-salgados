import { IsEnum, IsInt, Max, Min } from 'class-validator';

import { comoEnum } from '../../common/validation/enum.js';
import {
  type Preparo,
  PREPAROS,
  type UnidadeVenda,
  UNIDADES_VENDA,
} from '../preco-produto.entity.js';

/** Até R$ 999.999,99: folga para qualquer cento sem chegar perto do limite da coluna. */
export const PRECO_MAXIMO_CENTAVOS = 99_999_999;

export class NovoPrecoDto {
  @IsEnum(comoEnum(PREPAROS))
  preparo: Preparo;

  @IsEnum(comoEnum(UNIDADES_VENDA))
  unidadeVenda: UnidadeVenda;

  @IsInt()
  @Min(1)
  @Max(PRECO_MAXIMO_CENTAVOS)
  precoCentavos: number;
}
