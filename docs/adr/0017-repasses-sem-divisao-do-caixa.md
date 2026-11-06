# ADR 0017 — Repasses, sem divisão automática do caixa

## Contexto

O acerto dividia o caixa do dia (PIX e dinheiro) entre os produtores, na
proporção do que cada um produziu (decisões D1 a D3). Na prática a família não
acerta assim: o que importa é saber o que entrou e quanto cada um tem a
receber, e pagar cada um quando der, sem obrigação de registrar todo dia.

## Decisão

- **A receber** de cada produtor é o valor dos salgados que fez, nos pedidos
  confirmados e concluídos com entrega até a data, com a parte dos descontos de
  cada pedido (maior resto, como antes). Fiado e o que falta pagar entram desde
  já: o produtor fez o salgado.
- **Repasses** registram o dinheiro entregue a um produtor (valor, PIX ou
  dinheiro, data e observação). São opcionais e livres: um por semana, um por
  mês ou nenhum. Qualquer conta registra e desfaz; desfazer é lógico e tudo
  fica na auditoria.
- **Falta** = a receber − repasses, acumulado desde o começo. Negativo é
  adiantamento.
- O acerto do dia mostra o que entrou (caixa, fiado, sem pagamento) e o que
  cada um fez, sem divisão. O saldo fica em `/relatorios/saldos` e na tela
  Repasses; o Início mostra o saldo de quem tem conta ligada a um produtor.

## Consequências

- Sai a participação percentual e o "a receber do caixa / pendente" do acerto,
  da planilha e da mensagem do WhatsApp.
- "O que você fez" no Início conta só até hoje, como o saldo; pedidos dos
  próximos dias ficam em "próximos dias".
- A receber depende só de pedidos e preços; corrigir um pedido antigo muda o
  saldo, e o histórico da mudança fica na auditoria do pedido.
