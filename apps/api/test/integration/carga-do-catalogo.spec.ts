import { readFileSync } from 'node:fs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource, IsNull, Not } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { autorDaCarga, carregarCatalogo, lerCatalogo } from '../../src/cli/catalogo.js';
import { PrecoProduto } from '../../src/produtos/preco-produto.entity.js';
import { Produto } from '../../src/produtos/produto.entity.js';
import { ProdutosService } from '../../src/produtos/produtos.service.js';
import { Produtor } from '../../src/produtores/produtor.entity.js';
import { criarUsuario } from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { createTestApp } from './helpers/test-app.js';

const catalogoDoServidor = lerCatalogo(
  JSON.parse(
    readFileSync(
      new URL('../../../../deploy/mira-salgados/catalogo-inicial.json', import.meta.url),
      'utf8',
    ),
  ) as unknown,
);

describe('carga do catálogo', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await limparBanco(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige um administrador ativo e usa o mais antigo como autor', async () => {
    await criarUsuario(app, { papel: 'MEMBRO' });
    await expect(autorDaCarga(app)).rejects.toThrow('Crie o administrador antes');

    const primeiro = await criarUsuario(app, { nome: 'Primeira', papel: 'ADMIN' });
    await criarUsuario(app, { nome: 'Segunda', papel: 'ADMIN' });

    expect((await autorDaCarga(app)).id).toBe(primeiro.id);
  });

  it('cria o catálogo do servidor inteiro, com auditoria em nome do administrador', async () => {
    const admin = await criarUsuario(app, { papel: 'ADMIN' });

    const relatorio = await carregarCatalogo(app, catalogoDoServidor, admin.id);

    // 3 produtores, 12 produtos e 24 preços (dois por produto).
    expect(relatorio.criados).toHaveLength(39);
    expect(relatorio.mantidos).toEqual([]);
    expect(await dataSource.getRepository(Produtor).count()).toBe(3);
    expect(await dataSource.getRepository(Produto).count()).toBe(12);
    expect(await dataSource.getRepository(PrecoProduto).countBy({ vigenteAte: IsNull() })).toBe(24);

    const bacalhau = await dataSource.getRepository(Produto).findOneOrFail({
      where: { nome: 'Bolinha de bacalhau' },
      relations: { produtorPadrao: true },
    });
    expect(bacalhau.produtorPadrao?.nome).toBe('Mariellen e Elton');
    const precos = await dataSource
      .getRepository(PrecoProduto)
      .findBy({ produtoId: bacalhau.id, vigenteAte: IsNull() });
    expect(
      precos
        .map(({ preparo, unidadeVenda, preco }) => `${preparo} ${unidadeVenda} ${String(preco)}`)
        .sort(),
    ).toEqual(['CONGELADO CENTO 19000', 'FRITO CENTO 20000']);

    // Fora o registro da criação do próprio administrador.
    const registros = await dataSource
      .getRepository(LogAuditoria)
      .findBy({ entidade: Not('usuario') });
    expect(registros).toHaveLength(39);
    expect(new Set(registros.map((registro) => registro.usuarioId))).toEqual(new Set([admin.id]));
  });

  it('roda de novo sem duplicar e sem desfazer o que mudou pela tela', async () => {
    const admin = await criarUsuario(app, { papel: 'ADMIN' });
    await carregarCatalogo(app, catalogoDoServidor, admin.id);

    const kibe = await dataSource.getRepository(Produto).findOneByOrFail({ nome: 'Kibe' });
    const produtos = app.get(ProdutosService);
    await produtos.definirPreco(
      kibe.id,
      { preparo: 'FRITO', unidadeVenda: 'CENTO', precoCentavos: 12500 },
      admin.id,
    );
    const pastel = await dataSource
      .getRepository(Produto)
      .findOneByOrFail({ nome: 'Pastel de queijo' });
    await produtos.atualizar(pastel.id, { ativo: false }, admin.id);
    const congelado = await dataSource.getRepository(PrecoProduto).findOneByOrFail({
      produtoId: kibe.id,
      preparo: 'CONGELADO',
      vigenteAte: IsNull(),
    });
    await produtos.encerrarPreco(kibe.id, congelado.id, admin.id);

    const segunda = await carregarCatalogo(app, catalogoDoServidor, admin.id);

    expect(await dataSource.getRepository(Produtor).count()).toBe(3);
    expect(await dataSource.getRepository(Produto).count()).toBe(12);
    // Só volta o preço congelado do kibe, que tinha sido tirado da tabela.
    expect(segunda.criados).toEqual(['Preço Kibe, congelado por cento: R$ 100,00']);
    expect(segunda.mantidos).toContain('Preço Kibe, frito por cento: R$ 125,00');
    expect(segunda.mantidos).toContain('Produto Pastel de queijo (inativo)');
    const vigentesDoPastel = await dataSource
      .getRepository(PrecoProduto)
      .countBy({ produtoId: pastel.id, vigenteAte: IsNull() });
    expect(vigentesDoPastel).toBe(2);
  });

  it('acha produtor e produto já cadastrados com outra grafia de maiúsculas', async () => {
    const admin = await criarUsuario(app, { papel: 'ADMIN' });
    await dataSource.getRepository(Produtor).save({ nome: 'MIRA' });

    const relatorio = await carregarCatalogo(
      app,
      lerCatalogo({
        produtores: ['Mira'],
        produtos: [
          { nome: 'Esfiha de carne', produtor: 'Mira', precos: { ASSADO: { CENTO: 11000 } } },
        ],
      }),
      admin.id,
    );

    expect(relatorio.mantidos).toEqual(['Produtor MIRA']);
    const esfiha = await dataSource.getRepository(Produto).findOneOrFail({
      where: { nome: 'Esfiha de carne' },
      relations: { produtorPadrao: true },
    });
    expect(esfiha.produtorPadrao?.nome).toBe('MIRA');
  });
});
