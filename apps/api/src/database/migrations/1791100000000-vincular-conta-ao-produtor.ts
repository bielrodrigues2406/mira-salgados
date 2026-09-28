import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cada produtor pode ter a sua conta: o painel mostra a produção e os ganhos
 * de quem entrou. Uma conta aponta para no máximo um produtor, e um produtor
 * para no máximo uma conta.
 */
export class VincularContaAoProdutor1791100000000 implements MigrationInterface {
  name = 'VincularContaAoProdutor1791100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN produtor_id uuid,
        ADD CONSTRAINT uq_usuarios_produtor UNIQUE (produtor_id),
        ADD CONSTRAINT fk_usuarios_produtor FOREIGN KEY (produtor_id) REFERENCES produtores (id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        DROP CONSTRAINT fk_usuarios_produtor,
        DROP CONSTRAINT uq_usuarios_produtor,
        DROP COLUMN produtor_id
    `);
  }
}
