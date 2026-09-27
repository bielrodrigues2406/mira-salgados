import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarProdutores1790600000000 implements MigrationInterface {
  name = 'CriarProdutores1790600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE produtores (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(80) COLLATE "pt-BR-x-icu" NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_produtores PRIMARY KEY (id),
        CONSTRAINT ck_produtores_nome_preenchido CHECK (btrim(nome) <> '')
      )
    `);
    // Nome único sem distinção de maiúsculas, inclusive entre inativos: um
    // produtor desativado é reativado, não cadastrado de novo.
    await queryRunner.query('CREATE UNIQUE INDEX uq_produtores_nome ON produtores (lower(nome))');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE produtores');
  }
}
