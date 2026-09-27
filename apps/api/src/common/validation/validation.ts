import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  messages: string[];
}

export class ValidationFailedException extends BadRequestException {
  constructor(readonly fieldErrors: FieldError[]) {
    super('Os dados enviados são inválidos.');
  }
}

// O class-validator só expõe os argumentos da regra dentro da mensagem padrão,
// em inglês ("must not be less than 1"). O último número dela é o limite.
const ULTIMO_NUMERO = /(-?\d+(?:\.\d+)?)(?!.*\d)/;
const VALORES_PERMITIDOS = /:\s*(.+)$/;

function limite(mensagemOriginal: string): string {
  return ULTIMO_NUMERO.exec(mensagemOriginal)?.[1] ?? '';
}

type Traducao = (campo: string, mensagemOriginal: string) => string;

const TRADUCOES: Record<string, Traducao> = {
  whitelistValidation: (campo) => `O campo "${campo}" não é permitido.`,
  isDefined: (campo) => `O campo "${campo}" é obrigatório.`,
  isNotEmpty: (campo) => `O campo "${campo}" é obrigatório.`,
  isString: (campo) => `O campo "${campo}" deve ser um texto.`,
  isInt: (campo) => `O campo "${campo}" deve ser um número inteiro.`,
  isNumber: (campo) => `O campo "${campo}" deve ser um número.`,
  isPositive: (campo) => `O campo "${campo}" deve ser maior que zero.`,
  isBoolean: (campo) => `O campo "${campo}" deve ser verdadeiro ou falso.`,
  isEmail: (campo) => `O campo "${campo}" deve ser um e-mail válido.`,
  isUuid: (campo) => `O campo "${campo}" deve ser um identificador válido.`,
  isIso8601: (campo) => `O campo "${campo}" deve ser uma data válida.`,
  isDateString: (campo) => `O campo "${campo}" deve ser uma data válida.`,
  isMilitaryTime: (campo) => `O campo "${campo}" deve estar no formato HH:MM.`,
  isArray: (campo) => `O campo "${campo}" deve ser uma lista.`,
  isObject: (campo) => `O campo "${campo}" deve ser um objeto.`,
  nestedValidation: (campo) => `O campo "${campo}" contém itens inválidos.`,
  matches: (campo) => `O campo "${campo}" está em formato inválido.`,
  isEnum: (campo, original) => {
    const valores = VALORES_PERMITIDOS.exec(original)?.[1];
    return valores
      ? `O campo "${campo}" deve ser um destes valores: ${valores}.`
      : `O campo "${campo}" tem um valor não permitido.`;
  },
  min: (campo, original) => `O campo "${campo}" deve ser no mínimo ${limite(original)}.`,
  max: (campo, original) => `O campo "${campo}" deve ser no máximo ${limite(original)}.`,
  minLength: (campo, original) =>
    `O campo "${campo}" deve ter pelo menos ${limite(original)} caracteres.`,
  maxLength: (campo, original) =>
    `O campo "${campo}" deve ter no máximo ${limite(original)} caracteres.`,
  arrayMinSize: (campo, original) =>
    `O campo "${campo}" deve ter pelo menos ${limite(original)} itens.`,
  arrayMaxSize: (campo, original) =>
    `O campo "${campo}" deve ter no máximo ${limite(original)} itens.`,
};

function traduzir(regra: string, campo: string, mensagemOriginal: string): string {
  return TRADUCOES[regra]?.(campo, mensagemOriginal) ?? mensagemOriginal;
}

export function formatValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: FieldError[] = error.constraints
      ? [
          {
            field,
            messages: Object.entries(error.constraints).map(([regra, mensagem]) =>
              traduzir(regra, error.property, mensagem),
            ),
          },
        ]
      : [];
    return [...own, ...formatValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Propriedades não declaradas no DTO são rejeitadas, não ignoradas: aceitar e
    // descartar em silêncio esconde erros do cliente e abre caminho para
    // atribuição em massa se algum DTO for reaproveitado em outra operação.
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new ValidationFailedException(formatValidationErrors(errors)),
  });
}
