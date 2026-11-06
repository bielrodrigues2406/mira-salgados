import { Module } from '@nestjs/common';

import { RepassesModule } from '../repasses/repasses.module.js';
import { AcertoDiarioService } from './acerto/acerto-diario.service.js';
import { FiadosService } from './fiados/fiados.service.js';
import { PainelController } from './painel/painel.controller.js';
import { PainelService } from './painel/painel.service.js';
import { RelatoriosDePeriodoService } from './periodo/relatorios-de-periodo.service.js';
import { ProducaoDoDiaService } from './producao/producao-do-dia.service.js';
import { RelatoriosController } from './relatorios.controller.js';
import { SaldosService } from './saldos/saldos.service.js';

// Só leitura: consulta as tabelas de pedidos pelo DataSource, sem repositórios
// próprios nem dependência dos services de pedidos. Dos repasses, só as somas.
@Module({
  imports: [RepassesModule],
  controllers: [RelatoriosController, PainelController],
  providers: [
    AcertoDiarioService,
    FiadosService,
    PainelService,
    ProducaoDoDiaService,
    RelatoriosDePeriodoService,
    SaldosService,
  ],
})
export class RelatoriosModule {}
