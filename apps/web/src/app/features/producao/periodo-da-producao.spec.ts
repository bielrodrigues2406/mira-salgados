import { atalhosDaProducao, periodoDaProducao, periodoVizinho } from './periodo-da-producao';

describe('período da produção', () => {
  it('sem fim na URL são 7 dias a partir da data; fim inválido ou longo demais também', () => {
    expect(periodoDaProducao(undefined, undefined, '2026-09-28')).toEqual({
      de: '2026-09-28',
      ate: '2026-10-04',
    });
    expect(periodoDaProducao('2026-10-01', '2026-10-14', '2026-09-28')).toEqual({
      de: '2026-10-01',
      ate: '2026-10-14',
    });
    expect(periodoDaProducao('2026-10-01', '2026-12-01', '2026-09-28').ate).toBe('2026-10-07');
    expect(periodoDaProducao('2026-10-10', '2026-10-01', '2026-09-28').ate).toBe('2026-10-16');
  });

  it('atalhos olham para a frente', () => {
    // 30/09/2026 é quarta-feira: a semana vai de segunda 28/09 a domingo 04/10.
    expect(atalhosDaProducao('2026-09-30')).toEqual([
      { rotulo: '7 dias', de: '2026-09-30', ate: '2026-10-06' },
      { rotulo: 'Esta semana', de: '2026-09-28', ate: '2026-10-04' },
      { rotulo: 'Semana que vem', de: '2026-10-05', ate: '2026-10-11' },
      { rotulo: '14 dias', de: '2026-09-30', ate: '2026-10-13' },
      { rotulo: 'Este mês', de: '2026-09-01', ate: '2026-09-30' },
      { rotulo: 'Próximo mês', de: '2026-10-01', ate: '2026-10-31' },
    ]);
  });

  it('as setas andam o tamanho do período, e o mês inteiro anda de mês em mês', () => {
    expect(periodoVizinho({ de: '2026-09-28', ate: '2026-10-11' }, 1)).toEqual({
      de: '2026-10-12',
      ate: '2026-10-25',
    });
    expect(periodoVizinho({ de: '2026-10-01', ate: '2026-10-31' }, 1)).toEqual({
      de: '2026-11-01',
      ate: '2026-11-30',
    });
    expect(periodoVizinho({ de: '2026-03-01', ate: '2026-03-31' }, -1)).toEqual({
      de: '2026-02-01',
      ate: '2026-02-28',
    });
  });
});
