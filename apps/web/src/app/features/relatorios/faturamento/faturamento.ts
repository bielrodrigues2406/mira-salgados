import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { Periodo } from '../../../core/models/relatorios';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { Compartilhar } from '../../../shared/components/compartilhar/compartilhar';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { dataCurta, hoje } from '../../../shared/utils/datas';
import { type Arquivo, csv, reaisNoCsv } from '../../../shared/utils/arquivo';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { contagem } from '../../../shared/utils/textos';
import { periodoDaUrl } from '../periodo';
import { SeletorPeriodo } from '../seletor-periodo/seletor-periodo';

/** Faturamento por período: métricas sintéticas e o faturamento de cada dia. */
@Component({
  selector: 'ms-faturamento',
  imports: [
    Compartilhar,
    EstadoErro,
    EstadoVazio,
    ListaEsqueleto,
    MoedaPipe,
    RouterLink,
    SeletorPeriodo,
  ],
  templateUrl: './faturamento.html',
  styleUrl: './faturamento.css',
})
export class Faturamento {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /** Parâmetros de consulta, pela ligação de parâmetros a inputs. */
  readonly de = input<string>();
  readonly ate = input<string>();

  protected readonly periodo = computed(() => periodoDaUrl(this.de(), this.ate(), hoje()));
  protected readonly recurso = inject(RelatoriosService).faturamento(() => this.periodo());
  protected readonly faturamento = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(
    this.recurso,
    (faturamento) => faturamento.quantidadePedidos === 0,
  );
  protected readonly legenda = computed(() => {
    const faturamento = this.faturamento();
    if (!faturamento) return '';
    return `${contagem(faturamento.quantidadePedidos, 'encomenda', 'encomendas')} · ${contagem(faturamento.unidades, 'salgado', 'salgados')}`;
  });
  /** Cada dia com a barra proporcional ao maior faturamento do período. */
  protected readonly dias = computed(() => {
    const porDia = this.faturamento()?.porDia ?? [];
    const maior = Math.max(1, ...porDia.map((dia) => dia.faturamentoCentavos));
    return porDia.map((dia) => ({
      ...dia,
      rotulo: dataCurta(dia.data),
      largura: (dia.faturamentoCentavos / maior) * 100,
      encomendas: contagem(dia.quantidadePedidos, 'encomenda', 'encomendas'),
    }));
  });

  /** Uma linha por dia com pedidos. */
  protected readonly planilha = (): Arquivo => {
    const faturamento = this.faturamento();
    if (!faturamento) throw new Error('Faturamento ainda não carregado.');
    return csv(
      `faturamento-${faturamento.de}-a-${faturamento.ate}`,
      ['Data', 'Encomendas', 'Faturamento (R$)'],
      faturamento.porDia.map((dia) => [
        dia.data,
        dia.quantidadePedidos,
        reaisNoCsv(dia.faturamentoCentavos),
      ]),
    );
  };

  protected async mudarPeriodo({ de, ate }: Periodo): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { de, ate },
      queryParamsHandling: 'merge',
    });
  }
}
