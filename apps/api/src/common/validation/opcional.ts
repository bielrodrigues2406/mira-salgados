import { ValidateIf } from 'class-validator';

/**
 * Campo que pode faltar, mas não pode vir null: ausência mantém o valor atual.
 * @IsOptional também aceita null e deixaria passar um PATCH { nome: null } até
 * a restrição NOT NULL do banco. Campos em que null apaga o valor (telefone,
 * horário, observação) continuam com @IsOptional.
 */
export function Opcional(): PropertyDecorator {
  return ValidateIf((_objeto: object, valor: unknown) => valor !== undefined);
}
