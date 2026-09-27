import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type {
  AlteracaoProduto,
  ConsultaProdutos,
  NovoPreco,
  NovoProduto,
  PrecoProduto,
  Produto,
} from '../models/produto';
import { paginaDe, parametros } from './respostas';

const PRODUTOS = `${environment.apiUrl}/produtos`;
const TAMANHO_DO_HISTORICO = 50;

function produto(id: string): string {
  return `${PRODUTOS}/${encodeURIComponent(id)}`;
}

@Injectable({ providedIn: 'root' })
export class ProdutosService {
  private readonly http = inject(HttpClient);

  /** Lista reativa; precisa de contexto de injeção. */
  listar(
    consulta: () => ConsultaProdutos | undefined,
  ): HttpResourceRef<Pagina<Produto> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: PRODUTOS, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<Produto[]>) },
    );
  }

  /** Histórico de preços, do mais recente ao mais antigo; sem id, não consulta. */
  historico(
    produtoId: () => string | undefined,
  ): HttpResourceRef<Pagina<PrecoProduto> | undefined> {
    return httpResource(
      () => {
        const id = produtoId();
        if (!id) return undefined;
        return { url: `${produto(id)}/precos`, params: { pageSize: TAMANHO_DO_HISTORICO } };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<PrecoProduto[]>) },
    );
  }

  criar(dados: NovoProduto): Observable<Produto> {
    return this.http.post<ApiEnvelope<Produto>>(PRODUTOS, dados).pipe(map(({ data }) => data));
  }

  atualizar(id: string, alteracao: AlteracaoProduto): Observable<Produto> {
    return this.http
      .patch<ApiEnvelope<Produto>>(produto(id), alteracao)
      .pipe(map(({ data }) => data));
  }

  /** Substitui o preço vigente da combinação; o anterior fica no histórico. */
  definirPreco(id: string, preco: NovoPreco): Observable<Produto> {
    return this.http
      .post<ApiEnvelope<Produto>>(`${produto(id)}/precos`, preco)
      .pipe(map(({ data }) => data));
  }

  encerrarPreco(id: string, precoId: string): Observable<Produto> {
    return this.http
      .delete<ApiEnvelope<Produto>>(`${produto(id)}/precos/${encodeURIComponent(precoId)}`)
      .pipe(map(({ data }) => data));
  }
}
