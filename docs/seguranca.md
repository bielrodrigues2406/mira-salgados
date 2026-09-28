# Segurança

O que o sistema garante, onde isso é verificado e o que conferir antes de
cada publicação.

## Verificado automaticamente (CI)

| Garantia                                                                                                                                                       | Teste                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Toda rota exige token, exceto `GET /health` e `POST /auth/login`, `/refresh` e `/logout`; uma rota nova marcada como pública falha o teste até entrar na lista | `test/integration/rotas-protegidas.spec.ts`     |
| Token ausente, inválido ou sem assinatura dá 401 em todas as rotas protegidas                                                                                  | idem                                            |
| Contas e histórico (`/usuarios`, `/auditoria`) só para administradores: membro recebe 403 em cada rota                                                         | idem                                            |
| Com senha provisória, só `PATCH /auth/senha` responde; as outras dão 403                                                                                       | idem                                            |
| Conta desativada perde o acesso na hora, mesmo com token válido                                                                                                | idem                                            |
| Cabeçalhos de segurança (CSP, HSTS, nosniff, frame) e sem `X-Powered-By`                                                                                       | idem                                            |
| CORS só para as origens configuradas; corpo acima de 100 KB dá 413                                                                                             | idem                                            |
| Login: resposta igual para telefone inexistente e senha errada; 5 tentativas por minuto por IP; 10 falhas em 15 minutos por telefone                           | `test/integration/auth.spec.ts`                 |
| Refresh token rotativo, com detecção de reuso que revoga a família inteira; cookie `HttpOnly`, `Secure`, `SameSite=Strict`, restrito a `/api/v1/auth`          | idem                                            |
| Sem cadastro público (`/auth/registro` não existe)                                                                                                             | idem                                            |
| Nenhuma resposta e nenhum registro de auditoria carrega hash de senha                                                                                          | `auth.spec.ts`, `auditoria.spec.ts`             |
| Regras de conta: ninguém se desativa ou se rebaixa; sempre um administrador ativo                                                                              | `test/integration/usuarios.spec.ts`             |
| Configuração de produção: origem https, cookie `Secure`, segredo JWT gerado                                                                                    | `src/config/env.schema.spec.ts`                 |
| Planilhas exportadas neutralizam fórmulas (`=`, `+`, `-`, `@`)                                                                                                 | `apps/web/src/app/shared/utils/arquivo.spec.ts` |

## Decisões que sustentam isso

- **Guard global com autenticação por padrão.** Rotas são protegidas a menos
  que declarem `@Public()`; permissões extras são metadados
  (`@SomenteAdmin()`, `@PermiteSenhaProvisoria()`) verificados num único
  ponto. A conta é relida do banco a cada requisição.
- **Senhas com argon2id**, mínimo de 12 caracteres (NIST SP 800-63B), sem
  regras de composição; tokens de refresh guardados só como hash.
- **JWT com algoritmo fixo (HS256)**, emissor e audiência verificados, 15
  minutos de validade, só em memória no navegador.
- **SQL sempre parametrizado.** Consultas manuais usam `$1`, `$2`; nenhum
  valor da requisição entra no texto do SQL.
- **Validação estrita.** DTOs com `whitelist` e `forbidNonWhitelisted`:
  propriedade não declarada é recusada com 400.
- **Segredos só por variável de ambiente.** `.env` fica fora do git; a API não
  sobe sem `JWT_ACCESS_SECRET` e não tem valor padrão para ele. Logs e
  mensagens de erro de configuração nunca mostram valores.
- **Frontend sem `innerHTML`** e com CSP sem `unsafe-inline` (nonce por
  requisição no nginx); links externos com `rel="noopener noreferrer"`.
- **Contêineres sem root**, banco publicado só em `127.0.0.1`.

## Antes de cada publicação

- [ ] CI verde (inclui `npm audit` limpo nas dependências de produção).
- [ ] `.env` do servidor conferido: `NODE_ENV=production` (já no compose),
      `WEB_ORIGIN` em https, `TRUST_PROXY` igual ao número de proxies à frente
      da API (2 com Caddy ou túnel), segredos gerados com `openssl`.
- [ ] Nenhum arquivo `.env`, chave ou backup no git (`git status` limpo).
- [ ] Backup do banco feito antes de atualizar.

## Limites conhecidos

- O limite por telefone fica em memória: reiniciar a API zera a contagem, e
  com mais de uma instância cada uma conta à parte.
- Membros veem todos os relatórios financeiros da família, incluindo o painel
  com a semana da família. É intencional: o acerto é aberto entre quem
  produz.
- Não há autenticação em dois fatores; a proteção é senha longa, limites de
  tentativa e sessão revogável pelo administrador.
