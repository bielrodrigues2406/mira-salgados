# Design de interface — Mira Salgados

Protótipo navegável da interface (Prompt 1). Não é a implementação do sistema:
o backend NestJS e o frontend Angular descritos no Prompt 2 ainda não existem.

- Canvas (privado até ser compartilhado pelo menu Share):
  https://claude.ai/artifact/Rv49DZ1QcnYXbwcLMGKzGt
- Fonte: `design/canvas/project/` — um arquivo `.dc.html` por prancha e o
  índice `canvas.json` com posição e tamanho de cada uma.

## Pranchas

| Grupo | Prancha | Arquivo |
| --- | --- | --- |
| Pedidos e produção | Autenticação, com erro de credencial | `Login.dc.html` |
| | Autenticação com cadastro expandido | `LoginCadastro.dc.html` |
| | Pedidos (entrada), busca e filtros funcionais | `Main.dc.html` |
| | Detalhe do pedido | `PedidoDetalhe.dc.html` |
| | Produção do dia, modo cronológico | `ProducaoCronologica.dc.html` |
| | Produção do dia, modo consolidado | `ProducaoConsolidada.dc.html` |
| Cadastros e relatórios | Clientes, com formulário em contexto | `Clientes.dc.html` |
| | Produtos e precificação | `Produtos.dc.html` |
| | Produtores | `Produtores.dc.html` |
| | Relatórios, acerto diário | `RelatorioAcerto.dc.html` |
| Estados | Carregando (esqueleto), vazio, erro | `Estado*.dc.html` |
| Desktop | Pedidos com navegação lateral | `PedidosDesktop.dc.html` |
| Sistema | Cor, tipografia, forma, ícones, chips, controles | `Fundamentos.dc.html` |

No modo Play, a barra inferior, os cartões de pedido e o controle
cronológico/consolidado navegam entre as pranchas.

## Decisões de design

- **Âmbar em dois papéis sem conflito.** O âmbar saturado `#C79A2E` aparece só
  como preenchimento (pílula "Hoje", faixa lateral dos pedidos do dia, contador)
  ou como texto sobre `#0F2440`. O chip de preparo Frito usa um tint dourado
  claro (`#FAF0D9` com texto `#7A5A12`) e nunca o âmbar saturado.
- **A tela de Pedidos responde a pergunta principal.** Além do contador do dia,
  um cartão de síntese mostra o volume de hoje por produtor, com link para a
  produção.
- **Quantidades de cozinha em unidades.** O número grande é sempre em unidades
  (1 cento = 100). A forma de venda ("2 centos", "avulsas") vem como legenda.
- **Tokens derivados.** Âmbar para texto `#7A5A12`, borda interativa `#8A94A0`
  (3,1:1 para campos, chips e botões secundários) e tints por semântica. Estão
  todos na prancha Fundamentos.
- **Ícones.** Traço de 1,5 px absoluto, com stroke-width 2,25 a 16 px e 1,8 a
  20 px no grid 24, na linha do Lucide. O forno é desenhado à parte porque o
  Lucide não tem esse ícone.

## Restrições de contraste encontradas na paleta

| Par | Razão | Regra adotada |
| --- | --- | --- |
| `#C79A2E` sobre branco | 2,6:1 | Nunca como texto; só preenchimento e faixa |
| `#8E97A3` sobre branco | 2,9:1 | Só placeholder, desabilitado e decoração |
| `#E3E6EA` sobre branco | 1,3:1 | Só estrutura; controles usam `#8A94A0` |
| `#15803D` sobre tint `#EEF7F1` | 4,6:1 | Tint clareado para passar de 4,5:1 |

## Pontos da especificação que pedem decisão

1. **Fiado como pagamento.** Por `totalPago = soma(pagamento.valor)`, um pedido
   todo em FIADO fica "PAGO" com saldo zero, e o cliente some da lista de
   devedores. Proposta usada no protótipo: o estado de pagamento considera só
   DINHEIRO e PIX, e o fiado aparece como marcador e continua no saldo devedor.
2. **Base de datas do acerto.** Não está definido se `caixaLiquido` soma os
   pagamentos registrados na data ou os pagamentos dos pedidos entregues na
   data. Proposta: pedidos com entrega na data, para que `valorPendente` feche
   com o que falta receber daqueles pedidos.
3. **Taxa de entrega e desconto no acerto.** Ficam fora de `valorProduzido`,
   mas entram no caixa. No exemplo, o pendente somado (R$ 795,00) difere do que
   falta receber (R$ 797,00). É preciso decidir se a taxa e o desconto são
   rateados ou tratados à parte.
4. **Arredondamento.** Os percentuais aparecem com uma casa pelo método do
   maior resto (56,8 / 29,6 / 13,6). Os valores a receber são calculados em
   centavos e somam exatamente o caixa líquido.
5. **Pedido cancelado com pagamentos.** Não está definido se exige estorno. O
   protótipo omite o chip de pagamento em pedidos cancelados.
6. **Edição de itens após CONFIRMADO.** Não há regra. O detalhe de um pedido
   confirmado não oferece "adicionar item".
7. **Saldo devedor de rascunhos.** Proposta: o saldo consolidado do cliente
   conta só pedidos CONFIRMADO e CONCLUIDO.
8. **Mensagem de erro de login.** O Prompt 1 pede texto específico, e o
   Prompt 2 pede que usuário inexistente e senha errada sejam indistinguíveis.
   Texto adotado: "E-mail ou senha incorretos".
9. **Produtores fora dos cinco destinos.** No celular, o acesso fica em
   Produtos; no desktop, no grupo Cadastros da navegação lateral.
10. **Chip de produtor em verde.** Divide o tom com "Pago"; o ícone de pessoa
    diferencia os dois.
