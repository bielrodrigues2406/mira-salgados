import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../../common/auth/usuario-autenticado.js';
import { PagamentoDto, PedidoDetalheDto } from '../dto/pedido-resposta.dto.js';
import { PedidosConsultaService } from '../pedidos-consulta.service.js';
import { NovoPagamentoDto } from './dto/novo-pagamento.dto.js';
import { PagamentosService } from './pagamentos.service.js';

@Controller('pedidos/:pedidoId/pagamentos')
export class PagamentosController {
  constructor(
    private readonly pagamentos: PagamentosService,
    private readonly consulta: PedidosConsultaService,
  ) {}

  /** Todos os lançamentos do pedido, inclusive estornados. */
  @Get()
  async listar(@Param('pedidoId', ParseUUIDPipe) pedidoId: string): Promise<PagamentoDto[]> {
    const { pagamentos } = await this.consulta.detalhar(pedidoId);
    return pagamentos.map((pagamento) => PagamentoDto.de(pagamento));
  }

  @Post()
  async registrar(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Body() dados: NovoPagamentoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.pagamentos.registrar(pedidoId, dados, usuario.id));
  }

  /** Estorno: o lançamento continua no histórico, fora das somas. */
  @Delete(':pagamentoId')
  async estornar(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Param('pagamentoId', ParseUUIDPipe) pagamentoId: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PedidoDetalheDto> {
    return PedidoDetalheDto.de(await this.pagamentos.estornar(pedidoId, pagamentoId, usuario.id));
  }
}
