import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Endereço de entrega próprio de cada pedido: pode ser o do cliente ou outro
 * (festa, trabalho, casa de parente). Pedidos de entrega que já existiam
 * recebem o endereço atual do cliente.
 */
export class EnderecoDeEntregaNoPedido1791200000000 implements MigrationInterface {
  name = 'EnderecoDeEntregaNoPedido1791200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pedidos
        ADD COLUMN endereco_entrega varchar(200),
        ADD CONSTRAINT ck_pedidos_endereco_entrega_preenchido CHECK (btrim(endereco_entrega) <> '')
    `);
    await queryRunner.query(`
      UPDATE pedidos p
         SET endereco_entrega = c.endereco
        FROM clientes c
       WHERE c.id = p.cliente_id
         AND p.tipo_entrega = 'ENTREGA'
         AND c.endereco IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pedidos
        DROP CONSTRAINT ck_pedidos_endereco_entrega_preenchido,
        DROP COLUMN endereco_entrega
    `);
  }
}
