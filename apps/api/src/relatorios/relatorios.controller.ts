import { Controller, Get, Query } from '@nestjs/common';

import type { Paginated } from '../common/pagination/pagination.js';
import { AcertoDiarioService } from './acerto/acerto-diario.service.js';
import { AcertoDiarioDto } from './dto/acerto-diario.dto.js';
import { DataDoRelatorioDto } from './dto/data-do-relatorio.dto.js';
import {
  FiltroFiadosDto,
  FiltroProducaoDto,
  IntervaloDto,
  IntervaloPaginadoDto,
} from './dto/intervalo.dto.js';
import { ProducaoDoDiaDto } from './dto/producao-do-dia.dto.js';
import {
  ClienteComFiadoDto,
  FaturamentoDto,
  ItemVendidoDto,
  ProducaoDoProdutorDto,
} from './dto/relatorios-de-periodo.dto.js';
import { FiadosService } from './fiados/fiados.service.js';
import { RelatoriosDePeriodoService } from './periodo/relatorios-de-periodo.service.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly acerto: AcertoDiarioService,
    private readonly producao: ProducaoDoDiaService,
    private readonly periodo: RelatoriosDePeriodoService,
    private readonly fiados: FiadosService,
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

  @Get('faturamento')
  async faturamento(@Query() intervalo: IntervaloDto): Promise<FaturamentoDto> {
    return FaturamentoDto.de(
      intervalo.de,
      intervalo.ate,
      await this.periodo.faturamento(intervalo),
    );
  }

  /** Ranking por unidades; o resumo traz o volume do período inteiro. */
  @Get('itens-vendidos')
  async itensVendidos(@Query() filtro: IntervaloPaginadoDto): Promise<Paginated<ItemVendidoDto>> {
    return (await this.periodo.itensVendidos(filtro)).map((item) => ItemVendidoDto.de(item));
  }

  @Get('producao')
  async producaoPorProdutor(
    @Query() filtro: FiltroProducaoDto,
  ): Promise<Paginated<ProducaoDoProdutorDto>> {
    return (await this.periodo.producaoPorProdutor(filtro)).map((producao) =>
      ProducaoDoProdutorDto.de(producao),
    );
  }

  /** Clientes com fiado em aberto; o resumo traz o total consolidado. */
  @Get('fiados')
  async fiadosEmAberto(@Query() filtro: FiltroFiadosDto): Promise<Paginated<ClienteComFiadoDto>> {
    return (await this.fiados.emAberto(filtro)).map((fiado) => ClienteComFiadoDto.de(fiado));
  }
}
