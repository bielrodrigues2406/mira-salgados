import { Pipe, type PipeTransform } from '@angular/core';

/** (11) 99134-2280 para celular e (11) 3021-4455 para fixo; outros valores seguem como vieram. */
export function formatarTelefone(digitos: string | null | undefined): string {
  if (!digitos) return '';
  if (/^\d{11}$/.test(digitos)) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (/^\d{10}$/.test(digitos)) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return digitos;
}

@Pipe({ name: 'telefone' })
export class TelefonePipe implements PipeTransform {
  transform(digitos: string | null | undefined): string {
    return formatarTelefone(digitos);
  }
}
