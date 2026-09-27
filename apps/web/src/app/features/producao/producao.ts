import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RelatoriosService } from '../../core/services/relatorios.service';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import {
  dataPorExtenso,
  deTextoDeData,
  hoje,
  paraTextoDeData,
  somarDias,
} from '../../shared/utils/datas';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { ProducaoConsolidada } from './consolidado/producao-consolidada';
import { LinhaDoTempo } from './linha-do-tempo/linha-do-tempo';
import { contagem } from './textos';

export type ModoDaProducao = 'cronologico' | 'consolidado';

const FORMATO_DE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** A data da URL, se existir no calendário; 2026-02-30 não passa. */
function dataValida(texto: string | undefined): string | undefined {
  if (!texto || !FORMATO_DE_DATA.test(texto)) return undefined;
  return paraTextoDeData(deTextoDeData(texto)) === texto ? texto : undefined;
}

/**
 * Produção do dia. Data e modo ficam na URL (?data=AAAA-MM-DD&modo=consolidado):
 * voltar no navegador troca de dia, e o link pode ser mandado para quem produz.
 * Sem data, é hoje.
 */
@Component({
  selector: 'ms-producao',
  imports: [
    EstadoErro,
    EstadoVazio,
    Icone,
    LinhaDoTempo,
    ListaEsqueleto,
    ProducaoConsolidada,
    RouterLink,
  ],
  templateUrl: './producao.html',
  styleUrl: './producao.css',
})
export class Producao {
  /** Parâmetros de consulta, pela ligação de parâmetros a inputs. */
  readonly data = input<string>();
  readonly modo = input<string>();

  protected readonly hoje = hoje();
  protected readonly dia = computed(() => dataValida(this.data()) ?? this.hoje);
  protected readonly ehHoje = computed(() => this.dia() === this.hoje);
  protected readonly modoAtual = computed((): ModoDaProducao =>
    this.modo() === 'consolidado' ? 'consolidado' : 'cronologico',
  );
  protected readonly dataPorExtenso = computed(() => dataPorExtenso(this.dia()));
  /** Hoje fica fora da URL, para o endereço de todo dia ser só /producao. */
  protected readonly anterior = computed(() => this.naUrl(somarDias(this.dia(), -1)));
  protected readonly proximo = computed(() => this.naUrl(somarDias(this.dia(), 1)));

  protected readonly recurso = inject(RelatoriosService).producaoDoDia(() => this.dia());
  protected readonly producao = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, (dia) => dia.quantidadePedidos === 0);
  protected readonly resumo = computed(() => {
    const producao = this.producao();
    if (!producao) return '';
    return [
      contagem(producao.quantidadePedidos, 'encomenda confirmada', 'encomendas confirmadas'),
      contagem(producao.unidades, 'salgado', 'salgados'),
      contagem(producao.quantidadeProdutores, 'produtor', 'produtores'),
    ].join(' · ');
  });

  private naUrl(data: string): string | null {
    return data === this.hoje ? null : data;
  }
}
