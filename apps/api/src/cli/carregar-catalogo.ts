import 'reflect-metadata';

import { readFile } from 'node:fs/promises';
import { argv, stdout } from 'node:process';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { autorDaCarga, carregarCatalogo, lerCatalogo } from './catalogo.js';

/**
 * Carrega produtores, produtos e preços de um arquivo JSON, criando só o que
 * ainda não existe (deploy/mira-salgados/catalogo-inicial.json):
 *
 *   docker compose run --rm -v ./catalogo-inicial.json:/catalogo.json:ro \
 *     api node dist/cli/carregar-catalogo.js /catalogo.json
 *
 * Exige o administrador já criado: a auditoria registra a carga em nome dele.
 */
function falhar(mensagem: string): never {
  stdout.write(`Erro: ${mensagem}\n`);
  process.exit(1);
}

async function principal(): Promise<void> {
  const caminho = argv[2];
  if (caminho === undefined) falhar('informe o caminho do arquivo do catálogo.');

  let catalogo;
  try {
    catalogo = lerCatalogo(JSON.parse(await readFile(caminho, 'utf8')) as unknown);
  } catch (erro) {
    falhar(erro instanceof Error ? erro.message : 'não foi possível ler o catálogo.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const autor = await autorDaCarga(app);
    const relatorio = await carregarCatalogo(app, catalogo, autor.id);
    for (const linha of relatorio.criados) stdout.write(`criado    ${linha}\n`);
    for (const linha of relatorio.mantidos) stdout.write(`mantido   ${linha}\n`);
    stdout.write(
      `Catálogo carregado: ${String(relatorio.criados.length)} criados, ` +
        `${String(relatorio.mantidos.length)} já existiam.\n`,
    );
  } catch (erro) {
    falhar(erro instanceof Error ? erro.message : 'não foi possível concluir.');
  } finally {
    await app.close();
  }
}

await principal();
