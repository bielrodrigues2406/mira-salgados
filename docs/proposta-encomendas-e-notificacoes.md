# Encomendas e notificações do Mira Salgados

Proposta para revisão do Antigravity, baseada em `e333384`. O fluxo normal passa a confirmar a
encomenda em um único salvamento. A equipe recebe avisos em um grupo de WhatsApp e um resumo na data
combinada para entrega ou retirada. A tela de automações reúne a configuração das regras, a prévia
das mensagens e a empadinha aprovada como direção visual. O escopo desta entrega é a proposta e o
protótipo de movimento.

## Estado atual das encomendas

| Estado interno | Rótulo     | Significado e transições                                                                                                                  |
| -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `RASCUNHO`     | Rascunho   | Editável e fora da produção e do acerto. Vai para `CONFIRMADO` ou `CANCELADO`.                                                            |
| `CONFIRMADO`   | Confirmado | Em vigor e ainda editável. Entra na produção e no acerto. Vai para `CONCLUIDO` ou `CANCELADO`.                                            |
| `CONCLUIDO`    | Concluído  | Encerra a operação e sai da lista de entregas pendentes. Continua nos totais de produção e acerto e pode ter saldo a receber. É terminal. |
| `CANCELADO`    | Cancelado  | Sai da produção e do acerto. Cancelar exige estornar os pagamentos ativos. É terminal.                                                    |

`CONCLUIDO` é o estado de encerramento também para entregas. `ENTREGA` e `RETIRADA` são
modalidades. A produção é uma visão que agrega os pedidos confirmados e concluídos pela data
combinada. O pagamento tem estado próprio derivado, com `PENDENTE` (Pendente), `PARCIAL` (Parcial)
e `PAGO` (Pago). Dinheiro e PIX abatem saldo. Fiado continua devido. O aviso de interface
“Pedido voltou a rascunho” existe no detalhe, embora a API vede essa transição.

[Rótulos da interface](../apps/web/src/app/shared/components/chip-status/chip-status.ts) ·
[Estados de domínio](../apps/api/src/pedidos/dominio/enums.ts) ·
[Máquina de estados](../apps/api/src/pedidos/dominio/maquina-de-estados.ts) ·
[Cálculo do pagamento](../apps/api/src/pedidos/dominio/calculos.ts) ·
[Painel de entregas](../apps/api/src/relatorios/painel/painel.ts)

## Salvar encomenda em um clique

Hoje **Criar e adicionar itens** grava um rascunho vazio e abre o detalhe. A confirmação vem depois.
No fluxo proposto, o operador preenche dados e itens e usa **Salvar encomenda**. O servidor valida
cliente, modalidade, data, itens, preços vigentes, produtores, quantidades e desconto em conjunto.
Horário e endereço permanecem opcionais. Uma única transação grava pedido confirmado, itens,
auditoria e a intenção de envio que se aplicar. O formulário conserva o preenchimento em caso de
erro. A confirmação efetiva, seja na criação ou em um rascunho existente, gera um único evento de
negócio. Rascunhos vazios, autosaves e transações revertidas ficam fora.

A direção indicada por Gabriel é retirar **Salvar como rascunho** para novos pedidos. A opção só
se justifica se a equipe realmente precisar retomar orçamentos ou encomendas com quantidade, data
ou sabor em aberto. Manter os rascunhos antigos acessíveis para confirmação ou cancelamento
individual, sem conversão automática. Uma confirmação manual antiga gera o aviso se for elegível.
Tratar a remoção definitiva do estado como etapa posterior, após verificar dados e consumidores.

| Área                   | Compatibilidade e implementação proposta                                                                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API                    | Adicionar operação explícita de criação confirmada com dados e itens. Preservar o contrato atual de `POST /pedidos` durante a transição, os endpoints de itens e `PATCH /pedidos/:id/status` para confirmar legados e aplicar as demais transições. Encadear chamadas atuais com um único botão expõe rascunhos parciais se alguma chamada falhar. |
| Concorrência           | Reutilizar o bloqueio do agregado nas alterações. Na criação, usar chave de idempotência por tentativa, devolver o mesmo pedido ao repetir a mesma entrada e rejeitar a chave reaproveitada com conteúdo diferente. Resolver o preço vigente no servidor.                                                                                          |
| Impressão e produção   | Após o commit, abrir o mesmo detalhe com número, itens e totais. Validar impressão e exportações nas telas que as oferecem. A produção e o acerto passam a enxergar o pedido completo após o commit.                                                                                                                                               |
| Pagamentos e auditoria | Conservar os endpoints de pagamentos e estornos e a exigência de estornar antes de cancelar. Auditar autor, criação confirmada e itens no mesmo commit.                                                                                                                                                                                            |
| Reversão               | Uma falha na gravação reverte pedido, itens, auditoria e intenção de envio. Desativar o novo fluxo de interface permite voltar ao fluxo legado sem rebaixar pedidos já confirmados.                                                                                                                                                                |

