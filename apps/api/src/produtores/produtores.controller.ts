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
import type { Produtor } from './produtor.entity.js';
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
    const comProdutos = await this.produtores.comProdutosPadrao(pagina.items);
    return new Paginated(
      comProdutos.map((item) => ProdutorRespostaDto.de(item)),
      pagina.total,
      pagina.page,
      pagina.pageSize,
    );
  }

  @Get(':id')
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ProdutorRespostaDto> {
    return this.resposta(await this.produtores.buscar(id));
  }

  @Post()
  async criar(
    @Body() dados: CriarProdutorDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutorRespostaDto> {
    return this.resposta(await this.produtores.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarProdutorDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutorRespostaDto> {
    return this.resposta(await this.produtores.atualizar(id, dados, usuario.id));
  }

  /** Desativação lógica, como no contrato; equivale a PATCH { ativo: false }. */
  @Delete(':id')
  async desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutorRespostaDto> {
    return this.resposta(await this.produtores.atualizar(id, { ativo: false }, usuario.id));
  }

  private async resposta(produtor: Produtor): Promise<ProdutorRespostaDto> {
    const [comProdutos] = await this.produtores.comProdutosPadrao([produtor]);
    if (!comProdutos) throw new Error('Produtor sem resultado ao anexar produtos.');
    return ProdutorRespostaDto.de(comProdutos);
  }
}
