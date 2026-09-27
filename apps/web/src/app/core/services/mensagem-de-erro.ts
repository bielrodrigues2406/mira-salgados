import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErro } from '../models/api';

const SEM_CONEXAO = 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
const GENERICA = 'Não foi possível concluir a operação. Tente novamente.';
const FALHA_AO_CARREGAR =
  'A conexão com o servidor falhou. Nenhum dado foi alterado. Confira a internet do aparelho e tente de novo.';

function ehApiErro(corpo: unknown): corpo is ApiErro {
  if (typeof corpo !== 'object' || corpo === null || !('error' in corpo)) return false;
  const { error } = corpo;
  return typeof error === 'object' && error !== null && 'message' in error;
}

/** Código estável do erro da API, para tratar casos específicos na tela. */
export function codigoDeErro(erro: unknown): string | undefined {
  if (!(erro instanceof HttpErrorResponse) || !ehApiErro(erro.error)) return undefined;
  return erro.error.error.code;
}

/** Mensagem para o usuário a partir de qualquer falha de requisição. */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof HttpErrorResponse)) return GENERICA;
  if (erro.status === 0) return SEM_CONEXAO;
  return ehApiErro(erro.error) ? erro.error.error.message : GENERICA;
}

/** Mensagem para falhas de leitura, em que nada foi alterado no servidor. */
export function mensagemDeCarregamento(erro: unknown): string {
  if (erro instanceof HttpErrorResponse && erro.status !== 0 && ehApiErro(erro.error)) {
    return erro.error.error.message;
  }
  return FALHA_AO_CARREGAR;
}
