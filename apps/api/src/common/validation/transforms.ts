import { Transform } from 'class-transformer';

/** Remove espaços nas pontas de textos; outros tipos seguem para a validação. */
export function Aparar(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

// Query strings chegam sempre como texto. Só "true" e "false" viram booleano;
// qualquer outro valor segue como está e é recusado pelo @IsBoolean.
export function BooleanoDeQuery(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
}
