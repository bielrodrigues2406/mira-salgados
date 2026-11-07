# Servidor para várias aplicações

Um servidor Linux com Docker hospeda o Mira Salgados e, depois, outras
aplicações, cada uma isolada, atrás de um único proxy HTTPS. O guia
[producao.md](producao.md) continua valendo para quem quer subir só esta
aplicação com o `docker-compose.yml` da raiz; este é o caminho recomendado
para uma VPS.

## Como fica

```
internet ──> Caddy (80/443, HTTPS automático)      /srv/proxy
               │  rede "proxy"
               ├─> mira-salgados-web ─> api ─> db   /srv/apps/mira-salgados
               └─> outra-app ─> db                  /srv/apps/outra-app
```

- **Só o Caddy abre portas.** Nenhuma aplicação publica porta; o firewall
  libera apenas SSH, 80 e 443.
- **Cada aplicação no seu compose**, com banco próprio numa rede interna. Só o
  serviço HTTP de cada uma entra na rede `proxy`, com um nome único.
- **Limite de memória em cada serviço**, para uma aplicação não derrubar as
  outras. O Mira Salgados usa cerca de 110 MB parado.
- **O servidor não compila nada.** Depois do CI verde no `master`, o workflow
  `publicar.yml` monta as imagens e publica no GitHub Container Registry
  (`ghcr.io/bielrodrigues2406/mira-salgados-api` e `-web`), com a tag
  `latest` e a do commit. O servidor só baixa.

## Instalar pela própria VPS (o mais simples)

Com o repositório e as imagens públicos, basta entrar na VPS por SSH, como
root, e rodar:

```sh
curl -fsSLo instalar.sh https://raw.githubusercontent.com/bielrodrigues2406/mira-salgados/master/deploy/servidor/instalar.sh
bash instalar.sh
```

O `instalar.sh` baixa a pasta `deploy/` do `master`, pergunta na tela o
domínio, o e-mail do certificado, a versão (`latest` por padrão) e, só na
primeira vez, o nome, o celular e a senha do administrador (a senha não
aparece nem fica em arquivo depois da implantação). Em seguida chama
`implantar.sh`, que faz o mesmo que o workflow abaixo: prepara o servidor,
sobe proxy e aplicação, cria o administrador, carrega o catálogo, agenda o
backup e confere o HTTPS.

Para atualizar depois de um merge no `master`, rode `bash instalar.sh` de
novo: as respostas anteriores viram o padrão e o administrador não é pedido
outra vez. Para voltar a uma versão anterior, responda com os 7 primeiros
caracteres do commit.

Se a VPS ainda não tem chave SSH autorizada, o login por senha continua
valendo (com firewall e fail2ban); ao autorizar uma chave e rodar de novo, o
SSH passa a aceitar só chave.

## Implantar pelo GitHub

O workflow **Implantar** (`.github/workflows/implantar.yml`) faz tudo pela
internet, sem baixar o projeto: entra na VPS por SSH, prepara o servidor na
primeira vez (Docker, firewall, fail2ban, swap, SSH só com chave), sobe o
proxy HTTPS e a versão escolhida, gera as senhas do banco e do JWT no próprio
servidor, cria o administrador, carrega o catálogo inicial
(`deploy/mira-salgados/catalogo-inicial.json`, uma vez só), agenda o backup
diário e confere se o site responde por HTTPS. Rodar de novo atualiza a
versão; cada passo só faz o que falta.

### Uma vez, antes da primeira implantação

1. **VPS** com Ubuntu 24.04. No PowerShell do Windows, gere a chave que o
   GitHub usa para entrar:

   ```powershell
   ssh-keygen -t ed25519 -C mira-deploy -f mira-deploy
   ```

   Saem dois arquivos. Cole o conteúdo de `mira-deploy.pub` (a chave pública)
   no painel da VPS, na criação ou em "Chaves SSH". O `mira-deploy` (sem
   extensão) é a chave privada: vai só para o segredo do GitHub, abaixo.

2. **Domínio** com registro A apontando para o IP da VPS (`nslookup` mostra
   quando já responde).
3. **Ambiente "producao" no GitHub:** Settings, Environments, New environment,
   nome `producao`. Marque _Required reviewers_ com a sua conta e, em
   _Deployment branches_, só `master`. Quem dispara este workflow tem, na
   prática, root na VPS: a aprovação garante que nada vai para o servidor sem
   você ver. No mesmo ambiente:

   | Tipo     | Nome             | Valor                                     |
   | -------- | ---------------- | ----------------------------------------- |
   | Variável | `VPS_HOST`       | IP da VPS                                 |
   | Variável | `DOMINIO`        | `mirasalgados.com.br`, sem `https://`     |
   | Variável | `ACME_EMAIL`     | e-mail que recebe avisos do Let's Encrypt |
   | Segredo  | `VPS_SSH_KEY`    | conteúdo inteiro do arquivo `mira-deploy` |
   | Segredo  | `ADMIN_NOME`     | seu nome                                  |
   | Segredo  | `ADMIN_TELEFONE` | seu celular com DDD, só números           |
   | Segredo  | `ADMIN_SENHA`    | sua senha, 12 caracteres ou mais          |

   Os três `ADMIN_` só servem para a primeira implantação: a conta não é
   recriada nem alterada depois, e os segredos podem ser apagados.

### Implantar ou atualizar

