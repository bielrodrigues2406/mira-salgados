import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Preparo } from '../../../core/models/produto';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { APARENCIA_DO_PREPARO } from '../../../shared/components/chip-preparo/chip-preparo';
import { Icone } from '../../../shared/components/icone/icone';
import { hoje } from '../../../shared/utils/datas';
import { idUnico } from '../../../shared/utils/id-unico';
import { contagem, numero } from '../../../shared/utils/textos';

/** Acima disso a lista aberta pararia de ser um resumo; o resto fica na produção. */
export const MAXIMO_DE_SALGADOS = 5;

export interface SalgadoDoProdutor {
  chave: string;
  produto: string;
  preparo: Preparo;
  unidades: number;
}

/**
 * Atalho da lista de pedidos para a produção de hoje, com a carga de cada
 * produtor. Tocar num produtor abre, no próprio cartão, o que ele tem que
 * fazer; tocar de novo fecha. Começa fechado para não empurrar os pedidos
 * para baixo. Some quando não há nada confirmado para hoje ou a consulta
 * falha: é um resumo, e a lista continua sendo o conteúdo principal da tela.
 */
@Component({
  selector: 'ms-producao-de-hoje',
  imports: [Icone, RouterLink],
  templateUrl: './producao-de-hoje.html',
  styleUrl: './producao-de-hoje.css',
})
export class ProducaoDeHoje {
  private readonly recurso = inject(RelatoriosService).producaoDoDia(() => hoje());
  private readonly producao = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );

  protected readonly idDetalhe = idUnico('producao-do-produtor');
  protected readonly numero = numero;
  protected readonly preparos = APARENCIA_DO_PREPARO;
  protected readonly produtores = computed(() => this.producao()?.porProdutor ?? []);
  protected readonly aberto = signal<string | null>(null);

  protected readonly produtorAberto = computed(() => {
    const id = this.aberto();
    return this.produtores().find((carga) => carga.produtor.id === id);
  });

  /** Salgados do produtor aberto, do maior volume para o menor, a partir do consolidado. */
  private readonly salgados = computed((): SalgadoDoProdutor[] => {
    const id = this.aberto();
    if (!id) return [];
    return (this.producao()?.consolidado ?? [])
      .flatMap((grupo) =>
        grupo.linhas
          .filter((linha) => linha.produtor.id === id)
          .map((linha) => ({
            chave: `${linha.produto.id}|${grupo.preparo}`,
            produto: linha.produto.nome,
            preparo: grupo.preparo,
            unidades: linha.unidades,
          })),
      )
      .sort((a, b) => b.unidades - a.unidades || a.produto.localeCompare(b.produto, 'pt-BR'));
  });
  protected readonly salgadosVisiveis = computed(() =>
    this.salgados().slice(0, MAXIMO_DE_SALGADOS),
  );
  protected readonly restantes = computed(() => {
    const fora = this.salgados().length - MAXIMO_DE_SALGADOS;
    return fora > 0 ? `+${contagem(fora, 'item', 'itens')}` : null;
  });

  protected alternar(id: string): void {
    this.aberto.update((atual) => (atual === id ? null : id));
  }
}
