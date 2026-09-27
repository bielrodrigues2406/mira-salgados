# ADR 0006 — Autenticação e sessão

## Decisão

**Senha.** Argon2id com 64 MiB, 3 iterações e paralelismo 1. Hashes antigos com
parâmetros mais fracos são refeitos no login seguinte (`needsRehash`). Política
por comprimento: mínimo de 12 e máximo de 128 caracteres, sem regra de
composição (NIST SP 800-63B).

**Access token.** JWT HS256 com 15 minutos de vida (configurável entre 5 e 60),
emissor e público fixos e algoritmo travado na verificação. Contém só o `sub`.
O frontend o mantém em memória, nunca em `localStorage`.

**Refresh token.** Valor aleatório de 256 bits, não JWT. O banco guarda só o
SHA-256. Vive num cookie `httpOnly`, `Secure`, `SameSite=Strict`, com path
restrito a `/api/v1/auth`. Vale 14 dias (configurável), renovados a cada uso.

**Rotação e família.** O login abre uma família. Cada renovação marca o token
atual como usado e emite o próximo da mesma família, numa transação que
bloqueia a linha do token. Se um token já usado reaparecer, a família inteira é
revogada e o evento vai para o log como alerta de segurança.

**Mensagens.** E-mail inexistente, senha errada e usuário desativado recebem a
mesma resposta (`CREDENCIAIS_INVALIDAS`), e a verificação de senha roda mesmo
sem usuário, contra um hash de referência, para que o tempo de resposta também
não revele quais e-mails existem.

**Guard global.** Toda rota exige autenticação, salvo as marcadas com
`@Public()` ou `@OptionalAuth()`. O guard anexa `request.usuario` e os services
recebem apenas o id. Autorização por papel entra como outro guard global,
lendo outro metadado, sem mudar services.

**Limite de taxa.** 300 requisições por minuto por IP no geral; 5 por minuto
em login e cadastro; 30 por minuto nas demais rotas de sessão. Armazenamento em
memória.

**Cadastro.** Por padrão, `POST /auth/registro` exige um usuário autenticado. A
variável `AUTH_PUBLIC_SIGNUP_ENABLED=true` abre o cadastro para criar as
primeiras contas; `GET /auth/configuracao` informa à tela de login se deve
mostrar a opção.

## Alternativas consideradas

- **Refresh token como JWT.** Dispensaria a consulta ao banco, mas impediria
  revogar sessões e detectar reuso.
- **Janela de tolerância no reuso.** Duas abas renovando ao mesmo tempo acionam
  a detecção e derrubam a sessão. Uma janela de alguns segundos evitaria isso,
  ao custo de enfraquecer a detecção. O frontend serializa as renovações dentro
  da aba; coordenar entre abas (BroadcastChannel) fica como evolução.
- **Consultar o usuário a cada requisição.** Derrubaria imediatamente um usuário
  desativado, mas acopla o guard ao banco. O access token curto limita a
  exposição a 15 minutos, e a desativação deverá revogar as famílias de refresh.

## Consequências

- O limite em memória não é compartilhado entre instâncias. Com mais de uma
  réplica, o armazenamento do throttler precisa ir para Redis.
- Tokens expirados se acumulam na tabela `refresh_tokens`; uma rotina de limpeza
  periódica entra junto com o índice em `expires_at`.