[Criação no Angular](../apps/web/src/app/features/pedidos/novo/novo-pedido.html) ·
[Controller](../apps/api/src/pedidos/pedidos.controller.ts) ·
[Transações](../apps/api/src/pedidos/pedidos.service.ts) ·
[Agregado](../apps/api/src/pedidos/agregado-pedido.ts) ·
[Itens](../apps/api/src/pedidos/itens/itens.service.ts) ·
[Pagamentos](../apps/api/src/pedidos/pagamentos/pagamentos.service.ts) ·
[Saldo por cliente](../apps/api/src/pedidos/saldo-devedor.service.ts) ·
[Acerto diário](../apps/api/src/relatorios/acerto/acerto-diario.service.ts) ·
[Impressão](../apps/web/src/styles.css)

## Regras de aviso dentro do Mira

**Equipe Mira** é o destino inicial para as duas regras. Cada uma terá liga/desliga, destino,
modalidade e filtros próprios. Salvar os parâmetros e simular a mensagem são ações disponíveis antes
da ativação. A transmissão começa por decisão administrativa. O aviso imediato vale a partir de
novas confirmações e o primeiro resumo considera os pedidos elegíveis para a próxima data agendada,
mesmo que tenham sido cadastrados antes.

- **Quais encomendas disparam** permite todas ou encomendas com pelo menos um dos preparos escolhidos.
  **Itens exibidos** permite todos ou só os correspondentes. Com filtro **Todas**, os dois formatos
  correspondem a todos os itens. A configuração inicial do aviso seleciona encomendas com assado e
  exibe o pedido inteiro, com os assados destacados.
- **Aviso imediato** sai ao salvar uma encomenda confirmada. A primeira inclusão de assado em um
  pedido já confirmado pode gerar o primeiro aviso. Em **Com assados**, mudar a quantidade de um
  assado ou remover o último gera correção. Alterar só os fritos gera correção no modo **Todas as
  encomendas**. Data, horário e cancelamento com assados mantidos precisam de regra explícita.
- **Resumo** usa `dataEntrega`, que representa o dia combinado para entrega ou retirada. A equipe
  escolhe dias da semana e uma hora no fuso `America/Sao_Paulo`, como 7h ou 12h. Ordenar por horário,
  depois por número, com horário ausente no fim. Incluir confirmados e concluídos. Omitir dias vazios
  por padrão. A regra tem filtro próprio, e Gabriel precisa confirmar se o padrão deve ser todos os
  pedidos do dia ou todos os que correspondem ao filtro escolhido.
- **Complementos** cobrem pedidos novos e alterações relevantes após o resumo. Substituir revisões
  antigas ainda pendentes. Para avisos que a equipe já recebeu, identificar a correção pelo número do
  pedido. Se o aviso imediato e o complemento cobrirem a mesma alteração para o mesmo grupo, emitir
  uma única mensagem. Fixar uma janela para recuperar o resumo do próprio dia após indisponibilidade.

O catálogo classifica a combinação de preço em `FRITO`, `ASSADO` e `CONGELADO`. O filtro usa o
`preparo` gravado no item do pedido. Um produto pode ser vendido em mais de um preparo. A
mensagem converte quantidade para unidades inteiras com a regra de `unidadesDe`. Assim,
`0,50 CENTO` no armazenamento aparece como 50 salgados. O preço vigente copiado permanece por
cento para essa modalidade. Os valores das linhas continuam arredondados antes da soma.

[Catálogo](../apps/api/src/produtos/preco-produto.entity.ts) ·
[Item do pedido](../apps/api/src/pedidos/itens/item-pedido.entity.ts) ·
[Data e horário](../apps/api/src/pedidos/pedido.entity.ts) ·
[Ordenação da produção](../apps/api/src/relatorios/producao/producao-do-dia.service.ts) ·
[Conversão em unidades](../apps/api/src/relatorios/producao/producao-do-dia.ts)

### Exemplos sintéticos

> **27/11 às 19h • Pedido #104 • Retirada**
>
> - 50 coxinhas de frango (fritas)
> - **25 esfihas de carne (assadas)**
> - **25 empadas de frango (assadas)**

> **Bom dia! Hoje temos estas encomendas com assados…**
>
> - **27/11 às 9h30 • Pedido #103 • Entrega** — 30 empadas de frango
> - **27/11 às 19h • Pedido #104 • Retirada** — 25 esfihas de carne e 25 empadas de frango

