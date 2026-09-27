import { Controller, Get, Query } from '@nestjs/common';

import type { Paginated } from '../common/pagination/pagination.js';
import { AuditoriaService } from './auditoria.service.js';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';
import { LogAuditoriaRespostaDto } from './dto/log-auditoria-resposta.dto.js';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  async listar(@Query() filtro: FiltroAuditoriaDto): Promise<Paginated<LogAuditoriaRespostaDto>> {
    const pagina = await this.auditoria.listar(filtro);
    return pagina.map((log) => LogAuditoriaRespostaDto.de(log));
  }
}
