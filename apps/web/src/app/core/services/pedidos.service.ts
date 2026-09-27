import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope, Pagina } from '../models/api';
import type {
  AlteracaoItem,
  AlteracaoPedido,
  ConsultaPedidos,
  DadosPedido,
  NovoItem,
  NovoPagamento,
  PedidoDetalhe,
  PedidoResumo,
  StatusPedido,
} from '../models/pedido';
import { paginaDe, parametros } from './respostas';

const PEDIDOS = `${environment.apiUrl}/pedidos`;

function pedido(id: string): string {
  return `${PEDIDOS}/${encodeURIComponent(id)}`;
}

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly http = inject(HttpClient);

  /** Lista reativa; precisa de contexto de injeção. */
  listar(
    consulta: () => ConsultaPedidos | undefined,
  ): HttpResourceRef<Pagina<PedidoResumo> | undefined> {
    return httpResource(
      () => {
        const atual = consulta();
        return atual && { url: PEDIDOS, params: parametros({ ...atual }) };
      },
      { parse: (corpo) => paginaDe(corpo as ApiEnvelope<PedidoResumo[]>) },
    );
  }

  /** Agregado completo; sem id, não consulta. */
  detalhar(id: () => string | undefined): HttpResourceRef<PedidoDetalhe | undefined> {
    return httpResource(
      () => {
        const atual = id();
        return atual ? pedido(atual) : undefined;
      },
      { parse: (corpo) => (corpo as ApiEnvelope<PedidoDetalhe>).data },
    );
  }

  criar(dados: DadosPedido): Observable<PedidoDetalhe> {
    return this.agregado(this.http.post<ApiEnvelope<PedidoDetalhe>>(PEDIDOS, dados));
  }

  atualizar(id: string, alteracao: AlteracaoPedido): Observable<PedidoDetalhe> {
    return this.agregado(this.http.patch<ApiEnvelope<PedidoDetalhe>>(pedido(id), alteracao));
  }

  alterarStatus(id: string, status: StatusPedido): Observable<PedidoDetalhe> {
    return this.agregado(
      this.http.patch<ApiEnvelope<PedidoDetalhe>>(`${pedido(id)}/status`, { status }),
    );
  }

  adicionarItem(id: string, item: NovoItem): Observable<PedidoDetalhe> {
    return this.agregado(this.http.post<ApiEnvelope<PedidoDetalhe>>(`${pedido(id)}/itens`, item));
  }

  atualizarItem(id: string, itemId: string, alteracao: AlteracaoItem): Observable<PedidoDetalhe> {
    const url = `${pedido(id)}/itens/${encodeURIComponent(itemId)}`;
    return this.agregado(this.http.patch<ApiEnvelope<PedidoDetalhe>>(url, alteracao));
  }

  removerItem(id: string, itemId: string): Observable<PedidoDetalhe> {
    const url = `${pedido(id)}/itens/${encodeURIComponent(itemId)}`;
    return this.agregado(this.http.delete<ApiEnvelope<PedidoDetalhe>>(url));
  }

  registrarPagamento(id: string, pagamento: NovoPagamento): Observable<PedidoDetalhe> {
    return this.agregado(
      this.http.post<ApiEnvelope<PedidoDetalhe>>(`${pedido(id)}/pagamentos`, pagamento),
    );
  }

  estornarPagamento(id: string, pagamentoId: string): Observable<PedidoDetalhe> {
    const url = `${pedido(id)}/pagamentos/${encodeURIComponent(pagamentoId)}`;
    return this.agregado(this.http.delete<ApiEnvelope<PedidoDetalhe>>(url));
  }

  private agregado(requisicao: Observable<ApiEnvelope<PedidoDetalhe>>): Observable<PedidoDetalhe> {
    return requisicao.pipe(map(({ data }) => data));
  }
}
