import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { mensagemDeErro } from '../../core/services/mensagem-de-erro';
import { ProdutoresService } from '../../core/services/produtores.service';
import { ProdutosService } from '../../core/services/produtos.service';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { ProdutoCartao } from './produto-cartao/produto-cartao';
import {
  type OpcaoProdutor,
  ProdutoFormulario,
  type SalvarProduto,
} from './produto-formulario/produto-formulario';

const TAMANHO_DA_PAGINA = 20;
/** Uma família tem poucos produtores; todos os ativos cabem na escolha do padrão. */
const LIMITE_DE_PRODUTORES = 100;

@Component({
  selector: 'ms-produtos',
  imports: [
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    Paginacao,
    ProdutoCartao,
    ProdutoFormulario,
    RouterLink,
  ],
  templateUrl: './produtos.html',
  styleUrl: './produtos.css',
})
export class Produtos {
  private readonly servico = inject(ProdutosService);

  protected readonly pagina = signal(1);
  protected readonly produtos = this.servico.listar(() => ({
    page: this.pagina(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly estado = estadoDeRecurso(this.produtos, ({ itens }) => itens.length === 0);
  protected readonly itens = computed(() =>
    this.produtos.hasValue() ? this.produtos.value().itens : [],
  );
  protected readonly meta = computed(() =>
    this.produtos.hasValue() ? this.produtos.value().meta : undefined,
  );

  private readonly produtoresAtivos = inject(ProdutoresService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_PRODUTORES,
    ativo: true,
  }));
  protected readonly opcoesDeProdutor = computed((): OpcaoProdutor[] =>
    this.produtoresAtivos.hasValue()
      ? this.produtoresAtivos.value().itens.map(({ id, nome, ativo }) => ({ id, nome, ativo }))
      : [],
  );
  protected readonly resumoProdutores = computed(() => {
    if (!this.produtoresAtivos.hasValue()) return 'Quem prepara cada produto por padrão';
    const total = this.produtoresAtivos.value().meta.total;
    const ativos = total === 1 ? '1 ativo' : `${String(total)} ativos`;
    return `${ativos} · quem prepara cada produto por padrão`;
  });

  protected readonly aviso = signal('');
  protected readonly formularioAberto = signal(false);

  protected abrirFormulario(): void {
    this.formularioAberto.set(true);
  }

  protected irParaPagina(pagina: number): void {
    this.pagina.set(pagina);
  }

  protected readonly criar: SalvarProduto = async ({ nome, produtorPadraoId }) => {
    try {
      const produto = await firstValueFrom(this.servico.criar({ nome, produtorPadraoId }));
      this.formularioAberto.set(false);
      this.concluir(`Cadastro de ${produto.nome} salvo. Adicione os preços.`);
      return null;
    } catch (falha) {
      return mensagemDeErro(falha);
    }
  };

  protected concluir(mensagem: string): void {
    this.aviso.set(mensagem);
    this.produtos.reload();
  }
}
