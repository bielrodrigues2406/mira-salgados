import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Aparar, ApararOuNulo, SomenteDigitos } from '../../common/validation/transforms.js';
import { TELEFONE } from './criar-cliente.dto.js';
import { Opcional } from '../../common/validation/opcional.js';

// null em telefone ou endereço apaga o valor; ausência mantém o atual.
export class AtualizarClienteDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

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

  @Opcional()
  @IsBoolean()
  ativo?: boolean;
}
