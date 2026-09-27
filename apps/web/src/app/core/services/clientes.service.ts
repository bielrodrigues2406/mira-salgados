import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type { AlteracaoCliente, Cliente, ConsultaClientes, NovoCliente } from '../models/cliente';
import { paginaDe, parametros } from './respostas';

const CLIENTES = `${environment.apiUrl}/clientes`;

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);

  /** Lista reativa; precisa de contexto de injeção. */
  listar(
    consulta: () => ConsultaClientes | undefined,
  ): HttpResourceRef<Pagina<Cliente> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: CLIENTES, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<Cliente[]>) },
    );
  }

  criar(dados: NovoCliente): Observable<Cliente> {
    return this.http.post<ApiEnvelope<Cliente>>(CLIENTES, dados).pipe(map(({ data }) => data));
  }

  atualizar(id: string, alteracao: AlteracaoCliente): Observable<Cliente> {
    return this.http
      .patch<ApiEnvelope<Cliente>>(`${CLIENTES}/${encodeURIComponent(id)}`, alteracao)
      .pipe(map(({ data }) => data));
  }
}
