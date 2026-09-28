import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { RelatoriosService } from '../../core/services/relatorios.service';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import {
  dataCurta,
  dataDoCalendario,
  dataPorExtenso,
  hoje,
  somarDias,
} from '../../shared/utils/datas';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { ProducaoConsolidada } from './consolidado/producao-consolidada';
import { LinhaDoTempo } from './linha-do-tempo/linha-do-tempo';
import { ProducaoDaSemana } from './semana/producao-da-semana';
import { contagem } from '../../shared/utils/textos';

export type ModoDaProducao = 'cronologico' | 'consolidado' | 'semana';

/** A semana é o dia escolhido e os seis seguintes. */
const DIAS_DA_SEMANA = 7;

/**
 * Produção do dia e da semana. Data e modo ficam na URL
 * (?data=AAAA-MM-DD&modo=consolidado|semana): voltar no navegador troca de dia,
 * e o link pode ser mandado para quem produz. Sem data, é hoje.
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
    ProducaoDaSemana,
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
  protected readonly dia = computed(() => dataDoCalendario(this.data()) ?? this.hoje);
  protected readonly ehHoje = computed(() => this.dia() === this.hoje);
  protected readonly modoAtual = computed((): ModoDaProducao => {
    const modo = this.modo();
    return modo === 'consolidado' || modo === 'semana' ? modo : 'cronologico';
  });
  protected readonly naSemana = computed(() => this.modoAtual() === 'semana');
  private readonly passo = computed(() => (this.naSemana() ? DIAS_DA_SEMANA : 1));
  private readonly fimDaSemana = computed(() => somarDias(this.dia(), DIAS_DA_SEMANA - 1));
  protected readonly dataPorExtenso = computed(() =>
    this.naSemana()
      ? `${dataCurta(this.dia())} a ${dataCurta(this.fimDaSemana())}`
      : dataPorExtenso(this.dia()),
  );
  /** Hoje fica fora da URL, para o endereço de todo dia ser só /producao. */
  protected readonly anterior = computed(() => this.naUrl(somarDias(this.dia(), -this.passo())));
  protected readonly proximo = computed(() => this.naUrl(somarDias(this.dia(), this.passo())));
  private readonly auth = inject(AuthService);
  protected readonly meuProdutorId = computed(() => this.auth.usuario()?.produtorId ?? null);

  private readonly relatorios = inject(RelatoriosService);
  protected readonly recurso = this.relatorios.producaoDoDia(() =>
    this.naSemana() ? undefined : this.dia(),
  );
  protected readonly semana = this.relatorios.producaoPorDia(() =>
    this.naSemana() ? { de: this.dia(), ate: this.fimDaSemana() } : undefined,
  );
  protected readonly estadoDaSemana = estadoDeRecurso(this.semana, () => false);
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
