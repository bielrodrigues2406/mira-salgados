import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { DataDoCalendario } from '../../common/validation/data.js';
import { comoEnum } from '../../common/validation/enum.js';
import { ApararOuNulo } from '../../common/validation/transforms.js';
import { VALOR_MAXIMO_CENTAVOS } from '../../pedidos/dto/limites.js';
import { FORMAS_REPASSE, type FormaRepasse } from '../repasse.entity.js';

export class NovoRepasseDto {
  @IsUUID()
  produtorId: string;

  @IsInt()
  @Min(1)
  @Max(VALOR_MAXIMO_CENTAVOS)
  valorCentavos: number;

  @IsEnum(comoEnum(FORMAS_REPASSE))
  forma: FormaRepasse;

  /** Dia da entrega do dinheiro, AAAA-MM-DD, no calendário de quem registra. */
  @DataDoCalendario()
  data: string;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(200)
  observacao?: string | null;
}
