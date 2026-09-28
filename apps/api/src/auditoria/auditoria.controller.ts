import { Controller, Get, Query } from '@nestjs/common';

import { SomenteAdmin } from '../common/auth/usuario-autenticado.js';
import type { Paginated } from '../common/pagination/pagination.js';
import { AuditoriaService } from './auditoria.service.js';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';
import { LogAuditoriaRespostaDto } from './dto/log-auditoria-resposta.dto.js';

/** Histórico de alterações: mostra dados de todas as áreas e é só para administradores. */
@Controller('auditoria')
@SomenteAdmin()
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  async listar(@Query() filtro: FiltroAuditoriaDto): Promise<Paginated<LogAuditoriaRespostaDto>> {
    const pagina = await this.auditoria.listar(filtro);
    return pagina.map((log) => LogAuditoriaRespostaDto.de(log));
  }
}
