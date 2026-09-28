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
import {
  type FieldTree,
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import { iniciais } from '../../core/layout/destinos';
import {
  type AlteracaoUsuario,
  type Papel,
  ROTULO_PAPEL,
  type Usuario,
} from '../../core/models/usuario';
import { AuthService } from '../../core/services/auth.service';
import { ProdutoresService } from '../../core/services/produtores.service';
import { codigoDeErro, mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { UsuariosService } from '../../core/services/usuarios.service';
import { Chip } from '../../shared/components/chip/chip';
import { ErrosDoCampo } from '../../shared/components/erros-do-campo/erros-do-campo';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { TelefonePipe } from '../../shared/pipes/telefone.pipe';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { gerarSenhaProvisoria } from '../../shared/utils/senha-provisoria';
import {
  type AcessoProvisorio,
  AcessoProvisorioCartao,
} from './acesso-provisorio/acesso-provisorio';

const TAMANHO_DA_PAGINA = 20;
const LIMITE_DO_NOME = 120;
const DIGITOS_DO_TELEFONE = /^\d{10,11}$/;
const TELEFONE_EM_USO = 'TELEFONE_EM_USO';
const PRODUTOR_JA_VINCULADO = 'PRODUTOR_JA_VINCULADO';
const LIMITE_DE_PRODUTORES = 100;

interface DadosConta {
  nome: string;
  telefone: string;
  papel: Papel;
  /** Vazio: a pessoa não produz. */
  produtorId: string;
}

const CONTA_VAZIA: DadosConta = { nome: '', telefone: '', papel: 'MEMBRO', produtorId: '' };

function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Contas de quem usa o sistema, só para administradores. A conta nasce com
 * senha provisória, gerada aqui e entregue pelo WhatsApp; a pessoa cria a
 * própria senha no primeiro acesso.
 */
@Component({
  selector: 'ms-usuarios',
  imports: [
    AcessoProvisorioCartao,
    Chip,
    ErrosDoCampo,
    EstadoErro,
    FormField,
    FormRoot,
    Icone,
    ListaEsqueleto,
    Paginacao,
    TelefonePipe,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class Usuarios {
  private readonly servico = inject(UsuariosService);
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);

  protected readonly euId = computed(() => this.auth.usuario()?.id);
  protected readonly iniciais = iniciais;
  protected readonly rotuloPapel = ROTULO_PAPEL;
  protected readonly pagina = signal(1);
  protected readonly usuarios = this.servico.listar(() => ({
    page: this.pagina(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly estado = estadoDeRecurso(this.usuarios, ({ itens }) => itens.length === 0);
  protected readonly itens = computed(() =>
    this.usuarios.hasValue() ? this.usuarios.value().itens : [],
  );
  protected readonly meta = computed(() =>
    this.usuarios.hasValue() ? this.usuarios.value().meta : undefined,
  );
  private readonly produtoresAtivos = inject(ProdutoresService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_PRODUTORES,
    ativo: true,
  }));
  protected readonly produtores = computed(() =>
    this.produtoresAtivos.hasValue() ? this.produtoresAtivos.value().itens : [],
  );
  private readonly nomesDosProdutores = computed(
    () => new Map(this.produtores().map((produtor) => [produtor.id, produtor.nome])),
  );
  /** Produtores já ligados a alguma conta da página, fora a conta em edição. */
  protected readonly produtoresOcupados = computed(() => {
    const editando = this.emEdicao()?.id;
    return new Set(
      this.itens()
        .filter((usuario) => usuario.id !== editando && usuario.produtorId)
        .map((usuario) => usuario.produtorId),
    );
  });
  protected readonly aviso = signal('');
  /** Credenciais da última conta criada ou senha redefinida, até serem fechadas. */
  protected readonly acesso = signal<AcessoProvisorio | null>(null);

  private readonly campoNovo = viewChild<ElementRef<HTMLInputElement>>('campoNovo');
  private readonly campoEdicao = viewChild<ElementRef<HTMLInputElement>>('campoEdicao');

  protected readonly formularioAberto = signal(false);
  protected readonly erroNovo = signal<string | null>(null);
  protected readonly senhaNova = signal(gerarSenhaProvisoria());
  private readonly nova = signal<DadosConta>({ ...CONTA_VAZIA });
  protected readonly formularioNovo = form(
    this.nova,
    (campo) => {
      required(campo.nome, { message: 'Informe o nome.' });
      maxLength(campo.nome, LIMITE_DO_NOME, { message: 'Use no máximo 120 caracteres.' });
      required(campo.telefone, { message: 'Informe o celular.' });
      validate(campo.telefone, ({ value }) =>
        value() === '' || DIGITOS_DO_TELEFONE.test(somenteDigitos(value()))
          ? undefined
          : { kind: 'telefone', message: 'Use o celular com DDD, como (11) 98765-4321.' },
      );
    },
    {
      submission: {
        action: async (campo) => {
          this.erroNovo.set(null);
          const { nome, telefone, papel, produtorId } = this.nova();
          const senha = this.senhaNova();
          try {
            const criado = await firstValueFrom(
              this.servico.criar({
                nome: nome.trim(),
                telefone: somenteDigitos(telefone),
                papel,
                ...(produtorId ? { produtorId } : {}),
                senha,
              }),
            );
            this.fecharFormulario();
            this.acesso.set({
              nome: criado.nome,
              telefone: criado.telefone ?? '',
              senha,
              motivo: 'criada',
            });
            this.concluir(`Conta de ${criado.nome} criada.`);
            return undefined;
          } catch (falha) {
            const erro = this.erroDeCampo(falha, campo);
            if (erro) return erro;
            this.erroNovo.set(mensagemDeErro(falha));
            return undefined;
          }
        },
      },
    },
  );

  protected readonly emEdicao = signal<Usuario | null>(null);
  protected readonly erroEdicao = signal<string | null>(null);
  private readonly edicao = signal<DadosConta & { ativo: boolean }>({
    ...CONTA_VAZIA,
    ativo: true,
  });
  protected readonly editandoASiMesmo = computed(() => this.emEdicao()?.id === this.euId());
  protected readonly formularioEdicao = form(
    this.edicao,
    (campo) => {
      required(campo.nome, { message: 'Informe o nome.' });
      maxLength(campo.nome, LIMITE_DO_NOME, { message: 'Use no máximo 120 caracteres.' });
      required(campo.telefone, { message: 'Informe o celular.' });
      validate(campo.telefone, ({ value }) =>
        value() === '' || DIGITOS_DO_TELEFONE.test(somenteDigitos(value()))
          ? undefined
          : { kind: 'telefone', message: 'Use o celular com DDD, como (11) 98765-4321.' },
      );
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
            const salvo = await firstValueFrom(this.servico.atualizar(original.id, alteracao));
            this.emEdicao.set(null);
            this.concluir(`Alterações de ${salvo.nome} salvas.`);
            return undefined;
          } catch (falha) {
            const erro = this.erroDeCampo(falha, campo);
            if (erro) return erro;
            this.erroEdicao.set(mensagemDeErro(falha));
            return undefined;
          }
        },
      },
    },
  );

  protected readonly redefinindo = signal<string | null>(null);
  protected readonly erroRedefinicao = signal<string | null>(null);

  protected abrirFormulario(): void {
    this.cancelarEdicao();
    this.senhaNova.set(gerarSenhaProvisoria());
    this.formularioAberto.set(true);
    this.focar(this.campoNovo);
  }

  protected fecharFormulario(): void {
    this.formularioAberto.set(false);
    this.erroNovo.set(null);
    this.formularioNovo().reset({ ...CONTA_VAZIA });
  }

  protected gerarOutraSenha(): void {
    this.senhaNova.set(gerarSenhaProvisoria());
  }

  protected editar(usuario: Usuario): void {
    this.fecharFormulario();
    this.redefinindo.set(null);
    this.erroEdicao.set(null);
    this.formularioEdicao().reset({
      nome: usuario.nome,
      telefone: usuario.telefone ?? '',
      papel: usuario.papel,
      produtorId: usuario.produtorId ?? '',
      ativo: usuario.ativo,
    });
    this.emEdicao.set(usuario);
    this.focar(this.campoEdicao);
  }

  protected cancelarEdicao(): void {
    this.emEdicao.set(null);
    this.erroEdicao.set(null);
  }

  protected pedirRedefinicao(usuario: Usuario): void {
    this.cancelarEdicao();
    this.erroRedefinicao.set(null);
    this.redefinindo.set(usuario.id);
  }

  protected async redefinirSenha(usuario: Usuario): Promise<void> {
    const senha = gerarSenhaProvisoria();
    this.erroRedefinicao.set(null);
    try {
      await firstValueFrom(this.servico.redefinirSenha(usuario.id, senha));
      this.redefinindo.set(null);
      this.acesso.set({
        nome: usuario.nome,
        telefone: usuario.telefone ?? '',
        senha,
        motivo: 'redefinida',
      });
      this.concluir(`Nova senha provisória de ${usuario.nome} gerada.`);
    } catch (falha) {
      this.erroRedefinicao.set(mensagemDeErro(falha));
    }
  }

  protected irParaPagina(pagina: number): void {
    this.cancelarEdicao();
    this.pagina.set(pagina);
  }

  private alteracoes(original: Usuario): AlteracaoUsuario {
    const { nome, telefone, papel, produtorId, ativo } = this.edicao();
    const alteracao: AlteracaoUsuario = {};
    if (nome.trim() !== original.nome) alteracao.nome = nome.trim();
    if (somenteDigitos(telefone) !== (original.telefone ?? '')) {
      alteracao.telefone = somenteDigitos(telefone);
    }
    if (papel !== original.papel) alteracao.papel = papel;
    if (ativo !== original.ativo) alteracao.ativo = ativo;
    if ((produtorId || null) !== original.produtorId) alteracao.produtorId = produtorId || null;
    return alteracao;
  }

  protected nomeDoProdutor(id: string | null): string | undefined {
    return id ? this.nomesDosProdutores().get(id) : undefined;
  }

  /** Conflitos que pertencem a um campo aparecem nele, não no alerta do formulário. */
  private erroDeCampo(
    falha: unknown,
    campo: { telefone: FieldTree<string>; produtorId: FieldTree<string> },
  ): { kind: string; message: string; fieldTree: FieldTree<string> } | undefined {
    const codigo = codigoDeErro(falha);
    if (codigo === TELEFONE_EM_USO) {
      return { kind: 'duplicado', message: mensagemDeErro(falha), fieldTree: campo.telefone };
    }
    if (codigo === PRODUTOR_JA_VINCULADO) {
      return { kind: 'duplicado', message: mensagemDeErro(falha), fieldTree: campo.produtorId };
    }
    return undefined;
  }

  private concluir(mensagem: string): void {
    this.aviso.set(mensagem);
    this.usuarios.reload();
  }

  private focar(campo: () => ElementRef<HTMLInputElement> | undefined): void {
    afterNextRender(() => campo()?.nativeElement.focus(), { injector: this.injector });
  }
}
