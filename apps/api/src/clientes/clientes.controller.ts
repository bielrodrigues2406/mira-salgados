import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import { ClientesService } from './clientes.service.js';
import { AtualizarClienteDto } from './dto/atualizar-cliente.dto.js';
import { ClienteRespostaDto } from './dto/cliente-resposta.dto.js';
import { CriarClienteDto } from './dto/criar-cliente.dto.js';
import { FiltroClientesDto } from './dto/filtro-clientes.dto.js';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  async listar(@Query() filtro: FiltroClientesDto): Promise<Paginated<ClienteRespostaDto>> {
    const pagina = await this.clientes.listar(filtro);
    return pagina.map((cliente) => ClienteRespostaDto.de(cliente));
  }

  @Get(':id')
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ClienteRespostaDto> {
    return ClienteRespostaDto.de(await this.clientes.buscar(id));
  }

  @Post()
  async criar(
    @Body() dados: CriarClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteRespostaDto> {
    return ClienteRespostaDto.de(await this.clientes.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarClienteDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ClienteRespostaDto> {
    return ClienteRespostaDto.de(await this.clientes.atualizar(id, dados, usuario.id));
  }
}
