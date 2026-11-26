import { describe, expect, it } from 'vitest';

import type { ProjecaoPedido } from './projecao.js';
import {
  chaveDeduplicacaoPedido,
  chaveDeduplicacaoResumo,
  classificarEventoComplemento,
  classificarEventoImediato,
  type ConfiguracaoRegraNotificacao,
  encomendaCorrespondeARegra,
  itensParaMensagem,
  mudancaIncrementaRevisao,
} from './regras.js';

const REGRA_IMEDIATA: ConfiguracaoRegraNotificacao = {
  id: 'regra-1',
  tipo: 'AVISO_IMEDIATO',
  ativa: true,
  destinoId: 'dest-1',
  filtroEncomenda: 'POR_PREPARO',
  preparos: ['ASSADO'],
  modalidades: [],
  escopoItens: 'TODOS',
  enviarCorrecoes: true,
  enviarCancelamentos: true,
  debounceSegundos: 30,
  diasSemana: [],
  horarioResumo: null,
  fusoHorario: 'America/Sao_Paulo',
  omitirDiasVazios: true,
  incluirConcluidos: true,
  enviarComplementos: false,
  toleranciaAtrasoMinutos: 120,
};

const REGRA_RESUMO: ConfiguracaoRegraNotificacao = {
  ...REGRA_IMEDIATA,
  id: 'regra-2',
  tipo: 'RESUMO_DIARIO',
  escopoItens: 'APENAS_FILTRADOS',
  diasSemana: [0, 1, 2, 3, 4, 5, 6],
  horarioResumo: '07:00',
  enviarComplementos: true,
};

function pedido(parcial: Partial<ProjecaoPedido> = {}): ProjecaoPedido {
  return {
    pedidoId: 'ped-1',
    numero: 1043,
    status: 'CONFIRMADO',
    dataEntrega: '2026-10-02',
    horarioEntrega: '18:30',
    tipoEntrega: 'ENTREGA',
    itens: [
      { produtoId: 'p1', produtoNome: 'Esfiha de carne', preparo: 'ASSADO', unidades: 100 },
      { produtoId: 'p2', produtoNome: 'Coxinha de frango', preparo: 'FRITO', unidades: 100 },
    ],
    ...parcial,
  };
}

describe('regras de notificação', () => {
  it('encomenda mista com assado corresponde à regra de assados e mantém todos os itens quando escopo = TODOS', () => {
    const p = pedido();
    expect(encomendaCorrespondeARegra(p, REGRA_IMEDIATA)).toBe(true);
    expect(itensParaMensagem(p, REGRA_IMEDIATA)).toHaveLength(2);
    expect(itensParaMensagem(p, REGRA_RESUMO)).toHaveLength(1);
    expect(itensParaMensagem(p, REGRA_RESUMO)[0]?.preparo).toBe('ASSADO');
  });

  it('encomenda só de fritos não dispara aviso imediato de assados, mas dispara ao ganhar primeiro assado', () => {
    const soFrito = pedido({
      itens: [
        { produtoId: 'p2', produtoNome: 'Coxinha de frango', preparo: 'FRITO', unidades: 100 },
      ],
    });
    expect(classificarEventoImediato(null, soFrito, REGRA_IMEDIATA)).toBeNull();
    expect(classificarEventoImediato(soFrito, pedido(), REGRA_IMEDIATA)).toBe('AVISO_IMEDIATO');
  });

  it('mudança de data, horário ou modalidade sempre gera correção mesmo com itens assados iguais', () => {
    const antes = pedido();
    expect(
      classificarEventoImediato(antes, pedido({ dataEntrega: '2026-10-03' }), REGRA_IMEDIATA),
    ).toBe('CORRECAO');
    expect(
      classificarEventoImediato(antes, pedido({ horarioEntrega: '19:30' }), REGRA_IMEDIATA),
    ).toBe('CORRECAO');
    expect(
      classificarEventoImediato(antes, pedido({ tipoEntrega: 'RETIRADA' }), REGRA_IMEDIATA),
    ).toBe('CORRECAO');
  });

  it('remover último item assado gera correção; cancelar pedido elegível gera cancelamento', () => {
    const antes = pedido();
    const semAssado = pedido({
      itens: [
        { produtoId: 'p2', produtoNome: 'Coxinha de frango', preparo: 'FRITO', unidades: 100 },
      ],
    });
    expect(classificarEventoImediato(antes, semAssado, REGRA_IMEDIATA)).toBe('CORRECAO');
    expect(classificarEventoImediato(antes, pedido({ status: 'CANCELADO' }), REGRA_IMEDIATA)).toBe(
      'CANCELAMENTO',
    );
  });

  it('transição CONFIRMADO -> CONCLUIDO nunca gera aviso imediato nem incrementa revisão', () => {
    const antes = pedido({ status: 'CONFIRMADO' });
    const depois = pedido({ status: 'CONCLUIDO' });
    expect(mudancaIncrementaRevisao(antes, depois)).toBe(false);
    expect(classificarEventoImediato(antes, depois, REGRA_IMEDIATA)).toBeNull();
    expect(
      classificarEventoComplemento(antes, depois, REGRA_RESUMO, {
        estavaNoResumo: true,
        dataDepoisJaResumida: true,
      }),
    ).toBeNull();
  });

  it('classifica complemento, correção e cancelamento pós-resumo', () => {
    const novo = pedido();
    expect(
      classificarEventoComplemento(null, novo, REGRA_RESUMO, {
        estavaNoResumo: false,
        dataDepoisJaResumida: true,
      }),
    ).toBe('COMPLEMENTO');
    expect(
      classificarEventoComplemento(novo, pedido({ horarioEntrega: '20:00' }), REGRA_RESUMO, {
        estavaNoResumo: true,
        dataDepoisJaResumida: true,
      }),
    ).toBe('CORRECAO');
    expect(
      classificarEventoComplemento(novo, pedido({ status: 'CANCELADO' }), REGRA_RESUMO, {
        estavaNoResumo: true,
        dataDepoisJaResumida: true,
      }),
    ).toBe('CANCELAMENTO');
  });

  it('chave de deduplicação por pedido omite regraId para impedir duplicata entre imediato e complemento', () => {
    expect(chaveDeduplicacaoPedido('dest-1', 'ped-1', 2)).toBe('pedido:ped-1:destino:dest-1:rev:2');
    expect(chaveDeduplicacaoResumo('regra-2', 'dest-1', '2026-10-02')).toBe(
      'resumo:regra:regra-2:destino:dest-1:data:2026-10-02',
    );
  });
});
