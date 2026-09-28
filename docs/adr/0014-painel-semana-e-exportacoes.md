# ADR 0014 — Painel inicial, produção da semana e exportações

## Contexto

A tela inicial era a lista de pedidos. Quem produz queria saber, sem procurar,
o que tem de fazer hoje e nos próximos dias e quanto ganhou; e a família
compartilha produção, acerto e cobranças pelo WhatsApp.

## Decisão

- **Produção por dia.** `GET /relatorios/producao-por-dia?de&ate[&produtorId]`
  devolve cada dia do intervalo (até 31, inclusive os vazios) com a carga de
  cada produtor por salgado. É a base do modo "Semana" da tela de produção e
  dos próximos dias do painel.
- **Painel por pessoa.** `GET /painel?data=` junta, para quem entrou: o dia
  (entregas pendentes, sem pagamento), os próximos sete dias e, se a conta
  estiver ligada a um produtor, a produção dele e os ganhos da semana e do
  mês. A data vem do aparelho, que é o "hoje" de quem olha.
- **Ganhos somam acertos diários.** O ganho de um intervalo é a soma do que o
  acerto de cada dia dá ao produtor. Somar os pedidos do intervalo e dividir
  uma vez daria outro resultado, porque a divisão do caixa é proporcional
  dentro de cada dia. `AcertoDiarioService.porDia` calcula todos os dias em
  duas consultas.
- **Navegação no celular.** A barra inferior ficou com Início, Pedidos,
  Produção e Mais; "Mais" abre as outras telas, a troca de senha e a saída. O
  menu lateral fica para o desktop, onde há espaço.
- **Exportar sem servidor.** Planilhas CSV são montadas no navegador
  (ponto e vírgula, vírgula decimal e BOM, para abrir direto no Excel e no
  Planilhas em português; textos que começam com `=`, `+`, `-` ou `@` recebem
  um apóstrofo, contra injeção de fórmula). Listas paginadas buscam todas as
  páginas antes de exportar. Imprimir usa uma folha de estilo de impressão, e
  "Salvar como PDF" do navegador cobre o PDF.
- **WhatsApp por link.** Mensagens prontas abrem o aplicativo por
  `https://wa.me/55<celular>?text=`, sem API do WhatsApp, sem custo e sem
  guardar nada fora do sistema.
