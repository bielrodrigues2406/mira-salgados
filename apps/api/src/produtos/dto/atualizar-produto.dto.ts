import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';

export class AtualizarProdutoDto {
  @IsOptional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsUUID()
  produtorPadraoId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
