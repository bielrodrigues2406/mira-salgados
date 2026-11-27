# ADR 0018 — Encomenda confirmada atômica, idempotência e transição de rascunhos

## Contexto

No fluxo original, criar uma encomenda exigia gravar primeiro um pedido vazio em
`RASCUNHO` (`POST /pedidos`), adicionar itens um a um (`POST /pedidos/:id/itens`)
e confirmar por último (`PATCH /pedidos/:id/status`). Na rotina da família pelo
celular, isso introduz atrito e deixa pedidos esquecidos em rascunho fora da
produção do dia. Por outro lado, encadear as chamadas antigas atrás de um único
botão no navegador deixaria rascunhos parciais no banco em caso de queda de rede
ou erro no segundo item.

## Decisão

- **Operação explícita de criação confirmada (`POST /pedidos/confirmados`).**
  Recebe dados do pedido e a lista de itens (1 a 100 itens) e grava tudo em uma
  única transação PostgreSQL, já com status `CONFIRMADO`, auditoria do pedido e
  de cada item e eventual intenção de notificação no mesmo commit.
- **Validação completa antes do `INSERT` do pedido.** Cliente ativo, produtos
  ativos, preços vigentes, produtores ativos, quantidades válidas e a invariante
  `desconto <= subtotal` são conferidos antes de gravar `pedidos`, evitando
  desperdiçar números sequenciais (`GENERATED ALWAYS AS IDENTITY`) em entradas
  inválidas.
- **Preservação das linhas e do arredondamento por item.** A criação atômica não
  funde linhas com o mesmo produto, preparo e unidade: cada linha gera seu
  próprio `ItemPedido` e é arredondada com `subtotalItem` antes da soma (mantendo
  a regressão de duas linhas de `0,50 CENTO` a R$ 95,01 = R$ 95,02 e 100
  unidades).
- **Idempotência por tentativa (`Idempotency-Key`).** O cliente envia um UUID no
  cabeçalho `Idempotency-Key` (liberado em `CORS` `allowedHeaders`). A tabela
  `chaves_idempotencia` guarda `(usuario_id, rota, chave, hash_requisicao,
pedido_id, expira_em)` com restrição única `UNIQUE (usuario_id, rota, chave)`:
  - Repetir a mesma chave com o mesmo payload canônico (duplo clique ou retentativa
    de rede) devolve o mesmo pedido sem duplicar nem renotificar.
  - Reaproveitar a chave com conteúdo diferente responde `409 Conflict`
    (`CHAVE_IDEMPOTENCIA_CONFLITANTE`).
  - Em corrida simultânea antes do commit, a restrição única do PostgreSQL
    (`23505`) resolve de forma atômica, sem criar pedidos duplicados.
  - No Angular, a chave é preservada em falhas de rede/`5xx`/duplo clique e
    regenerada assim que o operador altera qualquer campo ou item após erro
    `4xx`.
  - Chaves expiradas (TTL padrão de 72 horas) são purgadas periodicamente pelo
    worker.
- **Aposentadoria gradual de `RASCUNHO`.** A tela de novo pedido deixa de
  oferecer "Salvar como rascunho" e usa **Salvar encomenda**. `POST /pedidos`
  legado e as transições a partir de `RASCUNHO` permanecem ativas na API durante
  a transição para resolver pedidos antigos sem conversão automática. O painel
  inicial passa a contar todos os rascunhos pendentes (inclusive de datas
  anteriores) para facilitar o zeramento antes da remoção definitiva do estado.
- **Consultas sequenciais em transações.** Operações sobre o `EntityManager`
  transacional evitam `Promise.all` sobre a mesma conexão `pg.Client`, mantendo
  compatibilidade com `pg@9`.
- **Impressão no detalhe.** O detalhe do pedido passa a expor `<ms-compartilhar>`
  e marca controles interativos com `.nao-imprimir` para que a impressão ou PDF
  do pedido saia limpa.

## Alternativas consideradas

- **Sobrecarregar `POST /pedidos` aceitando `itens` opcional.** Mistura dois
  contratos (rascunho vazio vs encomenda confirmada com idempotência) no mesmo
  DTO sob `forbidNonWhitelisted`. Um endpoint explícito mantém a compatibilidade
  limpa e facilita deprecar o legado depois.
- **Encadear chamadas no navegador atrás de um botão.** Expõe rascunhos parciais
  em quedas de conexão no celular e não garante atomicidade com auditoria nem
  notificações.
- **Remover `RASCUNHO` do banco imediatamente.** Quebraria dados existentes em
  produção e exigiria migração arriscada de pedidos inacabados sem revisão
  humana.

## Consequências

- `POST /pedidos/confirmados` registra `pedido:CRIACAO` (já em `CONFIRMADO`) e
  `item_pedido:CRIACAO` por item, sem gerar `TRANSICAO_STATUS` artificial.
- Mesmo quando `RASCUNHO` deixar de existir para novos pedidos, a tela de
  alterações (`/alteracoes`) mantém o rótulo histórico de `RASCUNHO` para
  snapshots antigos em `logs_auditoria`.
