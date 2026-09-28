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

## Preparar a VPS (uma vez)

Numa VPS Ubuntu 24.04 nova, como root:

```sh
git clone https://github.com/bielrodrigues2406/mira-salgados.git /opt/mira-salgados
sudo bash /opt/mira-salgados/deploy/servidor/preparar.sh
```

O script instala o Docker do repositório oficial, liga as atualizações de
segurança automáticas, o firewall (SSH, 80, 443) e o fail2ban, cria 2 GB de
swap, limita o tamanho dos logs dos contêineres e cria a rede `proxy` e as
pastas `/srv/proxy`, `/srv/apps` e `/srv/backups`.

Depois, por segurança, entre por chave SSH e desligue o login por senha
(`PasswordAuthentication no` em `/etc/ssh/sshd_config`), confirmando antes que
a chave funciona numa segunda janela.

## Acesso às imagens

Se o repositório for privado, as imagens também são. Crie no GitHub um token
clássico só com `read:packages` e, no servidor:

```sh
echo SEU_TOKEN | docker login ghcr.io -u bielrodrigues2406 --password-stdin
```

## Proxy HTTPS

```sh
cp -r /opt/mira-salgados/deploy/proxy/. /srv/proxy/
cp /srv/proxy/.env.example /srv/proxy/.env   # ACME_EMAIL e MIRA_SALGADOS_DOMINIO
cd /srv/proxy && docker compose up -d
```

O domínio precisa apontar (registro A) para o IP da VPS antes de subir: o
Caddy pede o certificado na hora.

## Mira Salgados

```sh
mkdir -p /srv/apps/mira-salgados
cp -r /opt/mira-salgados/deploy/mira-salgados/. /srv/apps/mira-salgados/
cd /srv/apps/mira-salgados
cp .env.example .env    # senhas geradas com openssl e WEB_ORIGIN=https://seu-dominio
./atualizar.sh
docker compose run --rm api node dist/cli/criar-admin.js
```

`atualizar.sh` baixa as imagens, roda as migrations e sobe a aplicação. Para
atualizar depois de um merge no `master`, basta rodá-lo de novo. Para voltar a
uma versão anterior, coloque em `VERSAO` no `.env` os 7 primeiros caracteres
do commit e rode `./atualizar.sh`.

Backup diário às 3h (`crontab -e`):

```
0 3 * * * /srv/apps/mira-salgados/backup-postgres.sh /srv/apps/mira-salgados >> /srv/backups/backup.log 2>&1
```

Copie `/srv/backups` para fora da máquina (rclone para o Google Drive, por
exemplo) e teste uma restauração de vez em quando.

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