Se o filtro do resumo for **Todas**, usar uma abertura que reflita esse escopo. Os campos permitidos
são número, data, hora, modalidade, produto, preparo e quantidade. O texto e a fila dispensam nome
do cliente, telefone, endereço, valores, forma de pagamento e observações livres.

### Esboço da tela

| Área            | Essencial                                                                                       | Avançado                                                             |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Canal e destino | Estado textual da conexão, grupo escolhido, prévia com dados fictícios e ação **Simular envio** | Teste em grupo autorizado, reconexão, pausa e confirmação de destino |
| Aviso imediato  | Liga/desliga, destino, filtro e itens exibidos                                                  | Modalidade, correção e cancelamento                                  |
| Resumo          | Liga/desliga, destino, dias, hora, fuso, filtro e **Omitir dias vazios**                        | Complementos, tolerância de atraso e política de recuperação         |
| Histórico       | Encomenda ou data, regra, destino, momento e resultado                                          | Tentativas, reconciliar envio incerto e revisão administrativa       |

Configuração de regras, destinos, ativação e reenvios restritos a `ADMIN`, com auditoria de mudanças.
A empadinha entra no primeiro acesso, no estado vazio e no retorno de conexão ou simulação. O
texto explica o estado junto da ação adequada, inclusive com a imagem ausente ou movimento
reduzido.

## Entrega das mensagens e escolha de arquitetura

Começar com módulo NestJS e outbox no PostgreSQL do Mira, com o worker em processo separado.
O Mira é responsável por eventos, filtros e dados. A fila usa uma intenção com destino e texto
permitido. O adaptador controla a sessão de mensageria, traduz a API e devolve o resultado.
O conector roda em contêiner privado e recebe somente os dados necessários para a entrega.

A intenção é gravada na transação e fica visível ao worker após o commit. A chave do aviso é
`pedido + regra + destino + revisão` e a chave do resumo é `regra + destino + data local`.
Para correções que as duas regras mandariam ao mesmo grupo, usar uma identidade compartilhada para
o mesmo pedido, revisão e destino. Guardar o registro de quais pedidos foram incluídos no resumo
para reconciliar correções. Usar restrições únicas e reservas com expiração para workers
concorrentes. Conferir se a revisão continua válida e se o envio está ativo antes de despachar.

O histórico distingue pendente, aceito pelo conector, entregue quando comprovado, falha e resultado
incerto. Retentar falhas transitórias conhecidas com limite. Se um timeout ocorrer depois que o
envio pode ter sido aceito, tentar reconciliar antes de liberar um reenvio. Pausar pendências
durante a desconexão e manter **Copiar mensagem** como alternativa. Guardar segredos e material de
sessão no servidor, restringir o destino a grupos aprovados e excluir texto e segredos dos logs.
Manter o texto apenas pelo prazo útil à revisão e preservar as chaves durante a janela de
recuperação.

### Grupo existente, sem Cloud API

Gabriel prefere preservar a entrega ao grupo da equipe e avaliar conectores fora da Cloud API.
A shortlist para avaliação é **WAHA**, **WPPConnect Server** e **Evolution API com Baileys**.
São conectores não oficiais que dependem de uma sessão vinculada. A documentação permite avaliar
o suporte esperado, e o teste com pedidos fictícios precisa confirmar o comportamento da versão
escolhida. Os termos da plataforma e os riscos de desconexão e restrição da conta entram na
decisão.

| Opção                     | Avaliação                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WAHA                      | Primeiro candidato para um envio simples por HTTP. Avaliar o motor escolhido, reconexão e eventos de entrega por grupo. O relato de pendência no NOWEB é um caso de homologação. |
| WPPConnect Server         | Alternativa com painel de sessão e operação via Docker. Comparar custo de manter o Chromium e recuperação após reinícios.                                                        |
| Evolution API com Baileys | Considerar se surgir demanda por uma plataforma de mensagens compartilhada. Traz mais integrações e dependências de operação para o escopo atual.                                |
| Prévia e cópia            | Alternativa operacional para o grupo corrente durante falha de sessão. A interface registra a cópia, quando aplicável.                                                           |

A Groups API oficial foi considerada. A Meta exige uma conta comercial oficial para o número,
informa limite de oito participantes e documenta criação de um grupo novo por convite. Comprar
uma linha dedicada atende ao isolamento do piloto, mas a compra por si só não dá acesso à API nem
converte o grupo já existente. Se houver abertura para outro canal, Telegram permite automação em
grupo com seu Bot API. WhatsApp 1:1 oficial é uma alternativa de aviso individual a responsáveis
autorizados.

