# ADR 0015 — Servidor para várias aplicações

## Contexto

O Mira Salgados vai para uma VPS pequena (Hostinger KVM 1 ou 2), que também
pode receber outras aplicações. Compilar o Angular no servidor pede mais
memória do que a aplicação usa rodando, e cada aplicação com o seu próprio
proxy disputaria as portas 80 e 443.

## Decisão

- **Imagens publicadas pelo CI.** Depois do CI verde no `master`, o workflow
  `publicar.yml` publica API e web no GitHub Container Registry, com as tags
  `latest` e a do commit. O servidor só baixa; voltar de versão é trocar
  `VERSAO` no `.env`.
- **Um proxy compartilhado.** Um Caddy em `/srv/proxy` é o único contêiner
  com portas abertas e emite os certificados. Cada aplicação tem um arquivo em
  `sites/`.
- **Aplicações isoladas.** Cada uma em `/srv/apps/<nome>`, com compose, banco
  e volume próprios, sem portas publicadas; só o serviço HTTP entra na rede
  `proxy`, com um nome único. Cada serviço tem limite de memória.
- **Servidor preparado por script.** `deploy/servidor/preparar.sh` instala o
  Docker oficial, firewall (SSH, 80, 443), fail2ban, atualizações de
  segurança automáticas, swap e teto de logs.
- **Backup por aplicação.** `backup-postgres.sh <pasta>` grava um dump
  comprimido por dia em `/srv/backups/<nome>`, só legível pelo dono.

## Consequências

- Portas publicadas pelo Docker passam por fora do ufw; por isso a regra é
  nenhuma aplicação publicar porta.
- Com o repositório privado, o servidor precisa de um token `read:packages`
  para baixar as imagens.
- O `docker-compose.yml` da raiz continua servindo para desenvolvimento e para
  quem quer subir só esta aplicação compilando na máquina.
