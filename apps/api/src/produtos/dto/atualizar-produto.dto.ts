import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';
import { Opcional } from '../../common/validation/opcional.js';

export class AtualizarProdutoDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome?: string;

  @Opcional()
  @IsUUID()
  produtorPadraoId?: string;

  @Opcional()
  @IsBoolean()
  ativo?: boolean;
}
