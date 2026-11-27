import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import type { Env } from '../config/env.schema.js';
import { ItemPedido } from '../pedidos/itens/item-pedido.entity.js';
import { Pedido } from '../pedidos/pedido.entity.js';
import { Produto } from '../produtos/produto.entity.js';
import { AutomacoesController } from './automacoes.controller.js';
import { CONECTOR_WHATSAPP, type ConectorWhatsApp } from './conector/conector-whatsapp.js';
import { GowaConector } from './conector/gowa.conector.js';
import { TransporteSimuladoConector } from './conector/transporte-simulado.conector.js';
import { DestinoNotificacao } from './entities/destino-notificacao.entity.js';
import { EstadoConectorNotificacao } from './entities/estado-conector-notificacao.entity.js';
import { ExecucaoResumoDiario } from './entities/execucao-resumo-diario.entity.js';
import { OutboxNotificacao } from './entities/outbox-notificacao.entity.js';
import { ReciboNotificacao } from './entities/recibo-notificacao.entity.js';
import { RegraNotificacao } from './entities/regra-notificacao.entity.js';
import { ResumoEnviadoPedido } from './entities/resumo-enviado-pedido.entity.js';
import { AgendadorResumosService } from './servicos/agendador-resumos.service.js';
import { AutomacoesService } from './servicos/automacoes.service.js';
import { ConfiguracaoNotificacoesService } from './servicos/configuracao-notificacoes.service.js';
import { DespachanteOutboxService } from './servicos/despachante-outbox.service.js';
import { EnfileiradorNotificacoesService } from './servicos/enfileirador-notificacoes.service.js';
import { LimpezaRetencaoService } from './servicos/limpeza-retencao.service.js';
import { WebhookNotificacoesService } from './servicos/webhook-notificacoes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DestinoNotificacao,
      RegraNotificacao,
      OutboxNotificacao,
      ReciboNotificacao,
      ExecucaoResumoDiario,
      ResumoEnviadoPedido,
      EstadoConectorNotificacao,
      Pedido,
      ItemPedido,
      Produto,
    ]),
    AuditoriaModule,
  ],
  controllers: [AutomacoesController],
  providers: [
    TransporteSimuladoConector,
    {
      provide: CONECTOR_WHATSAPP,
      inject: [ConfigService, TransporteSimuladoConector],
      useFactory: (
        config: ConfigService<Env, true>,
        simulado: TransporteSimuladoConector,
      ): ConectorWhatsApp => {
        const modo = config.get('NOTIFICACOES_MODO', { infer: true });
        if (modo === 'GOWA') {
          const baseUrl = config.get('NOTIFICACOES_CONECTOR_URL', { infer: true });
          const token = config.get('NOTIFICACOES_CONECTOR_TOKEN', { infer: true });
          if (!baseUrl || !token) {
            throw new Error(
              'NOTIFICACOES_CONECTOR_URL e NOTIFICACOES_CONECTOR_TOKEN são obrigatórios no modo GOWA.',
            );
          }
          return new GowaConector({
            baseUrl,
            token,
            deviceId: config.get('NOTIFICACOES_CONECTOR_DEVICE_ID', { infer: true }),
          });
        }
        return simulado;
      },
    },
    ConfiguracaoNotificacoesService,
    EnfileiradorNotificacoesService,
    AgendadorResumosService,
    DespachanteOutboxService,
    LimpezaRetencaoService,
    WebhookNotificacoesService,
    AutomacoesService,
  ],
  exports: [
    CONECTOR_WHATSAPP,
    TransporteSimuladoConector,
    ConfiguracaoNotificacoesService,
    EnfileiradorNotificacoesService,
    AgendadorResumosService,
    DespachanteOutboxService,
    LimpezaRetencaoService,
    WebhookNotificacoesService,
    AutomacoesService,
  ],
})
export class NotificacoesModule {}
