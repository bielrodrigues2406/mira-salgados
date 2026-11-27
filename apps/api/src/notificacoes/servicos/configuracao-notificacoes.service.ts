import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

import type { Env } from '../../config/env.schema.js';
import type { EstadoConexaoNotificacao, ModoConectorNotificacao } from '../dominio/enums.js';
import { DestinoNotificacao } from '../entities/destino-notificacao.entity.js';
import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { RegraNotificacao } from '../entities/regra-notificacao.entity.js';

const TRAVA_INICIALIZACAO_PADROES = 78_123_456;

function estadoInicialPara(modo: ModoConectorNotificacao): EstadoConexaoNotificacao {
  if (modo === 'DESLIGADO') return 'DESLIGADO';
  if (modo === 'SIMULADO') return 'SIMULADO';
  return 'DESCONECTADO';
}

/**
 * Garante a configuração inicial idempotente (estado do conector, destino
 * "Equipe Mira" e as duas regras padrão desativadas) sem exigir seed manual.
 */
@Injectable()
export class ConfiguracaoNotificacoesService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async garantirPadroes(manager: EntityManager): Promise<{
    estado: EstadoConectorNotificacao;
    destinos: DestinoNotificacao[];
    regras: RegraNotificacao[];
  }> {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [TRAVA_INICIALIZACAO_PADROES]);

    const modo = this.config.get('NOTIFICACOES_MODO', { infer: true });
    const repoEstado = manager.getRepository(EstadoConectorNotificacao);
    let estado =
      (await repoEstado.findOneBy({ canal: 'WHATSAPP' })) ??
      (await repoEstado.save(
        repoEstado.create({
          canal: 'WHATSAPP',
          modo,
          estado: estadoInicialPara(modo),
          pausado: false,
          motivoPausa: null,
          ultimoErro: null,
          ultimaVerificacaoEm: null,
        }),
      ));
    if (estado.modo !== modo) {
      estado.modo = modo;
      estado.estado = estadoInicialPara(modo);
      estado = await repoEstado.save(estado);
    }

    const repoDestino = manager.getRepository(DestinoNotificacao);
    let destinos = await repoDestino.find({ order: { criadoEm: 'ASC', id: 'ASC' } });
    if (destinos.length === 0) {
      const equipe = await repoDestino.save(
        repoDestino.create({
          nome: 'Equipe Mira',
          canal: 'WHATSAPP',
          identificadorExterno: modo === 'SIMULADO' ? 'simulado:equipe-mira@g.us' : null,
          ativo: true,
          aprovadoEm: null,
          aprovadoPorId: null,
        }),
      );
      destinos = [equipe];
    }

    const repoRegra = manager.getRepository(RegraNotificacao);
    let regras = await repoRegra.find({
      relations: { destino: true },
      order: { tipo: 'ASC', criadoEm: 'ASC', id: 'ASC' },
    });

    if (regras.length === 0) {
      const destinoPadrao = destinos[0];
      if (destinoPadrao) {
        await repoRegra.save(
          repoRegra.create({
            nome: 'Aviso imediato',
            tipo: 'AVISO_IMEDIATO',
            ativa: false,
            destinoId: destinoPadrao.id,
            filtroEncomenda: 'POR_PREPARO',
            preparos: ['ASSADO'],
            modalidades: [],
            escopoItens: 'TODOS',
            enviarCorrecoes: true,
            enviarCancelamentos: true,
            debounceSegundos: 30,
            diasSemana: [],
            horarioResumo: null,
            fusoHorario: 'America/Sao_Paulo',
            omitirDiasVazios: true,
            incluirConcluidos: true,
            enviarComplementos: false,
            toleranciaAtrasoMinutos: 120,
          }),
        );

        await repoRegra.save(
          repoRegra.create({
            nome: 'Resumo diário',
            tipo: 'RESUMO_DIARIO',
            ativa: false,
            destinoId: destinoPadrao.id,
            filtroEncomenda: 'POR_PREPARO',
            preparos: ['ASSADO'],
            modalidades: [],
            escopoItens: 'APENAS_FILTRADOS',
            enviarCorrecoes: true,
            enviarCancelamentos: true,
            debounceSegundos: 30,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            horarioResumo: '07:00',
            fusoHorario: 'America/Sao_Paulo',
            omitirDiasVazios: true,
            incluirConcluidos: true,
            enviarComplementos: true,
            toleranciaAtrasoMinutos: 120,
          }),
        );

        regras = await repoRegra.find({
          relations: { destino: true },
          order: { tipo: 'ASC', criadoEm: 'ASC', id: 'ASC' },
        });
      }
    }

    return { estado, destinos, regras };
  }
}
