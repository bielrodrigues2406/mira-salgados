import { Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  DiaDeProducao,
  ProducaoPorDia,
  SalgadoDoProdutor,
} from '../../../core/models/producao';
import { APARENCIA_DO_PREPARO } from '../../../shared/components/chip-preparo/chip-preparo';
import { Compartilhar } from '../../../shared/components/compartilhar/compartilhar';
import { type Arquivo, csv } from '../../../shared/utils/arquivo';
import { dataCurta } from '../../../shared/utils/datas';
import { mensagemDaSemana } from '../../../shared/utils/mensagens';
import { contagem, numero } from '../../../shared/utils/textos';

interface Referencia {
  id: string;
  nome: string;
}

interface TotalDoSalgado {
  chave: string;
  nome: string;
  unidades: number;
  porProdutor: Map<string, { nome: string; unidades: number }>;
}

/**
 * Modo semana: quanto cada produtor faz em cada dia, por salgado. Um filtro
 * mostra só um produtor; quem tem conta ligada a um produtor já abre com a
 * própria produção.
 */
@Component({
  selector: 'ms-producao-da-semana',
  imports: [Compartilhar, RouterLink],
  templateUrl: './producao-da-semana.html',
  styleUrl: './producao-da-semana.css',
})
export class ProducaoDaSemana {
  readonly producao = input.required<ProducaoPorDia>();
  readonly hoje = input.required<string>();
  /** Produtor da conta de quem está olhando, se houver. */
  readonly meuProdutorId = input<string | null>(null);

  protected readonly numero = numero;
  protected readonly contagem = contagem;
  protected readonly dataCurta = dataCurta;

  /** Produtores com produção no intervalo, em ordem alfabética. */
  protected readonly produtores = computed((): Referencia[] => {
    const vistos = new Map<string, Referencia>();
    for (const dia of this.producao().dias) {
      for (const carga of dia.produtores) vistos.set(carga.produtor.id, carga.produtor);
    }
    return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

  /**
   * Produtor escolhido no filtro, guardado pela tela de fora para sobreviver à
   * troca de período: undefined é "ainda não escolheu", null é "todos".
   */
  readonly escolha = model<string | null | undefined>(undefined);

  /** Sem escolha, começa no produtor da conta, se ele tiver produção no período. */
  protected readonly filtro = computed((): string | null => {
    const escolha = this.escolha();
    const ids = this.produtores().map(({ id }) => id);
    if (escolha !== undefined && (escolha === null || ids.includes(escolha))) return escolha;
    const meu = this.meuProdutorId();
    return meu && ids.includes(meu) ? meu : null;
  });

  protected readonly dias = computed(() => {
    const filtro = this.filtro();
    return this.producao().dias.map((dia): DiaDeProducao => {
      if (!filtro) return dia;
      const produtores = dia.produtores.filter((carga) => carga.produtor.id === filtro);
      return {
        ...dia,
        produtores,
        unidades: produtores.reduce((soma, carga) => soma + carga.unidades, 0),
      };
    });
  });

  /**
   * Quanto de cada salgado no período inteiro, do mais feito para o menos, e
   * quanto cada produtor faz dele. Responde "quanta massa de coxinha preciso".
   */
  protected readonly totaisPorSalgado = computed((): TotalDoSalgado[] => {
    const totais = new Map<string, TotalDoSalgado>();
    for (const dia of this.dias()) {
      for (const carga of dia.produtores) {
        for (const salgado of carga.salgados) {
          const chave = `${salgado.produto.id}|${salgado.preparo}`;
          const total = totais.get(chave) ?? {
            chave,
            nome: this.nomeDoSalgado(salgado),
            unidades: 0,
            porProdutor: new Map<string, { nome: string; unidades: number }>(),
          };
          total.unidades += salgado.unidades;
          const parte = total.porProdutor.get(carga.produtor.id) ?? {
            nome: carga.produtor.nome,
            unidades: 0,
          };
          parte.unidades += salgado.unidades;
          total.porProdutor.set(carga.produtor.id, parte);
          totais.set(chave, total);
        }
      }
    }
    return [...totais.values()].sort(
      (a, b) => b.unidades - a.unidades || a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  });

  /** "Mira 1.500 · Célia 300", só quando mais de um produtor faz o salgado. */
  protected divisao(total: TotalDoSalgado): string | null {
    if (total.porProdutor.size < 2) return null;
    return [...total.porProdutor.values()]
      .sort((a, b) => b.unidades - a.unidades)
      .map((parte) => `${parte.nome} ${numero(parte.unidades)}`)
      .join(' · ');
  }

  /** Total de cada produtor no período, para o filtro. */
  protected readonly totalDoProdutor = computed(() => {
    const totais = new Map<string, number>();
    for (const dia of this.producao().dias) {
      for (const carga of dia.produtores) {
        totais.set(carga.produtor.id, (totais.get(carga.produtor.id) ?? 0) + carga.unidades);
      }
    }
    return totais;
  });

  protected readonly total = computed(() =>
    this.dias().reduce((soma, dia) => soma + dia.unidades, 0),
  );

  /** Mensagem da semana, só do produtor escolhido quando há filtro. */
  protected readonly mensagem = computed(() => mensagemDaSemana(this.producao(), this.filtro()));

  protected readonly planilha = (): Arquivo => {
    const { de } = this.producao();
    return csv(
      `producao-da-semana-${de}`,
      ['Data', 'Produtor', 'Produto', 'Preparo', 'Salgados'],
      this.dias().flatMap((dia) =>
        dia.produtores.flatMap((carga) =>
          carga.salgados.map((salgado) => [
            dia.data,
            carga.produtor.nome,
            salgado.produto.nome,
            APARENCIA_DO_PREPARO[salgado.preparo].rotulo,
            salgado.unidades,
          ]),
        ),
      ),
    );
  };

  protected nomeDoSalgado(salgado: SalgadoDoProdutor): string {
    return salgado.preparo === 'FRITO'
      ? salgado.produto.nome
      : `${salgado.produto.nome} (${APARENCIA_DO_PREPARO[salgado.preparo].rotulo.toLowerCase()})`;
  }

  /** Hoje fica fora da URL, como na produção do dia. */
  protected linkDoDia(data: string): string | null {
    return data === this.hoje() ? null : data;
  }
}
