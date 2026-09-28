import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination.js';
import { DataDoCalendario } from '../../common/validation/data.js';
import { FimDoIntervalo } from '../../common/validation/intervalo.js';

/** Um ano, com folga para bissexto: mantém as agregações por dia limitadas. */
export const MAXIMO_DE_DIAS = 366;

/** Datas de entrega de `de` a `ate`, inclusive. */
export class IntervaloDto {
  @DataDoCalendario()
  de: string;

  @DataDoCalendario()
  @FimDoIntervalo('de', MAXIMO_DE_DIAS)
  ate: string;
}

export class IntervaloPaginadoDto extends PaginationQueryDto {
  @DataDoCalendario()
  de: string;

  @DataDoCalendario()
  @FimDoIntervalo('de', MAXIMO_DE_DIAS)
  ate: string;
}

export class FiltroProducaoDto extends IntervaloPaginadoDto {
  @IsOptional()
  @IsUUID()
  produtorId?: string;
}

export class FiltroFiadosDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;
}

/** Um mês cobre a visão da semana com folga; mais que isso é relatório de período. */
export const MAXIMO_DE_DIAS_DA_SEMANA = 31;

export class FiltroProducaoPorDiaDto {
  @DataDoCalendario()
  de: string;

  @DataDoCalendario()
  @FimDoIntervalo('de', MAXIMO_DE_DIAS_DA_SEMANA)
  ate: string;

  @IsOptional()
  @IsUUID()
  produtorId?: string;
}
