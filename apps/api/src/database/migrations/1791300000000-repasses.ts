import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repasses: o dinheiro entregue a cada produtor, registrado quando e como a
 * família quiser (opcional). O saldo de cada um é o valor dos salgados que fez
 * menos o que já recebeu. Desfazer é lógico: o lançamento fica no histórico.
 */
export class Repasses1791300000000 implements MigrationInterface {
  name = 'Repasses1791300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE forma_repasse AS ENUM ('PIX', 'DINHEIRO')`);
    await queryRunner.query(`
      CREATE TABLE repasses (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        produtor_id uuid NOT NULL,
        valor numeric(10, 2) NOT NULL,
        forma forma_repasse NOT NULL,
        data date NOT NULL,
        observacao varchar(200),
        registrado_por uuid NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT now(),
        desfeito_em timestamptz,
        desfeito_por uuid,
        CONSTRAINT pk_repasses PRIMARY KEY (id),
        CONSTRAINT fk_repasses_produtor FOREIGN KEY (produtor_id) REFERENCES produtores (id),
        CONSTRAINT fk_repasses_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios (id),
        CONSTRAINT fk_repasses_desfeito_por FOREIGN KEY (desfeito_por) REFERENCES usuarios (id),
        CONSTRAINT ck_repasses_valor_positivo CHECK (valor > 0),
        CONSTRAINT ck_repasses_desfeito_completo CHECK ((desfeito_em IS NULL) = (desfeito_por IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_repasses_produtor_id ON repasses (produtor_id, data, criado_em)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE repasses`);
    await queryRunner.query(`DROP TYPE forma_repasse`);
  }
}
