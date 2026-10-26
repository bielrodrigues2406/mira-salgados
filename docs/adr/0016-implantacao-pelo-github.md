# ADR 0016 — Implantação pelo GitHub Actions

## Contexto

Quem administra o sistema não vai baixar o projeto nem manter um terminal
com acesso à VPS, e o ambiente em que o código é escrito só sai para a
internet por HTTPS, sem SSH. Alguém precisa entrar na VPS para subir a versão
nova, criar a primeira conta e carregar o catálogo.

## Decisão

- **Workflow "Implantar", só à mão.** `workflow_dispatch` no `master`, que
  copia `deploy/` por SSH e roda `deploy/servidor/implantar.sh`. Esse script é
  idempotente: prepara o servidor se for a primeira vez, sobe proxy e
  aplicação na versão pedida, cria o administrador se não houver
  (`criar-admin --se-nao-houver`), carrega o catálogo uma vez e agenda o
  backup.
- **Ambiente "producao" com aprovação.** A chave SSH dá root na VPS; ela fica
  num segredo do ambiente, que exige aprovação do dono a cada execução e só
  aceita o `master`.
- **Segredos da aplicação nascem no servidor.** Senha do banco e segredo do
  JWT são gerados lá na primeira execução e nunca passam pelo GitHub. As
  variáveis que vão (domínio, versão, token do registro, dados do
  administrador) seguem num arquivo só do root, não na linha de comando.
- **Token do registro de vida curta.** O servidor baixa as imagens com o
  `GITHUB_TOKEN` da própria execução, que vence quando ela termina; não há
  token permanente guardado na VPS.
- **Catálogo como dado, não como migration.** `carregar-catalogo` cria só o
  que falta, pelos serviços da API e com auditoria, e nunca altera o que já
  existe. Uma migration rodaria em todo banco novo, inclusive nos de teste.

## Consequências

- Atualizar a VPS fora do workflow pede um token `read:packages` à mão
  (docs/servidor.md, "Implantar à mão").
- Na primeira execução a identidade da VPS é aceita como vier; a partir da
  variável `VPS_KNOWN_HOSTS`, uma máquina diferente é recusada.
- Com uma chave autorizada, o SSH da VPS deixa de aceitar senha. O console do
  painel da hospedagem continua sendo a entrada de emergência.
