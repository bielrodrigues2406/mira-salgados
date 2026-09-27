import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import { AtualizarProdutorDto } from './dto/atualizar-produtor.dto.js';
import { CriarProdutorDto } from './dto/criar-produtor.dto.js';
import { FiltroProdutoresDto } from './dto/filtro-produtores.dto.js';
import { ProdutorRespostaDto } from './dto/produtor-resposta.dto.js';
import { ProdutoresService } from './produtores.service.js';

@Controller('produtores')
export class ProdutoresController {
  constructor(private readonly produtores: ProdutoresService) {}

  @Get()
  async listar(@Query() filtro: FiltroProdutoresDto): Promise<Paginated<ProdutorRespostaDto>> {
    const pagina = await this.produtores.listar(filtro);
    return pagina.map((produtor) => ProdutorRespostaDto.de(produtor));
  }

  @Get(':id')
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ProdutorRespostaDto> {
    return ProdutorRespostaDto.de(await this.produtores.buscar(id));
  }

  @Post()
  async criar(
    @Body() dados: CriarProdutorDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutorRespostaDto> {
    return ProdutorRespostaDto.de(await this.produtores.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarProdutorDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutorRespostaDto> {
    return ProdutorRespostaDto.de(await this.produtores.atualizar(id, dados, usuario.id));
  }
}
