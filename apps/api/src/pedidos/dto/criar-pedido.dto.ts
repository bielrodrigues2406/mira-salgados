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
import { ApararOuNulo } from '../../common/validation/transforms.js';
import { TIPOS_ENTREGA, type TipoEntrega } from '../dominio/enums.js';
import { VALOR_MAXIMO_CENTAVOS } from './limites.js';
import { Opcional } from '../../common/validation/opcional.js';

export class CriarPedidoDto {
  @IsUUID()
  clienteId: string;

  @IsEnum(comoEnum(TIPOS_ENTREGA))
  tipoEntrega: TipoEntrega;

  @DataDoCalendario()
  dataEntrega: string;

  /** HH:MM; omitido quando o cliente não marcou horário. */
  @IsOptional()
  @IsMilitaryTime()
  horarioEntrega?: string | null;

  @Opcional()
  @IsInt()
  @Min(0)
  @Max(VALOR_MAXIMO_CENTAVOS)
  taxaEntregaCentavos?: number;

  @Opcional()
  @IsInt()
  @Min(0)
  @Max(VALOR_MAXIMO_CENTAVOS)
  descontoCentavos?: number;

  @IsOptional()
  @IsUUID()
  entregadorId?: string | null;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(500)
  observacao?: string | null;
}
