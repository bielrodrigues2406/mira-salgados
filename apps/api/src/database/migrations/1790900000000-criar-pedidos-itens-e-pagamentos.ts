import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarPedidosItensEPagamentos1790900000000 implements MigrationInterface {
  name = 'CriarPedidosItensEPagamentos1790900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE status_pedido AS ENUM ('RASCUNHO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO')`,
    );
    await queryRunner.query(`CREATE TYPE tipo_entrega AS ENUM ('RETIRADA', 'ENTREGA')`);
    await queryRunner.query(`CREATE TYPE forma_pagamento AS ENUM ('DINHEIRO', 'PIX', 'FIADO')`);

    // Entrega ou retirada é só informação logística: não há taxa nem registro
    // de quem entregou (decisão D3, revista em 27/09/2026).
    await queryRunner.query(`
      CREATE TABLE pedidos (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        numero integer GENERATED ALWAYS AS IDENTITY,
        cliente_id uuid NOT NULL,
        usuario_id uuid NOT NULL,
        status status_pedido NOT NULL DEFAULT 'RASCUNHO',
        tipo_entrega tipo_entrega NOT NULL,
        desconto numeric(10,2) NOT NULL DEFAULT 0,
        observacao varchar(500),
        data_entrega date NOT NULL,
        horario_entrega time,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_pedidos PRIMARY KEY (id),
        CONSTRAINT uq_pedidos_numero UNIQUE (numero),
        CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
        CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
        CONSTRAINT ck_pedidos_desconto_nao_negativo CHECK (desconto >= 0),
        CONSTRAINT ck_pedidos_observacao_preenchida CHECK (btrim(observacao) <> '')
      )
    `);
    // Lista por data, produção do dia e acerto filtram por data de entrega e status.
    await queryRunner.query(
      'CREATE INDEX ix_pedidos_data_entrega_status ON pedidos (data_entrega, status)',
    );
    // Saldo devedor e fiados de um cliente.
    await queryRunner.query(
      'CREATE INDEX ix_pedidos_cliente_status ON pedidos (cliente_id, status)',
    );

    await queryRunner.query(`
      CREATE TABLE itens_pedido (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        pedido_id uuid NOT NULL,
        produto_id uuid NOT NULL,
        produtor_id uuid NOT NULL,
        preparo preparo NOT NULL,
        unidade_venda unidade_venda NOT NULL,
        quantidade integer NOT NULL,
        preco_unitario numeric(10,2) NOT NULL,
        observacao varchar(300),
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_itens_pedido PRIMARY KEY (id),
        CONSTRAINT fk_itens_pedido_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
        CONSTRAINT fk_itens_pedido_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
        CONSTRAINT fk_itens_pedido_produtor FOREIGN KEY (produtor_id) REFERENCES produtores (id),
        CONSTRAINT ck_itens_pedido_quantidade_positiva CHECK (quantidade > 0),
        CONSTRAINT ck_itens_pedido_preco_positivo CHECK (preco_unitario > 0),
        CONSTRAINT ck_itens_pedido_observacao_preenchida CHECK (btrim(observacao) <> '')
      )
    `);
    await queryRunner.query('CREATE INDEX ix_itens_pedido_pedido_id ON itens_pedido (pedido_id)');
    // Produção e acerto somam por produtor.
    await queryRunner.query(
      'CREATE INDEX ix_itens_pedido_produtor_id ON itens_pedido (produtor_id)',
    );
    await queryRunner.query('CREATE INDEX ix_itens_pedido_produto_id ON itens_pedido (produto_id)');

    // Estorno é lógico: o lançamento continua visível com quem o estornou e quando.
    await queryRunner.query(`
      CREATE TABLE pagamentos (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        pedido_id uuid NOT NULL,
        forma forma_pagamento NOT NULL,
        valor numeric(10,2) NOT NULL,
        registrado_por uuid NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT now(),
        estornado_em timestamptz,
        estornado_por uuid,
        CONSTRAINT pk_pagamentos PRIMARY KEY (id),
        CONSTRAINT fk_pagamentos_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
        CONSTRAINT fk_pagamentos_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuarios (id),
        CONSTRAINT fk_pagamentos_estornado_por FOREIGN KEY (estornado_por) REFERENCES usuarios (id),
        CONSTRAINT ck_pagamentos_valor_positivo CHECK (valor > 0),
        CONSTRAINT ck_pagamentos_estorno_completo
          CHECK ((estornado_em IS NULL) = (estornado_por IS NULL))
      )
    `);
    await queryRunner.query('CREATE INDEX ix_pagamentos_pedido_id ON pagamentos (pedido_id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE pagamentos');
    await queryRunner.query('DROP TABLE itens_pedido');
    await queryRunner.query('DROP TABLE pedidos');
    await queryRunner.query('DROP TYPE forma_pagamento');
    await queryRunner.query('DROP TYPE tipo_entrega');
    await queryRunner.query('DROP TYPE status_pedido');
  }
}
