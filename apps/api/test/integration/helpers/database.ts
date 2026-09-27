import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Apaga os dados entre testes sem tocar no esquema nem na tabela de migrations.
export async function limparBanco(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tabelas = dataSource.entityMetadatas.map((metadata) => `"${metadata.tableName}"`);
  if (tabelas.length > 0) {
    await dataSource.query(`TRUNCATE ${tabelas.join(', ')} RESTART IDENTITY CASCADE`);
  }
}
