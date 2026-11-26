import { describe, expect, it } from 'vitest';

import { formatarAvisoPedido, formatarResumoDiario, sanitizarTextoWhatsApp } from './formatacao.js';
import type { ProjecaoPedido } from './projecao.js';

const REGEX_EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}/u;

const PEDIDO_MISTO: ProjecaoPedido = {
  pedidoId: 'ped-1',
  numero: 1043,
  status: 'CONFIRMADO',
  dataEntrega: '2026-10-02',
  horarioEntrega: '18:30',
  tipoEntrega: 'ENTREGA',
  itens: [
    {
      produtoId: 'p1',
      produtoNome: 'Esfiha *de* _carne_\nEspecial',
      preparo: 'ASSADO',
      unidades: 100,
    },
    { produtoId: 'p2', produtoNome: 'Coxinha de frango', preparo: 'FRITO', unidades: 100 },
  ],
};

describe('formatação de mensagens para WhatsApp', () => {
  it('sanitiza caracteres de marcação e quebras de linha no nome do produto', () => {
    expect(sanitizarTextoWhatsApp('Esfiha *de* _carne_ ~boa~ `top`\nlinha 2')).toBe(
      'Esfiha de carne boa top linha 2',
    );
  });

  it('formata aviso imediato com destaque em assados, sem emojis e sem dados sensíveis', () => {
    const texto = formatarAvisoPedido('AVISO_IMEDIATO', PEDIDO_MISTO, {
      itens: PEDIDO_MISTO.itens,
      destacarPreparos: ['ASSADO'],
    });

    expect(texto).toBe(
      [
        '*Nova encomenda #1043*',
        'Sex, 2 out · 18:30 · Entrega',
        '• *100 Esfiha de carne Especial (assado)*',
        '• 100 Coxinha de frango (frito)',
      ].join('\n'),
    );
    expect(REGEX_EMOJI.test(texto)).toBe(false);
  });

  it('formata cancelamento e remoção do último item filtrado', () => {
    const cancelado = formatarAvisoPedido('CANCELAMENTO', PEDIDO_MISTO, { itens: [] });
    expect(cancelado).toContain('*Encomenda cancelada #1043*');
    expect(cancelado).toContain('Não precisa mais preparar');

    const removido = formatarAvisoPedido('CORRECAO', PEDIDO_MISTO, {
      itens: [],
      removidoDoFiltro: true,
    });
    expect(removido).toContain('*Encomenda alterada #1043*');
    expect(removido).toContain('Nenhum item correspondente restante');
  });

  it('formata resumo diário ordenado por horário (sem horário no fim) e sinaliza concluídos', () => {
    const semHorario: ProjecaoPedido = {
      ...PEDIDO_MISTO,
      pedidoId: 'ped-3',
      numero: 1045,
      horarioEntrega: null,
      tipoEntrega: 'RETIRADA',
      itens: [
        { produtoId: 'p3', produtoNome: 'Empadinha de frango', preparo: 'ASSADO', unidades: 50 },
      ],
    };
    const concluido: ProjecaoPedido = {
      ...PEDIDO_MISTO,
      pedidoId: 'ped-2',
      numero: 1042,
      status: 'CONCLUIDO',
      horarioEntrega: '11:30',
      tipoEntrega: 'RETIRADA',
      itens: [
        { produtoId: 'p1', produtoNome: 'Esfiha de carne', preparo: 'ASSADO', unidades: 100 },
      ],
    };

    const resumo = formatarResumoDiario('2026-10-02', [
      { projecao: semHorario, itens: semHorario.itens },
      { projecao: concluido, itens: concluido.itens },
    ]);

    expect(resumo).toBe(
      [
        '*Resumo de encomendas · Sex, 2 out*',
        '2 encomendas · 150 salgados',
        '',
        '*#1042 · 11:30 · Retirada* (concluído)',
        '• *100 Esfiha de carne (assado)*',
        '',
        '*#1045 · Sem horário · Retirada*',
        '• *50 Empadinha de frango (assado)*',
      ].join('\n'),
    );
    expect(REGEX_EMOJI.test(resumo)).toBe(false);
  });
});
