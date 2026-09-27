import { IsEnum } from 'class-validator';

import { comoEnum } from '../../common/validation/enum.js';
import { STATUS_PEDIDO, type StatusPedido } from '../dominio/enums.js';

export class AlterarStatusDto {
  @IsEnum(comoEnum(STATUS_PEDIDO))
  status: StatusPedido;
}
