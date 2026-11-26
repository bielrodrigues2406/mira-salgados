# ADR 0019 — Motor de notificações com outbox, worker isolado e conector WhatsApp

## Contexto

A equipe do Mira Salgados usa um grupo existente no WhatsApp para acompanhar
encomendas, sobretudo itens **assados** (forno). A automação precisa avisar em
tempo hábil sem bloquear o salvamento de pedidos, sem duplicar mensagens, sem
vazar dados pessoais de clientes ou valores financeiros e respeitando o orçamento
de memória da VPS pequena compartilhada (1 vCPU, 2 GB RAM, ADR 0015).

## Decisão

- **Domínio puro em `apps/api/src/notificacoes/dominio/`.** Projeção dos campos
  permitidos, cálculo de hash de revisão, avaliação de regras, formatação de
  texto e calendário em `America/Sao_Paulo` ficam em funções puras sem banco nem
  NestJS (mesmo padrão do ADR 0011).
- **Minimização estrita de dados.** Apenas `número`, `dataEntrega`,
  `horarioEntrega`, `tipoEntrega`, `produto`, `preparo` e `quantidade` (em
  unidades via `unidadesDe`) entram na projeção, no texto e na fila. Nome do
  cliente, telefone, endereço, preços, desconto, pagamentos, produtor e
  observações livres ficam de fora.
- **Formatação no padrão WhatsApp do projeto.** Usa `*negrito*` (sanitizando
  caracteres de marcação em nomes de produto), sem emojis (`local/sem-emoji`),
  com o nome exato do catálogo e rótulo neutro de preparo (`(frito)`, `(assado)`,
  `(congelado)`), somando unidades de linhas repetidas do mesmo `(produto,
preparo)` dentro do mesmo pedido.
- **Revisão notificável e debounce em edições.** `pedidos` ganha
  `notificacao_revisao` e `notificacao_hash` calculados apenas sobre os 7 campos
  permitidos (sob o `FOR UPDATE` do agregado). Alterar desconto, endereço,
  produtor, observação ou pagamentos não altera o hash nem gera correção.
  - Confirmação inicial agenda saída imediata (`disponivel_em = now()`).
  - Correções ou cancelamentos após confirmação usam espera curta configurável
    (padrão **30 segundos**) e marcam pendências anteriores do mesmo
    `(pedido, destino)` como `SUBSTITUIDO`, agrupando múltiplos ajustes de itens
    em uma única mensagem.
  - Mudanças de `dataEntrega`, `horarioEntrega`, `tipoEntrega` ou cancelamento
    sempre geram correção para pedidos elegíveis (mesmo se os itens assados não
    mudarem). A transição `CONFIRMADO -> CONCLUIDO` não gera aviso imediato.
- **Regras independentes e chave única unificada.**
  - **Aviso imediato** (padrão: filtro **Com assados**, exibindo todos os itens
    do pedido com assados destacados) e **Resumo diário** (padrão: filtro
    **Com assados**, dias escolhidos e hora em `America/Sao_Paulo`, omitindo
    dias vazios por padrão, incluindo `CONCLUIDO` sinalizados como `(concluído)`
    e janela de recuperação padrão de **120 minutos** no mesmo dia local).
  - Toda intenção de envio é gravada na tabela `outbox_notificacoes` dentro da
    mesma transação do evento de negócio.
  - Para impedir duplicatas quando aviso imediato e complemento pós-resumo
    cobrirem a mesma alteração para o mesmo grupo, a restrição única por pedido
    omite a regra: `pedido:{pedidoId}:destino:{destinoId}:rev:{revisao}` (a
    `regra_id` fica como metadado). Para resumos agendados, a chave é
    `resumo:regra:{regraId}:destino:{destinoId}:data:{AAAA-MM-DD}`.
  - A tabela `resumos_enviados_pedidos` registra quais pedidos (e revisões)
    entraram em cada resumo, permitindo gerar complementos e detectar pedidos
    movidos para dentro ou fora da data já resumida.
