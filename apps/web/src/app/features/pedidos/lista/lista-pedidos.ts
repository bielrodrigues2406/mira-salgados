import { Component, computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Pagina, PaginacaoMeta } from '../../../core/models/api';
import {
  type ConsultaPedidos,
  type PedidoResumo,
  STATUS_PEDIDO,
  type StatusPedido,
} from '../../../core/models/pedido';
import { PedidosService } from '../../../core/services/pedidos.service';
import { APARENCIA_DO_STATUS } from '../../../shared/components/chip-status/chip-status';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import { dataCurta, hoje, somarDias } from '../../../shared/utils/datas';
import { type EstadoDeRecurso, estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { CartaoPedido } from '../cartao-pedido/cartao-pedido';
import { ProducaoDeHoje } from '../producao-de-hoje/producao-de-hoje';

const TAMANHO_DA_SECAO = 10;
const ESPERA_DA_BUSCA_MS = 300;

type Filtro = Pick<ConsultaPedidos, 'de' | 'ate' | 'ordem'>;

interface Secao {
  chave: string;
  titulo: string;
  destaque: boolean;
  pagina: ReturnType<typeof signal<number>>;
  recurso: { reload(): boolean; error: Signal<unknown> };
  estado: Signal<EstadoDeRecurso>;
  itens: Signal<PedidoResumo[]>;
  meta: Signal<PaginacaoMeta | undefined>;
}

@Component({
  selector: 'ms-lista-pedidos',
  imports: [
    CartaoPedido,
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    Paginacao,
    ProducaoDeHoje,
    RouterLink,
  ],
  templateUrl: './lista-pedidos.html',
  styleUrl: './lista-pedidos.css',
})
export class ListaPedidos {
  private readonly servico = inject(PedidosService);

  protected readonly hoje = hoje();
  protected readonly termo = signal('');
  private readonly busca = signal('');
  protected readonly filtrosAbertos = signal(false);
  protected readonly statusFiltrados = signal<readonly StatusPedido[]>([]);
  protected readonly opcoesDeStatus = STATUS_PEDIDO.map((status) => ({
    status,
    rotulo: APARENCIA_DO_STATUS[status].rotulo,
  }));
  protected readonly filtrando = computed(
    () => this.busca() !== '' || this.statusFiltrados().length > 0,
  );

  private readonly vencemHoje = this.servico.listar(() => ({
    page: 1,
    pageSize: 1,
    de: this.hoje,
    ate: this.hoje,
    status: ['RASCUNHO', 'CONFIRMADO'],
  }));
  protected readonly quantidadeHoje = computed(() =>
    this.vencemHoje.hasValue() ? this.vencemHoje.value().meta.total : null,
  );

  protected readonly secoes: Secao[] = [
    this.secao('hoje', `Hoje · ${dataCurta(this.hoje).toLowerCase()}`, true, {
      de: this.hoje,
      ate: this.hoje,
      ordem: 'asc',
    }),
    this.secao('proximas', 'Próximas', false, { de: somarDias(this.hoje, 1), ordem: 'asc' }),
    this.secao('anteriores', 'Anteriores', false, { ate: somarDias(this.hoje, -1), ordem: 'desc' }),
  ];

  /** Estado da tela: esqueleto até todas as seções responderem; erro se alguma falhar. */
  protected readonly estado = computed((): EstadoDeRecurso => {
    const estados = this.secoes.map((secao) => secao.estado());
    if (estados.includes('erro')) return 'erro';
    if (estados.includes('tentando')) return 'tentando';
    if (estados.includes('carregando')) return 'carregando';
    return estados.every((estado) => estado === 'vazio') ? 'vazio' : 'pronto';
  });
  protected readonly erro = computed(() =>
    this.secoes.find((secao) => secao.estado() === 'erro')?.recurso.error(),
  );

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
    });
  }

  protected aoDigitarBusca(valor: string): void {
    this.termo.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.busca.set(valor.trim());
      this.voltarAoInicio();
    }, ESPERA_DA_BUSCA_MS);
  }

  protected alternarFiltro(status: StatusPedido | null): void {
    this.statusFiltrados.update((atuais) => {
      if (status === null) return [];
      return atuais.includes(status)
        ? atuais.filter((atual) => atual !== status)
        : [...atuais, status];
    });
    this.voltarAoInicio();
  }

  protected limparFiltros(): void {
    clearTimeout(this.temporizador);
    this.termo.set('');
    this.busca.set('');
    this.statusFiltrados.set([]);
    this.voltarAoInicio();
  }

  protected tentarNovamente(): void {
    for (const secao of this.secoes) {
      if (secao.estado() === 'erro') secao.recurso.reload();
    }
  }

  private voltarAoInicio(): void {
    for (const secao of this.secoes) secao.pagina.set(1);
  }

  private secao(chave: string, titulo: string, destaque: boolean, filtro: Filtro): Secao {
    const pagina = signal(1);
    const recurso = this.servico.listar(() => {
      const status = this.statusFiltrados();
      return {
        ...filtro,
        page: pagina(),
        pageSize: TAMANHO_DA_SECAO,
        busca: this.busca() || undefined,
        status: status.length > 0 ? [...status] : undefined,
      };
    });
    const valor = computed((): Pagina<PedidoResumo> | undefined =>
      recurso.hasValue() ? recurso.value() : undefined,
    );
    return {
      chave,
      titulo,
      destaque,
      pagina,
      recurso,
      estado: estadoDeRecurso(recurso, ({ itens }) => itens.length === 0),
      itens: computed(() => valor()?.itens ?? []),
      meta: computed(() => valor()?.meta),
    };
  }
}
