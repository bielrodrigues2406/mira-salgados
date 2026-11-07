#!/bin/bash
# Implanta ou atualiza o Mira Salgados no servidor. Chamado por instalar.sh
# (na própria VPS) ou pelo workflow "Implantar" (.github/workflows/implantar.yml),
# que deixam a pasta deploy/ em /opt/mira-salgados/deploy e mandam as variáveis
# num arquivo só do root:
#   bash /opt/mira-salgados/deploy/servidor/implantar.sh /root/.implantar.env
# Pode rodar quantas vezes precisar: cada passo só faz o que falta.
#
# Variáveis: DOMINIO, ACME_EMAIL, VERSAO; GHCR_USUARIO e GHCR_TOKEN só se as
# imagens forem privadas; e, para criar o administrador na primeira vez,
# ADMIN_NOME, ADMIN_TELEFONE e ADMIN_SENHA.
set -euo pipefail
umask 077

variaveis="${1:?informe o arquivo de variáveis}"
set -a
# shellcheck disable=SC1090
. "$variaveis"
set +a
rm -f "$variaveis"

: "${DOMINIO:?}" "${ACME_EMAIL:?}" "${VERSAO:?}"

origem="$(cd "$(dirname "$0")/.." && pwd)"
proxy=/srv/proxy
app=/srv/apps/mira-salgados

# Troca ou acrescenta CHAVE=valor num .env, sem mexer nas outras linhas.
definir() {
  local arquivo="$1" chave="$2" valor="$3"
  touch "$arquivo"
  grep -v "^${chave}=" "$arquivo" > "$arquivo.tmp" || true
  printf '%s=%s\n' "$chave" "$valor" >> "$arquivo.tmp"
  mv "$arquivo.tmp" "$arquivo"
}

# Segredo gerado aqui, uma vez: nunca sai do servidor.
gerar_se_faltar() {
  grep -q "^$2=." "$1" 2> /dev/null || definir "$1" "$2" "$3"
}

segredo() {
  openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-"$1"
}

if ! command -v docker > /dev/null || [ ! -d /srv/proxy ]; then
  bash "$origem/servidor/preparar.sh"
fi

# Imagens públicas não pedem login. Com token (imagens privadas, workflow),
# entra e sai no fim: o token do workflow vence quando ele termina.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> Acesso às imagens"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USUARIO:?}" --password-stdin > /dev/null
  trap 'docker logout ghcr.io > /dev/null 2>&1 || true' EXIT
fi

echo "==> Proxy HTTPS em $proxy"
install -d -m 755 "$proxy" "$proxy/sites"
install -m 644 "$origem/proxy/docker-compose.yml" "$origem/proxy/Caddyfile" "$proxy/"
install -m 644 "$origem/proxy/sites/"*.caddy "$proxy/sites/"
definir "$proxy/.env" ACME_EMAIL "$ACME_EMAIL"
definir "$proxy/.env" MIRA_SALGADOS_DOMINIO "$DOMINIO"
docker compose --project-directory "$proxy" up -d
# Recarrega sites que mudaram. Um Caddy recém-criado leva alguns segundos para
# aceitar o comando; uma configuração inválida falha nas três tentativas e
# para a implantação com o erro, sem derrubar a configuração que está no ar.
for tentativa in 1 2 3; do
  if docker compose --project-directory "$proxy" exec -T caddy \
    caddy reload --config /etc/caddy/Caddyfile > /dev/null 2>&1; then
    break
  fi
  if [ "$tentativa" -eq 3 ]; then
    docker compose --project-directory "$proxy" exec -T caddy \
      caddy reload --config /etc/caddy/Caddyfile
  fi
  sleep 5
done

echo "==> Mira Salgados em $app, versão $VERSAO"
install -d -m 700 "$app"
install -m 644 "$origem/mira-salgados/docker-compose.yml" "$origem/mira-salgados/catalogo-inicial.json" "$app/"
install -m 755 "$origem/mira-salgados/atualizar.sh" "$origem/mira-salgados/backup-postgres.sh" "$app/"
gerar_se_faltar "$app/.env" POSTGRES_PASSWORD "$(segredo 40)"
gerar_se_faltar "$app/.env" JWT_ACCESS_SECRET "$(segredo 64)"
gerar_se_faltar "$app/.env" LOG_LEVEL info
definir "$app/.env" WEB_ORIGIN "https://$DOMINIO"
definir "$app/.env" VERSAO "$VERSAO"
"$app/atualizar.sh"

echo "==> Administrador"
if [ -n "${ADMIN_SENHA:-}" ]; then
  docker compose --project-directory "$app" run --rm --no-deps -T \
    -e ADMIN_NOME -e ADMIN_TELEFONE -e ADMIN_SENHA \
    api node dist/cli/criar-admin.js --se-nao-houver
else
  echo "Sem ADMIN_SENHA: nenhuma conta criada."
fi

echo "==> Catálogo inicial"
if [ -f "$app/.catalogo-carregado" ]; then
  # Uma vez só: depois, produtos e preços mudam pela tela, e um produto
  # renomeado não pode voltar com o nome antigo.
  echo "Já carregado em $(cat "$app/.catalogo-carregado")."
else
  docker compose --project-directory "$app" run --rm --no-deps -T \
    -v "$app/catalogo-inicial.json:/catalogo.json:ro" \
    api node dist/cli/carregar-catalogo.js /catalogo.json
  date '+%Y-%m-%d %H:%M' > "$app/.catalogo-carregado"
fi

echo "==> Backup diário às 3h"
install -d -m 700 /srv/backups
cat > /etc/cron.d/mira-salgados-backup << CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 3 * * * root $app/backup-postgres.sh $app >> /srv/backups/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/mira-salgados-backup

echo "==> Conferindo https://$DOMINIO"
for _ in $(seq 1 24); do
  if curl -fsS --max-time 5 --resolve "$DOMINIO:443:127.0.0.1" \
    "https://$DOMINIO/api/v1/health" > /dev/null 2>&1; then
    echo "No ar: https://$DOMINIO (versão $VERSAO)."
    exit 0
  fi
  sleep 5
done

echo "O site não respondeu por HTTPS em 2 minutos. Situação:" >&2
docker compose --project-directory "$app" ps >&2
echo "--- DNS de $DOMINIO (precisa ser o IP desta VPS):" >&2
getent ahostsv4 "$DOMINIO" | awk '{print $1}' | sort -u >&2 || echo "não resolve" >&2
echo "--- Últimas linhas do proxy:" >&2
docker compose --project-directory "$proxy" logs --tail 20 caddy >&2
exit 1
