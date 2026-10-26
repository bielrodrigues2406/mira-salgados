import type { INestApplicationContext } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { centavos, formatarReais } from '../common/utils/dinheiro.js';
import { PRECO_MAXIMO_CENTAVOS } from '../produtos/dto/novo-preco.dto.js';
import {
  PrecoProduto,
  type Preparo,
  PREPAROS,
  type UnidadeVenda,
  UNIDADES_VENDA,
} from '../produtos/preco-produto.entity.js';
import { Produto } from '../produtos/produto.entity.js';
import { ProdutosService } from '../produtos/produtos.service.js';
import { Produtor } from '../produtores/produtor.entity.js';
import { ProdutoresService } from '../produtores/produtores.service.js';
import { Usuario } from '../usuarios/usuario.entity.js';

/** Preço em centavos por preparo e unidade de venda: { FRITO: { CENTO: 11000 } }. */
export type TabelaDePrecos = Partial<Record<Preparo, Partial<Record<UnidadeVenda, number>>>>;

export interface ProdutoDoCatalogo {
  nome: string;
  produtor: string;
  precos: TabelaDePrecos;
}

export interface Catalogo {
  produtores: string[];
  produtos: ProdutoDoCatalogo[];
}

export interface RelatorioDaCarga {
  criados: string[];
  mantidos: string[];
}

const TAMANHO_MAXIMO_DO_NOME = 80;

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function chave(nome: string): string {
  return nome.toLocaleLowerCase('pt-BR');
}

function lerNome(valor: unknown, onde: string, erros: string[]): string | null {
  if (typeof valor !== 'string' || valor.trim() === '') {
    erros.push(`${onde}: informe o nome.`);
    return null;
  }
  const nome = valor.trim();
  if (nome.length > TAMANHO_MAXIMO_DO_NOME) {
    erros.push(`${onde}: o nome passa de ${String(TAMANHO_MAXIMO_DO_NOME)} caracteres.`);
    return null;
  }
  return nome;
}

function lerPrecos(valor: unknown, onde: string, erros: string[]): TabelaDePrecos {
  const tabela: TabelaDePrecos = {};
  if (!ehObjeto(valor)) {
    erros.push(`${onde}: informe os preços.`);
    return tabela;
  }
  let quantos = 0;
  for (const [preparo, porUnidade] of Object.entries(valor)) {
    if (!PREPAROS.includes(preparo as Preparo)) {
      erros.push(`${onde}: preparo desconhecido "${preparo}" (use ${PREPAROS.join(', ')}).`);
      continue;
    }
    if (!ehObjeto(porUnidade)) {
      erros.push(`${onde}, ${preparo}: informe o preço por unidade de venda.`);
      continue;
    }
    const linha: Partial<Record<UnidadeVenda, number>> = {};
    for (const [unidade, preco] of Object.entries(porUnidade)) {
      if (!UNIDADES_VENDA.includes(unidade as UnidadeVenda)) {
        erros.push(
          `${onde}, ${preparo}: unidade desconhecida "${unidade}" (use ${UNIDADES_VENDA.join(', ')}).`,
        );
        continue;
      }
      if (
        typeof preco !== 'number' ||
        !Number.isInteger(preco) ||
        preco < 1 ||
        preco > PRECO_MAXIMO_CENTAVOS
      ) {
        erros.push(`${onde}, ${preparo} ${unidade}: o preço precisa ser um inteiro em centavos.`);
        continue;
      }
      linha[unidade as UnidadeVenda] = preco;
      quantos += 1;
    }
    tabela[preparo as Preparo] = linha;
  }
  if (quantos === 0) erros.push(`${onde}: informe ao menos um preço.`);
  return tabela;
}

/**
 * Confere o arquivo inteiro antes de gravar qualquer coisa: um catálogo com
 * erro não deixa o banco pela metade. Lança um Error com todos os problemas.
 */
