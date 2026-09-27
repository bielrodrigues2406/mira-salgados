#!/bin/sh
# Cria o banco usado pelos testes de integração, isolado do banco de desenvolvimento.
# Executado pela imagem oficial do PostgreSQL apenas na primeira inicialização do volume.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  SELECT 'CREATE DATABASE "${POSTGRES_TEST_DB}" OWNER "${POSTGRES_USER}"'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_TEST_DB}')\gexec
SQL
