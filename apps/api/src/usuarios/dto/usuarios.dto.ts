import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { comoEnum } from '../../common/validation/enum.js';
import { Opcional } from '../../common/validation/opcional.js';
import { TELEFONE } from '../../common/validation/telefone.js';
import { Aparar, BooleanoDeQuery, SomenteDigitos } from '../../common/validation/transforms.js';
import { PAPEIS, type Papel } from '../papeis.js';

// Política de senha pelo comprimento, como recomenda o NIST SP 800-63B: regras
// de composição levam a senhas previsíveis sem ganho real de entropia. O teto
// limita o custo de hashing que um corpo de requisição pode provocar.
export const SENHA_MINIMA = 12;
export const SENHA_MAXIMA = 128;

export function Senha(): PropertyDecorator {
  return (alvo, propriedade) => {
    IsString()(alvo, propriedade);
    MinLength(SENHA_MINIMA)(alvo, propriedade);
    MaxLength(SENHA_MAXIMA)(alvo, propriedade);
  };
}

export function Celular(): PropertyDecorator {
  return (alvo, propriedade) => {
    SomenteDigitos()(alvo, propriedade);
    IsString()(alvo, propriedade);
    Matches(TELEFONE)(alvo, propriedade);
  };
}

export class FiltroUsuariosDto extends PaginationQueryDto {
  @IsOptional()
  @BooleanoDeQuery()
  @IsBoolean()
  ativo?: boolean;
}

export class CriarUsuarioDto {
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @Celular()
  telefone: string;

  @IsEnum(comoEnum(PAPEIS))
  papel: Papel;

  /** Quem produz: liga a conta ao cadastro do produtor. */
  @IsOptional()
  @IsUUID()
  produtorId?: string;

  /** Provisória: a pessoa troca no primeiro acesso. */
  @Senha()
  senha: string;
}

export class AtualizarUsuarioDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @Opcional()
  @Celular()
  telefone?: string;

  @Opcional()
  @IsEnum(comoEnum(PAPEIS))
  papel?: Papel;

  @Opcional()
  @IsBoolean()
  ativo?: boolean;

  /** null desfaz a ligação com o produtor. */
  @IsOptional()
  @IsUUID()
  produtorId?: string | null;
}

export class RedefinirSenhaDto {
  @Senha()
  senha: string;
}

export class TrocarSenhaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SENHA_MAXIMA)
  senhaAtual: string;

  @Senha()
  novaSenha: string;
}
