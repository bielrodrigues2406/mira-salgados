import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../common/auth/usuario-autenticado.js';
import { Paginated } from '../common/pagination/pagination.js';
import { FiltroRepassesDto } from './dto/filtro-repasses.dto.js';
import { NovoRepasseDto } from './dto/novo-repasse.dto.js';
import { RepasseRespostaDto } from './dto/repasse-resposta.dto.js';
import { RepassesService } from './repasses.service.js';

/** Qualquer conta registra e desfaz repasses; o saldo fica em /relatorios/saldos. */
@Controller('repasses')
export class RepassesController {
  constructor(private readonly repasses: RepassesService) {}

  @Get()
  async listar(@Query() filtro: FiltroRepassesDto): Promise<Paginated<RepasseRespostaDto>> {
    const pagina = await this.repasses.listar(filtro);
    return new Paginated(
      pagina.items.map((repasse) => RepasseRespostaDto.de(repasse)),
      pagina.total,
      pagina.page,
      pagina.pageSize,
    );
  }

  @Post()
  async registrar(
    @Body() dados: NovoRepasseDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<RepasseRespostaDto> {
    return RepasseRespostaDto.de(await this.repasses.registrar(dados, usuario.id));
  }

  @Delete(':id')
  async desfazer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<RepasseRespostaDto> {
    return RepasseRespostaDto.de(await this.repasses.desfazer(id, usuario.id));
  }
}
