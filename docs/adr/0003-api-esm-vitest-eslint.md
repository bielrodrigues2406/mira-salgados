# ADR 0003 — API em ESM, testada com Vitest e analisada com ESLint

## Contexto

O NestJS 12 é publicado apenas como ESM, e a CLI passou a gerar projetos com
Vitest e oxlint. A especificação pede ESLint com regras estritas.

## Decisão

- **ESM com `module: nodenext`.** Importações relativas levam extensão `.js`, e
  o `main.ts` usa `await` no topo do módulo.
- **Vitest 5 nos testes unitários e de integração.** O transformador Oxc do Vite
  emite os metadados de decorators de que a injeção de dependência do Nest
  depende, sem precisar de SWC ou Babel.
- **ESLint 10 com typescript-eslint `strictTypeChecked`**, na raiz do monorepo,
  em vez do oxlint gerado pela CLI.
- **Migrations em lista explícita** (`src/database/migrations/index.ts`) em vez
  de glob, para que a CLI do TypeORM, a aplicação e os testes carreguem
  exatamente o mesmo conjunto.
- **`strictPropertyInitialization` desligado só na API.** Entidades e DTOs são
  hidratados pelo TypeORM e pelo class-transformer, não por construtor.

## Alternativas consideradas

- **oxlint.** Muito mais rápido, mas ainda não cobre todas as regras com
  informação de tipos do typescript-eslint nem as regras do angular-eslint.
  Manter um único linter no monorepo pesou mais que a velocidade.
- **Jest.** O suporte a ESM ainda depende de flags experimentais do Node.

## Consequências

- A CLI do TypeORM roda sobre o build (`dist/`), porque o carregamento direto de
  TypeScript no Node não aceita decorators.
- Testes de integração usam um banco real (`*_test`), recriado a cada execução
  a partir das migrations.
