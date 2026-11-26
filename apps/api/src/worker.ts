import 'reflect-metadata';

import type { Server } from 'node:http';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import type { Env } from './config/env.schema.js';
import { AgendadorResumosService } from './notificacoes/servicos/agendador-resumos.service.js';
import { DespachanteOutboxService } from './notificacoes/servicos/despachante-outbox.service.js';
import { LimpezaRetencaoService } from './notificacoes/servicos/limpeza-retencao.service.js';
import { WebhookNotificacoesService } from './notificacoes/servicos/webhook-notificacoes.service.js';
import { criarServidorWebhookPrivado } from './notificacoes/worker-webhook.js';
import { WorkerModule } from './worker.module.js';

const INTERVALO_RESUMO_MS = 30_000;
const INTERVALO_LIMPEZA_MS = 60 * 60 * 1000;

async function iniciarWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const despachante = app.get(DespachanteOutboxService);
  const agendador = app.get(AgendadorResumosService);
  const limpeza = app.get(LimpezaRetencaoService);
  const webhooks = app.get(WebhookNotificacoesService);

  const intervaloMs = config.get('NOTIFICACOES_WORKER_INTERVALO_MS', { infer: true });
  const webhookHost = config.get('NOTIFICACOES_WEBHOOK_HOST', { infer: true });
  const webhookPort = config.get('NOTIFICACOES_WEBHOOK_PORT', { infer: true });
  const webhookSecret = config.get('NOTIFICACOES_WEBHOOK_SECRET', { infer: true });

  let servidorWebhook: Server | null = null;
  if (webhookPort > 0 && webhookSecret) {
    servidorWebhook = criarServidorWebhookPrivado(webhooks, webhookSecret);
    await new Promise<void>((resolve) => {
      servidorWebhook?.listen(webhookPort, webhookHost, resolve);
    });
    logger.log(
      `Listener privado de webhooks ativo em ${webhookHost}:${String(webhookPort)}`,
      'Worker',
    );
  }

  let encerrando = false;
  let executandoCiclo = false;
  let ultimoResumoEm = 0;
  let ultimaLimpezaEm = 0;

  const executarCiclo = async (): Promise<void> => {
    if (encerrando || executandoCiclo) return;
    executandoCiclo = true;
    try {
      const agoraMs = Date.now();
      if (agoraMs - ultimoResumoEm >= INTERVALO_RESUMO_MS) {
        await agendador.processarResumosDoDia(new Date(agoraMs));
        ultimoResumoEm = agoraMs;
      }
      await despachante.processarPendentes({ agora: new Date() });
      if (agoraMs - ultimaLimpezaEm >= INTERVALO_LIMPEZA_MS) {
        await limpeza.executar(new Date(agoraMs));
        ultimaLimpezaEm = agoraMs;
      }
    } catch (erro) {
      logger.error(erro instanceof Error ? erro.message : 'Erro no ciclo do worker', 'Worker');
    } finally {
      executandoCiclo = false;
    }
  };

  logger.log(`Worker de notificações iniciado (ciclo a cada ${String(intervaloMs)} ms)`, 'Worker');
  void executarCiclo();
  const temporizador = setInterval(() => {
    void executarCiclo();
  }, intervaloMs);

  const encerrar = async (sinal: string): Promise<void> => {
    if (encerrando) return;
    encerrando = true;
    logger.log(`Encerrando worker (${sinal})`, 'Worker');
    clearInterval(temporizador);
    if (servidorWebhook) {
      const servidor = servidorWebhook;
      await new Promise<void>((resolve) => {
        servidor.close(() => {
          resolve();
        });
      });
    }
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void encerrar('SIGTERM');
  });
  process.on('SIGINT', () => {
    void encerrar('SIGINT');
  });
}

void iniciarWorker();
