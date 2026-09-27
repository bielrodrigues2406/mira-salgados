import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, IsNull, type Repository } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../common/errors/domain.errors.js';
import { ehViolacaoDeUnicidade } from '../common/errors/postgres-errors.js';
import { Paginated, type PaginationQueryDto } from '../common/pagination/pagination.js';
import { centavos } from '../common/utils/dinheiro.js';
import { Produtor } from '../produtores/produtor.entity.js';
import type { AtualizarProdutoDto } from './dto/atualizar-produto.dto.js';
import type { CriarProdutoDto } from './dto/criar-produto.dto.js';
import type { FiltroProdutosDto } from './dto/filtro-produtos.dto.js';
import type { NovoPrecoDto } from './dto/novo-preco.dto.js';
import { PrecoProduto, type Preparo, PREPAROS, type UnidadeVenda } from './preco-produto.entity.js';
import { Produto } from './produto.entity.js';

export interface ProdutoComPrecos {
  produto: Produto;
  produtorPadrao: Produtor;
  precos: PrecoProduto[];
}

const UNICIDADE_DO_NOME = 'uq_produtos_nome';
// Ordem da tabela de preços no design: preparo, depois cento antes de unidade.
const ORDEM_DAS_UNIDADES: readonly UnidadeVenda[] = ['CENTO', 'UNIDADE'];
const ROTULOS: Record<Preparo | UnidadeVenda, string> = {
  FRITO: 'Frito',
  ASSADO: 'Assado',
  CONGELADO: 'Congelado',
  UNIDADE: 'Unidade',
  CENTO: 'Cento',
};

function nomeEmUso(): ConflictError {
  return new ConflictError('PRODUTO_JA_EXISTE', 'Já existe um produto com este nome.');
}

function ordenarPrecos(precos: PrecoProduto[]): PrecoProduto[] {
  return precos.sort(
    (a, b) =>
      PREPAROS.indexOf(a.preparo) - PREPAROS.indexOf(b.preparo) ||
      ORDEM_DAS_UNIDADES.indexOf(a.unidadeVenda) - ORDEM_DAS_UNIDADES.indexOf(b.unidadeVenda),
  );
}

async function traduzirNomeDuplicado<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro, UNICIDADE_DO_NOME)) throw nomeEmUso();
    throw erro;
  }
}

