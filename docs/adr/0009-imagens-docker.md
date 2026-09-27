# ADR 0009 — Imagens Docker e pilha completa

## Decisão

- **Build multiestágio a partir da raiz.** Cada imagem instala só o workspace de
  que precisa (`npm ci --workspace`). A da API leva apenas dependências de
  produção e o `dist`; a da web leva só os arquivos estáticos, servidos pelo
  nginx.
- **Sem root.** A API roda com o usuário `node` da imagem oficial.
- **Migração como serviço.** O serviço `migrate` aplica as migrations pendentes
  e termina; a API só sobe depois que ele conclui com sucesso. Nada de
  `migrationsRun` na inicialização da aplicação, que poderia rodar em paralelo
  com várias réplicas.
- **Mesma origem.** O nginx serve a aplicação e encaminha `/api` para a API. O
  cookie de sessão funciona sem CORS com credenciais, e a API recebe o IP real
  por `X-Forwarded-For` (`TRUST_PROXY=1`), usado pela limitação de taxa.
- **CSP sem `unsafe-inline`.** O nginx gera um nonce por requisição
  (`$request_id`) e o injeta no atributo `ngCspNonce` do `index.html`; o Angular
  o aplica aos estilos que injeta em tempo de execução. O CSS crítico embutido
  do build de produção fica desligado, porque carrega a folha de estilos por um
  atributo `onload`, que a CSP bloquearia.
- **Cache.** Arquivos com hash no nome ficam um ano em cache; o `index.html`
  nunca vai para cache.
- **Sem scripts de instalação nas imagens** (`--ignore-scripts`): argon2 e
  esbuild trazem binários prontos, e o `prepare` da raiz depende do husky.
- **CA extra opcional.** Atrás de proxy com inspeção TLS, a CA do proxy entra
  como secret do BuildKit só durante o `npm ci`
  (`docker build --secret id=npm_ca,src=<ca.pem>`), sem desligar a verificação
  de certificados.

## Consequências

- TLS termina num proxy à frente do nginx (Caddy, Traefik, balanceador). Sem
  HTTPS o navegador só aceita o cookie `Secure` em `localhost`.
- Senhas do banco devem usar apenas letras e números, porque entram na URL de
  conexão montada pelo Compose.
