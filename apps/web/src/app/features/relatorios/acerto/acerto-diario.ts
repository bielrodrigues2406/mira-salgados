import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { RelatoriosService } from '../../../core/services/relatorios.service';
import { Compartilhar } from '../../../shared/components/compartilhar/compartilhar';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { SeletorData } from '../../../shared/components/seletor-data/seletor-data';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { type Arquivo, csv, reaisNoCsv } from '../../../shared/utils/arquivo';
import { dataDoCalendario, hoje } from '../../../shared/utils/datas';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { mensagemDoAcerto } from '../../../shared/utils/mensagens';
import { contagem, listaDePedidos, percentuaisInteiros } from '../../../shared/utils/textos';
import { CartaoProdutor } from './cartao-produtor/cartao-produtor';

/**
 * Acerto de uma data: síntese, caixa por forma de recebimento e divisão entre
 * produtores. A data fica na URL (?data=AAAA-MM-DD); sem ela, é hoje.
 */
@Component({
  selector: 'ms-acerto-diario',
  imports: [
    CartaoProdutor,
    Compartilhar,
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    MoedaPipe,
    RouterLink,
    SeletorData,
  ],
  templateUrl: './acerto-diario.html',
  styleUrl: './acerto-diario.css',
})
export class AcertoDiario {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  /** Parâmetro de consulta, pela ligação de parâmetros a inputs. */
  readonly data = input<string>();

  private readonly hoje = hoje();
  protected readonly dia = computed(() => dataDoCalendario(this.data()) ?? this.hoje);
  protected readonly recurso = inject(RelatoriosService).acerto(() => this.dia());
  protected readonly acerto = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, (dia) => dia.quantidadePedidos === 0);

  protected readonly unidades = computed(() =>
    contagem(this.acerto()?.unidades ?? 0, 'salgado', 'salgados'),
  );
  /** Caixa, fiado e sem pagamento, em percentuais que somam 100. */
  protected readonly distribuicao = computed(() => {
    const acerto = this.acerto();
    if (!acerto) return { caixa: 0, fiado: 0, semPagamento: 0 };
    const [caixa = 0, fiado = 0, semPagamento = 0] = percentuaisInteiros([
      acerto.caixa.totalCentavos,
      acerto.fiado.valorCentavos,
      acerto.semPagamento.valorCentavos,
    ]);
    return { caixa, fiado, semPagamento };
  });
  protected readonly descricaoDaBarra = computed(() => {
    const { caixa, fiado, semPagamento } = this.distribuicao();
    return `Distribuição do valor movimentado: ${String(caixa)}% em caixa, ${String(fiado)}% em fiado, ${String(semPagamento)}% sem pagamento registrado`;
  });
  protected readonly pedidosComFiado = computed(() =>
    listaDePedidos(this.acerto()?.fiado.pedidos ?? []),
  );
  protected readonly pedidosSemPagamento = computed(() => {
    const lista = listaDePedidos(this.acerto()?.semPagamento.pedidos ?? []);
    return lista.charAt(0).toUpperCase() + lista.slice(1);
  });
  protected readonly mensagem = computed(() => {
    const acerto = this.acerto();
    return acerto ? mensagemDoAcerto(acerto) : null;
  });

  /** Uma linha por produtor e as linhas do caixa, para conferir numa planilha. */
  protected readonly planilha = (): Arquivo => {
    const acerto = this.acerto();
    if (!acerto) throw new Error('Acerto ainda não carregado.');
    const produtores = acerto.produtores.map((parte) => [
      parte.produtor.nome,
      parte.unidades,
      reaisNoCsv(parte.valorItensCentavos),
      reaisNoCsv(parte.descontoCentavos),
      reaisNoCsv(parte.valorProduzidoCentavos),
    ]);
    return csv(
      `acerto-${acerto.data}`,
      ['Produtor', 'Salgados', 'Itens (R$)', 'Descontos (R$)', 'A receber pelo dia (R$)'],
      [
        ...produtores,
        [],
        ['Entrou: PIX', null, null, null, reaisNoCsv(acerto.caixa.pixCentavos)],
        ['Entrou: dinheiro', null, null, null, reaisNoCsv(acerto.caixa.dinheiroCentavos)],
        ['Fiado', null, null, null, reaisNoCsv(acerto.fiado.valorCentavos)],
        ['Sem pagamento', null, null, null, reaisNoCsv(acerto.semPagamento.valorCentavos)],
        [
          'Valor movimentado',
          acerto.unidades,
          null,
          null,
          reaisNoCsv(acerto.valorMovimentadoCentavos),
        ],
      ],
    );
  };

  protected async irPara(data: string): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.rota,
      queryParams: { data: data === this.hoje ? null : data },
      queryParamsHandling: 'merge',
    });
  }
}
