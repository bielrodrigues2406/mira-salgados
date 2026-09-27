import { Transform } from 'class-transformer';

// Normalização NFC: "é" digitado como "e" + acento combinante vira o mesmo
// caractere que "é" pré-composto, e nomes iguais não passam por diferentes na
// busca nem nas restrições de unicidade.
function limparTexto(texto: string): string {
  return texto.trim().normalize('NFC');
}

/** Remove espaços nas pontas de textos; outros tipos seguem para a validação. */
export function Aparar(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? limparTexto(value) : value,
  );
}

/** Como Aparar, mas texto vazio vira null: campo opcional apagado. */
export function ApararOuNulo(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const limpo = limparTexto(value);
    return limpo === '' ? null : limpo;
  });
}

// Telefone chega como o usuário digitou, com ou sem máscara; guarda-se só o
// número. Texto sem dígitos vira null.
export function SomenteDigitos(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const digitos = value.replace(/\D/g, '');
    return digitos === '' ? null : digitos;
  });
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
