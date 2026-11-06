import {
  atalhosDePeriodo,
  atalhosDoAReceber,
  erroDoPeriodo,
  estaSemana,
  esteMes,
  periodoDaUrl,
} from './periodo';

describe('período dos relatórios', () => {
  it('oferece atalhos a partir de hoje', () => {
    expect(atalhosDePeriodo('2026-10-17')).toEqual([
      { rotulo: 'Este mês', de: '2026-10-01', ate: '2026-10-31' },
      { rotulo: 'Mês passado', de: '2026-09-01', ate: '2026-09-30' },
      { rotulo: 'Últimos 7 dias', de: '2026-10-11', ate: '2026-10-17' },
      { rotulo: 'Últimos 30 dias', de: '2026-09-18', ate: '2026-10-17' },
    ]);
  });

  it('recusa fim antes do início e mais de um ano', () => {
    expect(erroDoPeriodo({ de: '2026-10-01', ate: '2026-10-01' })).toBeNull();
    expect(erroDoPeriodo({ de: '2026-10-02', ate: '2026-10-01' })).toContain('igual ou posterior');
    expect(erroDoPeriodo({ de: '2026-01-01', ate: '2027-01-01' })).toBeNull();
    expect(erroDoPeriodo({ de: '2026-01-01', ate: '2027-01-02' })).toContain('até um ano');
  });

  it('usa o período da URL só quando é válido', () => {
    const hoje = '2026-10-17';
    expect(periodoDaUrl('2026-09-01', '2026-09-15', hoje)).toEqual({
      de: '2026-09-01',
      ate: '2026-09-15',
    });
    expect(periodoDaUrl('2026-09-15', '2026-09-01', hoje)).toEqual(esteMes(hoje));
    expect(periodoDaUrl('2026-02-30', '2026-03-01', hoje)).toEqual(esteMes(hoje));
    expect(periodoDaUrl(undefined, undefined, hoje)).toEqual(esteMes(hoje));
  });

  it('para o a receber, a semana vai de segunda a domingo e pode ser o padrão', () => {
    // 2026-10-15 é uma quinta-feira.
    expect(atalhosDoAReceber('2026-10-15')).toEqual([
      { rotulo: 'Esta semana', de: '2026-10-12', ate: '2026-10-18' },
      { rotulo: 'Semana passada', de: '2026-10-05', ate: '2026-10-11' },
      { rotulo: 'Este mês', de: '2026-10-01', ate: '2026-10-31' },
      { rotulo: 'Mês passado', de: '2026-09-01', ate: '2026-09-30' },
    ]);
    expect(periodoDaUrl(undefined, undefined, '2026-10-15', estaSemana)).toEqual({
      de: '2026-10-12',
      ate: '2026-10-18',
    });
  });
});
