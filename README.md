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
- [Design de interface](design/README.md)
