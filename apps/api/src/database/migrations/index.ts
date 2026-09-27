import type { MigrationInterface } from 'typeorm';

// Lista explícita em vez de glob: funciona igual no build, na CLI do TypeORM e
// nos testes, sem depender de resolução de caminhos em tempo de execução.
export const migrations: (new () => MigrationInterface)[] = [];
