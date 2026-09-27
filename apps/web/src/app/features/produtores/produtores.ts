import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, FormRoot, maxLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { iniciais } from '../../core/layout/destinos';
import type { AlteracaoProdutor, Produtor } from '../../core/models/produtor';
import { codigoDeErro, mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { ProdutoresService } from '../../core/services/produtores.service';
import { Chip } from '../../shared/components/chip/chip';
import { ErrosDoCampo } from '../../shared/components/erros-do-campo/erros-do-campo';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';

const TAMANHO_DA_PAGINA = 20;
const LIMITE_DO_NOME = 80;
const NOME_OBRIGATORIO = 'Informe o nome.';
const NOME_LONGO = `Use no máximo ${String(LIMITE_DO_NOME)} caracteres.`;
const NOME_DUPLICADO = 'PRODUTOR_JA_EXISTE';

@Component({
  selector: 'ms-produtores',
  imports: [
    Chip,
    ErrosDoCampo,
    EstadoErro,
    EstadoVazio,
    FormField,
    FormRoot,
    Icone,
    ListaEsqueleto,
    Paginacao,
    RouterLink,
  ],
  templateUrl: './produtores.html',
  styleUrl: './produtores.css',
})
export class Produtores {
  private readonly servico = inject(ProdutoresService);
  private readonly injector = inject(Injector);

  protected readonly iniciais = iniciais;
  protected readonly pagina = signal(1);
  protected readonly produtores = this.servico.listar(() => ({
    page: this.pagina(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly estado = estadoDeRecurso(this.produtores, ({ itens }) => itens.length === 0);
  protected readonly itens = computed(() =>
    this.produtores.hasValue() ? this.produtores.value().itens : [],
  );
  protected readonly meta = computed(() =>
    this.produtores.hasValue() ? this.produtores.value().meta : undefined,
  );
  /** Confirmação anunciada em região viva depois de cada gravação. */
  protected readonly aviso = signal('');

  private readonly campoNovo = viewChild<ElementRef<HTMLInputElement>>('campoNovo');
  private readonly campoEdicao = viewChild<ElementRef<HTMLInputElement>>('campoEdicao');

  protected readonly formularioAberto = signal(false);
  protected readonly erroNovo = signal<string | null>(null);
  private readonly novo = signal({ nome: '' });
  protected readonly formularioNovo = form(
    this.novo,
    (campo) => {
      required(campo.nome, { message: NOME_OBRIGATORIO });
      maxLength(campo.nome, LIMITE_DO_NOME, { message: NOME_LONGO });
    },
    {
      submission: {
        action: async (campo) => {
          this.erroNovo.set(null);
          try {
            const produtor = await firstValueFrom(
              this.servico.criar({ nome: this.novo().nome.trim() }),
            );
            this.fecharFormulario();
            this.concluir(`Cadastro de ${produtor.nome} salvo.`);
            return undefined;
          } catch (falha) {
            if (codigoDeErro(falha) === NOME_DUPLICADO) {
              return { kind: 'duplicado', message: mensagemDeErro(falha), fieldTree: campo.nome };
            }
            this.erroNovo.set(mensagemDeErro(falha));
            return undefined;
          }
        },
      },
    },
  );

  protected readonly emEdicao = signal<Produtor | null>(null);
  protected readonly erroEdicao = signal<string | null>(null);
  private readonly edicao = signal({ nome: '', ativo: true });
  protected readonly formularioEdicao = form(
    this.edicao,
    (campo) => {
      required(campo.nome, { message: NOME_OBRIGATORIO });
      maxLength(campo.nome, LIMITE_DO_NOME, { message: NOME_LONGO });
    },
    {
      submission: {
        action: async (campo) => {
          const original = this.emEdicao();
          if (!original) return undefined;
          this.erroEdicao.set(null);

          const alteracao = this.alteracoes(original);
          if (Object.keys(alteracao).length === 0) {
            this.cancelarEdicao();
            return undefined;
          }
          try {
            const produtor = await firstValueFrom(this.servico.atualizar(original.id, alteracao));
            this.emEdicao.set(null);
            this.concluir(`Alterações de ${produtor.nome} salvas.`);
            return undefined;
          } catch (falha) {
            if (codigoDeErro(falha) === NOME_DUPLICADO) {
              return { kind: 'duplicado', message: mensagemDeErro(falha), fieldTree: campo.nome };
            }
            this.erroEdicao.set(mensagemDeErro(falha));
            return undefined;
          }
        },
      },
    },
  );

  protected abrirFormulario(): void {
    this.cancelarEdicao();
    this.formularioAberto.set(true);
    this.focar(this.campoNovo);
  }

  protected fecharFormulario(): void {
    this.formularioAberto.set(false);
    this.erroNovo.set(null);
    this.formularioNovo().reset({ nome: '' });
  }

  protected editar(produtor: Produtor): void {
    this.fecharFormulario();
    this.erroEdicao.set(null);
    this.formularioEdicao().reset({ nome: produtor.nome, ativo: produtor.ativo });
    this.emEdicao.set(produtor);
    this.focar(this.campoEdicao);
  }

  protected cancelarEdicao(): void {
    this.emEdicao.set(null);
    this.erroEdicao.set(null);
  }

  protected irParaPagina(pagina: number): void {
    this.cancelarEdicao();
    this.pagina.set(pagina);
  }

  private alteracoes(original: Produtor): AlteracaoProdutor {
    const { nome, ativo } = this.edicao();
    const alteracao: AlteracaoProdutor = {};
    if (nome.trim() !== original.nome) alteracao.nome = nome.trim();
    if (ativo !== original.ativo) alteracao.ativo = ativo;
    return alteracao;
  }

  private concluir(mensagem: string): void {
    this.aviso.set(mensagem);
    this.produtores.reload();
  }

  private focar(campo: () => ElementRef<HTMLInputElement> | undefined): void {
    afterNextRender(() => campo()?.nativeElement.focus(), { injector: this.injector });
  }
}
