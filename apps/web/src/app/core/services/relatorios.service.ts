import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../models/api';
import type { ProducaoDoDia } from '../models/producao';

const RELATORIOS = `${environment.apiUrl}/relatorios`;

@Injectable({ providedIn: 'root' })
export class RelatoriosService {
  /** Produção de uma data (AAAA-MM-DD); reativa, precisa de contexto de injeção. */
  producaoDoDia(data: () => string | undefined): HttpResourceRef<ProducaoDoDia | undefined> {
    return httpResource(
      () => {
        const atual = data();
        return atual
          ? { url: `${RELATORIOS}/producao-do-dia`, params: { data: atual } }
          : undefined;
      },
      { parse: (corpo) => (corpo as ApiEnvelope<ProducaoDoDia>).data },
    );
  }
}
