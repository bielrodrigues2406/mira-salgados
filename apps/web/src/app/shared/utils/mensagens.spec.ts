import type { PedidoDetalhe } from '../../core/models/pedido';
import type { ProducaoPorDia } from '../../core/models/producao';
import type { AcertoDiario, ClienteComFiado } from '../../core/models/relatorios';
import {
  mensagemDaSemana,
  mensagemDeCobranca,
  mensagemDeConfirmacao,
  mensagemDoAcerto,
} from './mensagens';

// O real formatado usa espaço duro; nos testes basta o espaço comum.
const legivel = (texto: string): string => texto.replace(/\u00a0/g, ' ');

const CELIA = { id: 'celia', nome: 'Célia' };
const MIRA = { id: 'mira', nome: 'Mira' };
const COXINHA = { id: 'cx', nome: 'Coxinha' };
const KIBE = { id: 'kb', nome: 'Kibe' };

describe('mensagens para o WhatsApp', () => {
  it('semana: só os dias com produção, e só a parte do produtor escolhido', () => {
    const semana: ProducaoPorDia = {
      de: '2026-09-28',
      ate: '2026-09-30',
      unidades: 500,
      dias: [
        { data: '2026-09-28', quantidadePedidos: 0, unidades: 0, produtores: [] },
        {
          data: '2026-09-29',
          quantidadePedidos: 2,
          unidades: 500,
          produtores: [
            {
              produtor: MIRA,
              unidades: 300,
              salgados: [{ produto: COXINHA, preparo: 'FRITO', unidades: 300 }],
            },
            {
              produtor: CELIA,
              unidades: 200,
              salgados: [{ produto: KIBE, preparo: 'CONGELADO', unidades: 200 }],
            },
          ],
        },
        { data: '2026-09-30', quantidadePedidos: 0, unidades: 0, produtores: [] },
      ],
    };

    expect(mensagemDaSemana(semana)).toBe(
      [
        '*Produção: Seg, 28 set a Qua, 30 set*',
        '',
        '*Ter, 29 set*: 500',
        'Mira: 300',
        '• 300 Coxinha',
        'Célia: 200',
        '• 200 Kibe (congelado)',
      ].join('\n'),
    );
    expect(mensagemDaSemana(semana, 'celia')).toBe(
      [
        '*Produção de Célia: Seg, 28 set a Qua, 30 set*',
        '',
        '*Ter, 29 set*: 200',
        '• 200 Kibe (congelado)',
      ].join('\n'),
    );
  });

  it('acerto: caixa e a parte de cada produtor, com o que falta', () => {
    const acerto = {
      data: '2026-10-02',
      quantidadePedidos: 2,
      valorMovimentadoCentavos: 50000,
      caixa: { pixCentavos: 30000, dinheiroCentavos: 10000, totalCentavos: 40000 },
      fiado: { valorCentavos: 10000, pedidos: [3] },
      semPagamento: { valorCentavos: 0, pedidos: [] },
      produtores: [
        { produtor: MIRA, aReceberCentavos: 24000, pendenteCentavos: 6000 },
        { produtor: CELIA, aReceberCentavos: 16000, pendenteCentavos: 0 },
      ],
    } as unknown as AcertoDiario;

    const texto = legivel(mensagemDoAcerto(acerto));

    expect(texto).toContain('*Acerto de sexta-feira, 2 de outubro*');
    expect(texto).toContain('Caixa: *R$ 400,00*');
    expect(texto).toContain('Fiado: R$ 100,00');
    expect(texto).not.toContain('Sem pagamento');
    expect(texto).toContain('Mira: R$ 240,00 (falta R$ 60,00)');
    expect(texto.endsWith('Célia: R$ 160,00')).toBe(true);
  });

  it('cobrança: pelo nome do cliente, com cada pedido e o total', () => {
    const fiado: ClienteComFiado = {
      cliente: { id: 'c1', nome: 'Ana Paula Ribeiro', telefone: '11987654321' },
      emAbertoCentavos: 39600,
      desde: '2026-09-20',
      pedidos: [{ id: 'p1', numero: 36, dataEntrega: '2026-09-20', emAbertoCentavos: 39600 }],
    };

    const texto = legivel(mensagemDeCobranca(fiado));

    expect(texto.startsWith('Olá, Ana Paula Ribeiro! Tudo bem?')).toBe(true);
    expect(texto).toContain('• Dom, 20 set (pedido #36): R$ 396,00');
    expect(texto).toContain('Total: *R$ 396,00*');
  });

  it('confirmação: itens, quando, endereço na entrega e o que falta pagar', () => {
    const pedido = {
      numero: 36,
      tipoEntrega: 'ENTREGA',
      dataEntrega: '2026-10-02',
      horarioEntrega: '10:00',
      enderecoEntrega: 'Rua das Flores, 10',
      cliente: { nome: 'Ana Paula', endereco: 'Rua Antiga, 1' },
      itens: [
        { produto: COXINHA, preparo: 'FRITO', unidadeVenda: 'CENTO', quantidade: 2 },
        { produto: KIBE, preparo: 'ASSADO', unidadeVenda: 'UNIDADE', quantidade: 1 },
      ],
      resumo: { totalCentavos: 20000, totalPagoCentavos: 5000, saldoDevedorCentavos: 15000 },
    } as unknown as PedidoDetalhe;

    const texto = legivel(mensagemDeConfirmacao(pedido));

    expect(texto).toContain('Seu pedido *#36*');
    expect(texto).toContain('• 2 centos de Coxinha\n• 1 unidade de Kibe (assado)');
    expect(texto).toContain('Entrega: *Sex, 2 out às 10:00*');
    expect(texto).toContain('Endereço: Rua das Flores, 10');
    expect(texto).toContain('Já pago: R$ 50,00 · Falta: R$ 150,00');
  });
});
