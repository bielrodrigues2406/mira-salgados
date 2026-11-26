import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type {
  CanalNotificacao,
  EscopoItensMensagem,
  EstadoConexaoNotificacao,
  FiltroEncomendaNotificacao,
  ModoConectorNotificacao,
  StatusEnvioNotificacao,
  TipoEventoNotificacao,
  TipoRegraNotificacao,
} from '../dominio/enums.js';
import type { DestinoNotificacao } from '../entities/destino-notificacao.entity.js';
import type { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import type { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import type { RegraNotificacao } from '../entities/regra-notificacao.entity.js';

export class EstadoConexaoDto {
  canal: CanalNotificacao;
  modo: ModoConectorNotificacao;
  estado: EstadoConexaoNotificacao;
  pausado: boolean;
  motivoPausa: string | null;
  ultimoErro: string | null;
  ultimaVerificacaoEm: string | null;
  atualizadoEm: string;

  static de(entidade: EstadoConectorNotificacao): EstadoConexaoDto {
    return Object.assign(new EstadoConexaoDto(), {
      canal: entidade.canal,
      modo: entidade.modo,
      estado: entidade.estado,
      pausado: entidade.pausado,
      motivoPausa: entidade.motivoPausa,
      ultimoErro: entidade.ultimoErro,
      ultimaVerificacaoEm: entidade.ultimaVerificacaoEm?.toISOString() ?? null,
      atualizadoEm: entidade.atualizadoEm.toISOString(),
    });
  }
}

export class DestinoNotificacaoDto {
  id: string;
  nome: string;
  canal: CanalNotificacao;
  identificadorExterno: string | null;
  ativo: boolean;
  aprovadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;

  static de(entidade: DestinoNotificacao): DestinoNotificacaoDto {
    return Object.assign(new DestinoNotificacaoDto(), {
      id: entidade.id,
      nome: entidade.nome,
      canal: entidade.canal,
      identificadorExterno: entidade.identificadorExterno,
      ativo: entidade.ativo,
      aprovadoEm: entidade.aprovadoEm?.toISOString() ?? null,
      criadoEm: entidade.criadoEm.toISOString(),
      atualizadoEm: entidade.atualizadoEm.toISOString(),
    });
  }
}

export class RegraNotificacaoDto {
  id: string;
  nome: string;
  tipo: TipoRegraNotificacao;
  ativa: boolean;
  destinoId: string;
  destinoNome: string | null;
  filtroEncomenda: FiltroEncomendaNotificacao;
  preparos: Preparo[];
  modalidades: TipoEntrega[];
  escopoItens: EscopoItensMensagem;
  enviarCorrecoes: boolean;
  enviarCancelamentos: boolean;
  debounceSegundos: number;
  diasSemana: number[];
  horarioResumo: string | null;
  fusoHorario: string;
  omitirDiasVazios: boolean;
  incluirConcluidos: boolean;
  enviarComplementos: boolean;
  toleranciaAtrasoMinutos: number;
  atualizadoEm: string;

  static de(entidade: RegraNotificacao): RegraNotificacaoDto {
    return Object.assign(new RegraNotificacaoDto(), {
      id: entidade.id,
      nome: entidade.nome,
      tipo: entidade.tipo,
      ativa: entidade.ativa,
      destinoId: entidade.destinoId,
      destinoNome: entidade.destino?.nome ?? null,
      filtroEncomenda: entidade.filtroEncomenda,
      preparos: entidade.preparos,
      modalidades: entidade.modalidades,
      escopoItens: entidade.escopoItens,
      enviarCorrecoes: entidade.enviarCorrecoes,
      enviarCancelamentos: entidade.enviarCancelamentos,
      debounceSegundos: entidade.debounceSegundos,
      diasSemana: entidade.diasSemana,
      horarioResumo: entidade.horarioResumo,
      fusoHorario: entidade.fusoHorario,
      omitirDiasVazios: entidade.omitirDiasVazios,
      incluirConcluidos: entidade.incluirConcluidos,
      enviarComplementos: entidade.enviarComplementos,
      toleranciaAtrasoMinutos: entidade.toleranciaAtrasoMinutos,
      atualizadoEm: entidade.atualizadoEm.toISOString(),
    });
  }
}

export class ItemHistoricoNotificacaoDto {
  id: string;
  tipoEvento: TipoEventoNotificacao;
  status: StatusEnvioNotificacao;
  regraId: string | null;
  regraNome: string | null;
  destinoId: string;
  destinoNome: string | null;
  pedidoId: string | null;
  pedidoNumero: number | null;
  pedidoRevisao: number | null;
  dataReferencia: string | null;
  textoRenderizado: string | null;
  tentativas: number;
  maxTentativas: number;
  ultimoErro: string | null;
  disponivelEm: string;
  enviadoEm: string | null;
  entregueEm: string | null;
  copiadoManualmenteEm: string | null;
  criadoEm: string;

  static de(entidade: OutboxNotificacao): ItemHistoricoNotificacaoDto {
    return Object.assign(new ItemHistoricoNotificacaoDto(), {
      id: entidade.id,
      tipoEvento: entidade.tipoEvento,
      status: entidade.status,
      regraId: entidade.regraId,
      regraNome: entidade.regra?.nome ?? null,
      destinoId: entidade.destinoId,
      destinoNome: entidade.destino?.nome ?? null,
      pedidoId: entidade.pedidoId,
      pedidoNumero: entidade.pedido?.numero ?? null,
      pedidoRevisao: entidade.pedidoRevisao,
      dataReferencia: entidade.dataReferencia,
      textoRenderizado: entidade.textoRenderizado,
      tentativas: entidade.tentativas,
      maxTentativas: entidade.maxTentativas,
      ultimoErro: entidade.ultimoErro,
      disponivelEm: entidade.disponivelEm.toISOString(),
      enviadoEm: entidade.enviadoEm?.toISOString() ?? null,
      entregueEm: entidade.entregueEm?.toISOString() ?? null,
      copiadoManualmenteEm: entidade.copiadoManualmenteEm?.toISOString() ?? null,
      criadoEm: entidade.criadoEm.toISOString(),
    });
  }
}

export interface PainelAutomacoesResposta {
  estado: EstadoConexaoDto;
  destinos: DestinoNotificacaoDto[];
  regras: RegraNotificacaoDto[];
  fila: {
    pendentes: number;
    incertos: number;
    falhas: number;
  };
}

export interface PreviaRegraResposta {
  regraId: string;
  tipo: TipoRegraNotificacao;
  dataReferencia: string;
  usouExemplo: boolean;
  quantidadePedidos: number;
  texto: string;
}

export interface MensagemEquipeResposta {
  pedidoId: string;
  numero: number;
  texto: string;
}
