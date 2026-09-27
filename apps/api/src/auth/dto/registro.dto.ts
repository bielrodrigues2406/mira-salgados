import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';

export class RegistroDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  // Política de senha pelo comprimento, como recomenda o NIST SP 800-63B: regras
  // de composição levam a senhas previsíveis sem ganho real de entropia.
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  senha: string;
}
