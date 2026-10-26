#!/bin/bash
# Prepara um Ubuntu 24.04 novo para hospedar várias aplicações em Docker,
# atrás de um proxy HTTPS compartilhado. Rode uma vez, como root:
#   sudo bash deploy/servidor/preparar.sh
# Pode ser rodado de novo sem estragar nada.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Atualizações do sistema e de segurança automáticas"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker Engine e Compose (repositório oficial)"
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Logs de contêiner com teto: sem isso, um app falante enche o disco em semanas.
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker

echo "==> Firewall: só SSH, HTTP e HTTPS"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Portas publicadas pelo Docker passam por fora do ufw. Por isso nenhum
# compose das aplicações publica porta: só o proxy abre 80 e 443.

echo "==> fail2ban para tentativas de SSH"
systemctl enable --now fail2ban

# Com uma chave autorizada, senha deixa de entrar por SSH: o workflow e quem
# administra usam chave, e o console do painel da VPS continua funcionando.
if [ -s /root/.ssh/authorized_keys ]; then
  echo "==> SSH só com chave"
  cat > /etc/ssh/sshd_config.d/10-somente-chave.conf << 'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
  sshd -t && (systemctl reload ssh || systemctl restart ssh)
fi

echo "==> Swap de 2 GB (folga para picos de memória)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Rede compartilhada entre o proxy e as aplicações"
docker network inspect proxy > /dev/null 2>&1 || docker network create proxy

echo "==> Pastas: /srv/proxy, /srv/apps e /srv/backups"
mkdir -p /srv/proxy/sites /srv/apps /srv/backups
chmod 700 /srv/backups

echo
echo "Pronto. Próximos passos em docs/servidor.md:"
echo "  1. copiar deploy/proxy para /srv/proxy e subir o proxy;"
echo "  2. copiar deploy/mira-salgados para /srv/apps/mira-salgados e subir a aplicação."
