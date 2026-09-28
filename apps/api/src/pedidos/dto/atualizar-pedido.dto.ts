import {
  IsEnum,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DataDoCalendario } from '../../common/validation/data.js';
import { comoEnum } from '../../common/validation/enum.js';
import { Opcional } from '../../common/validation/opcional.js';
import { ApararOuNulo } from '../../common/validation/transforms.js';
import { TIPOS_ENTREGA, type TipoEntrega } from '../dominio/enums.js';
import { VALOR_MAXIMO_CENTAVOS } from './limites.js';

// O status muda só por PATCH /pedidos/:id/status, que valida a transição.
// null em horário e observação apaga o valor.
export class AtualizarPedidoDto {
  @Opcional()
  @IsUUID()
  clienteId?: string;

  @Opcional()
  @IsEnum(comoEnum(TIPOS_ENTREGA))
  tipoEntrega?: TipoEntrega;

  @Opcional()
  @DataDoCalendario()
  dataEntrega?: string;

  @IsOptional()
  @IsMilitaryTime()
  horarioEntrega?: string | null;

  @Opcional()
  @IsInt()
  @Min(0)
  @Max(VALOR_MAXIMO_CENTAVOS)
  descontoCentavos?: number;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(500)
  observacao?: string | null;

  /** Só em entrega. null apaga; ao passar para entrega sem endereço, usa o do cliente. */
  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(200)
  enderecoEntrega?: string | null;
}
