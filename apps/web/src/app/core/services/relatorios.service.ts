import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, PaginaComResumo } from '../models/api';
import type { ProducaoDoDia } from '../models/producao';
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
} from '../models/relatorios';
import { paginaComResumoDe, parametros } from './respostas';

const RELATORIOS = `${environment.apiUrl}/relatorios`;
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
  /** Caixa e divisão entre produtores. */
  acerto(data: () => string | undefined): HttpResourceRef<AcertoDiario | undefined> {
    return daData('acerto', data);
  }

  /** O que fazer no dia, por horário e consolidado. */
  producaoDoDia(data: () => string | undefined): HttpResourceRef<ProducaoDoDia | undefined> {
    return daData('producao-do-dia', data);
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
