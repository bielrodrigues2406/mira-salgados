#!/bin/bash
# Instala ou atualiza o Mira Salgados numa VPS Ubuntu 24.04, sem GitHub do
# lado de quem administra: baixa a pasta deploy/ do repositório público,
# pergunta o que precisa na tela e chama implantar.sh. Como root:
#   curl -fsSLo instalar.sh https://raw.githubusercontent.com/bielrodrigues2406/mira-salgados/master/deploy/servidor/instalar.sh
#   bash instalar.sh
# Para atualizar, rode de novo: o que já foi respondido vira o padrão.
set -euo pipefail
umask 077

REPOSITORIO=bielrodrigues2406/mira-salgados
RAMO="${RAMO:-master}"
DESTINO=/opt/mira-salgados
APP=/srv/apps/mira-salgados

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash $0" >&2
  exit 1
fi

# As perguntas leem do terminal mesmo quando o script chega por pipe.
perguntar() {
  local texto="$1" padrao="${2:-}" resposta
  if [ -n "$padrao" ]; then
    read -r -p "$texto [$padrao]: " resposta < /dev/tty
  else
    read -r -p "$texto: " resposta < /dev/tty
  fi
  printf '%s' "${resposta:-$padrao}"
}

# Lê CHAVE=valor de um .env já existente, para virar o padrão da pergunta.
anterior() {
  [ -f "$1" ] && sed -n "s/^$2=//p" "$1" | tail -n 1 || true
}

echo "==> Baixando a versão atual da implantação ($RAMO)"
command -v curl > /dev/null || { apt-get update -q && apt-get install -yq curl; }
temporario="$(mktemp -d)"
trap 'rm -rf "$temporario"' EXIT
curl -fsSL "https://codeload.github.com/$REPOSITORIO/tar.gz/refs/heads/$RAMO" \
  | tar -xz -C "$temporario" --strip-components=1 --wildcards '*/deploy/'
install -d -m 755 "$DESTINO"
rm -rf "$DESTINO/deploy"
mv "$temporario/deploy" "$DESTINO/deploy"

echo
dominio="$(perguntar 'Domínio do site' "$(anterior /srv/proxy/.env MIRA_SALGADOS_DOMINIO)")"
dominio="${dominio:-mirasalgados.com.br}"
email="$(perguntar 'E-mail para o certificado HTTPS (avisos de renovação)' "$(anterior /srv/proxy/.env ACME_EMAIL)")"
[ -n "$email" ] || { echo "O e-mail é obrigatório." >&2; exit 1; }
versao="$(perguntar 'Versão (latest ou os 7 primeiros caracteres do commit)' "$(anterior "$APP/.env" VERSAO)")"
versao="${versao:-latest}"
if ! [[ "$versao" =~ ^([0-9a-f]{7}|latest)$ ]]; then
  echo "Versão inválida: $versao" >&2
  exit 1
fi

variaveis=/root/.implantar.env
{
  printf 'DOMINIO=%q\n' "$dominio"
  printf 'ACME_EMAIL=%q\n' "$email"
  printf 'VERSAO=%q\n' "$versao"
} > "$variaveis"

# O administrador só é pedido na primeira instalação; depois, as contas são
# criadas pela tela Usuários e a senha esquecida se troca com criar-admin.
if [ ! -f "$APP/.catalogo-carregado" ]; then
  echo
  echo "Sua conta de administrador (você entra no site com o celular e a senha):"
  nome="$(perguntar 'Seu nome')"
  telefone="$(perguntar 'Seu celular com DDD (só números)')"
  while true; do
    read -r -s -p "Senha (mínimo de 12 caracteres): " senha < /dev/tty
    echo
    read -r -s -p "Repita a senha: " confirmacao < /dev/tty
    echo
    if [ "${#senha}" -lt 12 ]; then
      echo "A senha precisa ter pelo menos 12 caracteres."
    elif [ "$senha" != "$confirmacao" ]; then
      echo "As senhas não conferem."
    else
      break
    fi
  done
  {
    printf 'ADMIN_NOME=%q\n' "$nome"
    printf 'ADMIN_TELEFONE=%q\n' "$telefone"
    printf 'ADMIN_SENHA=%q\n' "$senha"
  } >> "$variaveis"
  unset senha confirmacao
fi

echo
# implantar.sh apaga o arquivo de variáveis assim que o lê.
bash "$DESTINO/deploy/servidor/implantar.sh" "$variaveis"
