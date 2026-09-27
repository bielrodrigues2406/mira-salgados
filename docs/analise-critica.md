# Análise crítica da especificação

Pontos em que a especificação é ambígua, inconsistente ou arriscada, com a
resolução proposta. Atualizado a cada módulo implementado.

## Segurança

| #   | Ponto                                                                                                                               | Risco                                                                         | Resolução                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| S1  | `POST /auth/registro` aparece sem restrição no contrato                                                                             | Qualquer pessoa que encontre a URL cria conta e lê todos os dados             | Cadastro exige usuário autenticado; o cadastro público é uma chave de configuração, desligada por padrão (ADR 0006) |
| S2  | O Prompt 1 pede mensagem de erro específica no login; o Prompt 2 exige que usuário inexistente e senha errada sejam indistinguíveis | Mensagens diferentes revelam quais e-mails têm conta                          | Mensagem única e específica sobre a falha: "E-mail ou senha incorretos."                                            |
| S3  | O contrato não prevê encerramento de sessão                                                                                         | Sem logout, o refresh token vale até expirar, mesmo em aparelho compartilhado | Adicionado `POST /auth/logout`, que revoga a família de tokens                                                      |
| S4  | Duas abas renovando a sessão ao mesmo tempo acionam a detecção de reuso                                                             | Usuário desconectado sem motivo aparente                                      | Renovação serializada dentro da aba; coordenação entre abas é evolução prevista (ADR 0006)                          |
| S5  | O log de auditoria guardaria o estado completo das entidades                                                                        | Hash de senha e tokens copiados para uma tabela de leitura ampla              | Snapshots passam por sanitização que remove campos sensíveis                                                        |
| S6  | Todo usuário autenticado lê a auditoria inteira                                                                                     | Aceitável com quatro pessoas; deixa de ser com papéis diferentes              | Guard de papéis entra sem mudar services quando houver níveis de permissão                                          |

## Decisões de domínio

Ambiguidades levantadas no protótipo
([`design/README.md`](../design/README.md#pontos-da-especificação-que-pedem-decisão))
e decididas pelo responsável pelo produto em 27/09/2026.

| #   | Ponto                                | Decisão                     | Efeito na implementação                                                                                                                                                                                               |
| --- | ------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Fiado como pagamento                 | Fiado não quita o pedido    | `statusPagamento` e `saldoDevedor` consideram só DINHEIRO e PIX; o fiado aparece como marcador e o valor continua no saldo devedor do cliente                                                                         |
| D2  | Base de datas do acerto              | Pedidos com entrega na data | `caixaLiquido` soma os pagamentos em DINHEIRO e PIX dos pedidos CONFIRMADO ou CONCLUIDO entregues na data, qualquer que seja a data do registro                                                                       |
| D3  | Taxa de entrega e desconto no rateio | Taxa de entrega à parte     | A taxa sai do caixa antes da divisão e cabe a quem fez a entrega; o valor dos itens, já com o desconto, é dividido entre os produtores. Exige registrar no pedido quem fez a entrega (a definir no módulo de pedidos) |
| D4  | Cancelamento com pagamento           | Exige estorno antes         | A transição para CANCELADO é recusada com 422 enquanto houver pagamento registrado                                                                                                                                    |

Pontos com resolução técnica adotada, sem decisão pendente:

- **Arredondamento do rateio:** maior resto, em centavos e em décimos de ponto
  percentual (ADR 0004).
- **Edição de itens:** permitida em RASCUNHO e CONFIRMADO; bloqueada em
  CONCLUIDO e CANCELADO, que são estados terminais.
- **Saldo devedor do cliente:** soma apenas pedidos CONFIRMADO e CONCLUIDO.

## Desempenho e índices

| Tabela           | Índice                                                          | Consulta atendida                     |
| ---------------- | --------------------------------------------------------------- | ------------------------------------- |
| `refresh_tokens` | único em `token_hash`                                           | Renovação de sessão                   |
| `refresh_tokens` | `family_id`                                                     | Revogação da família                  |
| `logs_auditoria` | `(entidade, entidade_id, criado_em)`                            | Histórico de um registro              |
| `logs_auditoria` | `criado_em`                                                     | Filtro por intervalo                  |
| `produtores`     | único em `lower(nome)`                                          | Nome repetido sem distinção de caixa  |
| `clientes`       | GIN trigram em `lower(immutable_unaccent(nome))`                | Busca por trecho do nome, sem acentos |
| `clientes`       | GIN trigram em `telefone`                                       | Busca por trecho do telefone          |
| `produtos`       | único em `lower(nome)`                                          | Nome repetido sem distinção de caixa  |
| `produtos`       | `produtor_padrao_id`                                            | Produtos de um produtor, desativação  |
| `precos_produto` | único parcial em `(produto_id, preparo, unidade_venda)` vigente | Um preço vigente por combinação       |
| `precos_produto` | `(produto_id, vigente_desde DESC)`                              | Histórico de preços de um produto     |

A busca de clientes foi conferida com `EXPLAIN`: nome e telefone usam os dois
índices trigram num `BitmapOr`. Decisões dos cadastros no
[ADR 0010](adr/0010-cadastros-busca-e-precos.md).

Os índices dos relatórios (pedidos por data de entrega e status, itens por
produtor, pagamentos por pedido) serão definidos junto com as consultas.

## Evolução

- **Níveis de permissão.** O guard global já centraliza a identidade; falta só o
  metadado de papéis e uma coluna ou tabela de papéis por usuário.
- **Múltiplos produtores por item.** O modelo prevê um `produtorId` por item.
  Dividir um item entre pessoas hoje significa dividir a quantidade em dois
  itens, o que é suficiente para o acerto, que soma por produtor.
