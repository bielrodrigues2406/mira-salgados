import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarUsuariosSessoesEAuditoria1790500000000 implements MigrationInterface {
  name = 'CriarUsuariosSessoesEAuditoria1790500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE usuarios (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        nome varchar(120) NOT NULL,
        email varchar(254) NOT NULL,
        senha_hash varchar(255) NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        criado_em timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_usuarios PRIMARY KEY (id),
        CONSTRAINT uq_usuarios_email UNIQUE (email),
        CONSTRAINT ck_usuarios_email_minusculo CHECK (email = lower(email))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL,
        family_id uuid NOT NULL,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
        CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT fk_refresh_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_refresh_tokens_usuario_id ON refresh_tokens (usuario_id)',
    );

    await queryRunner.query(`
      CREATE TABLE logs_auditoria (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        entidade varchar(60) NOT NULL,
        entidade_id varchar(64) NOT NULL,
        acao varchar(40) NOT NULL,
        dados_antes jsonb,
        dados_depois jsonb,
        usuario_id uuid,
        criado_em timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_logs_auditoria PRIMARY KEY (id),
        CONSTRAINT fk_logs_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ix_logs_auditoria_entidade ON logs_auditoria (entidade, entidade_id, criado_em)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_logs_auditoria_criado_em ON logs_auditoria (criado_em)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_logs_auditoria_usuario_id ON logs_auditoria (usuario_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE logs_auditoria');
    await queryRunner.query('DROP TABLE refresh_tokens');
    await queryRunner.query('DROP TABLE usuarios');
  }
}
