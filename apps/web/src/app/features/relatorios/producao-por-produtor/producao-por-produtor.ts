import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { iniciais } from '../../../core/layout/destinos';
import type { Periodo, ProducaoDoProdutor } from '../../../core/models/relatorios';
import { ProdutoresService } from '../../../core/services/produtores.service';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { ChipPreparo } from '../../../shared/components/chip-preparo/chip-preparo';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { hoje } from '../../../shared/utils/datas';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { contagem, numero, percentual } from '../../../shared/utils/textos';
import { periodoDaUrl } from '../periodo';
import { SeletorPeriodo } from '../seletor-periodo/seletor-periodo';

const TAMANHO_DA_PAGINA = 20;
const IDENTIFICADOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DE_PRODUTORES = 100;

/** Produção agregada por produtor no período, com o que cada um fez. */
@Component({
  selector: 'ms-producao-por-produtor',
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
  templateUrl: './producao-por-produtor.html',
  styleUrl: './producao-por-produtor.css',
})
export class ProducaoPorProdutor {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly de = input<string>();
  readonly ate = input<string>();
  readonly produtor = input<string>();

  protected readonly periodo = computed(() => periodoDaUrl(this.de(), this.ate(), hoje()));
  /** Produtor da URL; um valor malformado é ignorado em vez de virar erro 400. */
  protected readonly produtorId = computed(() => {
    const id = this.produtor();
    return id !== undefined && IDENTIFICADOR.test(id) ? id : undefined;
  });
  /** Volta à primeira página quando o período ou o produtor mudam. */
  protected readonly paginaAtual = linkedSignal({
    source: () => [this.periodo(), this.produtorId()],
    computation: () => 1,
  });
  protected readonly recurso = inject(RelatoriosService).producaoPorProdutor(() => ({
    ...this.periodo(),
    produtorId: this.produtorId(),
    page: this.paginaAtual(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly resultado = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, ({ itens }) => itens.length === 0);

  private readonly cadastro = inject(ProdutoresService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_PRODUTORES,
  }));
  protected readonly produtores = computed(() =>
    this.cadastro.hasValue()
      ? this.cadastro.value().itens.map(({ id, nome }) => ({ id, nome }))
      : [],
  );

  protected readonly numero = numero;
  protected readonly percentual = percentual;
  protected readonly iniciais = iniciais;
  protected readonly resumo = computed(() => {
    const resumo = this.resultado()?.resumo;
    return resumo ? contagem(resumo.unidades, 'salgado', 'salgados') : '';
  });

  protected participacao(producao: ProducaoDoProdutor): number {
    const total = this.resultado()?.resumo.unidades ?? 0;
    return total > 0 ? Math.round((producao.unidades / total) * 1000) / 10 : 0;
  }

  protected detalhe(producao: ProducaoDoProdutor): string {
    return `${contagem(producao.unidades, 'salgado', 'salgados')} · ${contagem(producao.quantidadePedidos, 'pedido', 'pedidos')}`;
  }

  protected async mudarPeriodo({ de, ate }: Periodo): Promise<void> {
    await this.navegar({ de, ate });
  }

  protected async filtrarProdutor(id: string): Promise<void> {
    await this.navegar({ produtor: id || null });
  }

  private async navegar(queryParams: Record<string, string | null>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
