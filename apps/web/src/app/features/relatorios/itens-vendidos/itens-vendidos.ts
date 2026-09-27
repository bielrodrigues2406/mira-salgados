import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { ItemVendido, Periodo } from '../../../core/models/relatorios';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { ChipPreparo } from '../../../shared/components/chip-preparo/chip-preparo';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { hoje } from '../../../shared/utils/datas';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { contagem, numero } from '../../../shared/utils/textos';
import { periodoDaUrl } from '../periodo';
import { SeletorPeriodo } from '../seletor-periodo/seletor-periodo';

const TAMANHO_DA_PAGINA = 20;

/** Ranking de produto e preparo por unidades vendidas no período. */
@Component({
  selector: 'ms-itens-vendidos',
  imports: [
    ChipPreparo,
    EstadoErro,
    EstadoVazio,
    ListaEsqueleto,
    MoedaPipe,
    Paginacao,
    RouterLink,
    SeletorPeriodo,
  ],
  templateUrl: './itens-vendidos.html',
  styleUrl: './itens-vendidos.css',
})
export class ItensVendidos {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly de = input<string>();
  readonly ate = input<string>();

  protected readonly periodo = computed(() => periodoDaUrl(this.de(), this.ate(), hoje()));
  /** Volta à primeira página quando o período muda. */
  protected readonly paginaAtual = linkedSignal({ source: this.periodo, computation: () => 1 });
  protected readonly recurso = inject(RelatoriosService).itensVendidos(() => ({
    ...this.periodo(),
    page: this.paginaAtual(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly resultado = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, ({ itens }) => itens.length === 0);
  protected readonly numero = numero;
  protected readonly resumo = computed(() => {
    const unidades = this.resultado()?.resumo.unidades ?? 0;
    return `${contagem(unidades, 'salgado vendido', 'salgados vendidos')} no período`;
  });

  /** Participação no volume do período, que dá a largura da barra. */
  protected participacao(item: ItemVendido): number {
    const total = this.resultado()?.resumo.unidades ?? 0;
    return total > 0 ? (item.unidades / total) * 100 : 0;
  }

  protected detalhe(item: ItemVendido): string {
    return contagem(item.quantidadePedidos, 'pedido', 'pedidos');
  }

  protected async mudarPeriodo({ de, ate }: Periodo): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { de, ate },
      queryParamsHandling: 'merge',
    });
  }
}
