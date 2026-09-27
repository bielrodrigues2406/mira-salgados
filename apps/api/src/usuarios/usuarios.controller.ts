import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  CurrentUser,
  SomenteAdmin,
  type UsuarioAutenticado,
} from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto.js';
import {
  AtualizarUsuarioDto,
  CriarUsuarioDto,
  FiltroUsuariosDto,
  RedefinirSenhaDto,
} from './dto/usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

/** Contas de quem usa o sistema. Só administradores gerenciam contas. */
@Controller('usuarios')
@SomenteAdmin()
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  async listar(@Query() filtro: FiltroUsuariosDto): Promise<Paginated<UsuarioRespostaDto>> {
    return (await this.usuarios.listar(filtro)).map((usuario) => UsuarioRespostaDto.de(usuario));
  }

  /** A senha informada é provisória: a pessoa troca no primeiro acesso. */
  @Post()
  async criar(
    @Body() dados: CriarUsuarioDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuarios.criar(
      {
        nome: dados.nome,
        telefone: dados.telefone,
        papel: dados.papel,
        senha: dados.senha,
        provisoria: true,
      },
      autor.id,
    );
    return UsuarioRespostaDto.de(usuario);
  }

  @Patch(':id')
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarUsuarioDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<UsuarioRespostaDto> {
    return UsuarioRespostaDto.de(await this.usuarios.atualizar(id, dados, autor.id));
  }

  /** Senha provisória para quem esqueceu; encerra as sessões da conta. */
  @Post(':id/senha')
  @HttpCode(200)
  async redefinirSenha(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: RedefinirSenhaDto,
    @CurrentUser() autor: UsuarioAutenticado,
  ): Promise<UsuarioRespostaDto> {
    return UsuarioRespostaDto.de(await this.usuarios.redefinirSenha(id, dados.senha, autor.id));
  }
}
