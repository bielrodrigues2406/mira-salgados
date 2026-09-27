import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../../common/auth/usuario-autenticado.js';
import { ItemPedidoDto, PedidoDetalheDto } from '../dto/pedido-resposta.dto.js';
import { PedidosConsultaService } from '../pedidos-consulta.service.js';
import { AtualizarItemDto } from './dto/atualizar-item.dto.js';
import { NovoItemDto } from './dto/novo-item.dto.js';
import { ItensService } from './itens.service.js';

// Itens de um pedido são poucos por natureza; a lista não é paginada.
// Alterações respondem o pedido inteiro, já com totais recalculados.
@Controller('pedidos/:pedidoId/itens')
export class ItensController {
  constructor(
    private readonly itens: ItensService,
    private readonly consulta: PedidosConsultaService,
  ) {}

  @Get()
  async listar(@Param('pedidoId', ParseUUIDPipe) pedidoId: string): Promise<ItemPedidoDto[]> {
    const { itens } = await this.consulta.detalhar(pedidoId);
    return itens.map((item) => ItemPedidoDto.de(item));
  }

  @Post()
  async adicionar(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Body() dados: NovoItemDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.itens.adicionar(pedidoId, dados, usuario.id));
  }

  @Patch(':itemId')
  async atualizar(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dados: AtualizarItemDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.itens.atualizar(pedidoId, itemId, dados, usuario.id));
  }

  @Delete(':itemId')
  async remover(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.itens.remover(pedidoId, itemId, usuario.id));
  }
}
