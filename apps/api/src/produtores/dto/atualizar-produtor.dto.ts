import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { Aparar } from '../../common/validation/transforms.js';
import { Opcional } from '../../common/validation/opcional.js';

// Desativar é uma atualização de "ativo": o produtor continua referenciado por
// pedidos e acertos antigos, então nunca é excluído.
export class AtualizarProdutorDto {
  @Opcional()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome?: string;

  @Opcional()
  @IsBoolean()
  ativo?: boolean;
}
