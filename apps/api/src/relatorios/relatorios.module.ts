import { Module } from '@nestjs/common';

import { AcertoDiarioService } from './acerto/acerto-diario.service.js';
import { FiadosService } from './fiados/fiados.service.js';
import { RelatoriosDePeriodoService } from './periodo/relatorios-de-periodo.service.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';
import { RelatoriosController } from './relatorios.controller.js';

// Só leitura: consulta as tabelas de pedidos pelo DataSource, sem repositórios
// próprios nem dependência dos services de pedidos.
@Module({
  controllers: [RelatoriosController],
  providers: [AcertoDiarioService, FiadosService, ProducaoDoDiaService, RelatoriosDePeriodoService],
})
export class RelatoriosModule {}
