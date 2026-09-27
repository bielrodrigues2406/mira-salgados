import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../models/api';
import type { ProducaoDoDia } from '../models/producao';
import type { AcertoDiario } from '../models/relatorios';

const RELATORIOS = `${environment.apiUrl}/relatorios`;

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
}
