import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, PaginaComResumo } from '../models/api';
import type { ProducaoDoDia, ProducaoPorDia } from '../models/producao';
import type {
  AcertoDiario,
  ClienteComFiado,
  ConsultaDeFiados,
  ConsultaDePeriodo,
  Faturamento,
  ItemVendido,
  Periodo,
  ProducaoDoProdutor,
  ResumoDeVolume,
  ResumoDosFiados,
  Saldos,
} from '../models/relatorios';
import { paginaComResumoDe, parametros } from './respostas';

const RELATORIOS = `${environment.apiUrl}/relatorios`;
/** Maior página que a API aceita. */
const PAGINA_DA_EXPORTACAO = 100;
const SEM_VOLUME: ResumoDeVolume = { unidades: 0, valorCentavos: 0 };
const SEM_FIADOS: ResumoDosFiados = { totalEmAbertoCentavos: 0, quantidadePedidos: 0 };

/** Relatório de uma data (AAAA-MM-DD); sem data, não consulta. */
function daData<T>(
  caminho: string,
  data: () => string | undefined,
): HttpResourceRef<T | undefined> {
  return httpResource(
    () => {
      const atual = data();
      return atual ? { url: `${RELATORIOS}/${caminho}`, params: { data: atual } } : undefined;
    },
    { parse: (corpo) => (corpo as ApiEnvelope<T>).data },
  );
}

/** Relatório paginado com resumo; sem consulta, não busca. */
function paginado<T, R>(
  caminho: string,
  consulta: () => object | undefined,
  vazio: R,
): HttpResourceRef<PaginaComResumo<T, R> | undefined> {
  return httpResource(
    () => {
      const atual = consulta();
      return atual && { url: `${RELATORIOS}/${caminho}`, params: parametros({ ...atual }) };
    },
    { parse: (corpo) => paginaComResumoDe(corpo as ApiEnvelope<T[]>, vazio) },
  );
}

// Todos os relatórios são reativos e precisam de contexto de injeção.
@Injectable({ providedIn: 'root' })
export class RelatoriosService {
  private readonly http = inject(HttpClient);

  /**
   * Todas as páginas de um relatório, para exportar: a tela pagina, a planilha
   * leva tudo. Páginas do tamanho máximo que a API aceita.
   */
  async todasAsPaginas<T>(
    caminho: 'itens-vendidos' | 'producao' | 'fiados',
    consulta: Record<string, string | undefined>,
  ): Promise<T[]> {
    const itens: T[] = [];
    for (let pagina = 1; ; pagina++) {
      const corpo = await firstValueFrom(
        this.http.get<ApiEnvelope<T[]>>(`${RELATORIOS}/${caminho}`, {
          params: parametros({ ...consulta, page: pagina, pageSize: PAGINA_DA_EXPORTACAO }),
        }),
      );
      itens.push(...corpo.data);
      if (!corpo.meta || pagina >= corpo.meta.totalPages) return itens;
    }
  }

  /** O que entrou no dia e o que cada produtor fez. */
  acerto(data: () => string | undefined): HttpResourceRef<AcertoDiario | undefined> {
    return daData('acerto', data);
  }

  /** Quanto cada produtor tem a receber, já recebeu e falta, até a data. */
  saldos(data: () => string | undefined): HttpResourceRef<Saldos | undefined> {
    return daData('saldos', data);
  }

  /** O que fazer no dia, por horário e consolidado. */
  producaoDoDia(data: () => string | undefined): HttpResourceRef<ProducaoDoDia | undefined> {
    return daData('producao-do-dia', data);
  }

  /** Carga de cada produtor por dia; sem intervalo, não consulta. */
  producaoPorDia(
    intervalo: () => { de: string; ate: string } | undefined,
  ): HttpResourceRef<ProducaoPorDia | undefined> {
    return httpResource(
      () => {
        const atual = intervalo();
        return atual && { url: `${RELATORIOS}/producao-por-dia`, params: { ...atual } };
      },
      { parse: (corpo) => (corpo as ApiEnvelope<ProducaoPorDia>).data },
    );
  }

  faturamento(periodo: () => Periodo | undefined): HttpResourceRef<Faturamento | undefined> {
    return httpResource(
      () => {
        const atual = periodo();
        return atual && { url: `${RELATORIOS}/faturamento`, params: { ...atual } };
      },
      { parse: (corpo) => (corpo as ApiEnvelope<Faturamento>).data },
    );
  }

  /** Ranking de produto e preparo por unidades. */
  itensVendidos(
    consulta: () => ConsultaDePeriodo | undefined,
  ): HttpResourceRef<PaginaComResumo<ItemVendido, ResumoDeVolume> | undefined> {
    return paginado('itens-vendidos', consulta, SEM_VOLUME);
  }

  producaoPorProdutor(
    consulta: () => ConsultaDePeriodo | undefined,
  ): HttpResourceRef<PaginaComResumo<ProducaoDoProdutor, ResumoDeVolume> | undefined> {
    return paginado('producao', consulta, SEM_VOLUME);
  }

  /** Clientes com fiado em aberto e o total consolidado. */
  fiados(
    consulta: () => ConsultaDeFiados | undefined,
  ): HttpResourceRef<PaginaComResumo<ClienteComFiado, ResumoDosFiados> | undefined> {
    return paginado('fiados', consulta, SEM_FIADOS);
  }
}
