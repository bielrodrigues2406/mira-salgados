import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Mantém a unidade e os preços históricos; centésimos de cento são salgados inteiros. */
export class QuantidadesFracionadas1791400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE itens_pedido
      ALTER COLUMN quantidade TYPE numeric(8,2),
      ADD CONSTRAINT ck_itens_pedido_unidades_inteiras
        CHECK (unidade_venda = 'CENTO' OR quantidade = trunc(quantidade))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Não arredondar silenciosamente pedidos criados após a migração.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM itens_pedido WHERE quantidade <> trunc(quantidade)) THEN
        RAISE EXCEPTION 'Há pedidos com quantidades fracionadas; reversão interrompida para preservar os dados.';
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE itens_pedido
      DROP CONSTRAINT ck_itens_pedido_unidades_inteiras,
      ALTER COLUMN quantidade TYPE integer`);
  }
}
