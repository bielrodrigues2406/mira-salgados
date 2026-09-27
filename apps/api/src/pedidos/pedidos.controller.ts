import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import { AlterarStatusDto } from './dto/alterar-status.dto.js';
import { AtualizarPedidoDto } from './dto/atualizar-pedido.dto.js';
import { CriarPedidoDto } from './dto/criar-pedido.dto.js';
import { FiltroPedidosDto } from './dto/filtro-pedidos.dto.js';
import { PedidoDetalheDto } from './dto/pedido-resposta.dto.js';
import { PedidoResumoDto } from './dto/pedido-resumo.dto.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosConsultaService } from './pedidos-consulta.service.js';

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidos: PedidosService,
    private readonly consulta: PedidosConsultaService,
  ) {}

  @Get()
  async listar(@Query() filtro: FiltroPedidosDto): Promise<Paginated<PedidoResumoDto>> {
    const pagina = await this.consulta.listar(filtro);
    return pagina.map((pedido) => PedidoResumoDto.de(pedido));
  }

  /** Agregado completo: itens, pagamentos, resumo financeiro e transições possíveis. */
  @Get(':id')
  async detalhar(@Param('id', ParseUUIDPipe) id: string): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.consulta.detalhar(id));
  }

  @Post()
  async criar(
    @Body() dados: CriarPedidoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.pedidos.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarPedidoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.pedidos.atualizar(id, dados, usuario.id));
  }

  @Patch(':id/status')
  async alterarStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AlterarStatusDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    const agregado = await this.pedidos.aplicarTransicaoDeStatus(id, dados.status, usuario.id);
    return PedidoDetalheDto.de(agregado);
  }
}
