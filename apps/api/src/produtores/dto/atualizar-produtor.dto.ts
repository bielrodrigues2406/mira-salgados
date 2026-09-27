import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';

// Desativar é uma atualização de "ativo": o produtor continua referenciado por
// pedidos e acertos antigos, então nunca é excluído.
export class AtualizarProdutorDto {
  @IsOptional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
