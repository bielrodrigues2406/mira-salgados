# Convenções do projeto

## Idioma

O domínio de negócio usa português; a infraestrutura técnica usa inglês. A
fronteira é esta: se o termo tem significado específico para a operação de
salgados, fica em português, porque traduzir introduz ambiguidade (fiado,
acerto, cento, preparo). Se o termo é um conceito genérico de software, fica em
inglês, porque é assim que aparece na documentação das ferramentas.

| Categoria                                  | Idioma    | Exemplos                                                      |
| ------------------------------------------ | --------- | ------------------------------------------------------------- |
| Entidades, campos, enums e DTOs de domínio | Português | `Pedido`, `dataEntrega`, `StatusPedido`, `CriarPedidoDto`     |
| Métodos de regra de negócio                | Português | `aplicarTransicaoDeStatus`, `calcularAcerto`                  |
| Módulos, pastas e rotas de domínio         | Português | `pedidos/`, `/api/v1/clientes`                                |
| Erros de domínio e seus códigos            | Português | `RegraDeNegocioError`, `TRANSICAO_DE_STATUS_INVALIDA`         |
| Sufixos de framework                       | Inglês    | `Controller`, `Service`, `Module`, `Dto`, `Guard`             |
| Infraestrutura genérica                    | Inglês    | `config/`, `AllExceptionsFilter`, `JwtAuthGuard`, `@Public()` |
| Códigos de erro de infraestrutura          | Inglês    | `VALIDATION_FAILED`, `UNAUTHORIZED`, `RATE_LIMITED`           |
| Paginação e variáveis de ambiente          | Inglês    | `page`, `pageSize`, `DATABASE_URL`, `JWT_ACCESS_SECRET`       |
| Texto em linguagem natural                 | Português | comentários, mensagens ao usuário, logs, documentação         |

Arquivos seguem a mesma regra: `pedidos.service.ts`, `all-exceptions.filter.ts`.

## Código

- Nenhum emoji em código, comentários, mensagens, logs, documentação ou
  interface. A regra `local/sem-emoji` do ESLint bloqueia a violação.
- Comentário registra o porquê: decisão não óbvia, restrição externa ou armadilha
  conhecida. Código que precisa de comentário para explicar o que faz deve ser
  reescrito.
- Sem código morto, importações não usadas ou blocos comentados.
- Nomes precisos e sem abreviação fora de convenções estabelecidas.
- TypeScript em modo estrito com `noUncheckedIndexedAccess`.

## Git

- Branch por assunto, a partir do branch de integração: `feat/<assunto>`,
  `fix/<assunto>`, `chore/<assunto>`, `docs/<assunto>`.
- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org),
  com assunto curto (até 72 caracteres), minúsculo e no imperativo da terceira
  pessoa: `feat(pedidos): valida transicao de status`.
- Escopos usuais: `api`, `web`, `auth`, `pedidos`, `clientes`, `produtos`,
  `produtores`, `relatorios`, `auditoria`, `design`, `infra`, `deps`.
- O hook `pre-commit` roda ESLint e Prettier nos arquivos alterados; o hook
  `commit-msg` valida a mensagem com commitlint.
- Integração com merge `--no-ff`, para o histórico mostrar a entrada de cada
  branch.
