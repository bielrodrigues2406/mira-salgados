import type { NomeIcone } from '../../shared/components/icone/icones';

export interface Destino {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
}

/** Os cinco destinos da navegação principal, na ordem do design. */
export const DESTINOS: readonly Destino[] = [
  { rota: '/pedidos', rotulo: 'Pedidos', icone: 'pedidos' },
  { rota: '/producao', rotulo: 'Produção', icone: 'producao' },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { rota: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'relatorios' },
];

/** Cadastros de baixa frequência: no desktop, grupo próprio; no celular, a partir de Produtos. */
export const CADASTROS: readonly Destino[] = [
  { rota: '/produtores', rotulo: 'Produtores', icone: 'produtor' },
];

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}
