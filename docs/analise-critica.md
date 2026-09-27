# Análise crítica da especificação

Pontos em que a especificação é ambígua, inconsistente ou arriscada, com a
resolução proposta. Atualizado a cada módulo implementado.

## Segurança

| #   | Ponto                                                                                                                               | Risco                                                                         | Resolução                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| S1  | `POST /auth/registro` aparece sem restrição no contrato                                                                             | Qualquer pessoa que encontre a URL cria conta e lê todos os dados             | Cadastro exige usuário autenticado; o cadastro público é uma chave de configuração, desligada por padrão (ADR 0006) |
| S2  | O Prompt 1 pede mensagem de erro específica no login; o Prompt 2 exige que usuário inexistente e senha errada sejam indistinguíveis | Mensagens diferentes revelam quais e-mails têm conta                          | Mensagem única e específica sobre a falha: "E-mail ou senha incorretos."                                            |
| S3  | O contrato não prevê encerramento de sessão                                                                                         | Sem logout, o refresh token vale até expirar, mesmo em aparelho compartilhado | Adicionado `POST /auth/logout`, que revoga a família de tokens                                                      |
| S4  | Duas abas renovando a sessão ao mesmo tempo acionam a detecção de reuso                                                             | Usuário desconectado sem motivo aparente                                      | Renovação serializada dentro da aba; coordenação entre abas é evolução prevista (ADR 0006)                          |
| S5  | O log de auditoria guardaria o estado completo das entidades                                                                        | Hash de senha e tokens copiados para uma tabela de leitura ampla              | Snapshots passam por sanitização que remove campos sensíveis                                                        |
| S6  | Todo usuário autenticado lê a auditoria inteira                                                                                     | Aceitável com quatro pessoas; deixa de ser com papéis diferentes              | Guard de papéis entra sem mudar services quando houver níveis de permissão                                          |

## Ambiguidades de domínio

As ambiguidades levantadas no protótipo estão em
[`design/README.md`](../design/README.md#pontos-da-especificação-que-pedem-decisão):
fiado como pagamento, base de datas do acerto, taxa e desconto no rateio,
pedido cancelado com pagamentos, edição de itens após a confirmação e saldo
devedor de rascunhos. Cada uma será resolvida no módulo correspondente.

## Desempenho e índices

| Tabela           | Índice                               | Consulta atendida        |
| ---------------- | ------------------------------------ | ------------------------ |
| `refresh_tokens` | único em `token_hash`                | Renovação de sessão      |
| `refresh_tokens` | `family_id`                          | Revogação da família     |
| `logs_auditoria` | `(entidade, entidade_id, criado_em)` | Histórico de um registro |
| `logs_auditoria` | `criado_em`                          | Filtro por intervalo     |

Os índices dos relatórios (pedidos por data de entrega e status, itens por
produtor, pagamentos por pedido) serão definidos junto com as consultas.

## Evolução

- **Níveis de permissão.** O guard global já centraliza a identidade; falta só o
  metadado de papéis e uma coluna ou tabela de papéis por usuário.
- **Múltiplos produtores por item.** O modelo prevê um `produtorId` por item.
  Dividir um item entre pessoas hoje significa dividir a quantidade em dois
  itens, o que é suficiente para o acerto, que soma por produtor.
