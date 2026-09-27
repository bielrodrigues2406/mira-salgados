# ADR 0001 — Monorepo com npm workspaces

## Contexto

O sistema tem uma API e uma aplicação web mantidas pela mesma pessoa, com
contrato compartilhado e ciclo de entrega conjunto. O repositório continha o
template padrão do Ionic, sem código próprio.

## Decisão

Um único repositório com `apps/api` e `apps/web` como workspaces do npm.
Ferramentas transversais (ESLint, Prettier, commitlint, husky, TypeScript)
ficam na raiz; dependências de cada aplicação ficam no seu `package.json`. O
template Ionic foi removido: o Prompt 2 proíbe bibliotecas de componentes de
interface, e o histórico do git preserva o conteúdo.

## Alternativas consideradas

- **Nx ou Turborepo.** Trazem cache de tarefas e grafo de dependências, úteis
  com muitos pacotes. Com duas aplicações, o custo de configuração e de
  aprendizado não se paga.
- **Dois repositórios.** Isolamento maior, mas cada mudança de contrato vira
  dois pull requests sincronizados.

## Consequências

- Um `package-lock.json` na raiz e um `npm install` para tudo.
- Sem pacote de tipos compartilhado por enquanto: os modelos do frontend
  espelham os DTOs da API. Se a divergência virar problema, a evolução natural é
  um workspace `packages/contrato` com os tipos, ou a geração de clientes a
  partir de OpenAPI.
