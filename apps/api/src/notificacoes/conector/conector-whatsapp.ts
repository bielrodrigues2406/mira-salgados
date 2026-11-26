import type { EstadoConexaoNotificacao, ModoConectorNotificacao } from '../dominio/enums.js';

export const CONECTOR_WHATSAPP = Symbol('CONECTOR_WHATSAPP');

export type ResultadoEnvioConector =
  | { tipo: 'ACEITO'; idExterno: string }
  | { tipo: 'ENTREGUE'; idExterno: string }
  | { tipo: 'FALHA_TRANSITORIA'; mensagem: string }
  | { tipo: 'FALHA_PERMANENTE'; mensagem: string }
  /**
   * Timeout ou perda de resposta após possível envio ao provedor. Nunca deve
   * ser reenviado automaticamente sem decisão do administrador (ADR 0019).
   */
  | { tipo: 'INCERTO'; mensagem: string }
  /** Sessão desconectada ou bloqueada temporariamente: pausa fila sem queimar tentativas. */
  | { tipo: 'DESCONECTADO'; mensagem: string };

export interface GrupoWhatsApp {
  id: string;
  nome: string;
}

export interface ResultadoPareamento {
  qrCode?: string;
  codigo?: string;
  mensagem: string;
}

/**
 * Contrato desacoplado de envio para WhatsApp. Na Fase 2 usa o transporte
 * simulado; na Fase 3 pluga GoWA (alvo principal) ou WAHA GOWS sem alterar
 * regras, outbox nem telas.
 */
export interface ConectorWhatsApp {
  readonly modo: ModoConectorNotificacao;

  enviarTexto(
    destinoExterno: string,
    texto: string,
    chaveDeduplicacao: string,
  ): Promise<ResultadoEnvioConector>;

  obterEstado(): Promise<{ estado: EstadoConexaoNotificacao; detalhe?: string }>;

  listarGrupos(): Promise<readonly GrupoWhatsApp[]>;

  iniciarPareamento(metodo: 'QR' | 'CODIGO', telefone?: string): Promise<ResultadoPareamento>;
}
