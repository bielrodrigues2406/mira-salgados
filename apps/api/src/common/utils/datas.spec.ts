import { describe, expect, it } from 'vitest';

import { diasDoIntervalo, fimDoMes, inicioDaSemana, inicioDoMes, somarDias } from './datas.js';

describe('datas de calendário', () => {
  it('lista os dias do intervalo, inclusive, atravessando o mês', () => {
    expect(diasDoIntervalo('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(diasDoIntervalo('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('soma dias para frente e para trás', () => {
    expect(somarDias('2026-02-28', 1)).toBe('2026-03-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('começa a semana na segunda-feira', () => {
    expect(inicioDaSemana('2026-09-28')).toBe('2026-09-28'); // segunda
    expect(inicioDaSemana('2026-10-04')).toBe('2026-09-28'); // domingo
    expect(inicioDaSemana('2026-10-01')).toBe('2026-09-28'); // quinta
  });

  it('acha o primeiro e o último dia do mês, inclusive em ano bissexto', () => {
    expect(inicioDoMes('2026-09-17')).toBe('2026-09-01');
    expect(fimDoMes('2026-09-17')).toBe('2026-09-30');
    expect(fimDoMes('2028-02-10')).toBe('2028-02-29');
  });
});
