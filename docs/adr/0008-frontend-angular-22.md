# ADR 0008 — Frontend em Angular 22

## Decisão

- **Standalone, zoneless e OnPush.** No Angular 22 os três são o padrão; nenhum
  componente declara `changeDetection`, e não há `zone.js`.
- **Signals para estado e `computed` para derivados.** Observables ficam restritos
  às chamadas HTTP, convertidos com `firstValueFrom` ou `toSignal` na borda.
- **Signal Forms** (`@angular/forms/signals`, API pública desde a 22.0) em vez de
  Reactive Forms: o modelo do formulário é um signal, e as validações ficam
  declaradas junto do formulário.
- **Controle de fluxo nativo** (`@if`, `@for`, `@switch`) exigido pelo lint.
- **Três arquivos por componente.** O lint proíbe template e estilo inline, sem
  exceção para componentes triviais. Os nomes seguem o guia de estilo atual, sem
  sufixo de tipo (`login.ts`, `login.html`, `login.css`).
- **Camadas.** `core/` reúne serviços singleton, guards, interceptor e layout;
  `shared/` reúne componentes reutilizáveis; `features/` reúne as telas, cada uma
  carregada sob demanda pela rota.
- **Sessão.** O access token fica em memória, num signal. Ao abrir o app, um
  inicializador tenta restaurar a sessão pelo cookie de refresh antes da
  primeira navegação, para que os guards decidam com o estado real.
- **Renovação no interceptor.** Um 401 dispara a renovação e a requisição é
  repetida com o novo token. Requisições paralelas compartilham a mesma
  renovação, porque reapresentar um refresh token já usado revoga a sessão
  inteira. Falha na renovação leva ao login com aviso de sessão expirada.
- **Mesma origem.** A API é servida em `/api/v1` pela mesma origem da aplicação:
  proxy no desenvolvimento, nginx em produção. O cookie `SameSite=Strict`
  funciona sem CORS com credenciais.
- **Sem biblioteca de componentes.** Tokens do design em variáveis CSS globais,
  primitivas (botão, campo, cartão, alerta) em classes globais e ícones de traço
  desenhados por um componente próprio a partir de uma tabela de formas SVG, sem
  `innerHTML`. A fonte IBM Plex Sans é servida localmente (`@fontsource`), sem
  requisição a terceiros.

## Consequências

- Rotas dos módulos ainda não entregues apontam para uma página "em construção",
  trocada pelo módulo real em cada entrega.
- A renovação é reativa (após o 401). Renovar alguns segundos antes do
  vencimento evitaria uma ida e volta a cada 15 minutos; fica como ajuste fino.
