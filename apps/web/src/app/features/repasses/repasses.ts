import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, required, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import { iniciais } from '../../core/layout/destinos';
import type { SaldoDoProdutor } from '../../core/models/relatorios';
import type { FormaRepasse, Repasse } from '../../core/models/repasse';
import { mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { RelatoriosService } from '../../core/services/relatorios.service';
import { RepassesService } from '../../core/services/repasses.service';
import { ErrosDoCampo } from '../../shared/components/erros-do-campo/erros-do-campo';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import type { NomeIcone } from '../../shared/components/icone/icones';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { MoedaPipe } from '../../shared/pipes/moeda.pipe';
import { centavosDeTexto, centavosParaTexto, formatarMoeda } from '../../shared/utils/dinheiro';
import { dataCurta, hoje } from '../../shared/utils/datas';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';

const TAMANHO_DA_PAGINA = 20;
const LIMITE_DA_OBSERVACAO = 200;

const FORMAS: Record<FormaRepasse, { rotulo: string; icone: NomeIcone }> = {
  PIX: { rotulo: 'PIX', icone: 'pix' },
  DINHEIRO: { rotulo: 'Dinheiro', icone: 'dinheiro' },
};

interface DadosDoRepasse {
  forma: FormaRepasse;
  valor: string;
  data: string;
  observacao: string;
}

/**
 * Quanto cada produtor tem a receber pelos salgados que fez, quanto já recebeu
 * e o que falta (ADR 0017). Registrar repasse é opcional: o saldo acumula até
 * alguém registrar, quando e como a família quiser.
 */
@Component({
  selector: 'ms-repasses',
  imports: [
    ErrosDoCampo,
    EstadoErro,
    EstadoVazio,
    FormField,
    FormRoot,
    Icone,
    ListaEsqueleto,
    MoedaPipe,
    Paginacao,
  ],
  templateUrl: './repasses.html',
  styleUrl: './repasses.css',
})
export class Repasses {
  private readonly relatorios = inject(RelatoriosService);
  private readonly servico = inject(RepassesService);

  protected readonly hoje = hoje();
  protected readonly iniciais = iniciais;
  protected readonly dataCurta = dataCurta;
  protected readonly abs = Math.abs;
  protected readonly formas = (Object.keys(FORMAS) as FormaRepasse[]).map((forma) => ({
    forma,
    ...FORMAS[forma],
  }));
  protected readonly aparencia = FORMAS;

  protected readonly saldos = this.relatorios.saldos(() => this.hoje);
  protected readonly estado = estadoDeRecurso(
    this.saldos,
    ({ produtores }) => produtores.length === 0,
  );

  protected readonly filtro = signal<string | undefined>(undefined);
  protected readonly pagina = signal(1);
  protected readonly historico = this.servico.listar(() => ({
    page: this.pagina(),
    pageSize: TAMANHO_DA_PAGINA,
    produtorId: this.filtro(),
  }));
  protected readonly repasses = computed(() =>
    this.historico.hasValue() ? this.historico.value().itens : [],
  );
  protected readonly meta = computed(() =>
    this.historico.hasValue() ? this.historico.value().meta : undefined,
  );

  /** Produtor com o formulário aberto. */
  protected readonly registrandoPara = signal<SaldoDoProdutor | null>(null);
  protected readonly desfazendo = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroDoFormulario = signal<string | null>(null);
  /** Confirmação anunciada em região viva depois de cada gravação. */
  protected readonly aviso = signal('');

  private readonly valores = signal<DadosDoRepasse>({
    forma: 'PIX',
    valor: '',
    data: this.hoje,
    observacao: '',
  });

  protected readonly formulario = form(
    this.valores,
    (campo) => {
      required(campo.valor, { message: 'Informe o valor.' });
      validate(campo.valor, ({ value }) => {
        if (value().trim() === '') return undefined;
        const centavos = centavosDeTexto(value());
        if (centavos === null) return { kind: 'formato', message: 'Use um valor como 100,00.' };
        return centavos > 0
          ? undefined
          : { kind: 'minimo', message: 'O valor precisa ser maior que zero.' };
      });
      required(campo.data, { message: 'Informe a data.' });
      maxLength(campo.observacao, LIMITE_DA_OBSERVACAO, {
        message: `Use no máximo ${String(LIMITE_DA_OBSERVACAO)} caracteres.`,
      });
    },
    {
      submission: {
        action: async () => {
          const produtor = this.registrandoPara();
          const { forma, valor, data, observacao } = this.valores();
          const valorCentavos = centavosDeTexto(valor);
          if (!produtor || valorCentavos === null) return undefined;
          this.erroDoFormulario.set(null);
          try {
            await firstValueFrom(
              this.servico.registrar({
                produtorId: produtor.produtor.id,
                valorCentavos,
                forma,
                data,
                observacao: observacao.trim() || null,
              }),
            );
            this.registrandoPara.set(null);
            this.recarregar();
            this.aviso.set(
              `Repasse de ${formatarMoeda(valorCentavos)} para ${produtor.produtor.nome} registrado.`,
            );
          } catch (falha) {
            this.erroDoFormulario.set(mensagemDeErro(falha));
          }
          return undefined;
        },
      },
    },
  );

  /** Abre já com o que falta, o caso mais comum; quem pagou menos ajusta o valor. */
  protected abrir(saldo: SaldoDoProdutor): void {
    this.erro.set(null);
    this.erroDoFormulario.set(null);
    this.formulario().reset({
      forma: 'PIX',
      valor: saldo.faltaCentavos > 0 ? centavosParaTexto(saldo.faltaCentavos) : '',
      data: this.hoje,
      observacao: '',
    });
    this.registrandoPara.set(saldo);
  }

  protected filtrar(produtorId: string | undefined): void {
    this.filtro.set(produtorId);
    this.pagina.set(1);
  }

  protected rotuloDoDesfazer(repasse: Repasse): string {
    return `Desfazer repasse de ${formatarMoeda(repasse.valorCentavos)} para ${repasse.produtor.nome}`;
  }

  protected async desfazer(repasse: Repasse): Promise<void> {
    this.erro.set(null);
    try {
      await firstValueFrom(this.servico.desfazer(repasse.id));
      this.desfazendo.set(null);
      this.recarregar();
      this.aviso.set(
        `Repasse de ${formatarMoeda(repasse.valorCentavos)} para ${repasse.produtor.nome} desfeito.`,
      );
    } catch (falha) {
      this.erro.set(mensagemDeErro(falha));
    }
  }

  private recarregar(): void {
    this.saldos.reload();
    this.historico.reload();
  }
}
