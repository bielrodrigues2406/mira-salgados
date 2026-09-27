# ADR 0005 — Erros, validação e envelope de resposta

## Decisão

**Envelope.** Sucesso: `{ "data": ... }`; coleções paginadas acrescentam
`meta: { page, pageSize, total, totalPages }`. Erro:
`{ "error": { "code", "message", "details"?, "requestId"? } }`.

**Status.**

| Situação                                        | Status | Código                              |
| ----------------------------------------------- | ------ | ----------------------------------- |
| Entrada malformada ou propriedade não declarada | 400    | `VALIDATION_FAILED`, `BAD_REQUEST`  |
| Falha de autenticação                           | 401    | `UNAUTHORIZED` ou código de domínio |
| Recurso inexistente                             | 404    | `NOT_FOUND`                         |
| Duplicidade ou violação de referência           | 409    | `CONFLICT`                          |
| Regra de negócio violada sobre entrada válida   | 422    | código de domínio                   |
| Limite de taxa                                  | 429    | `RATE_LIMITED`                      |
| Falha inesperada                                | 500    | `INTERNAL_ERROR`                    |

**Erros de domínio.** Os services lançam `BusinessRuleError`, `NotFoundError`,
`ConflictError`, `AuthenticationError` e `ForbiddenError`, com mensagem em
português e código estável. Não conhecem HTTP; o filtro global faz o mapeamento.

**Mensagens do framework.** Exceções do Nest e do Express (rota inexistente,
JSON malformado) têm a mensagem substituída pela mensagem padrão do status, em
português. Mensagens do banco nunca chegam ao cliente: duplicidade vira 409
genérico, e o log registra só o código do PostgreSQL, porque a mensagem pode
conter valores da linha.

**Validação.** `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`,
`forbidUnknownValues` e sem conversão implícita de tipos. As mensagens do
class-validator são traduzidas num único lugar
(`common/validation/validation.ts`), sem repetir texto em cada DTO.

**Saída.** Controllers nunca devolvem entidades; cada módulo define DTOs de
resposta montados explicitamente a partir da entidade.

**Logs.** JSON via pino. Identificador de requisição gerado no servidor e
devolvido em `X-Request-Id`. Cabeçalhos e corpos de requisição não são
registrados; a query string é removida do caminho; campos sensíveis (senha,
tokens, cookies) são ocultados em qualquer nível de aninhamento.
