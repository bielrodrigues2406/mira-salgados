import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

import { TELEFONE } from '../../common/validation/telefone.js';
import { SomenteDigitos } from '../../common/validation/transforms.js';
import { SENHA_MAXIMA } from '../../usuarios/dto/usuarios.dto.js';

export class LoginDto {
  /** Celular com DDD; máscara e espaços são descartados. */
  @SomenteDigitos()
  @IsString()
  @Matches(TELEFONE)
  telefone: string;

  // Sem regra de tamanho mínimo no login: a política vale no cadastro. O teto
  // limita o custo de hashing que um corpo de requisição pode provocar.
  @IsString()
  @IsNotEmpty()
  @MaxLength(SENHA_MAXIMA)
  senha: string;
}
