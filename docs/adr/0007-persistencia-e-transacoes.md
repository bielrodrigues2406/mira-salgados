# ADR 0007 — Persistência e transações

## Contexto

A especificação pede que a camada de persistência não vaze detalhes do ORM
para os services "quando isso puder ser evitado sem custo excessivo", e que o
log de auditoria participe da mesma transação da operação auditada.

## Decisão

- Services usam diretamente o `Repository` do TypeORM para operações simples.
  Consultas com filtros dinâmicos ou agregações usam QueryBuilder com
  parâmetros nomeados. Concatenar valores em SQL é proibido, inclusive em
  relatórios.
- Operações que alteram mais de uma entidade rodam em
  `dataSource.transaction(...)`. O `EntityManager` da transação é repassado a
  quem precisa participar dela, como `AuditoriaService.registrar(manager, ...)`.
- Nomes de tabelas, colunas, chaves e índices são explícitos e em snake_case,
  iguais nas entidades e nas migrations.
- Um teste de integração compara as entidades com o esquema criado pelas
  migrations e falha em qualquer divergência.

## Alternativas consideradas

- **Repositórios próprios por agregado, escondendo o TypeORM.** Isolaria o ORM,
  mas duplicaria a API do `Repository` sem ganho real para um sistema deste
  porte. Fica reservado a consultas complexas, como as dos relatórios.
- **Contexto transacional implícito (AsyncLocalStorage).** Evita passar o
  `EntityManager` adiante, mas torna invisível quais operações participam da
  transação, justamente o que a auditoria precisa garantir.

## Consequências

- O tipo `EntityManager` aparece na assinatura de quem participa de transações
  alheias. É um vazamento consciente e restrito.
- Colunas `jsonb` são gravadas com `save` em vez de `insert`, porque o tipo
  parcial profundo do TypeORM não resolve tipos JSON recursivos.