@Injectable()
export class ProdutosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Produto)
    private readonly produtos: Repository<Produto>,
    @InjectRepository(PrecoProduto)
    private readonly precos: Repository<PrecoProduto>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: FiltroProdutosDto): Promise<Paginated<ProdutoComPrecos>> {
    const consulta = this.produtos
      .createQueryBuilder('produto')
      .innerJoinAndSelect('produto.produtorPadrao', 'produtor')
      .orderBy('produto.ativo', 'DESC')
      .addOrderBy('produto.nome', 'ASC')
      .addOrderBy('produto.id', 'ASC')
      .skip(filtro.skip)
      .take(filtro.pageSize);
    if (filtro.ativo !== undefined) {
      consulta.andWhere('produto.ativo = :ativo', { ativo: filtro.ativo });
    }

    const [itens, total] = await consulta.getManyAndCount();
    return Paginated.of(await this.comPrecos(this.precos.manager, itens), total, filtro);
  }

  async buscar(id: string): Promise<ProdutoComPrecos> {
    return this.carregar(this.produtos.manager, id);
  }

  async historicoDePrecos(
    produtoId: string,
    paginacao: PaginationQueryDto,
  ): Promise<Paginated<PrecoProduto>> {
    if (!(await this.produtos.existsBy({ id: produtoId }))) throw new NotFoundError('Produto');
    const [itens, total] = await this.precos.findAndCount({
      where: { produtoId },
      order: { vigenteDesde: 'DESC', id: 'DESC' },
      skip: paginacao.skip,
      take: paginacao.pageSize,
    });
    return Paginated.of(itens, total, paginacao);
  }

  criar(dados: CriarProdutoDto, autorId: string): Promise<ProdutoComPrecos> {
    return traduzirNomeDuplicado(
      this.dataSource.transaction(async (manager) => {
        await this.garantirProdutorAtivo(manager, dados.produtorPadraoId);
        await this.garantirNomeDisponivel(manager, dados.nome);

        const repositorio = manager.getRepository(Produto);
        const produto = await repositorio.save(
          repositorio.create({ nome: dados.nome, produtorPadraoId: dados.produtorPadraoId }),
        );
        await this.auditoria.registrar(manager, {
          entidade: 'produto',
          entidadeId: produto.id,
          acao: 'CRIACAO',
          antes: null,
          depois: produto,
          usuarioId: autorId,
        });
        return this.carregar(manager, produto.id);
      }),
    );
  }

  atualizar(id: string, dados: AtualizarProdutoDto, autorId: string): Promise<ProdutoComPrecos> {
    return traduzirNomeDuplicado(
      this.dataSource.transaction(async (manager) => {
        const repositorio = manager.getRepository(Produto);
        const produto = await this.bloquearProduto(manager, id);
        const antes = Object.assign(new Produto(), produto);

        if (dados.nome !== undefined && dados.nome !== produto.nome) {
          await this.garantirNomeDisponivel(manager, dados.nome, id);
          produto.nome = dados.nome;
        }
        if (
          dados.produtorPadraoId !== undefined &&
          dados.produtorPadraoId !== produto.produtorPadraoId
        ) {
          await this.garantirProdutorAtivo(manager, dados.produtorPadraoId);
          produto.produtorPadraoId = dados.produtorPadraoId;
        }
        if (dados.ativo !== undefined) produto.ativo = dados.ativo;

        const mudou =
          produto.nome !== antes.nome ||
          produto.produtorPadraoId !== antes.produtorPadraoId ||
          produto.ativo !== antes.ativo;
        if (mudou) {
          const salvo = await repositorio.save(produto);
          await this.auditoria.registrar(manager, {
            entidade: 'produto',
            entidadeId: id,
            acao: antes.ativo && !salvo.ativo ? 'DESATIVACAO' : 'ATUALIZACAO',
            antes,
            depois: salvo,
            usuarioId: autorId,
          });
        }
        return this.carregar(manager, id);
      }),
    );
  }

  /**
   * Define o preço vigente de uma combinação de preparo e unidade. Havendo um
   * preço vigente, ele é encerrado no mesmo instante em que o novo começa.
   */
  definirPreco(produtoId: string, dados: NovoPrecoDto, autorId: string): Promise<ProdutoComPrecos> {
    return this.dataSource.transaction(async (manager) => {
      const produto = await this.bloquearProduto(manager, produtoId);
      if (!produto.ativo) {
        throw new BusinessRuleError(
          'PRODUTO_INATIVO',
          'Reative o produto antes de alterar os preços.',
        );
      }

      const repositorio = manager.getRepository(PrecoProduto);
      const vigente = await repositorio.findOneBy({
        produtoId,
        preparo: dados.preparo,
        unidadeVenda: dados.unidadeVenda,
        vigenteAte: IsNull(),
      });
      const preco = centavos(dados.precoCentavos);
      if (vigente?.preco === preco) {
        throw new BusinessRuleError(
          'PRECO_INALTERADO',
          `Este já é o preço vigente de ${ROTULOS[dados.preparo]} · ${ROTULOS[dados.unidadeVenda]}.`,
        );
      }

      const agora = await this.instanteAtual(manager, vigente);
      if (vigente) await this.encerrar(manager, vigente, agora, autorId);

      const novo = await repositorio.save(
        repositorio.create({
          produtoId,
          preparo: dados.preparo,
          unidadeVenda: dados.unidadeVenda,
          preco,
          vigenteDesde: agora,
          vigenteAte: null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'preco_produto',
        entidadeId: novo.id,
        acao: 'CRIACAO',
        antes: null,
        depois: novo,
        usuarioId: autorId,
      });
      return this.carregar(manager, produtoId);
    });
  }

  /** Tira a combinação da tabela vigente; o registro continua no histórico. */
  encerrarPreco(produtoId: string, precoId: string, autorId: string): Promise<ProdutoComPrecos> {
    return this.dataSource.transaction(async (manager) => {
      await this.bloquearProduto(manager, produtoId);
      const preco = await manager.getRepository(PrecoProduto).findOneBy({ id: precoId, produtoId });
      if (!preco) throw new NotFoundError('Preço');
      if (preco.vigenteAte !== null) {
        throw new BusinessRuleError('PRECO_ENCERRADO', 'Este preço já não está vigente.');
      }

      await this.encerrar(manager, preco, await this.instanteAtual(manager, preco), autorId);
      return this.carregar(manager, produtoId);
    });
  }

  private async encerrar(
    manager: EntityManager,
    preco: PrecoProduto,
    instante: Date,
    autorId: string,
  ): Promise<void> {
    const antes = Object.assign(new PrecoProduto(), preco);
    preco.vigenteAte = instante;
    await manager.getRepository(PrecoProduto).save(preco);
    await this.auditoria.registrar(manager, {
      entidade: 'preco_produto',
      entidadeId: preco.id,
      acao: 'DESATIVACAO',
      antes,
      depois: preco,
      usuarioId: autorId,
    });
  }

  // Lido depois do bloqueio do produto, com clock_timestamp(): now() é o início
  // da transação, e uma transação que começou antes mas esperou o bloqueio
  // encerraria o preço recém-criado por outra com data anterior ao início dele.
  // O mesmo instante encerra o preço antigo e abre o novo, sem lacuna.
  private async instanteAtual(manager: EntityManager, vigente: PrecoProduto | null): Promise<Date> {
    const [linha] = await manager.query<{ agora: Date }[]>('SELECT clock_timestamp() AS agora');
    if (!linha) throw new Error('Consulta de clock_timestamp() sem resultado.');
    // Proteção contra ajuste do relógio do servidor para trás.
    return vigente && vigente.vigenteDesde > linha.agora ? vigente.vigenteDesde : linha.agora;
  }

  // Bloqueia a linha do produto: alterações de preço do mesmo produto passam
  // a acontecer uma de cada vez.
  private async bloquearProduto(manager: EntityManager, id: string): Promise<Produto> {
    const produto = await manager.getRepository(Produto).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!produto) throw new NotFoundError('Produto');
    return produto;
  }

  // FOR SHARE no produtor: se ele for desativado ao mesmo tempo, uma das duas
  // transações espera a outra e enxerga o resultado dela.
  private async garantirProdutorAtivo(manager: EntityManager, produtorId: string): Promise<void> {
    const produtor = await manager.getRepository(Produtor).findOne({
      where: { id: produtorId },
      lock: { mode: 'pessimistic_read' },
    });
    if (!produtor?.ativo) {
      throw new BusinessRuleError('PRODUTOR_INVALIDO', 'Escolha um produtor ativo como padrão.');
    }
  }

  private async garantirNomeDisponivel(
    manager: EntityManager,
    nome: string,
    exceto?: string,
  ): Promise<void> {
    const consulta = manager
      .getRepository(Produto)
      .createQueryBuilder('produto')
      .where('lower(produto.nome) = lower(:nome)', { nome });
    if (exceto) consulta.andWhere('produto.id <> :exceto', { exceto });
    if (await consulta.getExists()) throw nomeEmUso();
  }

  private async carregar(manager: EntityManager, id: string): Promise<ProdutoComPrecos> {
    const produto = await manager.getRepository(Produto).findOne({
      where: { id },
      relations: { produtorPadrao: true },
    });
    if (!produto) throw new NotFoundError('Produto');
    const [comPrecos] = await this.comPrecos(manager, [produto]);
    if (!comPrecos) throw new NotFoundError('Produto');
    return comPrecos;
  }

  // Uma consulta para os preços de toda a página, em vez de uma por produto.
  private async comPrecos(
    manager: EntityManager,
    produtos: Produto[],
  ): Promise<ProdutoComPrecos[]> {
    const ids = produtos.map((produto) => produto.id);
    const vigentes =
      ids.length === 0
        ? []
        : await manager
            .getRepository(PrecoProduto)
            .findBy({ produtoId: In(ids), vigenteAte: IsNull() });

    return produtos.map((produto) => {
      if (!produto.produtorPadrao) throw new Error('Produtor padrão não carregado.');
      return {
        produto,
        produtorPadrao: produto.produtorPadrao,
        precos: ordenarPrecos(vigentes.filter((preco) => preco.produtoId === produto.id)),
      };
    });
  }
}
