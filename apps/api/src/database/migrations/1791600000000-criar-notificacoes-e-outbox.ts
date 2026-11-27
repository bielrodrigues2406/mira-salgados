import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarNotificacoesEOutbox1791600000000 implements MigrationInterface {
  name = 'CriarNotificacoesEOutbox1791600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pedidos
        ADD COLUMN notificacao_revisao integer NOT NULL DEFAULT 0,
        ADD COLUMN notificacao_hash char(64),
        ADD CONSTRAINT ck_pedidos_notificacao_revisao_nao_negativa CHECK (notificacao_revisao >= 0)
    `);

    await queryRunner.query(
      `CREATE TYPE tipo_regra_notificacao AS ENUM ('AVISO_IMEDIATO', 'RESUMO_DIARIO')`,
    );
    await queryRunner.query(
      `CREATE TYPE filtro_encomenda_notificacao AS ENUM ('TODAS', 'POR_PREPARO')`,
    );
    await queryRunner.query(
      `CREATE TYPE escopo_itens_mensagem AS ENUM ('TODOS', 'APENAS_FILTRADOS')`,
    );
    await queryRunner.query(
      `CREATE TYPE status_envio_notificacao AS ENUM ('PENDENTE', 'ACEITO', 'ENTREGUE', 'FALHA', 'INCERTO', 'SUBSTITUIDO', 'EXPIRADO', 'CANCELADO')`,
    );
    await queryRunner.query(
      `CREATE TYPE tipo_evento_notificacao AS ENUM ('AVISO_IMEDIATO', 'CORRECAO', 'CANCELAMENTO', 'RESUMO_DIARIO', 'COMPLEMENTO', 'TESTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE modo_conector_notificacao AS ENUM ('DESLIGADO', 'SIMULADO', 'GOWA', 'WAHA')`,
    );
    await queryRunner.query(
      `CREATE TYPE estado_conexao_notificacao AS ENUM ('DESLIGADO', 'SIMULADO', 'CONECTADO', 'DESCONECTADO', 'PAUSADO')`,
    );

    await queryRunner.query(`
      CREATE TABLE destinos_notificacao (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(120) NOT NULL,
        canal varchar(20) NOT NULL DEFAULT 'WHATSAPP',
        identificador_externo varchar(160),
        ativo boolean NOT NULL DEFAULT true,
        aprovado_em timestamptz,
        aprovado_por_id uuid,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_destinos_notificacao PRIMARY KEY (id),
        CONSTRAINT fk_destinos_notificacao_aprovado_por FOREIGN KEY (aprovado_por_id) REFERENCES usuarios (id),
        CONSTRAINT ck_destinos_notificacao_nome_preenchido CHECK (btrim(nome) <> ''),
        CONSTRAINT ck_destinos_notificacao_identificador_preenchido CHECK (btrim(identificador_externo) <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_destinos_notificacao_ativo ON destinos_notificacao (ativo)',
    );

    await queryRunner.query(`
      CREATE TABLE regras_notificacao (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(120) NOT NULL,
        tipo tipo_regra_notificacao NOT NULL,
        ativa boolean NOT NULL DEFAULT false,
        destino_id uuid NOT NULL,
        filtro_encomenda filtro_encomenda_notificacao NOT NULL DEFAULT 'POR_PREPARO',
        preparos jsonb NOT NULL,
        modalidades jsonb NOT NULL,
        escopo_itens escopo_itens_mensagem NOT NULL DEFAULT 'TODOS',
        enviar_correcoes boolean NOT NULL DEFAULT true,
        enviar_cancelamentos boolean NOT NULL DEFAULT true,
        debounce_segundos integer NOT NULL DEFAULT 30,
        dias_semana jsonb NOT NULL,
        horario_resumo varchar(5),
        fuso_horario varchar(60) NOT NULL DEFAULT 'America/Sao_Paulo',
        omitir_dias_vazios boolean NOT NULL DEFAULT true,
        incluir_concluidos boolean NOT NULL DEFAULT true,
        enviar_complementos boolean NOT NULL DEFAULT true,
        tolerancia_atraso_minutos integer NOT NULL DEFAULT 120,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_regras_notificacao PRIMARY KEY (id),
        CONSTRAINT fk_regras_notificacao_destino FOREIGN KEY (destino_id) REFERENCES destinos_notificacao (id),
        CONSTRAINT ck_regras_notificacao_nome_preenchido CHECK (btrim(nome) <> ''),
        CONSTRAINT ck_regras_notificacao_debounce CHECK (debounce_segundos >= 0 AND debounce_segundos <= 600),
        CONSTRAINT ck_regras_notificacao_tolerancia CHECK (tolerancia_atraso_minutos >= 0 AND tolerancia_atraso_minutos <= 1440),
        CONSTRAINT ck_regras_notificacao_horario_resumo CHECK (horario_resumo ~ '^[0-2][0-9]:[0-5][0-9]$')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_regras_notificacao_tipo_ativa ON regras_notificacao (tipo, ativa)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_regras_notificacao_destino_id ON regras_notificacao (destino_id)',
    );

    await queryRunner.query(`
      CREATE TABLE outbox_notificacoes (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        chave_deduplicacao varchar(180) NOT NULL,
        tipo_evento tipo_evento_notificacao NOT NULL,
        status status_envio_notificacao NOT NULL DEFAULT 'PENDENTE',
        regra_id uuid,
        destino_id uuid NOT NULL,
        destino_identificador_externo varchar(160),
        pedido_id uuid,
        pedido_revisao integer,
        data_referencia date,
        texto_renderizado text,
        disponivel_em timestamptz NOT NULL,
        expira_em timestamptz,
        envio_iniciado_em timestamptz,
        reservado_ate timestamptz,
        reservado_por varchar(80),
        tentativas integer NOT NULL DEFAULT 0,
        max_tentativas integer NOT NULL DEFAULT 5,
        id_externo varchar(160),
        ultimo_erro varchar(500),
        enviado_em timestamptz,
        entregue_em timestamptz,
        copiado_manualmente_em timestamptz,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_outbox_notificacoes PRIMARY KEY (id),
        CONSTRAINT uq_outbox_notificacoes_chave_deduplicacao UNIQUE (chave_deduplicacao),
        CONSTRAINT fk_outbox_notificacoes_regra FOREIGN KEY (regra_id) REFERENCES regras_notificacao (id),
        CONSTRAINT fk_outbox_notificacoes_destino FOREIGN KEY (destino_id) REFERENCES destinos_notificacao (id),
        CONSTRAINT fk_outbox_notificacoes_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
        CONSTRAINT ck_outbox_notificacoes_chave_preenchida CHECK (btrim(chave_deduplicacao) <> ''),
        CONSTRAINT ck_outbox_notificacoes_tentativas CHECK (tentativas >= 0 AND max_tentativas >= 1)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_outbox_notificacoes_fila ON outbox_notificacoes (status, disponivel_em)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_outbox_notificacoes_pedido_destino ON outbox_notificacoes (pedido_id, destino_id, status)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_outbox_notificacoes_id_externo ON outbox_notificacoes (id_externo)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_outbox_notificacoes_criado_em ON outbox_notificacoes (criado_em)',
    );

    await queryRunner.query(`
      CREATE TABLE recibos_notificacao (
        id_externo varchar(160) NOT NULL,
        recebido_em timestamptz NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_recibos_notificacao PRIMARY KEY (id_externo),
        CONSTRAINT ck_recibos_notificacao_id_preenchido CHECK (btrim(id_externo) <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_recibos_notificacao_criado_em ON recibos_notificacao (criado_em)',
    );

    await queryRunner.query(`
      CREATE TABLE execucoes_resumo_diario (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        regra_id uuid NOT NULL,
        destino_id uuid NOT NULL,
        data_referencia date NOT NULL,
        desfecho varchar(20) NOT NULL,
        outbox_id uuid,
        criado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_execucoes_resumo_diario PRIMARY KEY (id),
        CONSTRAINT uq_execucoes_resumo_diario_chave UNIQUE (regra_id, destino_id, data_referencia),
        CONSTRAINT fk_execucoes_resumo_diario_regra FOREIGN KEY (regra_id) REFERENCES regras_notificacao (id),
        CONSTRAINT fk_execucoes_resumo_diario_destino FOREIGN KEY (destino_id) REFERENCES destinos_notificacao (id),
        CONSTRAINT fk_execucoes_resumo_diario_outbox FOREIGN KEY (outbox_id) REFERENCES outbox_notificacoes (id) ON DELETE SET NULL,
        CONSTRAINT ck_execucoes_resumo_diario_desfecho CHECK (desfecho IN ('AGENDADO', 'OMITIDO', 'EXPIRADO'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_execucoes_resumo_diario_data ON execucoes_resumo_diario (data_referencia, regra_id, destino_id)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_execucoes_resumo_diario_criado_em ON execucoes_resumo_diario (criado_em)',
    );

    await queryRunner.query(`
      CREATE TABLE resumos_enviados_pedidos (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        outbox_id uuid NOT NULL,
        regra_id uuid NOT NULL,
        destino_id uuid NOT NULL,
        data_referencia date NOT NULL,
        pedido_id uuid NOT NULL,
        pedido_revisao integer NOT NULL,
        criado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_resumos_enviados_pedidos PRIMARY KEY (id),
        CONSTRAINT uq_resumos_enviados_outbox_pedido UNIQUE (outbox_id, pedido_id),
        CONSTRAINT fk_resumos_enviados_outbox FOREIGN KEY (outbox_id) REFERENCES outbox_notificacoes (id) ON DELETE CASCADE,
        CONSTRAINT fk_resumos_enviados_regra FOREIGN KEY (regra_id) REFERENCES regras_notificacao (id),
        CONSTRAINT fk_resumos_enviados_destino FOREIGN KEY (destino_id) REFERENCES destinos_notificacao (id),
        CONSTRAINT fk_resumos_enviados_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_resumos_enviados_consulta ON resumos_enviados_pedidos (data_referencia, destino_id, pedido_id)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_resumos_enviados_pedido_id ON resumos_enviados_pedidos (pedido_id)',
    );

    await queryRunner.query(`
      CREATE TABLE estado_conector_notificacao (
        canal varchar(20) NOT NULL,
        modo modo_conector_notificacao NOT NULL DEFAULT 'SIMULADO',
        estado estado_conexao_notificacao NOT NULL DEFAULT 'SIMULADO',
        pausado boolean NOT NULL DEFAULT false,
        motivo_pausa varchar(240),
        ultimo_erro varchar(500),
        ultima_verificacao_em timestamptz,
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_estado_conector_notificacao PRIMARY KEY (canal)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE estado_conector_notificacao');
    await queryRunner.query('DROP TABLE resumos_enviados_pedidos');
    await queryRunner.query('DROP TABLE execucoes_resumo_diario');
    await queryRunner.query('DROP TABLE recibos_notificacao');
    await queryRunner.query('DROP TABLE outbox_notificacoes');
    await queryRunner.query('DROP TABLE regras_notificacao');
    await queryRunner.query('DROP TABLE destinos_notificacao');
    await queryRunner.query('DROP TYPE estado_conexao_notificacao');
    await queryRunner.query('DROP TYPE modo_conector_notificacao');
    await queryRunner.query('DROP TYPE tipo_evento_notificacao');
    await queryRunner.query('DROP TYPE status_envio_notificacao');
    await queryRunner.query('DROP TYPE escopo_itens_mensagem');
    await queryRunner.query('DROP TYPE filtro_encomenda_notificacao');
    await queryRunner.query('DROP TYPE tipo_regra_notificacao');
    await queryRunner.query(`
      ALTER TABLE pedidos
        DROP CONSTRAINT ck_pedidos_notificacao_revisao_nao_negativa,
        DROP COLUMN notificacao_hash,
        DROP COLUMN notificacao_revisao
    `);
  }
}
