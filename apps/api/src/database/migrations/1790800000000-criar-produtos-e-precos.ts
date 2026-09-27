import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarProdutosEPrecos1790800000000 implements MigrationInterface {
  name = 'CriarProdutosEPrecos1790800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE produtos (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(80) COLLATE "pt-BR-x-icu" NOT NULL,
        produtor_padrao_id uuid NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_produtos PRIMARY KEY (id),
        CONSTRAINT ck_produtos_nome_preenchido CHECK (btrim(nome) <> ''),
        CONSTRAINT fk_produtos_produtor_padrao FOREIGN KEY (produtor_padrao_id) REFERENCES produtores (id)
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX uq_produtos_nome ON produtos (lower(nome))');
    await queryRunner.query(
      'CREATE INDEX ix_produtos_produtor_padrao_id ON produtos (produtor_padrao_id)',
    );

    await queryRunner.query(`CREATE TYPE preparo AS ENUM ('FRITO', 'ASSADO', 'CONGELADO')`);
    await queryRunner.query(`CREATE TYPE unidade_venda AS ENUM ('UNIDADE', 'CENTO')`);

    // Preço é histórico: trocar um valor encerra a vigência do anterior e cria
    // outro registro. Pedidos guardam o preço praticado, então nada do passado
    // muda quando a tabela muda.
    await queryRunner.query(`
      CREATE TABLE precos_produto (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        produto_id uuid NOT NULL,
        preparo preparo NOT NULL,
        unidade_venda unidade_venda NOT NULL,
        preco numeric(10,2) NOT NULL,
        vigente_desde timestamptz NOT NULL DEFAULT now(),
        vigente_ate timestamptz,
        CONSTRAINT pk_precos_produto PRIMARY KEY (id),
        CONSTRAINT fk_precos_produto_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
        CONSTRAINT ck_precos_produto_preco_positivo CHECK (preco > 0),
        CONSTRAINT ck_precos_produto_periodo CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_desde)
      )
    `);
    // No máximo um preço vigente por combinação de produto, preparo e unidade.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_precos_produto_vigente
        ON precos_produto (produto_id, preparo, unidade_venda)
        WHERE vigente_ate IS NULL
    `);
    await queryRunner.query(
      'CREATE INDEX ix_precos_produto_historico ON precos_produto (produto_id, vigente_desde DESC)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE precos_produto');
    await queryRunner.query('DROP TYPE unidade_venda');
    await queryRunner.query('DROP TYPE preparo');
    await queryRunner.query('DROP TABLE produtos');
  }
}