export function lerCatalogo(bruto: unknown): Catalogo {
  const erros: string[] = [];
  if (!ehObjeto(bruto))
    throw new Error('O catálogo precisa ser um objeto com produtores e produtos.');

  const produtores: string[] = [];
  const vistos = new Set<string>();
  if (!Array.isArray(bruto['produtores']) || bruto['produtores'].length === 0) {
    erros.push('Informe a lista de produtores.');
  } else {
    bruto['produtores'].forEach((valor: unknown, indice) => {
      const nome = lerNome(valor, `Produtor ${String(indice + 1)}`, erros);
      if (nome === null) return;
      if (vistos.has(chave(nome))) erros.push(`Produtor "${nome}" aparece duas vezes.`);
      vistos.add(chave(nome));
      produtores.push(nome);
    });
  }

  const produtos: ProdutoDoCatalogo[] = [];
  const nomesDeProduto = new Set<string>();
  if (!Array.isArray(bruto['produtos']) || bruto['produtos'].length === 0) {
    erros.push('Informe a lista de produtos.');
  } else {
    bruto['produtos'].forEach((item: unknown, indice) => {
      const onde = `Produto ${String(indice + 1)}`;
      if (!ehObjeto(item)) {
        erros.push(`${onde}: informe nome, produtor e preços.`);
        return;
      }
      const nome = lerNome(item['nome'], onde, erros);
      const rotulo = nome === null ? onde : `Produto "${nome}"`;
      const produtor = lerNome(item['produtor'], `${rotulo}, produtor`, erros);
      const precos = lerPrecos(item['precos'], rotulo, erros);
      if (nome !== null) {
        if (nomesDeProduto.has(chave(nome))) erros.push(`${rotulo} aparece duas vezes.`);
        nomesDeProduto.add(chave(nome));
      }
      if (produtor !== null && !vistos.has(chave(produtor))) {
        erros.push(`${rotulo}: o produtor "${produtor}" não está na lista de produtores.`);
      }
      if (nome !== null && produtor !== null) produtos.push({ nome, produtor, precos });
    });
  }

  if (erros.length > 0) throw new Error(erros.join('\n'));
  return { produtores, produtos };
}

/**
 * Cria o que falta do catálogo e nunca altera o que já existe: um preço mudado
 * pela tela continua valendo. Pode rodar de novo sem duplicar nada. Passa
 * pelos mesmos serviços da API, então as regras e a auditoria são as mesmas.
 */
export async function carregarCatalogo(
  app: INestApplicationContext,
  catalogo: Catalogo,
  autorId: string,
): Promise<RelatorioDaCarga> {
  const dataSource = app.get(DataSource);
  const servicoDeProdutores = app.get(ProdutoresService);
  const servicoDeProdutos = app.get(ProdutosService);
  const relatorio: RelatorioDaCarga = { criados: [], mantidos: [] };

  const idsDosProdutores = new Map<string, string>();
  for (const nome of catalogo.produtores) {
    const existente = await dataSource
      .getRepository(Produtor)
      .createQueryBuilder('produtor')
      .where('lower(produtor.nome) = lower(:nome)', { nome })
      .getOne();
    if (existente) {
      idsDosProdutores.set(chave(nome), existente.id);
      relatorio.mantidos.push(`Produtor ${existente.nome}${existente.ativo ? '' : ' (inativo)'}`);
      continue;
    }
    const criado = await servicoDeProdutores.criar({ nome }, autorId);
    idsDosProdutores.set(chave(nome), criado.id);
    relatorio.criados.push(`Produtor ${criado.nome}`);
  }

  for (const item of catalogo.produtos) {
    let produto = await dataSource
      .getRepository(Produto)
      .createQueryBuilder('produto')
      .where('lower(produto.nome) = lower(:nome)', { nome: item.nome })
      .getOne();
    if (produto) {
      relatorio.mantidos.push(`Produto ${produto.nome}${produto.ativo ? '' : ' (inativo)'}`);
    } else {
      const produtorPadraoId = idsDosProdutores.get(chave(item.produtor));
      if (produtorPadraoId === undefined) throw new Error(`Produtor "${item.produtor}" sem id.`);
      produto = (await servicoDeProdutos.criar({ nome: item.nome, produtorPadraoId }, autorId))
        .produto;
      relatorio.criados.push(`Produto ${produto.nome}`);
    }
    // Produto desativado pela tela continua desativado, e sem preço novo.
    if (!produto.ativo) continue;

    for (const preparo of PREPAROS) {
      for (const unidade of UNIDADES_VENDA) {
        const valor = item.precos[preparo]?.[unidade];
        if (valor === undefined) continue;
        const descricao = `Preço ${produto.nome}, ${preparo.toLowerCase()} por ${unidade.toLowerCase()}`;
        const vigente = await dataSource.getRepository(PrecoProduto).findOneBy({
          produtoId: produto.id,
          preparo,
          unidadeVenda: unidade,
          vigenteAte: IsNull(),
        });
        if (vigente) {
          relatorio.mantidos.push(`${descricao}: ${formatarReais(vigente.preco)}`);
          continue;
        }
        await servicoDeProdutos.definirPreco(
          produto.id,
          { preparo, unidadeVenda: unidade, precoCentavos: valor },
          autorId,
        );
        relatorio.criados.push(`${descricao}: ${formatarReais(centavos(valor))}`);
      }
    }
  }
  return relatorio;
}

/** A carga entra na auditoria em nome do administrador mais antigo ainda ativo. */
export async function autorDaCarga(app: INestApplicationContext): Promise<Usuario> {
  const admin = await app
    .get(DataSource)
    .getRepository(Usuario)
    .findOne({
      where: { papel: 'ADMIN', ativo: true },
      order: { criadoEm: 'ASC' },
    });
  if (!admin) {
    throw new Error(
      'Crie o administrador antes (dist/cli/criar-admin.js): a carga é feita em nome dele.',
    );
  }
  return admin;
}
