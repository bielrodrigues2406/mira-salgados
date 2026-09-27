import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../common/auth/usuario-autenticado.js';
import { Paginated } from '../common/pagination/pagination.js';
import { SaldoDevedorService } from '../pedidos/saldo-devedor.service.js';
import type { Cliente } from './cliente.entity.js';
import { ClientesService } from './clientes.service.js';
import { AtualizarClienteDto } from './dto/atualizar-cliente.dto.js';
import { ClienteDetalheDto, ClienteRespostaDto } from './dto/cliente-resposta.dto.js';
import { CriarClienteDto } from './dto/criar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';

const PEDIDOS_EM_ABERTO_NO_DETALHE = 10;

@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly saldos: SaldoDevedorService,
  ) {}

  @Get()
  async listar(@Query() filtro: FiltroClientesDto): Promise<Paginated<ClienteRespostaDto>> {
    const pagina = await this.clientes.listar(filtro);
    const saldos = await this.saldos.porCliente(pagina.items.map((cliente) => cliente.id));
    return pagina.map((cliente) => ClienteRespostaDto.de(cliente, saldos.get(cliente.id)));
  }

  /** Inclui o saldo devedor consolidado e os pedidos que ainda têm saldo. */
  @Get(':id')
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ClienteDetalheDto> {
    const cliente = await this.clientes.buscar(id);
    const [saldos, pedidos] = await Promise.all([
      this.saldos.porCliente([id]),
      this.saldos.pedidosEmAberto(id, PEDIDOS_EM_ABERTO_NO_DETALHE),
    ]);
    return ClienteDetalheDto.detalhe(cliente, saldos.get(id), pedidos);
  }

  @Post()
  async criar(
    @Body() dados: CriarClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteRespostaDto> {
    return this.resposta(await this.clientes.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteRespostaDto> {
    return this.resposta(await this.clientes.atualizar(id, dados, usuario.id));
  }

  /** Desativação lógica, como no contrato; equivale a PATCH { ativo: false }. */
  @Delete(':id')
  async desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteRespostaDto> {
    return this.resposta(await this.clientes.atualizar(id, { ativo: false }, usuario.id));
  }

  private async resposta(cliente: Cliente): Promise<ClienteRespostaDto> {
    const saldos = await this.saldos.porCliente([cliente.id]);
    return ClienteRespostaDto.de(cliente, saldos.get(cliente.id));
  }
}
