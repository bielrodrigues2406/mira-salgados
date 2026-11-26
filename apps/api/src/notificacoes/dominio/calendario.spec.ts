import { describe, expect, it } from 'vitest';

import { avaliarJanelaResumo, obterDataHoraLocal } from './calendario.js';

describe('calendário em America/Sao_Paulo e janela de resumo', () => {
  it('trata corretamente virada de dia entre 23:59 e 00:00 BRT (02:59 e 03:00 UTC)', () => {
    // 2026-10-03T02:59:00Z = sexta 2026-10-02 23:59 BRT
    const antesDaMeiaNoite = obterDataHoraLocal(new Date('2026-10-03T02:59:00.000Z'));
    expect(antesDaMeiaNoite).toEqual({
      data: '2026-10-02',
      diaSemana: 5,
      minutosDoDia: 23 * 60 + 59,
      horaFormatada: '23:59',
    });

    // 2026-10-03T03:00:00Z = sábado 2026-10-03 00:00 BRT
    const meiaNoite = obterDataHoraLocal(new Date('2026-10-03T03:00:00.000Z'));
    expect(meiaNoite).toEqual({
      data: '2026-10-03',
      diaSemana: 6,
      minutosDoDia: 0,
      horaFormatada: '00:00',
    });
  });

  it('classifica antes do horário, dentro da janela de 120 min e expirado no mesmo dia', () => {
    const regra = {
      diasSemana: [5],
      horarioResumo: '07:00',
      fusoHorario: 'America/Sao_Paulo',
      toleranciaAtrasoMinutos: 120,
    };

    // Sexta 06:59 BRT (09:59 UTC)
    expect(avaliarJanelaResumo(new Date('2026-10-02T09:59:00.000Z'), regra).situacao).toBe(
      'ANTES_DO_HORARIO',
    );
    // Sexta 07:00 BRT (10:00 UTC)
    expect(avaliarJanelaResumo(new Date('2026-10-02T10:00:00.000Z'), regra).situacao).toBe(
      'NA_JANELA',
    );
    // Sexta 09:00 BRT (12:00 UTC) — limite exato dos 120 min
    expect(avaliarJanelaResumo(new Date('2026-10-02T12:00:00.000Z'), regra).situacao).toBe(
      'NA_JANELA',
    );
    // Sexta 09:01 BRT (12:01 UTC) — expirado
    expect(avaliarJanelaResumo(new Date('2026-10-02T12:01:00.000Z'), regra).situacao).toBe(
      'EXPIRADO',
    );
    // Sábado 07:30 BRT (10:30 UTC) — fora dos dias configurados
    expect(avaliarJanelaResumo(new Date('2026-10-03T10:30:00.000Z'), regra).situacao).toBe(
      'FORA_DO_DIA',
    );
  });
});
