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

| #   | Ponto                                | Decisão                     | Efeito na implementação                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Fiado como pagamento                 | Fiado não quita o pedido    | `statusPagamento` e `saldoDevedor` consideram só DINHEIRO e PIX; o fiado aparece como marcador e o valor continua no saldo devedor do cliente                                                                                                                                                         |
| D2  | Base de datas do acerto              | Pedidos com entrega na data | `caixaLiquido` soma os pagamentos em DINHEIRO e PIX dos pedidos CONFIRMADO ou CONCLUIDO entregues na data, qualquer que seja a data do registro                                                                                                                                                       |
| D3  | Taxa de entrega e desconto no rateio | Sem taxa de entrega         | Revista no mesmo dia: entrega ou retirada é só informação logística, sem taxa nem entregador. O total é `subtotal - desconto`, diferente da fórmula da especificação. No acerto, o desconto de cada pedido é repartido entre os seus itens, e cada produtor recebe pelo valor líquido do que produziu |
| D4  | Cancelamento com pagamento           | Exige estorno antes         | A transição para CANCELADO é recusada com 422 enquanto houver pagamento registrado                                                                                                                                                                                                                    |

Pontos com resolução técnica adotada, sem decisão pendente:

- **Arredondamento do rateio:** maior resto, em centavos e em décimos de ponto
  percentual (ADR 0004).
- **Edição de itens:** permitida em RASCUNHO e CONFIRMADO; bloqueada em
  CONCLUIDO e CANCELADO, que são estados terminais.
- **Saldo devedor do cliente:** soma apenas pedidos CONFIRMADO e CONCLUIDO.

Pontos levantados ao implementar pedidos
([ADR 0011](adr/0011-agregado-do-pedido.md)), a produção do dia e os relatórios:

| #   | Ponto                                                                              | Resolução                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Pela fórmula, um pedido de total zero (desconto integral) fica PENDENTE            | Fica PAGO: não há nada a receber                                                                                                                                                                                           |
| P2  | Nada impede registrar mais do que o saldo                                          | Dinheiro e PIX valem no máximo o saldo; troco não é pagamento. Fiado vale no máximo o saldo ainda não marcado como fiado                                                                                                   |
| P3  | Desconto ou remoção de item podem deixar o total abaixo do pago                    | Recusado com 422; estorna-se antes                                                                                                                                                                                         |
| P4  | Desconto maior que o valor dos itens tornaria negativa a parte dos produtores (D3) | Recusado em pedido confirmado; no rascunho o desconto pode anteceder os itens e a regra vale ao confirmar                                                                                                                  |
| P5  | O contrato prevê `DELETE` para estorno, sem dizer se apaga                         | Estorno lógico: o lançamento fica com data e autor do estorno e sai das somas                                                                                                                                              |
| P6  | Taxa de entrega e entregador no pedido                                             | Fora do sistema (D3): a API recusa os dois campos com 400, e trocar entre entrega e retirada não muda valores                                                                                                              |
| P7  | Pedido confirmado sem nenhum item                                                  | Remover o último item de um pedido confirmado é recusado; cancela-se o pedido                                                                                                                                              |
| P8  | `quantidade` inteira não representa "meio cento", comum em salgados                | Mantida inteira; meio cento é vendido como 50 unidades. Evolução possível: unidade MEIO_CENTO na tabela de preços, sem mudar a aritmética                                                                                  |
| P9  | `DELETE /clientes/:id`, `/produtos/:id` e `/produtores/:id` no contrato            | Implementados como desativação, equivalentes a `PATCH { ativo: false }`, com as mesmas regras (produtor padrão de produto ativo não é desativado)                                                                          |
| P10 | `GET /produtos/:id` "inclui histórico de preços"                                   | O histórico, que cresce sem limite, fica paginado em `GET /produtos/:id/precos`; o produto traz os preços vigentes                                                                                                         |
| P11 | Itens e pagamentos de um pedido sem paginação                                      | São poucos por natureza e fazem parte do agregado; paginar o detalhe só adicionaria requisições                                                                                                                            |
| P12 | O consolidado agrega "por produto e preparo", mas cada item tem seu produtor       | Uma linha por produto, preparo e produtor: um item com produtor trocado vira linha própria, e cada produtor vê a sua carga                                                                                                 |
| P13 | Pedido concluído na produção do dia                                                | Entra, com marcador de concluído: a produção de uma data passada continua conferível; rascunho e cancelado ficam fora                                                                                                      |
| P14 | Produção do dia sem paginação                                                      | O relatório é de uma data só, com dezenas de itens, e os dois modos são montados em memória a partir de uma consulta; os relatórios por intervalo agregam no banco                                                         |
| P15 | Relatórios de período com ou sem descontos por item                                | Itens vendidos e produção por produtor mostram o valor dos itens antes dos descontos; o faturamento traz os descontos à parte; só o acerto reparte o desconto de cada pedido ([ADR 0012](adr/0012-relatorios-e-acerto.md)) |
| P16 | "Créditos informais em aberto" quando o cliente paga depois                        | O fiado em aberto de um pedido é o menor entre o fiado registrado e o saldo; pagar depois em dinheiro ou PIX tira o pedido da relação                                                                                      |
| P17 | Intervalo dos relatórios sem limite                                                | Até 366 dias, com 400 acima disso ou com fim antes do início; a tela abre no mês atual                                                                                                                                     |
| P18 | "Ranking de produtos" sem dizer se separa preparo                                  | Uma linha por produto e preparo: coxinha frita e congelada são trabalhos e preços diferentes                                                                                                                               |

