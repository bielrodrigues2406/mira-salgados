import type { MigrationInterface } from 'typeorm';

import { CriarUsuariosSessoesEAuditoria1790500000000 } from './1790500000000-criar-usuarios-sessoes-e-auditoria.js';
import { CriarProdutores1790600000000 } from './1790600000000-criar-produtores.js';
import { CriarClientes1790700000000 } from './1790700000000-criar-clientes.js';
import { CriarProdutosEPrecos1790800000000 } from './1790800000000-criar-produtos-e-precos.js';

// Lista explícita em vez de glob: funciona igual no build, na CLI do TypeORM e
// nos testes, sem depender de resolução de caminhos em tempo de execução.
export const migrations: (new () => MigrationInterface)[] = [
  CriarUsuariosSessoesEAuditoria1790500000000,
  CriarProdutores1790600000000,
  CriarClientes1790700000000,
  CriarProdutosEPrecos1790800000000,
];
