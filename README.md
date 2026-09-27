# Mira Salgados

Sistema interno de gestão de encomendas de salgados: pedidos, produção do dia,
pagamentos e acerto de contas entre produtores.

## Estrutura

```
apps/api     API REST (NestJS 12, TypeORM, PostgreSQL 18)
apps/web     Aplicação web (Angular 22)
database/    Scripts de inicialização do PostgreSQL
design/      Protótipo de interface e decisões de design
docker/      Imagens de produção
docs/        Convenções, ADRs e análise crítica da especificação
tools/       Regras locais de lint
```

## Requisitos

- Node.js 24 LTS (`nvm use` lê o `.nvmrc`)
- npm 11
- Docker com Compose

## Primeiros passos

```sh
cp .env.example .env        # defina POSTGRES_PASSWORD
npm install
docker compose up -d db
```

API (a partir da raiz):

```sh
cp apps/api/.env.example apps/api/.env              # ajuste DATABASE_URL
cp apps/api/.env.test.example apps/api/.env.test    # banco *_test dos testes
npm run migration:run -w @mira/api
npm run start:dev -w @mira/api                      # http://localhost:3000/api/v1
npm test -w @mira/api                               # testes unitários
npm run test:integration -w @mira/api               # testes contra o PostgreSQL
```

Web (com a API rodando):

```sh
npm start -w @mira/web                              # http://localhost:4200
npm test -w @mira/web                               # testes unitários (Vitest)
npm run build -w @mira/web                          # build de produção
```

Para criar as primeiras contas, suba a API com `AUTH_PUBLIC_SIGNUP_ENABLED=true`,
crie as contas pela tela de login e desligue a variável em seguida.

## Scripts da raiz

| Script              | O que faz                                          |
| ------------------- | -------------------------------------------------- |
| `npm run lint`      | ESLint em todo o monorepo, sem tolerância a avisos |
| `npm run format`    | Prettier em todo o monorepo                        |
| `npm run typecheck` | Verificação de tipos em cada aplicação             |
| `npm test`          | Testes de cada aplicação                           |
| `npm run build`     | Build de cada aplicação                            |

## Documentação

- [Convenções de idioma, código e git](docs/convencoes.md)
- [Decisões de arquitetura](docs/adr)
- [Análise crítica da especificação](docs/analise-critica.md)
- [Design de interface](design/README.md)
