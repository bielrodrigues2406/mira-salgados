import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { DataDoCalendario } from '../../common/validation/data.js';
import { comoEnum } from '../../common/validation/enum.js';
import { Aparar, BooleanoDeQuery } from '../../common/validation/transforms.js';
import { STATUS_PEDIDO, type StatusPedido } from '../dominio/enums.js';

export const ORDENS = ['asc', 'desc'] as const;
export type Ordem = (typeof ORDENS)[number];

export class FiltroPedidosDto extends PaginationQueryDto {
  /** Um ou mais estados: ?status=RASCUNHO&status=CONFIRMADO. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @ArrayMaxSize(STATUS_PEDIDO.length)
  @IsEnum(comoEnum(STATUS_PEDIDO), { each: true })
  status?: StatusPedido[];

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** Primeiro dia de entrega, inclusivo. */
  @IsOptional()
  @DataDoCalendario()
  de?: string;

  /** Último dia de entrega, inclusivo. */
  @IsOptional()
  @DataDoCalendario()
  ate?: string;

  /** Número do pedido (com ou sem #) ou trecho do nome do cliente. */
  @IsOptional()
  @Aparar()
  @IsString()
  @MaxLength(120)
  busca?: string;

  /** Só os confirmados e concluídos que ainda devem algo; o fiado não quita. */
  @IsOptional()
  @BooleanoDeQuery()
  @IsBoolean()
  faltaPagar?: boolean;

  /** Por data de entrega e horário: asc para os próximos, desc para os anteriores. */
  @IsOptional()
  @IsEnum(comoEnum(ORDENS))
  ordem?: Ordem;
}
