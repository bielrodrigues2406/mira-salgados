import { ValidateBy, type ValidationArguments } from 'class-validator';

const UM_DIA_MS = 86_400_000;

/**
 * Fim de intervalo: não antes do início (campo `inicio` do mesmo objeto) e com
 * no máximo `maximoDeDias` dias, contando os dois extremos. Os dois campos já
 * são validados como datas AAAA-MM-DD pelos próprios decoradores.
 */
export function FimDoIntervalo(inicio: string, maximoDeDias: number): PropertyDecorator {
  return ValidateBy({
    name: 'fimDoIntervalo',
    constraints: [inicio, maximoDeDias],
    validator: {
      validate(fim: unknown, argumentos: ValidationArguments): boolean {
        const comeco = (argumentos.object as Record<string, unknown>)[inicio];
        if (typeof fim !== 'string' || typeof comeco !== 'string') return true;
        const dias = (Date.parse(fim) - Date.parse(comeco)) / UM_DIA_MS + 1;
        return dias >= 1 && dias <= maximoDeDias;
      },
      defaultMessage: (argumentos?: ValidationArguments): string =>
        `O campo "${argumentos?.property ?? 'ate'}" deve ser igual ou posterior a "${inicio}", num intervalo de até ${String(maximoDeDias)} dias.`,
    },
  });
}
