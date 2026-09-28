import type { DataSource } from 'typeorm';

import type { LogAuditoria } from './log-auditoria.entity.js';

/** Tabela e rótulo de cada tipo de referência que aparece nos snapshots. */
const TABELAS = {
  clientes: 'SELECT id::text, nome AS rotulo FROM clientes WHERE id = ANY($1::uuid[])',
  produtores: 'SELECT id::text, nome AS rotulo FROM produtores WHERE id = ANY($1::uuid[])',
  produtos: 'SELECT id::text, nome AS rotulo FROM produtos WHERE id = ANY($1::uuid[])',
  pedidos:
    "SELECT id::text, 'Pedido #' || numero AS rotulo FROM pedidos WHERE id = ANY($1::uuid[])",
  usuarios: 'SELECT id::text, nome AS rotulo FROM usuarios WHERE id = ANY($1::uuid[])',
} as const;

type Tabela = keyof typeof TABELAS;

const TABELA_DO_CAMPO: Record<string, Tabela> = {
  clienteId: 'clientes',
  produtorId: 'produtores',
  produtorPadraoId: 'produtores',
  produtoId: 'produtos',
  pedidoId: 'pedidos',
  usuarioId: 'usuarios',
  registradoPorId: 'usuarios',
  estornadoPorId: 'usuarios',
};

const TABELA_DA_ENTIDADE: Record<string, Tabela> = {
  cliente: 'clientes',
  produtor: 'produtores',
  produto: 'produtos',
  pedido: 'pedidos',
  usuario: 'usuarios',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids que um registro cita: o da própria entidade e os campos de relação dos snapshots. */
export function idsCitados(log: LogAuditoria): [Tabela, string][] {
  const citados: [Tabela, string][] = [];
  const daEntidade = TABELA_DA_ENTIDADE[log.entidade];
  if (daEntidade && UUID.test(log.entidadeId)) citados.push([daEntidade, log.entidadeId]);
  for (const snapshot of [log.dadosAntes, log.dadosDepois]) {
    for (const [campo, valor] of Object.entries(snapshot ?? {})) {
      const tabela = TABELA_DO_CAMPO[campo];
      if (tabela && typeof valor === 'string' && UUID.test(valor)) citados.push([tabela, valor]);
    }
  }
  return citados;
}

/**
 * Nome legível de cada id citado na página: "Ana Paula", "Pedido #36". Uma
 * consulta por tabela, só com os ids da página. Registros apagados ficam sem
 * nome, e a tela mostra o que o snapshot tiver.
 */
export async function nomesCitados(
  dataSource: DataSource,
  logs: readonly LogAuditoria[],
): Promise<Map<string, string>> {
  const porTabela = new Map<Tabela, Set<string>>();
  for (const [tabela, id] of logs.flatMap(idsCitados)) {
    const ids = porTabela.get(tabela) ?? new Set<string>();
    ids.add(id);
    porTabela.set(tabela, ids);
  }
  const linhas = await Promise.all(
    [...porTabela].map(([tabela, ids]) =>
      dataSource.query<{ id: string; rotulo: string }[]>(TABELAS[tabela], [[...ids]]),
    ),
  );
  return new Map(linhas.flat().map(({ id, rotulo }) => [id, rotulo]));
}
