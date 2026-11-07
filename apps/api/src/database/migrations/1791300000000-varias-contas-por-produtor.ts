import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Um produtor pode ser mais de uma pessoa ("Mariellen e Elton"): cada uma tem
 * a sua conta, ligada ao mesmo produtor. Sai a unicidade; fica um índice para
 * a chave estrangeira.
 */
export class VariasContasPorProdutor1791300000000 implements MigrationInterface {
  name = 'VariasContasPorProdutor1791300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE usuarios DROP CONSTRAINT uq_usuarios_produtor`);
    await queryRunner.query(`CREATE INDEX idx_usuarios_produtor ON usuarios (produtor_id)`);
  }

  // Volta a exigir uma conta por produtor; falha se algum já tiver duas.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_usuarios_produtor`);
    await queryRunner.query(
      `ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_produtor UNIQUE (produtor_id)`,
    );
  }
}
