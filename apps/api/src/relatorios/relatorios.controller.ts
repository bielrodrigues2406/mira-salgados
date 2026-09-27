import { Controller, Get, Query } from '@nestjs/common';

import { DataDoRelatorioDto } from './dto/data-do-relatorio.dto.js';
import { ProducaoDoDiaDto } from './dto/producao-do-dia.dto.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly producao: ProducaoDoDiaService) {}

  /** O que fazer no dia: por horário (cronológico) e por produto (consolidado). */
  @Get('producao-do-dia')
  async producaoDoDia(@Query() { data }: DataDoRelatorioDto): Promise<ProducaoDoDiaDto> {
    return ProducaoDoDiaDto.de(data, await this.producao.doDia(data));
  }
}
