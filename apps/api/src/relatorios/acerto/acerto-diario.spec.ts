import { describe, expect, it } from 'vitest';

import { type Centavos, centavos, ZERO_CENTAVOS } from '../../common/utils/dinheiro.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import { calcularAcerto, type ItemDoAcerto, type PagamentosDoPedido } from './acerto-diario.js';

const c = (valor: number): Centavos => centavos(valor);

const MIRA = { id: 'mira', nome: 'Mira' };
const CELIA = { id: 'celia', nome: 'Célia' };
const RAFAEL = { id: 'rafael', nome: 'Rafael' };

function item(
  numero: number,
  produto: string,
  preparo: Preparo,
  produtor: { id: string; nome: string },
  quantidade: number,
  unidadeVenda: UnidadeVenda,
  precoUnitario: number,
  desconto = 0,
): ItemDoAcerto {
  return {
    pedidoId: `p${String(numero)}`,
    numero,
    descontoDoPedido: c(desconto),
    produto: { id: produto, nome: produto },
    produtor,
    preparo,
    unidadeVenda,
    quantidade,
    precoUnitario: c(precoUnitario),
  };
}

function pagamentos(
  numero: number,
  valores: Partial<Record<'pix' | 'dinheiro' | 'fiado', number>>,
): PagamentosDoPedido {
  return {
    pedidoId: `p${String(numero)}`,
    pix: c(valores.pix ?? 0),
    dinheiro: c(valores.dinheiro ?? 0),
    fiado: c(valores.fiado ?? 0),
  };
}

// O dia do protótipo, sem a taxa de entrega (D3): R$ 1.417,00 em quatro
// pedidos, R$ 622,00 em caixa, R$ 390,00 em fiado e R$ 405,00 sem pagamento.
const ITENS = [
  item(1042, 'Coxinha de frango', 'FRITO', MIRA, 2, 'CENTO', 9500),
  item(1042, 'Bolinha de queijo', 'FRITO', MIRA, 1, 'CENTO', 9000),
  item(1042, 'Empada de palmito', 'ASSADO', RAFAEL, 20, 'UNIDADE', 160),
  item(1043, 'Coxinha de frango', 'FRITO', MIRA, 3, 'CENTO', 9500),
  item(1043, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000),
  item(1043, 'Esfiha de carne', 'ASSADO', CELIA, 1, 'CENTO', 11000),
  item(1043, 'Risole de queijo', 'CONGELADO', RAFAEL, 1, 'CENTO', 7500),
  item(1044, 'Esfiha de carne', 'ASSADO', CELIA, 50, 'UNIDADE', 140),
  item(1044, 'Enroladinho de salsicha', 'ASSADO', RAFAEL, 1, 'CENTO', 8500),
  item(1045, 'Coxinha de frango', 'CONGELADO', MIRA, 3, 'CENTO', 8000),
  item(1045, 'Kibe', 'CONGELADO', CELIA, 2, 'CENTO', 7500),
];
const PAGAMENTOS = [
  pagamentos(1042, { pix: 31200 }),
  pagamentos(1043, { pix: 21000, dinheiro: 10000 }),
  pagamentos(1045, { fiado: 39000 }),
];

