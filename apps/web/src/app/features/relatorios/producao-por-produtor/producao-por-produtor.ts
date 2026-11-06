import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { iniciais } from '../../../core/layout/destinos';
import type { Periodo, ProducaoDoProdutor } from '../../../core/models/relatorios';
import { ProdutoresService } from '../../../core/services/produtores.service';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import {
  APARENCIA_DO_PREPARO,
  ChipPreparo,
} from '../../../shared/components/chip-preparo/chip-preparo';
import { Compartilhar } from '../../../shared/components/compartilhar/compartilhar';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { hoje } from '../../../shared/utils/datas';
import { type Arquivo, csv, reaisNoCsv } from '../../../shared/utils/arquivo';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { mensagemDoAReceber } from '../../../shared/utils/mensagens';
import { contagem, numero } from '../../../shared/utils/textos';
import { atalhosDoAReceber, estaSemana, periodoDaUrl } from '../periodo';
import { SeletorPeriodo } from '../seletor-periodo/seletor-periodo';

const TAMANHO_DA_PAGINA = 20;
const IDENTIFICADOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_DE_PRODUTORES = 100;

/**
 * Quanto cada produtor tem a receber no período: o valor dos salgados dele
 * menos a parte nos descontos, fiado incluído. Abre na semana atual.
 */
@Component({
  selector: 'ms-producao-por-produtor',
  imports: [
    ChipPreparo,
    Compartilhar,
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

  protected readonly periodo = computed(() =>
    periodoDaUrl(this.de(), this.ate(), hoje(), estaSemana),
  );
  protected readonly atalhos = atalhosDoAReceber(hoje());
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
  private readonly relatorios = inject(RelatoriosService);
  protected readonly recurso = this.relatorios.producaoPorProdutor(() => ({
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
  protected readonly iniciais = iniciais;
  protected readonly resumo = computed(() => {
    const resumo = this.resultado()?.resumo;
    return resumo ? contagem(resumo.unidades, 'salgado', 'salgados') : '';
  });
  /** Só quando todos do filtro estão na tela: a mensagem não pode deixar ninguém de fora. */
  protected readonly mensagem = computed(() => {
    const resultado = this.resultado();
    return resultado && resultado.meta.totalPages <= 1
      ? mensagemDoAReceber(this.periodo(), resultado.itens)
      : null;
  });

  /** Uma linha por salgado e, no fim de cada produtor, o desconto e o total a receber. */
  protected readonly planilha = async (): Promise<Arquivo> => {
    const { de, ate } = this.periodo();
    const producoes = await this.relatorios.todasAsPaginas<ProducaoDoProdutor>('producao', {
      de,
      ate,
      produtorId: this.produtorId(),
    });
    return csv(
      `a-receber-${de}-a-${ate}`,
      ['Produtor', 'Produto', 'Preparo', 'Salgados', 'Valor (R$)'],
      producoes.flatMap((producao) => [
        ...producao.itens.map((item) => [
          producao.produtor.nome,
          item.produto.nome,
          APARENCIA_DO_PREPARO[item.preparo].rotulo,
          item.unidades,
          reaisNoCsv(item.valorCentavos),
        ]),
        [producao.produtor.nome, 'Descontos', '', '', reaisNoCsv(-this.desconto(producao))],
        [
          producao.produtor.nome,
          'A receber',
          '',
          producao.unidades,
          reaisNoCsv(producao.aReceberCentavos),
        ],
      ]),
    );
  };

  /** A parte do produtor nos descontos dos pedidos. */
  protected desconto(producao: ProducaoDoProdutor): number {
    return producao.valorCentavos - producao.aReceberCentavos;
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
