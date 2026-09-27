// Collation ICU do português do Brasil, disponível na imagem oficial do
// PostgreSQL. Aplicada às colunas de nome, faz o ORDER BY seguir a ordem do
// dicionário ("Célia" antes de "Cláudio"), sem depender do locale do sistema
// operacional do servidor de banco.
export const COLLATION_PT_BR = 'pt-BR-x-icu';
