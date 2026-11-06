import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type { ConsultaRepasses, NovoRepasse, Repasse } from '../models/repasse';
import { paginaDe, parametros } from './respostas';

const REPASSES = `${environment.apiUrl}/repasses`;

@Injectable({ providedIn: 'root' })
export class RepassesService {
  private readonly http = inject(HttpClient);

  /** Histórico reativo; precisa de contexto de injeção. */
  listar(
    consulta: () => ConsultaRepasses | undefined,
  ): HttpResourceRef<Pagina<Repasse> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: REPASSES, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<Repasse[]>) },
    );
  }

  registrar(dados: NovoRepasse): Observable<Repasse> {
    return this.http.post<ApiEnvelope<Repasse>>(REPASSES, dados).pipe(map(({ data }) => data));
  }

  desfazer(id: string): Observable<Repasse> {
    return this.http
      .delete<ApiEnvelope<Repasse>>(`${REPASSES}/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }
}
