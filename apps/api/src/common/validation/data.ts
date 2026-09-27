import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data de calendário AAAA-MM-DD, sem hora nem fuso, e existente (recusa 2026-02-30). */
export function DataDoCalendario(): PropertyDecorator {
  return applyDecorators(IsISO8601({ strict: true }), Matches(SO_DATA));
}
