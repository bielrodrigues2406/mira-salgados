import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Aparar, ApararOuNulo, SomenteDigitos } from '../../common/validation/transforms.js';
import { TELEFONE } from './criar-cliente.dto.js';

// null em telefone ou endereço apaga o valor; ausência mantém o atual.
export class AtualizarClienteDto {
  @IsOptional()
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

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
