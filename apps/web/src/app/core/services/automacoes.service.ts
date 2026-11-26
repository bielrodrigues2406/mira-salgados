import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type {
  AcaoReconciliacaoNotificacao,
  AlteracaoDestino,
  AlteracaoRegra,
  ConsultaHistoricoNotificacoes,
  DestinoNotificacao,
  EstadoConexao,
  GrupoWhatsApp,
  ItemHistoricoNotificacao,
  MetodoPareamento,
  PainelAutomacoes,
  PreviaRegra,
  RegraNotificacao,
  ResultadoPareamento,
} from '../models/automacoes';
import { paginaDe, parametros } from './respostas';

const AUTOMACOES = `${environment.apiUrl}/automacoes`;

/** Gestão das automações de WhatsApp; restrita a administradores. */
@Injectable({ providedIn: 'root' })
export class AutomacoesService {
  private readonly http = inject(HttpClient);

  painel(): HttpResourceRef<PainelAutomacoes | undefined> {
    return httpResource(() => AUTOMACOES, {
      parse: (corpo) => (corpo as ApiEnvelope<PainelAutomacoes>).data,
    });
  }

  historico(
    consulta: () => ConsultaHistoricoNotificacoes | undefined,
  ): HttpResourceRef<Pagina<ItemHistoricoNotificacao> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: `${AUTOMACOES}/historico`, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<ItemHistoricoNotificacao[]>) },
    );
  }

  atualizarDestino(id: string, dados: AlteracaoDestino): Observable<DestinoNotificacao> {
    return this.http
      .patch<ApiEnvelope<DestinoNotificacao>>(
        `${AUTOMACOES}/destinos/${encodeURIComponent(id)}`,
        dados,
      )
      .pipe(map(({ data }) => data));
  }

  atualizarRegra(id: string, dados: AlteracaoRegra): Observable<RegraNotificacao> {
    return this.http
      .patch<ApiEnvelope<RegraNotificacao>>(`${AUTOMACOES}/regras/${encodeURIComponent(id)}`, dados)
      .pipe(map(({ data }) => data));
  }

  gerarPrevia(
    id: string,
    dados: { data?: string; usarExemplo?: boolean } = {},
  ): Observable<PreviaRegra> {
    return this.http
      .post<ApiEnvelope<PreviaRegra>>(
        `${AUTOMACOES}/regras/${encodeURIComponent(id)}/previa`,
        dados,
      )
      .pipe(map(({ data }) => data));
  }

  simularRegra(
    id: string,
    dados: { data?: string; usarExemplo?: boolean } = {},
  ): Observable<ItemHistoricoNotificacao> {
    return this.http
      .post<ApiEnvelope<ItemHistoricoNotificacao>>(
        `${AUTOMACOES}/regras/${encodeURIComponent(id)}/simular`,
        dados,
      )
      .pipe(map(({ data }) => data));
  }

  testarEnvioReal(
    id: string,
    dados: { destinoId: string; identificadorExterno: string; data?: string },
  ): Observable<ItemHistoricoNotificacao> {
    return this.http
      .post<ApiEnvelope<ItemHistoricoNotificacao>>(
        `${AUTOMACOES}/regras/${encodeURIComponent(id)}/testar-envio`,
        dados,
      )
      .pipe(map(({ data }) => data));
  }

  verificarConexao(): Observable<EstadoConexao> {
    return this.http
      .post<ApiEnvelope<EstadoConexao>>(`${AUTOMACOES}/conexao/verificar`, {})
      .pipe(map(({ data }) => data));
  }

  iniciarPareamento(
    metodo: MetodoPareamento,
    telefone?: string | null,
  ): Observable<ResultadoPareamento> {
    const telefoneLimpo = telefone?.trim();
    const corpo = telefoneLimpo?.length ? { metodo, telefone: telefoneLimpo } : { metodo };
    return this.http
      .post<ApiEnvelope<ResultadoPareamento>>(`${AUTOMACOES}/conexao/parear`, corpo)
      .pipe(map(({ data }) => data));
  }

  listarGrupos(): Observable<GrupoWhatsApp[]> {
    return this.http
      .get<ApiEnvelope<GrupoWhatsApp[]>>(`${AUTOMACOES}/grupos`)
      .pipe(map(({ data }) => data));
  }

  pausarConexao(motivo?: string | null): Observable<EstadoConexao> {
    return this.http
      .post<ApiEnvelope<EstadoConexao>>(`${AUTOMACOES}/conexao/pausar`, {
        motivo: motivo ?? undefined,
      })
      .pipe(map(({ data }) => data));
  }

  retomarConexao(): Observable<EstadoConexao> {
    return this.http
      .post<ApiEnvelope<EstadoConexao>>(`${AUTOMACOES}/conexao/retomar`, {})
      .pipe(map(({ data }) => data));
  }

  reconciliar(
    id: string,
    acao: AcaoReconciliacaoNotificacao,
  ): Observable<ItemHistoricoNotificacao> {
    return this.http
      .post<ApiEnvelope<ItemHistoricoNotificacao>>(
        `${AUTOMACOES}/historico/${encodeURIComponent(id)}/reconciliar`,
        { acao },
      )
      .pipe(map(({ data }) => data));
  }

  registrarCopia(id: string): Observable<ItemHistoricoNotificacao> {
    return this.http
      .post<ApiEnvelope<ItemHistoricoNotificacao>>(
        `${AUTOMACOES}/historico/${encodeURIComponent(id)}/copiado`,
        {},
      )
      .pipe(map(({ data }) => data));
  }
}