## Desempenho e índices

| Tabela           | Índice                                                          | Consulta atendida                       |
| ---------------- | --------------------------------------------------------------- | --------------------------------------- |
| `refresh_tokens` | único em `token_hash`                                           | Renovação de sessão                     |
| `refresh_tokens` | `family_id`                                                     | Revogação da família                    |
| `logs_auditoria` | `(entidade, entidade_id, criado_em)`                            | Histórico de um registro                |
| `logs_auditoria` | `criado_em`                                                     | Filtro por intervalo                    |
| `produtores`     | único em `lower(nome)`                                          | Nome repetido sem distinção de caixa    |
| `clientes`       | GIN trigram em `lower(immutable_unaccent(nome))`                | Busca por trecho do nome, sem acentos   |
| `clientes`       | GIN trigram em `telefone`                                       | Busca por trecho do telefone            |
| `produtos`       | único em `lower(nome)`                                          | Nome repetido sem distinção de caixa    |
| `produtos`       | `produtor_padrao_id`                                            | Produtos de um produtor, desativação    |
| `precos_produto` | único parcial em `(produto_id, preparo, unidade_venda)` vigente | Um preço vigente por combinação         |
| `precos_produto` | `(produto_id, vigente_desde DESC)`                              | Histórico de preços de um produto       |
| `pedidos`        | `(data_entrega, status)`                                        | Lista por data, produção do dia, acerto |
| `pedidos`        | `(cliente_id, status)`                                          | Saldo devedor e fiados do cliente       |
| `itens_pedido`   | `pedido_id`                                                     | Itens do pedido, somas da lista         |
| `itens_pedido`   | `produtor_id`                                                   | Produção e acerto por produtor          |
| `pagamentos`     | `pedido_id`                                                     | Pagamentos do pedido, somas da lista    |

A busca de clientes foi conferida com `EXPLAIN`: nome e telefone usam os dois
índices trigram num `BitmapOr`. Decisões dos cadastros no
[ADR 0010](adr/0010-cadastros-busca-e-precos.md).

A lista de pedidos soma itens e pagamentos da página em duas consultas
agrupadas por pedido, em vez de uma por pedido. Os relatórios de intervalo
(faturamento, itens vendidos) serão conferidos com `EXPLAIN` quando existirem.

## Evolução

- **Níveis de permissão.** O guard global já centraliza a identidade; falta só o
  metadado de papéis e uma coluna ou tabela de papéis por usuário.
- **Múltiplos produtores por item.** O modelo prevê um `produtorId` por item.
  Dividir um item entre pessoas hoje significa dividir a quantidade em dois
  itens, o que é suficiente para o acerto, que soma por produtor.
