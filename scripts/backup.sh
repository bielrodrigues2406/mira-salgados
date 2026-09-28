#!/bin/sh
# Cópia de segurança do banco: um arquivo .sql.gz por execução em ./backups,
# mantendo os últimos 30 dias. Agende no cron da máquina, por exemplo às 3h:
#   0 3 * * * cd /caminho/mira-salgados && ./scripts/backup.sh >> backups/backup.log 2>&1
# Restaurar (apaga os dados atuais do banco):
#   gunzip -c backups/<arquivo>.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
set -eu

cd "$(dirname "$0")/.."
mkdir -p backups
arquivo="backups/mira-$(date +%Y-%m-%d-%H%M).sql.gz"

docker compose exec -T db sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$arquivo.tmp"
mv "$arquivo.tmp" "$arquivo"
find backups -name 'mira-*.sql.gz' -mtime +30 -delete

echo "$(date '+%Y-%m-%d %H:%M') backup gravado em $arquivo"
