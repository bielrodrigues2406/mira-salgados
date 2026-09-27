import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';

import {
  type NovoPreco,
  type PrecoProduto,
  type Preparo,
  PREPAROS,
  ROTULO_UNIDADE,
  type UnidadeVenda,
  UNIDADES_VENDA,
} from '../../../core/models/produto';
import { APARENCIA_DO_PREPARO } from '../../../shared/components/chip-preparo/chip-preparo';
import { ErrosDoCampo } from '../../../shared/components/erros-do-campo/erros-do-campo';
import { Icone } from '../../../shared/components/icone/icone';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { centavosDeTexto } from '../../../shared/utils/dinheiro';
import { idUnico } from '../../../shared/utils/id-unico';

/** Mesmo limite da API: R$ 999.999,99. */
const PRECO_MAXIMO_CENTAVOS = 99_999_999;

/** Grava o preço e devolve a mensagem de erro, ou null se deu certo. */
export type SalvarPreco = (preco: NovoPreco) => Promise<string | null>;

@Component({
  selector: 'ms-preco-formulario',
  imports: [ErrosDoCampo, FormField, FormRoot, Icone, MoedaPipe],
  templateUrl: './preco-formulario.html',
  styleUrl: './preco-formulario.css',
})
export class PrecoFormulario {
  /** Preços vigentes do produto, para avisar quando o novo substitui um deles. */
  readonly vigentes = input.required<readonly PrecoProduto[]>();
  readonly salvar = input.required<SalvarPreco>();
  readonly cancelar = output();

  protected readonly id = idUnico('preco');
  protected readonly preparos = PREPAROS.map((preparo) => ({
    valor: preparo,
    ...APARENCIA_DO_PREPARO[preparo],
  }));
  protected readonly unidades = UNIDADES_VENDA.map((unidade) => ({
    valor: unidade,
    rotulo: ROTULO_UNIDADE[unidade],
  }));
  protected readonly erro = signal<string | null>(null);
  private readonly campoPreco = viewChild.required<ElementRef<HTMLInputElement>>('campoPreco');

  private readonly valores = signal<{
    preparo: Preparo;
    unidadeVenda: UnidadeVenda;
    preco: string;
  }>({ preparo: 'FRITO', unidadeVenda: 'CENTO', preco: '' });

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.preco, { message: 'Informe o preço.' });
      validate(campo.preco, ({ value }) => {
        if (value().trim() === '') return undefined;
        const centavos = centavosDeTexto(value());
        if (centavos === null) return { kind: 'formato', message: 'Use um valor como 95,00.' };
        if (centavos <= 0)
          return { kind: 'minimo', message: 'O preço precisa ser maior que zero.' };
        if (centavos > PRECO_MAXIMO_CENTAVOS) {
          return { kind: 'maximo', message: 'O preço passa do limite de R$ 999.999,99.' };
        }
        return undefined;
      });
    },
    {
      submission: {
        action: async () => {
          this.erro.set(null);
          const { preparo, unidadeVenda, preco } = this.valores();
          const precoCentavos = centavosDeTexto(preco);
          if (precoCentavos === null) return undefined;
          this.erro.set(await this.salvar()({ preparo, unidadeVenda, precoCentavos }));
          return undefined;
        },
      },
    },
  );

  /** Preço vigente da combinação escolhida, que o novo vai substituir. */
  protected readonly substituido = computed(() => {
    const { preparo, unidadeVenda } = this.valores();
    return this.vigentes().find(
      (preco) => preco.preparo === preparo && preco.unidadeVenda === unidadeVenda,
    );
  });
  protected readonly combinacao = computed(() => {
    const { preparo, unidadeVenda } = this.valores();
    return `${APARENCIA_DO_PREPARO[preparo].rotulo} · ${ROTULO_UNIDADE[unidadeVenda]}`;
  });

  constructor() {
    afterNextRender(() => {
      this.campoPreco().nativeElement.focus();
    });
  }
}
