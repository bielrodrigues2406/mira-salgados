import { Controller, Get, Query } from '@nestjs/common';

import { AcertoDiarioService } from './acerto/acerto-diario.service.js';
import { AcertoDiarioDto } from './dto/acerto-diario.dto.js';
import { DataDoRelatorioDto } from './dto/data-do-relatorio.dto.js';
import { ProducaoDoDiaDto } from './dto/producao-do-dia.dto.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly acerto: AcertoDiarioService,
    private readonly producao: ProducaoDoDiaService,
  ) {}

  /** Caixa do dia e divisão entre produtores, proporcional ao valor produzido. */
  @Get('acerto')
  async acertoDiario(@Query() { data }: DataDoRelatorioDto): Promise<AcertoDiarioDto> {
    return AcertoDiarioDto.de(data, await this.acerto.daData(data));
  }

  /** O que fazer no dia: por horário (cronológico) e por produto (consolidado). */
  @Get('producao-do-dia')
  async producaoDoDia(@Query() { data }: DataDoRelatorioDto): Promise<ProducaoDoDiaDto> {
    return ProducaoDoDiaDto.de(data, await this.producao.doDia(data));
  }
}
