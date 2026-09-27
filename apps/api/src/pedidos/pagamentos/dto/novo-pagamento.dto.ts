import { IsEnum, IsInt, Max, Min } from 'class-validator';

import { comoEnum } from '../../../common/validation/enum.js';
import { FORMAS_PAGAMENTO, type FormaPagamento } from '../../dominio/enums.js';
import { VALOR_MAXIMO_CENTAVOS } from '../../dto/limites.js';

export class NovoPagamentoDto {
  @IsEnum(comoEnum(FORMAS_PAGAMENTO))
  forma: FormaPagamento;

  @IsInt()
  @Min(1)
  @Max(VALOR_MAXIMO_CENTAVOS)
  valorCentavos: number;
}
