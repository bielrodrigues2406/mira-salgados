import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AlteracaoCliente, Cliente } from '../../core/models/cliente';
import { ClientesService } from '../../core/services/clientes.service';
import { mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { Chip } from '../../shared/components/chip/chip';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { TelefonePipe } from '../../shared/pipes/telefone.pipe';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import {
  CLIENTE_VAZIO,
  ClienteFormulario,
  type DadosCliente,
  type SalvarCliente,
} from './cliente-formulario/cliente-formulario';

const TAMANHO_DA_PAGINA = 20;
/** Espera entre a última tecla e a busca, para não consultar a cada letra. */
const ESPERA_DA_BUSCA_MS = 300;
const SO_TELEFONE = /^[\d\s()+.-]+$/;

function plural(total: number, singular: string, pluralizado: string): string {
  return `${String(total)} ${total === 1 ? singular : pluralizado}`;
}

@Component({
  selector: 'ms-clientes',
  imports: [
    Chip,
    ClienteFormulario,
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    Paginacao,
    TelefonePipe,
  ],
  templateUrl: './clientes.html',
  styleUrl: './clientes.css',
})
export class Clientes {
  private readonly servico = inject(ClientesService);

  protected readonly pagina = signal(1);
  /** Texto no campo de busca, atualizado a cada tecla. */
  protected readonly termo = signal('');
  /** Termo efetivamente consultado, depois da espera. */
  protected readonly busca = signal('');
  protected readonly mostrarInativos = signal(false);

  protected readonly clientes = this.servico.listar(() => ({
    page: this.pagina(),
    pageSize: TAMANHO_DA_PAGINA,
    busca: this.busca() || undefined,
    ativo: this.mostrarInativos() ? undefined : true,
  }));
  protected readonly estado = estadoDeRecurso(this.clientes, ({ itens }) => itens.length === 0);
  protected readonly itens = computed(() =>
    this.clientes.hasValue() ? this.clientes.value().itens : [],
  );
  protected readonly meta = computed(() =>
    this.clientes.hasValue() ? this.clientes.value().meta : undefined,
  );
  protected readonly resumo = computed(() => {
    const total = this.meta()?.total ?? 0;
    if (this.busca()) return plural(total, 'cliente encontrado', 'clientes encontrados');
    return this.mostrarInativos()
      ? plural(total, 'cliente', 'clientes')
      : plural(total, 'cliente ativo', 'clientes ativos');
  });

  protected readonly aviso = signal('');
  protected readonly formularioAberto = signal(false);
  protected readonly inicialNovo = signal<DadosCliente>(CLIENTE_VAZIO);
  protected readonly emEdicao = signal<Cliente | null>(null);
  protected readonly dadosEmEdicao = computed((): DadosCliente => {
    const cliente = this.emEdicao();
    return cliente ?? CLIENTE_VAZIO;
  });

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
    });
  }

  protected aoDigitarBusca(valor: string): void {
    this.termo.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.aplicarBusca(valor);
    }, ESPERA_DA_BUSCA_MS);
  }

  protected alternarInativos(mostrar: boolean): void {
    this.mostrarInativos.set(mostrar);
    this.pagina.set(1);
  }

  /** Abre o cadastro; vindo de uma busca sem resultado, aproveita o termo digitado. */
  protected abrirFormulario(aproveitarBusca = false): void {
    const termo = this.busca();
    let inicial = CLIENTE_VAZIO;
    if (aproveitarBusca && termo) {
      inicial = SO_TELEFONE.test(termo)
        ? { ...CLIENTE_VAZIO, telefone: termo.replace(/\D/g, '') }
        : { ...CLIENTE_VAZIO, nome: termo };
    }
    this.emEdicao.set(null);
    this.inicialNovo.set(inicial);
    this.formularioAberto.set(true);
  }

  protected fecharFormulario(): void {
    this.formularioAberto.set(false);
  }

  protected editar(cliente: Cliente): void {
    this.formularioAberto.set(false);
    this.emEdicao.set(cliente);
  }

  protected cancelarEdicao(): void {
    this.emEdicao.set(null);
  }

  protected irParaPagina(pagina: number): void {
    this.emEdicao.set(null);
    this.pagina.set(pagina);
  }

  protected readonly criar: SalvarCliente = async ({ nome, telefone, endereco }) => {
    try {
      const cliente = await firstValueFrom(this.servico.criar({ nome, telefone, endereco }));
      this.formularioAberto.set(false);
      this.concluir(`Cadastro de ${cliente.nome} salvo.`);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected readonly atualizar: SalvarCliente = async (dados) => {
    const original = this.emEdicao();
    if (!original) return null;

    const alteracao = alteracoes(original, dados);
    if (Object.keys(alteracao).length === 0) {
      this.emEdicao.set(null);
      return null;
    }
    try {
      const cliente = await firstValueFrom(this.servico.atualizar(original.id, alteracao));
      this.emEdicao.set(null);
      this.concluir(`Alterações de ${cliente.nome} salvas.`);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  private aplicarBusca(valor: string): void {
    this.busca.set(valor.trim());
    this.pagina.set(1);
    this.emEdicao.set(null);
  }

  private concluir(mensagem: string): void {
    this.aviso.set(mensagem);
    this.clientes.reload();
  }
}

function alteracoes(original: Cliente, dados: DadosCliente): AlteracaoCliente {
  const alteracao: AlteracaoCliente = {};
  if (dados.nome !== original.nome) alteracao.nome = dados.nome;
  if (dados.telefone !== original.telefone) alteracao.telefone = dados.telefone;
  if (dados.endereco !== original.endereco) alteracao.endereco = dados.endereco;
  if (dados.ativo !== original.ativo) alteracao.ativo = dados.ativo;
  return alteracao;
}
