import { Module } from '@nestjs/common';

import { AcertoDiarioService } from './acerto/acerto-diario.service.js';
import { FiadosService } from './fiados/fiados.service.js';
import { PainelController } from './painel/painel.controller.js';
import { PainelService } from './painel/painel.service.js';
import { RelatoriosDePeriodoService } from './periodo/relatorios-de-periodo.service.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';
import { RelatoriosController } from './relatorios.controller.js';

// Só leitura: consulta as tabelas de pedidos pelo DataSource, sem repositórios
// próprios nem dependência dos services de pedidos.
@Module({
  controllers: [RelatoriosController, PainelController],
  providers: [
    AcertoDiarioService,
    FiadosService,
    PainelService,
    ProducaoDoDiaService,
    RelatoriosDePeriodoService,
  ],
})
export class RelatoriosModule {}