describe('acerto diário', () => {
  it('discrimina o caixa: disponível, fiado e sem pagamento', () => {
    const acerto = calcularAcerto(ITENS, PAGAMENTOS);

    expect(acerto.quantidadePedidos).toBe(4);
    expect(acerto.unidades).toBe(1570);
    expect(acerto.valorMovimentado).toBe(141700);
    expect(acerto.caixa).toEqual({ pix: 52200, dinheiro: 10000, total: 62200 });
    expect(acerto.fiado).toEqual({ valor: 39000, pedidos: [1045] });
    expect(acerto.semPagamento).toEqual({ valor: 40500, pedidos: [1043, 1044] });
  });

  it('cada produtor tem a receber o que fez, sem dividir o caixa (ADR 0017)', () => {
    const { produtores } = calcularAcerto(ITENS, PAGAMENTOS);

    expect(produtores.map((p) => [p.produtor.nome, p.unidades, p.valorProduzido])).toEqual([
      ['Mira', 900, 80500],
      ['Célia', 450, 42000],
      ['Rafael', 220, 19200],
    ]);
    expect(produtores[0]).not.toHaveProperty('aReceber');
  });

  it('o que os produtores fizeram soma o valor movimentado, fiado incluído', () => {
    const acerto = calcularAcerto(ITENS, PAGAMENTOS);

    expect(acerto.totalProduzido).toBe(acerto.valorMovimentado);
    expect(acerto.totalProduzido).toBe(
      acerto.caixa.total + acerto.fiado.valor + acerto.semPagamento.valor,
    );
  });

  it('agrupa os itens do produtor por produto e preparo, do maior valor ao menor', () => {
    const celia = calcularAcerto(ITENS, PAGAMENTOS).produtores[1];

    expect(celia?.itens).toEqual([
      {
        produto: { id: 'Esfiha de carne', nome: 'Esfiha de carne' },
        preparo: 'ASSADO',
        centos: 1,
        avulsas: 50,
        valor: 18000,
      },
      {
        produto: { id: 'Kibe', nome: 'Kibe' },
        preparo: 'CONGELADO',
        centos: 2,
        avulsas: 0,
        valor: 15000,
      },
      {
        produto: { id: 'Kibe', nome: 'Kibe' },
        preparo: 'FRITO',
        centos: 1,
        avulsas: 0,
        valor: 9000,
      },
    ]);
  });

  it('reparte o desconto de cada pedido entre os seus itens (D3)', () => {
    // R$ 10,00 de desconto sobre R$ 285,00 de coxinha e R$ 90,00 de kibe:
    // 760 e 240 centavos, pelo maior resto.
    const acerto = calcularAcerto(
      [
        item(1, 'Coxinha de frango', 'FRITO', MIRA, 3, 'CENTO', 9500, 1000),
        item(1, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000, 1000),
        item(2, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000),
      ],
      [pagamentos(1, { pix: 36500 }), pagamentos(2, { dinheiro: 5000 })],
    );

    expect(acerto.valorMovimentado).toBe(45500);
    expect(
      acerto.produtores.map((p) => [p.produtor.nome, p.valorItens, p.desconto, p.valorProduzido]),
    ).toEqual([
      ['Mira', 28500, 760, 27740],
      ['Célia', 18000, 240, 17760],
    ]);
    expect(acerto.totalProduzido).toBe(45500);
    expect(acerto.semPagamento).toEqual({ valor: 4000, pedidos: [2] });
  });

  it('ordena quem fez mais primeiro e desempata pelo nome, não pela chegada', () => {
    const ida = calcularAcerto(
      [
        item(1, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000),
        item(2, 'Coxinha de frango', 'FRITO', MIRA, 1, 'CENTO', 9000),
        item(3, 'Risole de queijo', 'FRITO', RAFAEL, 2, 'CENTO', 9000),
      ],
      [],
    );
    const volta = calcularAcerto(
      [
        item(3, 'Risole de queijo', 'FRITO', RAFAEL, 2, 'CENTO', 9000),
        item(2, 'Coxinha de frango', 'FRITO', MIRA, 1, 'CENTO', 9000),
        item(1, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000),
      ],
      [],
    );

    const nomes = (acerto: typeof ida) => acerto.produtores.map((p) => p.produtor.nome);
    expect(nomes(ida)).toEqual(['Rafael', 'Célia', 'Mira']);
    expect(nomes(volta)).toEqual(nomes(ida));
  });

  it('dia sem pedidos zera tudo, sem dividir por zero', () => {
    const acerto = calcularAcerto([], []);

    expect(acerto).toMatchObject({
      quantidadePedidos: 0,
      valorMovimentado: ZERO_CENTAVOS,
      caixa: { total: 0 },
      produtores: [],
    });
  });

  it('pedido com desconto integral deixa o produtor sem nada a receber', () => {
    const acerto = calcularAcerto([item(1, 'Kibe', 'FRITO', CELIA, 1, 'CENTO', 9000, 9000)], []);

    expect(acerto.produtores).toMatchObject([
      { valorItens: 9000, desconto: 9000, valorProduzido: 0 },
    ]);
  });
});
