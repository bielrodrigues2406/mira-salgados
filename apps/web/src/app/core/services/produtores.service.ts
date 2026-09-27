import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type {
  AlteracaoProdutor,
  ConsultaProdutores,
  NovoProdutor,
  Produtor,
} from '../models/produtor';
import { paginaDe, parametros } from './respostas';

const PRODUTORES = `${environment.apiUrl}/produtores`;

@Injectable({ providedIn: 'root' })
export class ProdutoresService {
  private readonly http = inject(HttpClient);

  /**
   * Lista reativa: refaz a requisição sempre que a consulta muda. Precisa de
   * contexto de injeção, como a inicialização de um campo do componente.
   */
  listar(
    consulta: () => ConsultaProdutores | undefined,
  ): HttpResourceRef<Pagina<Produtor> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: PRODUTORES, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<Produtor[]>) },
    );
  }

  criar(dados: NovoProdutor): Observable<Produtor> {
    return this.http.post<ApiEnvelope<Produtor>>(PRODUTORES, dados).pipe(map(({ data }) => data));
  }

  atualizar(id: string, alteracao: AlteracaoProdutor): Observable<Produtor> {
    return this.http
      .patch<ApiEnvelope<Produtor>>(`${PRODUTORES}/${encodeURIComponent(id)}`, alteracao)
      .pipe(map(({ data }) => data));
  }
}
