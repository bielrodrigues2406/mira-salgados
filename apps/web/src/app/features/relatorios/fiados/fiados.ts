import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { ClienteComFiado } from '../../../core/models/relatorios';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { Compartilhar } from '../../../shared/components/compartilhar/compartilhar';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import {
  type ClienteEscolhido,
  SeletorCliente,
} from '../../../shared/components/seletor-cliente/seletor-cliente';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { type Arquivo, csv, reaisNoCsv } from '../../../shared/utils/arquivo';
import { dataCurta, hoje } from '../../../shared/utils/datas';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { mensagemDeCobranca } from '../../../shared/utils/mensagens';
import { contagem } from '../../../shared/utils/textos';
import { linkDoWhatsApp } from '../../../shared/utils/whatsapp';

const TAMANHO_DA_PAGINA = 20;
const IDENTIFICADOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fiados em aberto, de qualquer data: o fiado registrado de cada pedido,
 * limitado ao que ainda falta receber dele.
 */
@Component({
  selector: 'ms-fiados',
  imports: [
    Compartilhar,
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    MoedaPipe,
    Paginacao,
    RouterLink,
    SeletorCliente,
    TelefonePipe,
  ],
  templateUrl: './fiados.html',
  styleUrl: './fiados.css',
})
export class Fiados {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /** Parâmetro de consulta, pela ligação de parâmetros a inputs. */
  readonly cliente = input<string>();

  /** Cliente da URL; um valor malformado é ignorado em vez de virar erro 400. */
  protected readonly clienteId = computed(() => {
    const id = this.cliente();
    return id !== undefined && IDENTIFICADOR.test(id) ? id : undefined;
  });
  /** Volta à primeira página quando o filtro muda. */
  protected readonly paginaAtual = linkedSignal({ source: this.clienteId, computation: () => 1 });
  private readonly relatorios = inject(RelatoriosService);
  protected readonly recurso = this.relatorios.fiados(() => ({
    page: this.paginaAtual(),
    pageSize: TAMANHO_DA_PAGINA,
    clienteId: this.clienteId(),
  }));
  protected readonly resultado = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, ({ itens }) => itens.length === 0);
  protected readonly dataCurta = dataCurta;
  protected readonly legenda = computed(() => {
    const resultado = this.resultado();
    if (!resultado) return '';
    return `${contagem(resultado.meta.total, 'cliente', 'clientes')} · ${contagem(resultado.resumo.quantidadePedidos, 'pedido', 'pedidos')}`;
  });

  /** Nome do cliente filtrado, para o seletor mostrar quem está escolhido ao abrir o link. */
  protected readonly clienteFiltrado = computed((): ClienteEscolhido | null => {
    const id = this.clienteId();
    const encontrado = this.resultado()?.itens.find((fiado) => fiado.cliente.id === id);
    return encontrado ? encontrado.cliente : null;
  });

  protected async filtrar(id: string): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { cliente: id || null },
      queryParamsHandling: 'merge',
    });
  }

  protected telefoneParaLigar(fiado: ClienteComFiado): string | null {
    return fiado.cliente.telefone ? `tel:+55${fiado.cliente.telefone}` : null;
  }

  /** Lembrete pronto, na conversa com o cliente. */
  protected cobrancaNoWhatsApp(fiado: ClienteComFiado): string | null {
    return fiado.cliente.telefone
      ? linkDoWhatsApp(mensagemDeCobranca(fiado), fiado.cliente.telefone)
      : null;
  }

  /** Uma linha por pedido com fiado em aberto, de todos os clientes do filtro. */
  protected readonly planilha = async (): Promise<Arquivo> => {
    const fiados = await this.relatorios.todasAsPaginas<ClienteComFiado>('fiados', {
      clienteId: this.clienteId(),
    });
    return csv(
      `fiados-${hoje()}`,
      ['Cliente', 'Telefone', 'Pedido', 'Entrega', 'Em aberto (R$)'],
      fiados.flatMap((fiado) =>
        fiado.pedidos.map((pedido) => [
          fiado.cliente.nome,
          fiado.cliente.telefone,
          pedido.numero,
          pedido.dataEntrega,
          reaisNoCsv(pedido.emAbertoCentavos),
        ]),
      ),
    );
  };
}
