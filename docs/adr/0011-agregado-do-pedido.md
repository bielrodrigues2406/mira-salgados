# ADR 0011 — Pedido como agregado

## Contexto

Pedido, itens e pagamentos mudam juntos: um item altera o total, o total limita
os pagamentos, e os pagamentos decidem se o pedido pode ser cancelado. Duas
pessoas da família podem mexer no mesmo pedido ao mesmo tempo pelo celular.

## Decisão

- **Bloqueio do pedido em toda alteração.** Criar, editar, mudar status,
  adicionar, alterar ou remover item, registrar ou estornar pagamento: tudo
  começa com `SELECT ... FOR UPDATE` na linha do pedido. As invariantes (total
  não abaixo do pago, desconto até o valor dos itens em pedido confirmado,
  confirmado com ao menos um item) são verificadas depois da alteração, na mesma
  transação, e uma violação desfaz tudo, inclusive a auditoria.
- **Regras puras fora dos services.** A máquina de estados e os cálculos
  (subtotal, total, pago, saldo, estado de pagamento) ficam em
  `pedidos/dominio`, sem banco nem Nest, cobertos por testes unitários. As
  condições de conteúdo da transição (itens e pagamentos) também:
  o service só coleta os fatos.
- **Estado de pagamento derivado.** Nunca é gravado. A lista de pedidos soma
  itens e pagamentos da página em duas consultas agrupadas e aplica a mesma
  função de cálculo do detalhe.
- **Respostas com o agregado.** Toda alteração de item ou pagamento responde o
  pedido inteiro, com totais recalculados e as transições possíveis, e a tela
  não precisa de uma segunda requisição.
- **Entrega sem efeito financeiro.** Entrega ou retirada é informação
  logística (decisão D3): o pedido não tem taxa de entrega nem entregador, e
  trocar uma pela outra não altera valores.
- **Estorno lógico.** `DELETE /pedidos/:id/pagamentos/:id` marca data e autor
  do estorno; o lançamento continua no detalhe e sai das somas.
- **Saldo do cliente no banco.** O saldo consolidado soma, em SQL, total menos
  pago dos pedidos CONFIRMADO e CONCLUIDO de cada cliente, e só volta os que
  têm saldo. Um teste de integração confere que ele bate com o saldo calculado
  pelo domínio em cada pedido.
- **Número do pedido.** Coluna `GENERATED ALWAYS AS IDENTITY`: o banco
  numera, sem corrida entre duas criações simultâneas.

## Alternativas consideradas

- **Bloqueio otimista (coluna de versão).** Evita esperas, mas devolve erro a
  quem perdeu a corrida e exige repetir a operação na tela. Com poucas pessoas
  e operações curtas, esperar alguns milissegundos é melhor que refazer.
- **Totais gravados no pedido.** Consultas mais simples, mas qualquer caminho
  que esqueça de atualizá-los produz divergência, exatamente o que a
  especificação pede para evitar no estado de pagamento.
- **Saldo do cliente calculado em memória.** Reusaria a função do domínio, mas
  carregaria todos os pedidos de cada cliente da página; o custo cresce com o
  histórico.
- **Estorno apagando o lançamento.** A auditoria guardaria os dados, mas o
  histórico do caixa do pedido sumiria da tela.

## Consequências

- O `EntityManager` da transação passa pelos métodos do agregado, como já
  acontecia com a auditoria (ADR 0007).
- A fórmula do total existe em dois lugares (domínio e SQL do saldo); o teste
  de integração do saldo é o que as mantém iguais.
