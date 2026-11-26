import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type { TipoEventoNotificacao } from './enums.js';
import type { ItemProjetado, ProjecaoPedido } from './projecao.js';

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

const ROTULO_PREPARO: Record<Preparo, string> = {
  FRITO: '(frito)',
  ASSADO: '(assado)',
  CONGELADO: '(congelado)',
};

const ROTULO_MODALIDADE: Record<TipoEntrega, string> = {
  ENTREGA: 'Entrega',
  RETIRADA: 'Retirada',
};

/**
 * Remove caracteres de marcação do WhatsApp e quebras de linha para evitar
 * quebra de formatação ou injeção visual via nomes cadastrados no catálogo.
 */
export function sanitizarTextoWhatsApp(texto: string): string {
  return texto
    .replace(/[*_~`]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function negritoWhatsApp(texto: string): string {
  const limpo = sanitizarTextoWhatsApp(texto);
  return limpo ? `*${limpo}*` : '';
}

/** Formata "AAAA-MM-DD" como "Sex, 2 out" sem depender do fuso da máquina. */
export function formatarDataCurta(dataIso: string): string {
  const [ano = 1970, mes = 1, dia = 1] = dataIso.split('-').map(Number);
  const utc = new Date(Date.UTC(ano, mes - 1, dia));
  const diaSemana = DIAS_CURTOS[utc.getUTCDay()] ?? '';
  const nomeMes = MESES_CURTOS[utc.getUTCMonth()] ?? '';
  return `${diaSemana}, ${String(dia)} ${nomeMes}`;
}

export function formatarLinhaItem(
  item: ItemProjetado,
  destacarPreparos: readonly Preparo[] = ['ASSADO'],
): string {
  const nome = sanitizarTextoWhatsApp(item.produtoNome);
  const base = `${String(item.unidades)} ${nome} ${ROTULO_PREPARO[item.preparo]}`;
  return destacarPreparos.includes(item.preparo) ? `• *${base}*` : `• ${base}`;
}

function cabecalhoPedido(
  evento: Extract<
    TipoEventoNotificacao,
    'AVISO_IMEDIATO' | 'CORRECAO' | 'CANCELAMENTO' | 'COMPLEMENTO' | 'TESTE'
  >,
  numero: number,
): string {
  const ref = `#${String(numero)}`;
  switch (evento) {
    case 'AVISO_IMEDIATO':
      return negritoWhatsApp(`Nova encomenda ${ref}`);
    case 'CORRECAO':
      return negritoWhatsApp(`Encomenda alterada ${ref}`);
    case 'CANCELAMENTO':
      return negritoWhatsApp(`Encomenda cancelada ${ref}`);
    case 'COMPLEMENTO':
      return negritoWhatsApp(`Complemento de encomenda ${ref}`);
    case 'TESTE':
      return negritoWhatsApp(`Teste de aviso · encomenda ${ref}`);
  }
}

function linhaQuandoEModalidade(projecao: ProjecaoPedido): string {
  const partes = [
    formatarDataCurta(projecao.dataEntrega),
    projecao.horarioEntrega ?? 'Sem horário',
    ROTULO_MODALIDADE[projecao.tipoEntrega],
  ];
  return partes.join(' · ');
}

export interface OpcoesFormatacaoAviso {
  itens: readonly ItemProjetado[];
  destacarPreparos?: readonly Preparo[];
  /** Opcional: motivo breve quando uma alteração retirou o último item filtrado. */
  removidoDoFiltro?: boolean;
}

/**
 * Formata aviso imediato, correção, cancelamento, complemento ou teste para o
 * grupo da equipe. Nunca inclui dados do cliente, preços, produtor ou
 * observações livres.
 */
export function formatarAvisoPedido(
  evento: Extract<
    TipoEventoNotificacao,
    'AVISO_IMEDIATO' | 'CORRECAO' | 'CANCELAMENTO' | 'COMPLEMENTO' | 'TESTE'
  >,
  projecao: ProjecaoPedido,
  opcoes: OpcoesFormatacaoAviso,
): string {
  const destacar = opcoes.destacarPreparos ?? ['ASSADO'];
  const linhas: string[] = [
    cabecalhoPedido(evento, projecao.numero),
    linhaQuandoEModalidade(projecao),
  ];

  if (evento === 'CANCELAMENTO') {
    linhas.push('Não precisa mais preparar os itens desta encomenda.');
    return linhas.join('\n');
  }

  if (opcoes.removidoDoFiltro || opcoes.itens.length === 0) {
    linhas.push('Nenhum item correspondente restante nesta encomenda.');
    return linhas.join('\n');
  }

  for (const item of opcoes.itens) {
    linhas.push(formatarLinhaItem(item, destacar));
  }
  return linhas.join('\n');
}

export interface PedidoParaResumo {
  projecao: ProjecaoPedido;
  itens: readonly ItemProjetado[];
}

export interface OpcoesFormatacaoResumo {
  destacarPreparos?: readonly Preparo[];
  teste?: boolean;
}

function compararParaResumo(a: PedidoParaResumo, b: PedidoParaResumo): number {
  const ha = a.projecao.horarioEntrega;
  const hb = b.projecao.horarioEntrega;
  if (ha !== null && hb === null) return -1;
  if (ha === null && hb !== null) return 1;
  if (ha !== null && hb !== null && ha !== hb) return ha.localeCompare(hb);
  return a.projecao.numero - b.projecao.numero;
}

function contagem(valor: number, singular: string, plural: string): string {
  return `${String(valor)} ${valor === 1 ? singular : plural}`;
}

/**
 * Formata o resumo diário ordenado por horário (sem horário no fim) e número do
 * pedido. Encomendas já concluídas entram sinalizadas com `(concluído)`.
 */
export function formatarResumoDiario(
  dataIso: string,
  pedidos: readonly PedidoParaResumo[],
  opcoes: OpcoesFormatacaoResumo = {},
): string {
  const destacar = opcoes.destacarPreparos ?? ['ASSADO'];
  const prefixo = opcoes.teste ? 'Teste de resumo' : 'Resumo de encomendas';
  const titulo = negritoWhatsApp(`${prefixo} · ${formatarDataCurta(dataIso)}`);

  if (pedidos.length === 0) {
    return `${titulo}\nNenhuma encomenda correspondente para este dia.`;
  }

  const ordenados = [...pedidos].sort(compararParaResumo);
  const totalUnidades = ordenados.reduce(
    (soma, entrada) => soma + entrada.itens.reduce((acc, item) => acc + item.unidades, 0),
    0,
  );

  const linhas: string[] = [
    titulo,
    `${contagem(ordenados.length, 'encomenda', 'encomendas')} · ${contagem(totalUnidades, 'salgado', 'salgados')}`,
  ];

  for (const { projecao, itens } of ordenados) {
    const horario = projecao.horarioEntrega ?? 'Sem horário';
    const modalidade = ROTULO_MODALIDADE[projecao.tipoEntrega];
    const sufixoConcluido = projecao.status === 'CONCLUIDO' ? ' (concluído)' : '';
    linhas.push('');
    linhas.push(
      `${negritoWhatsApp(`#${String(projecao.numero)} · ${horario} · ${modalidade}`)}${sufixoConcluido}`,
    );
    for (const item of itens) {
      linhas.push(formatarLinhaItem(item, destacar));
    }
  }

  return linhas.join('\n');
}
