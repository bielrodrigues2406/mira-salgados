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
import { type Paginated, PaginationQueryDto } from '../common/pagination/pagination.js';
import { AtualizarProdutoDto } from './dto/atualizar-produto.dto.js';
import { CriarProdutoDto } from './dto/criar-produto.dto.js';
import { FiltroProdutosDto } from './dto/filtro-produtos.dto.js';
import { NovoPrecoDto } from './dto/novo-preco.dto.js';
import { PrecoRespostaDto, ProdutoRespostaDto } from './dto/produto-resposta.dto.js';
import { ProdutosService } from './produtos.service.js';

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtos: ProdutosService) {}

  @Get()
  async listar(@Query() filtro: FiltroProdutosDto): Promise<Paginated<ProdutoRespostaDto>> {
    const pagina = await this.produtos.listar(filtro);
    return pagina.map((produto) => ProdutoRespostaDto.de(produto));
  }

  @Get(':id')
  async buscar(@Param('id', ParseUUIDPipe) id: string): Promise<ProdutoRespostaDto> {
    return ProdutoRespostaDto.de(await this.produtos.buscar(id));
  }

  @Post()
  async criar(
    @Body() dados: CriarProdutoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutoRespostaDto> {
    return ProdutoRespostaDto.de(await this.produtos.criar(dados, usuario.id));
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarProdutoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutoRespostaDto> {
    return ProdutoRespostaDto.de(await this.produtos.atualizar(id, dados, usuario.id));
  }

  /** Histórico completo, do mais recente para o mais antigo. */
  @Get(':id/precos')
  async historico(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() paginacao: PaginationQueryDto,
  ): Promise<Paginated<PrecoRespostaDto>> {
    const pagina = await this.produtos.historicoDePrecos(id, paginacao);
    return pagina.map((preco) => PrecoRespostaDto.de(preco));
  }

  /** Define o preço vigente da combinação, substituindo o anterior. Responde o produto. */
  @Post(':id/precos')
  async definirPreco(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: NovoPrecoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutoRespostaDto> {
    return ProdutoRespostaDto.de(await this.produtos.definirPreco(id, dados, usuario.id));
  }

  /** Encerra a vigência do preço; o registro continua no histórico. Responde o produto. */
  @Delete(':id/precos/:precoId')
  async encerrarPreco(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('precoId', ParseUUIDPipe) precoId: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<ProdutoRespostaDto> {
    return ProdutoRespostaDto.de(await this.produtos.encerrarPreco(id, precoId, usuario.id));
  }
}
