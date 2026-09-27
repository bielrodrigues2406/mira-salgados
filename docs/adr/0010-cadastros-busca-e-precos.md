# ADR 0010 — Cadastros: nomes, busca e histórico de preços

## Contexto

Produtores, clientes e produtos são a base dos pedidos e dos acertos. Registros
antigos continuam referenciados por pedidos, a família digita nomes com e sem
acento, e o preço de um salgado muda ao longo do tempo sem poder alterar o
valor de pedidos já feitos.

## Decisão

- **Desativação em vez de exclusão.** Os três cadastros têm `ativo`. Desativar
  é um `PATCH { ativo: false }`, auditado como `DESATIVACAO`; reativar é o
  mesmo campo. Inativos saem das escolhas de novos pedidos e continuam no
  histórico.
- **Nomes.** Colunas de nome usam a collation ICU `pt-BR-x-icu`, e a ordenação
  segue o dicionário ("Célia" antes de "Cláudio") sem depender do locale do
  sistema operacional do banco. Produtores e produtos têm nome único sem
  distinção de maiúsculas (`UNIQUE (lower(nome))`), inclusive entre inativos:
  quem volta é reativado, não recadastrado. Todo texto recebido passa por NFC,
  para que "é" composto e decomposto sejam o mesmo caractere.
- **Busca de clientes.** Trecho do nome sem distinção de maiúsculas e acentos,
  com `lower(immutable_unaccent(nome)) LIKE ...` e índice GIN trigram sobre a
  mesma expressão. O termo também é procurado no telefone apenas quando é
  formado por dígitos e pontuação de telefone: "Escola 2" não lista todo
  telefone que contenha 2. Curingas do LIKE digitados na busca são escapados.
- **Telefone e endereço.** O telefone é guardado só com dígitos (10 para fixo,
  11 para celular), com a máscara aplicada na tela. Endereço é opcional, para
  quem só faz retirada.
- **Preço como histórico.** `precos_produto` tem `vigente_desde` e
  `vigente_ate`; um índice único parcial (`WHERE vigente_ate IS NULL`) garante
  no máximo um preço vigente por produto, preparo e unidade. Trocar o valor
  encerra o anterior e abre o novo no mesmo instante, sem lacuna. Encerrar um
  preço (`DELETE /produtos/:id/precos/:precoId`) tira a combinação da tabela
  vigente e mantém o registro. Definir o mesmo valor vigente responde 422.
- **Concorrência.** Alterações de preço bloqueiam a linha do produto
  (`FOR UPDATE`). O instante da troca é lido com `clock_timestamp()` depois do
  bloqueio: `now()` é o início da transação, e uma transação que começou antes
  mas esperou o bloqueio encerraria o preço recém-criado por outra com data
  anterior ao início dele (o teste de alterações simultâneas reproduzia a
  violação de `ck_precos_produto_periodo`). Escolher um produtor como padrão
  bloqueia a linha dele em modo compartilhado (`FOR SHARE`), e desativá-lo
  exige `FOR UPDATE` e nenhum produto ativo com ele como padrão; as duas
  operações não se cruzam.
- **Frontend.** Leituras com `httpResource`, mutações com `HttpClient`. O estado
  da tela (esqueleto, erro com nova tentativa, vazio, lista) deriva do status do
  resource, e uma recarga depois de gravar mantém a lista visível. Formulários
  abrem em contexto, no topo da lista ou no lugar do item editado, e recebem a
  gravação como função que devolve a mensagem de erro.

## Alternativas consideradas

- **Collation ICU não determinística para a busca.** O PostgreSQL 18 aceita
  LIKE com collation não determinística, o que dispensaria `unaccent`, mas esse
  LIKE não usa índice. A expressão com `unaccent` e trigram usa.
- **Busca textual completa (tsvector).** Resolve palavras inteiras e radicais,
  não trechos como "Marce" ou "9913". Trigram atende o que a tela pede.
- **Preço como coluna do produto.** Mais simples, mas perde o histórico e
  obriga o pedido a copiar o preço sem saber de onde veio.
- **`deleted_at` em vez de `ativo`.** "Excluído" sugere algo que some; para a
  família, o produtor inativo continua existindo e pode voltar.
- **Remover o preço de fato.** Apagaria a origem de valores usados em pedidos e
  relatórios.

## Consequências

- As extensões `unaccent` e `pg_trgm` passam a ser requisito do banco. Ambas
  são confiáveis desde o PostgreSQL 13 e fazem parte da imagem oficial.
- Índices de expressão e parciais são criados só nas migrations e marcados com
  `synchronize: false` nas entidades; o teste de esquema continua valendo para
  todo o resto.
- Pedidos vão gravar o preço praticado em cada item, e a tabela de preços serve
  apenas de sugestão no momento do pedido.
