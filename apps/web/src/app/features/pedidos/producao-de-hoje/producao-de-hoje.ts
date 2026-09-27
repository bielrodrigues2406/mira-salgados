import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RelatoriosService } from '../../../core/services/relatorios.service';
import { Icone } from '../../../shared/components/icone/icone';
import { hoje } from '../../../shared/utils/datas';
import { numero } from '../../../shared/utils/textos';

/**
 * Atalho da lista de pedidos para a produção de hoje, com a carga de cada
 * produtor. Some quando não há nada confirmado para hoje ou a consulta falha:
 * é um resumo, e a lista continua sendo o conteúdo principal da tela.
 */
@Component({
  selector: 'ms-producao-de-hoje',
  imports: [Icone, RouterLink],
  templateUrl: './producao-de-hoje.html',
  styleUrl: './producao-de-hoje.css',
})
export class ProducaoDeHoje {
  private readonly recurso = inject(RelatoriosService).producaoDoDia(() => hoje());

  protected readonly numero = numero;
  protected readonly produtores = computed(() =>
    this.recurso.hasValue() ? this.recurso.value().porProdutor : [],
  );
}
