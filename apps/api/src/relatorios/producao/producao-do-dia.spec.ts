import { describe, expect, it } from 'vitest';

import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import { type LinhaDeProducao, montarProducaoDoDia, unidadesDe } from './producao-do-dia.js';

interface Pedido {
  numero: number;
  horario: string | null;
  cliente: string;
}

const MIRA = { id: 'mira', nome: 'Mira' };
const CELIA = { id: 'celia', nome: 'Célia' };
const RAFAEL = { id: 'rafael', nome: 'Rafael' };

let sequencia = 0;
function item(
  pedido: Pedido,
  produto: string,
  preparo: Preparo,
  produtor: { id: string; nome: string },
  quantidade: number,
  unidadeVenda: UnidadeVenda = 'CENTO',
  observacaoItem: string | null = null,
): LinhaDeProducao {
  sequencia += 1;
  return {
    pedidoId: `p${String(pedido.numero)}`,
    numero: pedido.numero,
    status: 'CONFIRMADO',
    horario: pedido.horario,
    tipoEntrega: 'RETIRADA',
    observacaoPedido: null,
    cliente: { id: pedido.cliente, nome: pedido.cliente },
    itemId: `i${String(sequencia)}`,
    produto: { id: produto, nome: produto },
    produtor,
    preparo,
    unidadeVenda,
    quantidade,
    observacaoItem,
  };
}

// O dia do protótipo: quatro encomendas, 1.570 salgados, três produtores.
const P1042 = { numero: 1042, horario: '10:00', cliente: 'Ana Paula Ribeiro' };
const P1043 = { numero: 1043, horario: '11:30', cliente: 'Buffet Sabor & Arte' };
const P1044 = { numero: 1044, horario: '15:00', cliente: 'Carla Menezes' };
const P1045 = { numero: 1045, horario: null, cliente: 'Escola Pequeno Príncipe' };
const DIA = [
  item(P1042, 'Coxinha de frango', 'FRITO', MIRA, 2),
  item(P1042, 'Bolinha de queijo', 'FRITO', MIRA, 1),
  item(P1042, 'Empada de palmito', 'ASSADO', RAFAEL, 20, 'UNIDADE'),
  item(P1043, 'Coxinha de frango', 'FRITO', MIRA, 3),
  item(P1043, 'Kibe', 'FRITO', CELIA, 1),
  item(P1043, 'Esfiha de carne', 'ASSADO', CELIA, 1, 'CENTO', 'Metade sem cebola'),
  item(P1043, 'Risole de queijo', 'CONGELADO', RAFAEL, 1),
  item(P1044, 'Esfiha de carne', 'ASSADO', CELIA, 50, 'UNIDADE'),
  item(P1044, 'Enroladinho de salsicha', 'ASSADO', RAFAEL, 1),
  item(P1045, 'Coxinha de frango', 'CONGELADO', MIRA, 3),
  item(P1045, 'Kibe', 'CONGELADO', CELIA, 2),
];

describe('produção do dia', () => {
  it('converte centos em unidades', () => {
    expect(unidadesDe('CENTO', 3)).toBe(300);
    expect(unidadesDe('UNIDADE', 50)).toBe(50);
  });

  it('totaliza o dia por preparo, pedidos e produtores', () => {
    const producao = montarProducaoDoDia(DIA);

    expect(producao.unidades).toBe(1570);
    expect(producao.quantidadePedidos).toBe(4);
    expect(producao.quantidadeProdutores).toBe(3);
    expect(producao.porPreparo).toEqual([
      { preparo: 'FRITO', unidades: 700 },
      { preparo: 'ASSADO', unidades: 270 },
      { preparo: 'CONGELADO', unidades: 600 },
    ]);
    expect(producao.porProdutor.map((p) => [p.produtor.nome, p.unidades])).toEqual([
      ['Mira', 900],
      ['Célia', 450],
      ['Rafael', 220],
    ]);
  });

  it('agrupa por horário na ordem recebida, com os sem horário no fim', () => {
    const { faixas } = montarProducaoDoDia(DIA);

    expect(faixas.map(({ horario, unidades }) => [horario, unidades])).toEqual([
      ['10:00', 320],
      ['11:30', 600],
      ['15:00', 150],
      [null, 500],
    ]);
    const buffet = faixas[1]?.pedidos[0];
    expect(buffet?.numero).toBe(1043);
    expect(buffet?.itens.map((i) => [i.produto.nome, i.unidades, i.observacao])).toEqual([
      ['Coxinha de frango', 300, null],
      ['Kibe', 100, null],
      ['Esfiha de carne', 100, 'Metade sem cebola'],
      ['Risole de queijo', 100, null],
    ]);
  });

  it('põe pedidos do mesmo horário na mesma faixa', () => {
    const outro = { numero: 1046, horario: '10:00', cliente: 'Juliana Torres' };
    const { faixas } = montarProducaoDoDia([
      ...DIA.slice(0, 3),
      item(outro, 'Kibe', 'FRITO', CELIA, 1),
      ...DIA.slice(3),
    ]);

    expect(faixas[0]?.pedidos.map((pedido) => pedido.numero)).toEqual([1042, 1046]);
    expect(faixas[0]?.unidades).toBe(420);
  });

  it('consolida produto, preparo e produtor, somando centos e avulsas de todos os pedidos', () => {
    const { consolidado } = montarProducaoDoDia(DIA);

    expect(consolidado.map(({ preparo, unidades }) => [preparo, unidades])).toEqual([
      ['FRITO', 700],
      ['ASSADO', 270],
      ['CONGELADO', 600],
    ]);
    const assados = consolidado[1]?.linhas.map((linha) => ({
      produto: linha.produto.nome,
      unidades: linha.unidades,
      centos: linha.centos,
      avulsas: linha.avulsas,
      pedidos: linha.pedidos,
    }));
    expect(assados).toEqual([
      { produto: 'Esfiha de carne', unidades: 150, centos: 1, avulsas: 50, pedidos: [1043, 1044] },
      { produto: 'Enroladinho de salsicha', unidades: 100, centos: 1, avulsas: 0, pedidos: [1044] },
      { produto: 'Empada de palmito', unidades: 20, centos: 0, avulsas: 20, pedidos: [1042] },
    ]);
  });

  it('separa o mesmo produto feito por produtores diferentes e desempata pelo nome', () => {
    const { consolidado } = montarProducaoDoDia([
      item(P1042, 'Kibe', 'FRITO', CELIA, 1),
      item(P1043, 'Kibe', 'FRITO', MIRA, 1),
      item(P1043, 'Coxinha de frango', 'FRITO', MIRA, 1),
      item(P1044, 'Kibe', 'FRITO', CELIA, 1),
    ]);

    expect(
      consolidado[0]?.linhas.map((l) => [l.produto.nome, l.produtor.nome, l.unidades]),
    ).toEqual([
      ['Kibe', 'Célia', 200],
      ['Coxinha de frango', 'Mira', 100],
      ['Kibe', 'Mira', 100],
    ]);
  });

  it('dia sem pedidos tem os três preparos zerados e nenhuma faixa', () => {
    expect(montarProducaoDoDia([])).toEqual({
      quantidadePedidos: 0,
      quantidadeProdutores: 0,
      unidades: 0,
      porPreparo: [
        { preparo: 'FRITO', unidades: 0 },
        { preparo: 'ASSADO', unidades: 0 },
        { preparo: 'CONGELADO', unidades: 0 },
      ],
      porProdutor: [],
      faixas: [],
      consolidado: [],
    });
  });
});
