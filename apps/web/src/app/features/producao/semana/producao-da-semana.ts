import { Component, computed, input, linkedSignal } from '@angular/core';
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

  /** null é "todos". Começa no produtor da conta, se ele tiver produção na semana. */
  protected readonly filtro = linkedSignal((): string | null => {
    const meu = this.meuProdutorId();
    return meu && this.produtores().some((produtor) => produtor.id === meu) ? meu : null;
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
