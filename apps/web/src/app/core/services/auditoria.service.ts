import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type { ConsultaAlteracoes, RegistroDeAlteracao } from '../models/auditoria';
import { paginaDe, parametros } from './respostas';

/** Histórico de alterações; a API só atende administradores. */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  listar(
    consulta: () => ConsultaAlteracoes | undefined,
  ): HttpResourceRef<Pagina<RegistroDeAlteracao> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return (
          atual && { url: `${environment.apiUrl}/auditoria`, params: parametros({ ...atual }) }
        );
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<RegistroDeAlteracao[]>) },
    );
  }
}
