import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type { AlteracaoUsuario, ConsultaUsuarios, NovoUsuario, Usuario } from '../models/usuario';
import { paginaDe, parametros } from './respostas';

const USUARIOS = `${environment.apiUrl}/usuarios`;

function usuario(id: string): string {
  return `${USUARIOS}/${encodeURIComponent(id)}`;
}

/** Contas de quem usa o sistema; a API só atende administradores. */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(
    consulta: () => ConsultaUsuarios | undefined,
  ): HttpResourceRef<Pagina<Usuario> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: USUARIOS, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<Usuario[]>) },
    );
  }

  criar(dados: NovoUsuario): Observable<Usuario> {
    return this.http.post<ApiEnvelope<Usuario>>(USUARIOS, dados).pipe(map(({ data }) => data));
  }

  atualizar(id: string, alteracao: AlteracaoUsuario): Observable<Usuario> {
    return this.http
      .patch<ApiEnvelope<Usuario>>(usuario(id), alteracao)
      .pipe(map(({ data }) => data));
  }

  /** Senha provisória para quem esqueceu; a pessoa troca no próximo acesso. */
  redefinirSenha(id: string, senha: string): Observable<Usuario> {
    return this.http
      .post<ApiEnvelope<Usuario>>(`${usuario(id)}/senha`, { senha })
      .pipe(map(({ data }) => data));
  }
}
