import {
  dataCompleta,
  diasNoIntervalo,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
  dataCurta,
  dataDoCalendario,
  momentoCurto,
  dataPorExtenso,
  hoje,
  paraTextoDeData,
  quandoEntregar,
  somarDias,
} from './datas';

describe('datas de entrega', () => {
  it('usa o dia do aparelho, sem conversão de fuso', () => {
    expect(hoje(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
    expect(paraTextoDeData(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('escreve as datas como no design', () => {
    expect(dataCurta('2026-10-02')).toBe('Sex, 2 out');
    expect(dataPorExtenso('2026-10-04')).toBe('Domingo, 4 de outubro');
  });

  it.each([
    ['2026-10-02', '11:30', '11:30'],
    ['2026-10-02', null, 'Sem horário'],
    ['2026-10-03', '09:00', 'Sáb, 3 out · 09:00'],
    ['2026-10-04', null, 'Dom, 4 out'],
  ])('entrega em %s às %s aparece como "%s"', (data, horario, esperado) => {
    expect(quandoEntregar(data, horario, '2026-10-02')).toBe(esperado);
  });
});

describe('momentoCurto', () => {
  it('mostra dia, mês e hora no fuso do aparelho', () => {
    expect(momentoCurto(new Date(2026, 8, 29, 14, 12).toISOString())).toBe('29 set, 14:12');
  });

  it('escreve a data completa do seletor', () => {
    expect(dataCompleta('2026-10-02')).toBe('Sex, 2 de outubro de 2026');
  });

  it('aceita só datas que existem no calendário', () => {
    expect(dataDoCalendario('2026-10-02')).toBe('2026-10-02');
    expect(dataDoCalendario('2026-02-30')).toBeUndefined();
    expect(dataDoCalendario('02/10/2026')).toBeUndefined();
    expect(dataDoCalendario(undefined)).toBeUndefined();
  });

  it('acha o começo e o fim do mês, inclusive fevereiro bissexto', () => {
    expect(primeiroDiaDoMes('2026-10-17')).toBe('2026-10-01');
    expect(ultimoDiaDoMes('2026-10-17')).toBe('2026-10-31');
    expect(ultimoDiaDoMes('2028-02-10')).toBe('2028-02-29');
  });

  it('conta os dias do intervalo com os dois extremos', () => {
    expect(diasNoIntervalo('2026-10-01', '2026-10-01')).toBe(1);
    expect(diasNoIntervalo('2026-10-01', '2026-10-31')).toBe(31);
    expect(diasNoIntervalo('2026-01-01', '2026-12-31')).toBe(365);
    expect(diasNoIntervalo('2026-10-05', '2026-10-01')).toBe(-3);
  });
});
