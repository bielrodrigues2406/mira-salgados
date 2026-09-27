import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';

export class CriarProdutoDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome: string;

  @IsUUID()
  produtorPadraoId: string;
}
