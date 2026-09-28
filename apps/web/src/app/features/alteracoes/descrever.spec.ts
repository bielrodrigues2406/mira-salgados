import type { RegistroDeAlteracao } from '../../core/models/auditoria';
import { assunto, type Mudanca, mudancas, pedidoDoRegistro, titulo } from './descrever';

function registro(parcial: Partial<RegistroDeAlteracao>): RegistroDeAlteracao {
  return {
    id: 'r1',
    entidade: 'pedido',
    entidadeId: 'p36',
    acao: 'ATUALIZACAO',
    dadosAntes: null,
    dadosDepois: null,
    usuarioId: 'u1',
    autor: { id: 'u1', nome: 'Gabriel' },
    referencias: {},
    criadoEm: '2026-09-28T14:12:00.000Z',
    ...parcial,
  };
}

/** O real formatado usa espaço duro entre "R$" e o número. */
function semEspacoDuro(mudanca: Mudanca): Mudanca {
  return {
    campo: mudanca.campo,
    antes: mudanca.antes?.replace(/\u00a0/g, ' ') ?? null,
    depois: mudanca.depois?.replace(/\u00a0/g, ' ') ?? null,
  };
}

describe('descrever alterações', () => {
  it('numa alteração, lista só os campos que mudaram, em linguagem da tela', () => {
    const alterado = registro({
      referencias: { p36: 'Pedido #36', c1: 'Ana Paula', c2: 'Buffet Sabor' },
      dadosAntes: {
        id: 'p36',
        numero: 36,
        status: 'RASCUNHO',
        tipoEntrega: 'ENTREGA',
        clienteId: 'c1',
        desconto: 0,
        horarioEntrega: null,
        atualizadoEm: 'a',
      },
      dadosDepois: {
        id: 'p36',
        numero: 36,
        status: 'RASCUNHO',
        tipoEntrega: 'RETIRADA',
        clienteId: 'c2',
        desconto: 1500,
        horarioEntrega: '10:30:00',
        atualizadoEm: 'b',
      },
    });

    expect(titulo(alterado)).toBe('Pedido #36 alterado');
    expect(mudancas(alterado).map(semEspacoDuro)).toEqual([
      { campo: 'Entrega', antes: 'Entrega', depois: 'Retirada' },
      { campo: 'Horário', antes: null, depois: '10:30' },
      { campo: 'Desconto', antes: 'R$ 0,00', depois: 'R$ 15,00' },
      { campo: 'Cliente', antes: 'Ana Paula', depois: 'Buffet Sabor' },
    ]);
  });

  it('numa criação, mostra os dados com que o registro nasceu', () => {
    const criado = registro({
      entidade: 'pagamento',
      entidadeId: 'pg1',
      acao: 'CRIACAO',
      referencias: { p36: 'Pedido #36', u1: 'Gabriel' },
      dadosDepois: { id: 'pg1', forma: 'FIADO', valor: 39600, pedidoId: 'p36', estornadoEm: null },
    });

    expect(titulo(criado)).toBe('Pagamento do Pedido #36 criado');
    expect(mudancas(criado).map(({ campo, depois }) => [campo, depois])).toEqual([
      ['Pedido', 'Pedido #36'],
      ['Forma', 'Fiado'],
      ['Valor', 'R$ 396,00'],
    ]);
    expect(pedidoDoRegistro(criado)).toBe('p36');
  });

  it('usa o nome atual e cai no do snapshot quando o registro foi apagado', () => {
    expect(
      assunto(
        registro({
          entidade: 'cliente',
          entidadeId: 'c1',
          referencias: { c1: 'Ana Paula Ribeiro' },
          dadosDepois: { nome: 'Ana' },
        }),
      ),
    ).toBe('Cliente Ana Paula Ribeiro');
    expect(
      assunto(registro({ entidade: 'produtor', entidadeId: 'x', dadosAntes: { nome: 'Rosa' } })),
    ).toBe('Produtor Rosa');
    expect(
      assunto(
        registro({
          entidade: 'item_pedido',
          entidadeId: 'i1',
          referencias: { k: 'Kibe', p36: 'Pedido #36' },
          dadosDepois: { produtoId: 'k', pedidoId: 'p36' },
        }),
      ),
    ).toBe('Item Kibe do Pedido #36');
  });

  it('conta: papel, situação e produtor por extenso, sem hash nem e-mail', () => {
    const conta = registro({
      entidade: 'usuario',
      entidadeId: 'u2',
      referencias: { u2: 'Célia', pr1: 'Célia' },
      dadosAntes: { nome: 'Célia', papel: 'MEMBRO', ativo: true, produtorId: null, email: 'x' },
      dadosDepois: { nome: 'Célia', papel: 'ADMIN', ativo: false, produtorId: 'pr1', email: 'x' },
    });

    expect(titulo(conta)).toBe('Conta de Célia alterada');
    expect(mudancas(conta)).toEqual([
      { campo: 'Situação', antes: 'Ativo', depois: 'Inativo' },
      { campo: 'Produtor', antes: null, depois: 'Célia' },
      { campo: 'Papel', antes: 'Membro', depois: 'Administrador' },
    ]);
  });
});
