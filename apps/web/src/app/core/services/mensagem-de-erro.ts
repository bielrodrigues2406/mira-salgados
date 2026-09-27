import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErro } from '../models/api';

const SEM_CONEXAO = 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
const GENERICA = 'Não foi possível concluir a operação. Tente novamente.';

function ehApiErro(corpo: unknown): corpo is ApiErro {
  if (typeof corpo !== 'object' || corpo === null || !('error' in corpo)) return false;
  const { error } = corpo;
  return typeof error === 'object' && error !== null && 'message' in error;
}

/** Mensagem para o usuário a partir de qualquer falha de requisição. */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof HttpErrorResponse)) return GENERICA;
  if (erro.status === 0) return SEM_CONEXAO;
  return ehApiErro(erro.error) ? erro.error.error.message : GENERICA;
}
