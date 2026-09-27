import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contas passam a entrar pelo celular, e ganham papel e a marca de senha
 * provisória. O sistema ainda não tinha ido para produção; contas antigas,
 * criadas por e-mail, ficam sem telefone e não entram até um administrador
 * cadastrar o celular delas pela tela de usuários.
 */
export class ContasPorTelefoneEPapeis1791000000000 implements MigrationInterface {
  name = 'ContasPorTelefoneEPapeis1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE papel_usuario AS ENUM ('ADMIN', 'MEMBRO')`);
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN telefone varchar(11),
        ADD COLUMN papel papel_usuario NOT NULL DEFAULT 'MEMBRO',
        ADD COLUMN trocar_senha boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT uq_usuarios_telefone UNIQUE (telefone),
        ADD CONSTRAINT ck_usuarios_telefone_digitos CHECK (telefone ~ '^[0-9]{10,11}$'),
        DROP CONSTRAINT uq_usuarios_email,
        DROP CONSTRAINT ck_usuarios_email_minusculo,
        DROP COLUMN email
    `);
    // Sessões abertas antes da mudança não carregam o novo modelo de conta.
    await queryRunner.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
        ADD COLUMN email varchar(254),
        DROP CONSTRAINT ck_usuarios_telefone_digitos,
        DROP CONSTRAINT uq_usuarios_telefone,
        DROP COLUMN trocar_senha,
        DROP COLUMN papel,
        DROP COLUMN telefone
    `);
    await queryRunner.query(`UPDATE usuarios SET email = id || '@sem-email.invalid'`);
    await queryRunner.query(`
      ALTER TABLE usuarios
        ALTER COLUMN email SET NOT NULL,
        ADD CONSTRAINT uq_usuarios_email UNIQUE (email),
        ADD CONSTRAINT ck_usuarios_email_minusculo CHECK (email = lower(email))
    `);
    await queryRunner.query('DROP TYPE papel_usuario');
  }
}
