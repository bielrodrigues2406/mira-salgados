# ADR 0012 — Relatórios e acerto diário

## Contexto

O acerto encerra o dia: divide o dinheiro que entrou entre os produtores, em
proporção ao que cada um produziu. Um centavo a mais ou a menos só aparece
quando alguém confere na mão, e a família confere. Os demais relatórios olham
períodos (faturamento, produção por produtor, itens vendidos) ou o saldo em
aberto (fiados).

## Decisão

- **Acerto em memória, a partir de duas consultas.** Os itens dos pedidos
  CONFIRMADO e CONCLUIDO com entrega na data e os pagamentos ativos desses
  pedidos, somados por forma. O cálculo fica em `relatorios/acerto`, sem banco,
  coberto por testes unitários com o dia do protótipo.
- **Desconto repartido dentro do pedido (D3).** O desconto de cada pedido é
  dividido entre os seus itens pelo maior resto, em centavos. O valor produzido
  de cada produtor já vem líquido, e a soma dos valores produzidos é igual ao
  valor movimentado. O cartão do produtor mostra o valor dos itens, a parte dos
  descontos e o valor produzido, para que a conta seja conferível.
- **Divisão do caixa pelo maior resto.** O caixa líquido (DINHEIRO e PIX) é
  rateado pelo valor produzido com `ratearCentavos`, e as participações em
  décimos de ponto percentual com `ratearInteiro`: as partes somam o caixa e
  100,0% exatos. O desempate segue a ordem de exibição (maior valor produzido,
  depois nome), e não a ordem em que as linhas chegam do banco, para que o
  mesmo dia dê sempre o mesmo resultado.
- **Relatórios de período agregados no banco.** Faturamento, itens vendidos e
  produção por produtor somam em `numeric` no PostgreSQL e convertem o texto
  para centavos. O intervalo vai até 366 dias, o que limita a série diária do
  faturamento. Itens vendidos e produção por produtor mostram o valor dos
  itens antes dos descontos, porque repartir descontos de milhares de pedidos
  só faz sentido no acerto de um dia; o faturamento mostra os descontos à
  parte.
- **Fiado em aberto limitado ao saldo.** Por pedido, o fiado em aberto é o
  menor entre o fiado registrado e o que ainda falta receber. Um fiado pago
  depois em dinheiro ou PIX sai da relação sem precisar de estorno.
- **Resumo ao lado da paginação.** Listas paginadas de relatório levam
  `resumo` no envelope com os totais da coleção inteira (volume do período,
  total em aberto dos fiados), que a página sozinha não permite calcular.
- **Consultas parametrizadas.** As consultas com CTE e `LATERAL` usam SQL
  escrito à mão com parâmetros posicionais; só trechos fixos do código entram
  no texto da consulta.

## Alternativas consideradas

- **Desconto rateado entre todos os produtores do dia.** Mais simples, mas
  quem não participou de um pedido com desconto pagaria parte dele.
- **Relatório de período em memória.** Permitiria descontos repartidos em todo
  relatório, ao custo de carregar todos os itens de até um ano a cada consulta.
- **Total dos fiados em uma rota separada.** Evita o campo `resumo`, mas dobra
  as requisições e deixa página e total sujeitos a mudar entre uma e outra.

## Consequências

- O acerto de um dia com muitos pedidos continua leve: são dezenas de itens.
- Mudar a regra do acerto significa mudar uma função pura e os testes dela.
- Clientes da API que ignoram `resumo` continuam funcionando.
