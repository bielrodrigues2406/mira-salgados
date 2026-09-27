import { paginaDe, parametros } from './respostas';

describe('paginaDe', () => {
  it('separa itens e metadados de paginação', () => {
    const meta = { page: 2, pageSize: 1, total: 3, totalPages: 3 };

    expect(paginaDe({ data: ['b'], meta })).toEqual({ itens: ['b'], meta });
  });

  it('trata resposta sem meta como página única', () => {
    expect(paginaDe({ data: ['a', 'b'] }).meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 2,
      totalPages: 1,
    });
  });
});

describe('parametros', () => {
  it('omite valores indefinidos e mantém falsos', () => {
    expect(parametros({ page: 1, ativo: false, busca: undefined })).toEqual({
      page: 1,
      ativo: false,
    });
  });
});
