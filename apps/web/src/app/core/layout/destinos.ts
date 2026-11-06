import type { NomeIcone } from '../../shared/components/icone/icones';

export interface Destino {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
  /** Rotas alcançadas a partir deste destino, que o mantêm marcado na barra inferior. */
  relacionadas?: readonly string[];
}

/** Navegação principal do desktop, na barra lateral. */
export const DESTINOS: readonly Destino[] = [
  { rota: '/inicio', rotulo: 'Início', icone: 'inicio' },
  { rota: '/pedidos', rotulo: 'Pedidos', icone: 'pedidos' },
  { rota: '/producao', rotulo: 'Produção', icone: 'producao' },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { rota: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'relatorios' },
];

/** Cadastros de baixa frequência, em grupo próprio na barra lateral. */
export const CADASTROS: readonly Destino[] = [
  { rota: '/produtores', rotulo: 'Produtores', icone: 'produtor' },
];

/** Só para administradores: contas de acesso e histórico de alterações. */
export const ADMINISTRACAO: readonly Destino[] = [
  { rota: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' },
  { rota: '/alteracoes', rotulo: 'Alterações', icone: 'historico' },
];

/**
 * Barra inferior do celular: só o que se usa todo dia, ao alcance do polegar.
 * O resto fica em "Mais".
 */
export const INFERIORES: readonly Destino[] = DESTINOS.slice(0, 3);

/** O que abre em "Mais" no celular, fora os itens de administração. */
export const MAIS: readonly Destino[] = [...DESTINOS.slice(3), ...CADASTROS];

// Segmentação por grafema: "É" digitado como "E" + acento combinante continua
// sendo uma letra só.
const GRAFEMAS = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

function primeirasLetras(palavra: string, quantidade: number): string {
  return Array.from(GRAFEMAS.segment(palavra), ({ segment }) => segment)
    .slice(0, quantidade)
    .join('');
}

/** Primeira e última iniciais; um nome único usa as duas primeiras letras, como no design. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0] ?? '';
  if (partes.length === 1) return primeirasLetras(primeira, 2).toUpperCase();
  const ultima = partes.at(-1) ?? '';
  return `${primeirasLetras(primeira, 1)}${primeirasLetras(ultima, 1)}`.toUpperCase();
}
