import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

import { CriarPedidoDto } from './criar-pedido.dto.js';
import { NovoItemDto } from '../itens/dto/novo-item.dto.js';

export const LIMITE_ITENS_POR_PEDIDO = 100;

/**
 * Criação atômica de encomenda já confirmada: exige ao menos um item e valida
 * todos os dados em conjunto antes de gravar no banco.
 */
export class CriarPedidoConfirmadoDto extends CriarPedidoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITE_ITENS_POR_PEDIDO)
  @ValidateNested({ each: true })
  @Type(() => NovoItemDto)
  itens: NovoItemDto[];
}
