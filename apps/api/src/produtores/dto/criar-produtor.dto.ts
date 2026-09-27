import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';

export class CriarProdutorDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome: string;
}
