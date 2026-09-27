# ADR 0002 — Versões da stack

## Contexto

A especificação original cita Node 20, PostgreSQL 16 e Angular 19. A
orientação posterior é usar as versões mais atuais. Levantamento feito em
27/09/2026 no registro do npm, em nodejs.org e no Docker Hub.

## Decisão

| Tecnologia | Versão         | Observação                                                                                                    |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Node.js    | 24 LTS (24.21) | O 26 é a linha Current e só vira LTS em outubro/2026                                                          |
| TypeScript | 6.0            | O 7.0 (compilador nativo) ainda não é suportado pelo Angular 22 nem pelo typescript-eslint, que exigem `<6.1` |
| Angular    | 22.2           | Standalone, zoneless e signals por padrão; testes com Vitest                                                  |
| NestJS     | 12.1           | Publicado apenas como ESM                                                                                     |
| TypeORM    | 1.1            | Primeira linha estável após a 0.3                                                                             |
| PostgreSQL | 18.6           | O 19 está em beta                                                                                             |
| ESLint     | 10             | Configuração flat, com typescript-eslint e angular-eslint                                                     |
| Vitest     | 5              | Usado na API e na web                                                                                         |

## Consequências

- O TypeScript 6.0 é o limite comum. Migrar para o 7.0 depende do suporte do
  Angular e do typescript-eslint e deve ser uma mudança isolada.
- O NestJS 12 em ESM exige importações relativas com extensão `.js` e
  `module: nodenext`.
- O Angular 22 adota o guia de estilo sem sufixos de tipo nos nomes de arquivo
  (`login.ts`, `login.html`, `login.css`). O projeto segue o guia atual em vez da
  estrutura `*.component.ts` citada na especificação.
