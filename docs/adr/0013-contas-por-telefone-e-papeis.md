# ADR 0013 — Contas por telefone, papéis e administrador mestre

## Contexto

Quem usa o sistema é a família e poucas pessoas próximas, todas pelo celular.
E-mail era um dado a mais que ninguém usava, e o cadastro público, mesmo
desligado por variável, era uma porta que só precisava ficar aberta uma vez.
Algumas telas (contas de acesso, histórico de alterações) mostram dados de
todo mundo e não fazem sentido para todos.

## Decisão

- **Login pelo celular.** O telefone com DDD, só dígitos (10 ou 11), é o
  identificador único da conta. A tela aceita máscara; a API guarda e compara
  só os dígitos. A coluna de e-mail foi removida.
- **Sem cadastro público.** `POST /auth/registro` e a variável
  `AUTH_PUBLIC_SIGNUP_ENABLED` deixaram de existir. O primeiro administrador
  nasce pela linha de comando, dentro do servidor:
  `npm run usuarios:criar-admin -w @mira/api` (ou, na pilha Docker,
  `docker compose run --rm api node dist/cli/criar-admin.js`). A senha é
  digitada sem eco ou vem de `ADMIN_SENHA`. `--redefinir` recupera o acesso de
  um administrador que esqueceu a senha.
- **Dois papéis: ADMIN e MEMBRO.** Membros usam pedidos, produção, cadastros e
  relatórios. Só administradores gerenciam contas (`/usuarios`) e veem o
  histórico (`/auditoria`), marcados com `@SomenteAdmin()`.
- **Senha provisória.** O administrador cria a conta com uma senha gerada na
  tela (12 caracteres de um alfabeto sem símbolos ambíguos) e a entrega pelo
  WhatsApp. Enquanto `trocarSenha` for verdadeiro, toda rota responde 403
  `TROCA_DE_SENHA_OBRIGATORIA`, exceto `PATCH /auth/senha` e sair. Redefinir a
  senha de alguém encerra as sessões dessa pessoa; trocar a própria encerra as
  outras sessões e mantém a atual.
- **Permissão relida a cada requisição.** O guard global carrega a conta do
  banco em toda chamada: desativar alguém ou tirar o papel de administrador
  vale na hora, sem esperar o token de acesso de 15 minutos expirar.
- **Sempre um administrador.** Ninguém desativa nem rebaixa a própria conta, e
  a última conta de administrador ativa não pode perder o papel; as contas de
  administrador ficam bloqueadas (`FOR UPDATE`) durante a verificação.
- **Duas barreiras no login.** Além de 5 tentativas por minuto por IP, cada
  telefone aceita 10 falhas em 15 minutos, contadas em memória: quem troca de
  IP para adivinhar a senha de alguém é barrado pelo telefone.
- **Conta ligada a um produtor (opcional).** `usuarios.produtor_id`, único,
  diz qual produtor a pessoa é. O painel inicial usa isso para mostrar a
  produção e os ganhos dela.

## Consequências

- Contas antigas, criadas por e-mail, ficaram sem telefone e só entram depois
  que um administrador cadastrar o celular delas.
- Esquecer a senha não tem fluxo automático: um administrador gera uma nova
  senha provisória. Para a família, é mais simples e mais seguro do que um
  código por SMS.
- O limite por telefone vale para uma instância da API. Com mais de uma, ele
  teria de ir para o banco ou para um cache compartilhado.
