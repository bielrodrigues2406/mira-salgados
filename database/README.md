# Banco de dados

O esquema é definido exclusivamente por migrations versionadas em
`apps/api/src/database/migrations`. Não há `synchronize` em nenhum ambiente.

- `init/`: scripts executados pela imagem do PostgreSQL somente na primeira
  inicialização do volume. Hoje criam o banco de testes de integração.

Comandos (a partir da raiz):

```sh
docker compose up -d db
npm run migration:run --workspace apps/api
npm run migration:revert --workspace apps/api
```
