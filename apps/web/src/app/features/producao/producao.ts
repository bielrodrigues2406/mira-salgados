import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { Periodo } from '../../core/models/relatorios';
import { AuthService } from '../../core/services/auth.service';
import { RelatoriosService } from '../../core/services/relatorios.service';
import { APARENCIA_DO_PREPARO } from '../../shared/components/chip-preparo/chip-preparo';
import { Compartilhar } from '../../shared/components/compartilhar/compartilhar';
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
import { type Arquivo, csv } from '../../shared/utils/arquivo';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { mensagemDaProducaoDoDia } from '../../shared/utils/mensagens';
import { ProducaoConsolidada } from './consolidado/producao-consolidada';
import { LinhaDoTempo } from './linha-do-tempo/linha-do-tempo';
import { ProducaoDaSemana } from './semana/producao-da-semana';
import { SeletorPeriodo } from '../relatorios/seletor-periodo/seletor-periodo';
import {
  atalhosDaProducao,
  MAXIMO_DE_DIAS_DA_PRODUCAO,
  periodoDaProducao,
  periodoVizinho,
} from './periodo-da-producao';
import { contagem } from '../../shared/utils/textos';

export type ModoDaProducao = 'cronologico' | 'consolidado' | 'semana';

/**
 * Produção do dia e de um período. Data, fim do período e modo ficam na URL
 * (?data=AAAA-MM-DD&ate=AAAA-MM-DD&modo=consolidado|semana): voltar no
 * navegador troca de dia, e o link pode ser mandado para quem produz. Sem
 * data, é hoje; no período, sem fim, são 7 dias.
 */
@Component({
  selector: 'ms-producao',
  imports: [
    Compartilhar,
    EstadoErro,
    EstadoVazio,
    Icone,
    LinhaDoTempo,
    ListaEsqueleto,
    ProducaoConsolidada,
    ProducaoDaSemana,
    RouterLink,
    SeletorPeriodo,
  ],
  templateUrl: './producao.html',
  styleUrl: './producao.css',
})
export class Producao {
  /** Parâmetros de consulta, pela ligação de parâmetros a inputs. */
  readonly data = input<string>();
  readonly modo = input<string>();
  readonly ate = input<string>();

  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly hoje = hoje();
  protected readonly dia = computed(() => dataDoCalendario(this.data()) ?? this.hoje);
  protected readonly ehHoje = computed(() => this.dia() === this.hoje);
  protected readonly modoAtual = computed((): ModoDaProducao => {
    const modo = this.modo();
    return modo === 'consolidado' || modo === 'semana' ? modo : 'cronologico';
  });
  protected readonly naSemana = computed(() => this.modoAtual() === 'semana');
  protected readonly periodo = computed(() =>
    periodoDaProducao(this.data(), this.ate(), this.hoje),
  );
  protected readonly atalhos = atalhosDaProducao(this.hoje);
  protected readonly maximoDeDias = MAXIMO_DE_DIAS_DA_PRODUCAO;
  protected readonly dataPorExtenso = computed(() => {
    const { de, ate } = this.periodo();
    return this.naSemana() ? `${dataCurta(de)} a ${dataCurta(ate)}` : dataPorExtenso(this.dia());
  });
  /** Hoje fica fora da URL, para o endereço de todo dia ser só /producao. */
  protected readonly anterior = computed(() =>
    this.naSemana()
      ? this.paraUrl(periodoVizinho(this.periodo(), -1))
      : { data: this.naUrl(somarDias(this.dia(), -1)) },
  );
  protected readonly proximo = computed(() =>
    this.naSemana()
      ? this.paraUrl(periodoVizinho(this.periodo(), 1))
      : { data: this.naUrl(somarDias(this.dia(), 1)) },
  );
  private readonly auth = inject(AuthService);
  protected readonly meuProdutorId = computed(() => this.auth.usuario()?.produtorId ?? null);

  private readonly relatorios = inject(RelatoriosService);
  protected readonly recurso = this.relatorios.producaoDoDia(() =>
    this.naSemana() ? undefined : this.dia(),
  );
  protected readonly semana = this.relatorios.producaoPorDia(() =>
    this.naSemana() ? this.periodo() : undefined,
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

  protected readonly mensagem = computed(() => {
    const producao = this.producao();
    return producao ? mensagemDaProducaoDoDia(this.dia(), producao) : null;
  });

  /** O consolidado do dia: uma linha por salgado, preparo e produtor. */
  protected readonly planilha = (): Arquivo => {
    const producao = this.producao();
    if (!producao) throw new Error('Produção ainda não carregada.');
    return csv(
      `producao-${this.dia()}`,
      ['Preparo', 'Produto', 'Produtor', 'Salgados', 'Centos', 'Avulsas', 'Pedidos'],
      producao.consolidado.flatMap((grupo) =>
        grupo.linhas.map((linha) => [
          APARENCIA_DO_PREPARO[grupo.preparo].rotulo,
          linha.produto.nome,
          linha.produtor.nome,
          linha.unidades,
          linha.centos,
          linha.avulsas,
          linha.pedidos.map((numero) => `#${String(numero)}`).join(' '),
        ]),
      ),
    );
  };

  /** Data escolhida no calendário do aparelho. */
  protected async irParaData(valor: string): Promise<void> {
    const data = dataDoCalendario(valor);
    if (!data || data === this.dia()) return;
    await this.navegar({ data: this.naUrl(data) });
  }

  protected async mudarPeriodo(periodo: Periodo): Promise<void> {
    await this.navegar(this.paraUrl(periodo));
  }

  /** No desktop, o clique no campo não abre o calendário sozinho. */
  protected abrirCalendario(campo: HTMLInputElement): void {
    try {
      campo.showPicker();
    } catch {
      // Sem showPicker, ou já aberto: o campo segue editável.
    }
  }

  private async navegar(queryParams: Record<string, string | null>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private paraUrl({ de, ate }: Periodo): Record<string, string | null> {
    return { data: this.naUrl(de), ate };
  }

  private naUrl(data: string): string | null {
    return data === this.hoje ? null : data;
  }
}
