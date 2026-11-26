import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { EstadoConexaoNotificacao, ModoConectorNotificacao } from '../dominio/enums.js';
import type {
  ConectorWhatsApp,
  GrupoWhatsApp,
  ResultadoEnvioConector,
  ResultadoPareamento,
} from './conector-whatsapp.js';

export interface RegistroEnvioSimulado {
  destinoExterno: string;
  texto: string;
  chaveDeduplicacao: string;
  enviadoEm: Date;
}

export type ComportamentoEnvioSimulado = (
  destinoExterno: string,
  texto: string,
  chaveDeduplicacao: string,
) => ResultadoEnvioConector | Promise<ResultadoEnvioConector>;

/**
 * Transporte determinístico em memória para desenvolvimento, simulações pelo
 * painel de automações e suíte de testes sem dependência externa.
 */
@Injectable()
export class TransporteSimuladoConector implements ConectorWhatsApp {
  readonly modo: ModoConectorNotificacao = 'SIMULADO';

  private readonly registros: RegistroEnvioSimulado[] = [];
  private readonly filaResultados: ResultadoEnvioConector[] = [];
  private comportamentoCustomizado: ComportamentoEnvioSimulado | null = null;
  private estadoAtual: EstadoConexaoNotificacao = 'SIMULADO';

  get enviados(): readonly RegistroEnvioSimulado[] {
    return this.registros;
  }

  definirComportamento(comportamento: ComportamentoEnvioSimulado | null): void {
    this.comportamentoCustomizado = comportamento;
  }

  enfileirarResultado(...resultados: ResultadoEnvioConector[]): void {
    this.filaResultados.push(...resultados);
  }

  definirEstado(estado: EstadoConexaoNotificacao): void {
    this.estadoAtual = estado;
  }

  resetar(): void {
    this.registros.length = 0;
    this.filaResultados.length = 0;
    this.comportamentoCustomizado = null;
    this.estadoAtual = 'SIMULADO';
  }

  async enviarTexto(
    destinoExterno: string,
    texto: string,
    chaveDeduplicacao: string,
  ): Promise<ResultadoEnvioConector> {
    this.registros.push({
      destinoExterno,
      texto,
      chaveDeduplicacao,
      enviadoEm: new Date(),
    });

    if (this.estadoAtual === 'DESCONECTADO') {
      return {
        tipo: 'DESCONECTADO',
        mensagem: 'Conector simulado marcado como desconectado.',
      };
    }

    const proximo = this.filaResultados.shift();
    if (proximo) return proximo;

    if (this.comportamentoCustomizado) {
      return this.comportamentoCustomizado(destinoExterno, texto, chaveDeduplicacao);
    }

    return { tipo: 'ACEITO', idExterno: `sim-${randomUUID()}` };
  }

  obterEstado(): Promise<{ estado: EstadoConexaoNotificacao; detalhe?: string }> {
    return Promise.resolve({
      estado: this.estadoAtual,
      detalhe:
        this.estadoAtual === 'SIMULADO'
          ? 'Modo simulado ativo. Nenhuma mensagem real é enviada ao WhatsApp.'
          : undefined,
    });
  }

  listarGrupos(): Promise<readonly GrupoWhatsApp[]> {
    return Promise.resolve([{ id: 'simulado:equipe-mira@g.us', nome: 'Equipe Mira (Simulado)' }]);
  }

  iniciarPareamento(_metodo: 'QR' | 'CODIGO', _telefone?: string): Promise<ResultadoPareamento> {
    return Promise.resolve({
      mensagem: 'Modo simulado ativo. Pareamento real será habilitado na integração com GoWA.',
    });
  }
}
