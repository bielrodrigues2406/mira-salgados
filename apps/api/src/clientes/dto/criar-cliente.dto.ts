import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Aparar, ApararOuNulo, SomenteDigitos } from '../../common/validation/transforms.js';
import { TELEFONE } from '../../common/validation/telefone.js';

export { TELEFONE };

export class CriarClienteDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @SomenteDigitos()
  @IsString()
  @Matches(TELEFONE)
  telefone?: string | null;

  @IsOptional()
  @ApararOuNulo()
  @IsString()
  @MaxLength(200)
  endereco?: string | null;
}
