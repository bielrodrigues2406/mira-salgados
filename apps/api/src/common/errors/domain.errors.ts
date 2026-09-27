// Erros lançados pelas regras de negócio. Carregam mensagem em português,
// pronta para o usuário, e um código estável que o frontend pode tratar. O
// filtro global traduz cada categoria no status HTTP correspondente; os
// services não conhecem HTTP.
export abstract class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Violação de regra de negócio sobre uma entrada bem formada (HTTP 422). */
export class BusinessRuleError extends DomainError {}

/** Recurso inexistente ou inacessível (HTTP 404). */
export class NotFoundError extends DomainError {
  constructor(recurso: string) {
    super('NOT_FOUND', `${recurso} não encontrado.`);
  }
}

/** Conflito com o estado atual, como duplicidade de chave única (HTTP 409). */
export class ConflictError extends DomainError {}

/** Falha de autenticação (HTTP 401). */
export class AuthenticationError extends DomainError {}

/** Autenticado, mas sem permissão para a operação (HTTP 403). */
export class ForbiddenError extends DomainError {}