- **Worker separado na mesma imagem da API (`dist/worker.js`).** Roda com
  `NestFactory.createApplicationContext`, pool PostgreSQL pequeno, reivindicação
  atômica com `SELECT ... FOR UPDATE SKIP LOCKED` e reserva com expiração
  (`reservado_ate`). Confere novamente se a revisão continua atual, se a regra
  segue ativa e se o canal não está pausado antes de despachar.
- **Segurança por topologia e governança `ADMIN`.**
  - Toda configuração de destinos, regras, simulações, pausa e reconciliação é
    restrita a `@SomenteAdmin()`, auditada em `logs_auditoria` e registrada em
    `rotas-protegidas.spec.ts`.
  - O texto renderizado e segredos do conector são redigidos em `logger.config.ts`
    e nunca aparecem em logs ou snapshots de auditoria.
  - Webhooks do conector (recibos `message.ack` e eventos de sessão) entram
    apenas em listener HTTP privado do `worker` na rede interna Docker com
    assinatura HMAC-SHA-256 (`timingSafeEqual`), nunca atrás do proxy `/api/` do
    nginx, preservando a lista `PUBLICAS` da API intacta.
  - Envios que sofrem timeout após possível aceitação ficam como `INCERTO` e
    **nunca** são reenviados automaticamente; o administrador decide entre
    **Marcar entregue** ou **Reenviar** no histórico, mantendo **Copiar mensagem**
    como contingência operacional.
  - Retenção automática no worker: limpa `texto_renderizado` após **30 dias** e
    remove metadados/chaves antigas após **90 dias**.
- **Conector WhatsApp desacoplado (`ConectorWhatsApp`).**
  - A Fase 2 entrega o motor completo com `TransporteSimuladoConector` (sem
    dependência externa e totalmente testável).
  - Na Fase 3 (piloto autorizado com chip dedicado e grupo de teste), o alvo
    principal é **GoWA** (`aldinokemal/go-whatsapp-web-multidevice`, binário Go
    puro sobre `whatsmeow`, ~30–60 MB RAM, 1 container sem Chromium, OpenAPI,
    pareamento por QR ou código de 8 dígitos proxiado por `@SomenteAdmin()`, sem
    portas expostas no host e webhooks HMAC com eventos `message.ack`,
    `device.logged_out` e `device.temporary_ban`). **WAHA com motor GOWS** fica
    como alternativa trocável atrás da mesma interface.
  - O adaptador permanece neste monorepo até existir um segundo consumidor real
    na VPS que justifique extração para repositório próprio.
- **Mascote Empadinha (Fase 3).** Arte final em camadas WebP (384×512) animadas
  apenas por CSS `transform`/`opacity`, com fallback estático e respeito a
  `prefers-reduced-motion`, sem runtime de `<canvas>` procedural.

## Alternativas consideradas

- **WhatsApp Groups API oficial da Meta.** Exige conta comercial oficial (OBA),
  limita grupos a 8 participantes e não opera sobre o grupo já existente.
- **Motores baseados em Chromium (WPPConnect Server / WAHA WEBJS).** Consomem
  350–700 MB+ de RAM por sessão e competem com o PostgreSQL na VPS de 2 GB.
- **Serviço gerenciado pago (Uazapi / Z-API).** Elimina container local, mas
  adiciona mensalidade maior que a própria VPS mantendo o mesmo risco de
  protocolo de sessão vinculada.
- **Webhook público montado na `api` atrás do nginx.** Amplia a superfície
  pública, exige exceção em `rotas-protegidas.spec.ts` e disputa o
  `ThrottlerGuard`.
- **Telegram Bot API como fallback.** Descartado por requisito de produto: a
  operação da equipe acontece exclusivamente no WhatsApp.

## Consequências

- A API ganha variáveis de ambiente opcionais para o conector (validadas em
  `env.schema.ts`), mantendo o sistema totalmente funcional com notificações
  desligadas ou em modo simulado.
- A tela `/alteracoes` (`descrever.ts`) e `auditoria/referencias.ts` precisam
  reconhecer as novas entidades de automação e ter fallback defensivo para ações
  desconhecidas.
- Na Fase 3, o nginx deve incluir `.webp` na regra de cache imutável e o
  `docker-compose.yml` de produção manterá o GoWA atrás de `profiles` com volume
  de sessão fora do backup do PostgreSQL.
