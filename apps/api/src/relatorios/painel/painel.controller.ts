import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser, type UsuarioAutenticado } from '../../common/auth/usuario-autenticado.js';
import { DataDoRelatorioDto } from '../dto/data-do-relatorio.dto.js';
import { PainelDto } from './painel.dto.js';
import { PainelService } from './painel.service.js';

/** Tela inicial: o dia, os próximos dias e, para quem produz, a própria produção e os ganhos. */
@Controller('painel')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  async doUsuario(
    @Query() { data }: DataDoRelatorioDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PainelDto> {
    return PainelDto.de(await this.painel.doUsuario(usuario.id, data));
  }
}
