# ADR 0017 — A receber por produtor, sem divisão do caixa

## Contexto

O acerto dividia o caixa do dia (PIX e dinheiro) entre os produtores, na
proporção do que cada um produziu (decisões D1 a D3). Na prática a família não
acerta assim. O que importa é saber quanto cada encomenda ainda tem a pagar e
quanto cada um tem a receber num período, e acertar fora do sistema.

## Decisão

- **A receber** de cada produtor é o valor dos salgados que fez, nos pedidos
  confirmados e concluídos com entrega no período, menos a parte dele nos
  descontos de cada pedido (maior resto, como antes). O fiado entra: o
  produtor fez o salgado.
- **Um lugar para o período:** a aba "Por produtor" dos relatórios mostra o a
  receber de cada um, abre na semana atual (de segunda a domingo) e tem
  atalhos para semana passada, este mês e mês passado, com planilha e
  mensagem do WhatsApp.
- **O acerto do dia** mostra o que entrou (caixa, fiado, sem pagamento) e o
  que cada um fez, sem divisão.
- **O que falta em cada encomenda** aparece no cartão da lista de pedidos, e o
  filtro "Falta pagar" mostra só os confirmados e concluídos com saldo. O
  fiado não quita: conta como devido.
- **Sem registro de repasses.** O sistema não guarda quanto já foi pago a cada
  produtor; um saldo acumulado exigiria registrar todo pagamento, e a família
  não quer essa obrigação.

## Consequências

- Sai a participação percentual e o "a receber do caixa / pendente" do acerto,
  da planilha e da mensagem do WhatsApp.
- "O que você fez" no Início conta só até hoje; pedidos dos próximos dias
  ficam em "próximos dias".
- A receber depende só de pedidos e preços: corrigir um pedido antigo muda o
  valor do período, e o histórico da mudança fica na auditoria do pedido.
