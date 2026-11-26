import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarChavesIdempotencia1791500000000 implements MigrationInterface {
  name = 'CriarChavesIdempotencia1791500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chaves_idempotencia (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL,
        rota varchar(80) NOT NULL,
        chave varchar(128) NOT NULL,
        hash_requisicao char(64) NOT NULL,
        pedido_id uuid NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT now(),
        expira_em timestamptz NOT NULL,
        CONSTRAINT pk_chaves_idempotencia PRIMARY KEY (id),
        CONSTRAINT uq_chaves_idempotencia_escopo UNIQUE (usuario_id, rota, chave),
        CONSTRAINT fk_chaves_idempotencia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
        CONSTRAINT fk_chaves_idempotencia_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
        CONSTRAINT ck_chaves_idempotencia_chave_preenchida CHECK (btrim(chave) <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_chaves_idempotencia_expira_em ON chaves_idempotencia (expira_em)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE chaves_idempotencia');
  }
}
