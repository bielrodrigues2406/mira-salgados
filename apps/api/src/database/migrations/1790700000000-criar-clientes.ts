import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarClientes1790700000000 implements MigrationInterface {
  name = 'CriarClientes1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Extensões confiáveis desde o PostgreSQL 13: o dono do banco as cria sem
    // superusuário.
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    // unaccent() é STABLE porque o dicionário pode mudar; a versão com o
    // dicionário fixo é imutável e pode entrar em índice.
    await queryRunner.query(`
      CREATE FUNCTION immutable_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    `);

    await queryRunner.query(`
      CREATE TABLE clientes (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(120) COLLATE "pt-BR-x-icu" NOT NULL,
        telefone varchar(11),
        endereco varchar(200),
        ativo boolean NOT NULL DEFAULT true,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_clientes PRIMARY KEY (id),
        CONSTRAINT ck_clientes_nome_preenchido CHECK (btrim(nome) <> ''),
        CONSTRAINT ck_clientes_telefone_digitos CHECK (telefone ~ '^[0-9]{10,11}$'),
        CONSTRAINT ck_clientes_endereco_preenchido CHECK (btrim(endereco) <> '')
      )
    `);
    // Busca por trecho do nome, sem distinção de maiúsculas e acentos, e por
    // trecho do telefone. Índices trigram atendem LIKE com curinga no início.
    await queryRunner.query(
      'CREATE INDEX ix_clientes_nome_busca ON clientes USING gin (lower(immutable_unaccent(nome)) gin_trgm_ops)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_clientes_telefone_busca ON clientes USING gin (telefone gin_trgm_ops)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE clientes');
    await queryRunner.query('DROP FUNCTION immutable_unaccent(text)');
    await queryRunner.query('DROP EXTENSION IF EXISTS pg_trgm');
    await queryRunner.query('DROP EXTENSION IF EXISTS unaccent');
  }
}