Actions, **Implantar**, _Run workflow_ no `master`. Vazio, implanta o último
commit do `master` (as imagens dele precisam ter sido publicadas pelo
_Publicar imagens_, alguns minutos depois do merge). Para voltar a uma versão
anterior, informe os 7 primeiros caracteres do commit. Aprove a execução
quando o GitHub pedir.

Na primeira execução, o workflow mostra um aviso com a identidade da VPS
(`VPS_KNOWN_HOSTS`). Guarde a linha como variável do ambiente: daí em diante
ele recusa conectar se a máquina do outro lado não for a mesma.

## Implantar à mão

O mesmo resultado, passo a passo, entrando na VPS por SSH. Deixe a pasta
`deploy/` em `/opt/mira-salgados/deploy` (com `git clone` ou `scp -r`).

```sh
sudo bash /opt/mira-salgados/deploy/servidor/preparar.sh
```

O script instala o Docker do repositório oficial, liga as atualizações de
segurança automáticas, o firewall (SSH, 80, 443) e o fail2ban, deixa o SSH só
com chave (quando já há uma autorizada), cria 2 GB de swap, limita o tamanho
dos logs dos contêineres e cria a rede `proxy` e as pastas `/srv/proxy`,
`/srv/apps` e `/srv/backups`.

### Acesso às imagens

Só se as imagens forem privadas: crie no GitHub um token clássico só com
`read:packages` e, no servidor:

```sh
echo SEU_TOKEN | docker login ghcr.io -u bielrodrigues2406 --password-stdin
```

### Proxy HTTPS

```sh
cp -r /opt/mira-salgados/deploy/proxy/. /srv/proxy/
cp /srv/proxy/.env.example /srv/proxy/.env   # ACME_EMAIL e MIRA_SALGADOS_DOMINIO
cd /srv/proxy && docker compose up -d
```

O domínio precisa apontar (registro A) para o IP da VPS antes de subir: o
Caddy pede o certificado na hora.

### Mira Salgados

```sh
mkdir -p /srv/apps/mira-salgados
cp -r /opt/mira-salgados/deploy/mira-salgados/. /srv/apps/mira-salgados/
cd /srv/apps/mira-salgados
cp .env.example .env    # senhas geradas com openssl e WEB_ORIGIN=https://seu-dominio
./atualizar.sh
docker compose run --rm api node dist/cli/criar-admin.js
docker compose run --rm -v ./catalogo-inicial.json:/catalogo.json:ro \
  api node dist/cli/carregar-catalogo.js /catalogo.json
```

`atualizar.sh` baixa as imagens, roda as migrations e sobe a aplicação. Para
atualizar depois de um merge no `master`, basta rodá-lo de novo. Para voltar a
uma versão anterior, coloque em `VERSAO` no `.env` os 7 primeiros caracteres
do commit e rode `./atualizar.sh`.

A carga do catálogo cria só o que falta e nunca altera preço ou produto que já
existe. Rode uma vez: um produto renomeado pela tela voltaria com o nome
antigo numa segunda carga.

### Backup

O workflow agenda o backup diário às 3h em `/etc/cron.d/mira-salgados-backup`.
À mão (`crontab -e`):

```
0 3 * * * /srv/apps/mira-salgados/backup-postgres.sh /srv/apps/mira-salgados >> /srv/backups/backup.log 2>&1
```

Copie `/srv/backups` para fora da máquina (rclone para o Google Drive, por
exemplo) e teste uma restauração de vez em quando. O comando de restauração
está no começo de `backup-postgres.sh`.

## Colocar outra aplicação

1. Copie `deploy/modelo-de-aplicacao` para `/srv/apps/<nome>` e ajuste o
   compose: nome do projeto, imagens, alias único na rede `proxy`, limites de
   memória.
2. Copie `site.caddy` para `/srv/proxy/sites/<nome>.caddy` com o domínio e a
   porta interna da aplicação, e recarregue o proxy:
   `docker compose -f /srv/proxy/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile`.
3. Suba a aplicação e agende o backup do banco dela com a mesma linha de cron.

Cada aplicação tem banco, senha e volume próprios: nada é compartilhado
além do proxy.

## App para celular (Ionic/Capacitor)

O servidor não precisa de nada novo para um app que empacota este mesmo
sistema. O que muda depende de como o app é feito:

- **App que abre o site** (Capacitor com `server.url` apontando para o
  domínio): funciona como hoje. Mesma origem, mesmo cookie de sessão, mesmas
  atualizações sem publicar versão nova na loja.
- **App com os arquivos dentro do pacote** (funciona melhor com internet
  ruim na abertura): a tela passa a rodar em `capacitor://localhost` (iOS) ou
  `https://localhost` (Android), outra origem. Aí a API precisa aceitar essas
  origens no CORS e entregar o refresh token por outro caminho, porque o
  cookie `SameSite=Strict` não acompanha pedidos de outra origem; no
  aparelho, o token fica no armazenamento seguro do sistema. É uma mudança
  pequena na API, feita junto com o app.
- **Notificações push** (aviso de pedido novo, lembrete da produção de
  amanhã): exigem um serviço a mais, o Firebase Cloud Messaging (gratuito),
  e uma rota na API para registrar o aparelho.

Publicar nas lojas custa US$ 25 uma vez (Google Play) e US$ 99 por ano (App
Store). Antes disso, dá para instalar o site na tela inicial do celular como
atalho, sem loja e sem custo.
