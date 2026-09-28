# Colocar em produção

> Numa VPS, prefira o caminho de [servidor.md](servidor.md): imagens prontas do
> GitHub, proxy HTTPS compartilhado e espaço para outras aplicações. Este guia
> continua valendo para subir só o Mira Salgados, compilando na própria máquina.

Guia para subir o Mira Salgados num servidor de verdade, com HTTPS, conta de
administrador e cópias de segurança.

## Onde hospedar

A pilha é o `docker-compose.yml` (banco, API e web). Qualquer máquina Linux
com Docker serve; o que muda é quem cuida de ficar no ar.

|                   | Em casa                                                              | VPS barata                                 |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Custo             | Energia e internet que já existem                                    | Cerca de R$ 25 a 40 por mês (1 vCPU, 2 GB) |
| Fica no ar quando | A máquina, a luz e a internet de casa estão ok                       | Sempre; o provedor cuida de energia e rede |
| HTTPS             | Cloudflare Tunnel, sem abrir portas no roteador (funciona com CGNAT) | Caddy, com certificado automático          |
| Risco principal   | Queda de luz ou internet tira o sistema do ar para todos             | Esquecer de renovar o pagamento            |

Nos dois casos o domínio custa cerca de R$ 40 por ano (`.com.br`, no
Registro.br) e o backup precisa sair da máquina (veja abaixo).

**Recomendação:** VPS pequena. A família depende do sistema todo dia para
anotar pedidos e fechar o acerto, e uma queda de luz em casa no dia de uma
encomenda grande custa mais que a mensalidade. Hospedar em casa funciona bem
se a máquina tiver nobreak, ficar ligada o tempo todo e a internet for
estável; nesse caso, use o Cloudflare Tunnel.

Com 1 GB de memória, o build da aplicação web pode faltar memória: prefira
2 GB ou crie 2 GB de swap antes do primeiro `--build`.

## Passo a passo

1. **Servidor com Docker.** Ubuntu 24.04 ou Debian 12, com Docker Engine e o
   plugin Compose. Libere no firewall só SSH e, com Caddy, as portas 80 e 443.
2. **Domínio.** Com Caddy, aponte um registro A do domínio para o IP do
   servidor. Com Cloudflare Tunnel, coloque o domínio na Cloudflare, crie o
   túnel em _Zero Trust > Networks > Tunnels_ e publique o domínio apontando
   para `http://web:80`. Em _SSL/TLS > Edge Certificates_, ligue _Always Use
   HTTPS_.
3. **Código e configuração.**

   ```sh
   git clone https://github.com/bielrodrigues2406/mira-salgados.git
   cd mira-salgados
   cp .env.example .env
   openssl rand -hex 24      # use em POSTGRES_PASSWORD
   openssl rand -base64 48   # use em JWT_ACCESS_SECRET
   ```

   No `.env`, preencha `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
   `WEB_ORIGIN=https://seu-dominio` e `TRUST_PROXY=2`, mais `DOMINIO` (Caddy)
   ou `CLOUDFLARE_TUNNEL_TOKEN` (túnel). O arquivo `.env` nunca vai para o
   git. A API recusa subir em produção com origem sem https, cookie sem
   `Secure` ou segredo fraco.

4. **Subir.**

   ```sh
   # VPS ou portas liberadas em casa:
   docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
   # Em casa, pelo túnel:
   docker compose -f docker-compose.yml -f docker-compose.tunel.yml up -d --build
   ```

   O serviço `migrate` aplica as migrations antes de a API subir.

5. **Conta de administrador mestre.**

   ```sh
   docker compose run --rm api node dist/cli/criar-admin.js
   ```

   Informe nome, celular e uma senha forte (12 caracteres ou mais; a senha não
   aparece na tela). Entre pelo site e crie as outras contas em _Usuários_:
   o sistema gera uma senha provisória e o botão _Enviar pelo WhatsApp_ manda o
   acesso para a pessoa, que cria a própria senha no primeiro acesso. Ligue
   cada conta de quem produz ao produtor correspondente em _Produz como_.

6. **Esqueceu a senha do administrador?** No servidor:
   `docker compose run --rm api node dist/cli/criar-admin.js --redefinir`.

## Cópias de segurança

```sh
./scripts/backup.sh
```

Grava `backups/mira-AAAA-MM-DD-HHMM.sql.gz` e apaga os com mais de 30 dias.
Agende no cron (`crontab -e`):

```
0 3 * * * cd /caminho/mira-salgados && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Um backup só na mesma máquina não protege de disco queimado ou servidor
perdido: copie a pasta `backups/` para fora, por exemplo com
[rclone](https://rclone.org) para o Google Drive, no mesmo cron. Teste a
restauração de vez em quando (o comando está no início do script).

## Atualizar

```sh
git pull
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Use o mesmo arquivo extra (`https` ou `tunel`) da instalação. As migrations
novas rodam sozinhas antes da API.

## Antes de abrir para a família

- [ ] `.env` com senhas geradas, `WEB_ORIGIN` em https e `TRUST_PROXY=2`.
- [ ] O site abre com cadeado e `http://` redireciona para `https://`.
- [ ] Administrador criado; login e troca de senha testados no celular.
- [ ] Backup agendado, copiado para fora da máquina, e uma restauração testada.
- [ ] Porta do banco (5432) não aparece para a internet (`127.0.0.1` no compose).

## E sem internet?

O sistema é um site: os pedidos ficam no servidor, que é o que permite todo
mundo ver a mesma produção e o mesmo acerto em qualquer celular. Sem internet
no aparelho, ele não abre. Funcionar offline de verdade exigiria guardar os
dados no celular e sincronizar depois, resolvendo conflitos quando duas
pessoas mudam o mesmo pedido sem conexão; é um projeto grande e arriscado
para o dinheiro do acerto. Na prática, a internet do celular basta, e o que
dá para fazer sem mudar a arquitetura é instalar o site na tela inicial
(atalho, como um aplicativo) e manter a última tela aberta visível em quedas
curtas.