Se for autorizado um piloto, usar linha dedicada sob controle do Mira e grupo de teste. Em um
repositório próprio, o conector traz autonomia de operação e isolamento, mas introduz versionamento
do contrato, autenticação entre serviços e mais infraestrutura. O Mira ainda precisa conservar a
outbox junto às suas transações. Extrair quando um segundo consumidor concreto ou uma necessidade
demonstrada de operação independente justificar a mudança.

[WAHA — grupos](https://waha.devlike.pro/docs/how-to/groups/) ·
[WAHA — eventos](https://waha.devlike.pro/docs/how-to/events/) ·
[WAHA #2357](https://github.com/devlikeapro/waha/issues/2357) ·
[WPPConnect Server](https://github.com/wppconnect-team/wppconnect-server) ·
[Evolution API](https://github.com/evolution-foundation/evolution-api) ·
[Groups API da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/) ·
[Telegram Bot API](https://core.telegram.org/bots/tutorial) ·
[Termos do WhatsApp](https://www.whatsapp.com/legal/terms-of-service)

## Empadinha

Gabriel escolheu a empadinha com prancheta. A forma usa a borda ondulada, massa dourada e acessórios
em azul-marinho. A esfiha permanece na comparação original como alternativa visual estudada.
A prévia interativa redesenha a pose aprovada de forma simplificada para testar seis gestos.
Cada ação toca uma vez e tem pose estática em movimento reduzido. A revisão cobriu a pega e a
soltura da folha, a mão ao lado do tique durante a escrita e a palma do aceno em primeiro plano.
Para a arte final, preservar proporções e pivôs, testar a leitura a 32–40 px e 56–72 px e evitar
animações contínuas. O processo do Dudu serve de referência para articular partes separadamente.

- [Comparação original entre empadinha e esfiha](../design/empadinha/comparacao.png)
- [Poses da empadinha](../design/empadinha/poses.png)
- [Revisão dos seis movimentos em 24 quadros](../design/empadinha/quadros.png)
- [Prévia interativa](../design/empadinha/preview.html). No GitHub, baixe o HTML e abra no navegador.
- [Dudu no Cadernocc](https://github.com/bielrodrigues2406/enade-cs-platform/blob/main/docs/MASCOT.md)

## Fases e aceite

1. **Encomenda atômica.** Validar cliente e itens, duplo clique, reenvio da mesma requisição, falha
   com rollback, rascunhos legados, impressão, produção, pagamentos e auditoria. Conferir que a
   regressão de duas linhas de meio cento a R$ 95,01 mantém R$ 95,02 e 100 unidades.
2. **Configuração, prévia e transporte falso.** Cobrir gatilhos independentes, pedido misto, omissão
   de dia vazio, virada local em São Paulo, entrega e retirada, concluídos, complemento, correção,
   cancelamento, concorrência, reinício e timeout incerto. O aceite inclui pedido salvo durante
   indisponibilidade do conector e opção de copiar a mensagem.
3. **Piloto autorizado.** Validar WAHA e comparar a recuperação com WPPConnect se necessário. O
   aviso, o resumo e o complemento devem chegar ao grupo de teste, com confirmação verificável e
   sem duplicatas. A versão final da empadinha depende do aceite visual nas escalas da interface.

[Pedidos e pagamentos](../apps/api/test/integration/pedidos.spec.ts) ·
[Produção](../apps/api/test/integration/producao-do-dia.spec.ts) ·
[Saldo por cliente](../apps/api/test/integration/saldo-devedor.spec.ts) ·
[Acerto](../apps/api/test/integration/acerto-diario.spec.ts) ·
[Relatórios de período](../apps/api/test/integration/relatorios-de-periodo.spec.ts) ·
[Auditoria](../apps/api/test/integration/auditoria.spec.ts) ·
[Criação no Angular](../apps/web/src/app/features/pedidos/novo/novo-pedido.spec.ts) ·
[Detalhe no Angular](../apps/web/src/app/features/pedidos/detalhe/pedido-detalhe.spec.ts) ·
[Formulário de item](../apps/web/src/app/features/pedidos/detalhe/item-formulario/item-formulario.spec.ts) ·
[Impressão no Angular](../apps/web/src/app/shared/components/compartilhar/compartilhar.spec.ts)

### Decisões para revisão

- Há algum caso real que justifique rascunhos novos? Qual é a estratégia para resolver os legados e
  aposentar o estado depois?
- No resumo, entram todos os pedidos do dia ou apenas os que passam pelo filtro da regra?
- Mudar data ou hora e cancelar um pedido com assados deve sempre gerar correção, mesmo quando o
  conteúdo dos assados for igual? Qual é a janela de recuperação do resumo?
- Quem opera a conexão, reconcilia envios incertos e define o prazo de retenção? Qual critério
  concreto justificaria extrair um serviço em repositório próprio?
