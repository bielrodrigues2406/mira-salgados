import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { AuthService } from '../../../src/auth/auth.service.js';
import { REFRESH_COOKIE } from '../../../src/auth/refresh-cookie.js';
import type { Usuario } from '../../../src/usuarios/usuario.entity.js';

let ultimoOcteto = 0;

/** IP distinto por chamada, para que o limite de taxa de um teste não afete outro. */
export function novoIp(): string {
  ultimoOcteto = (ultimoOcteto % 250) + 1;
  return `10.0.${Math.floor(Math.random() * 250)}.${ultimoOcteto}`;
}

export const SENHA_PADRAO = 'senha-de-teste-bem-longa';

export function criarUsuario(
  app: INestApplication,
  dados: Partial<{ nome: string; email: string; senha: string }> = {},
): Promise<Usuario> {
  return app.get(AuthService).registrar(
    {
      nome: dados.nome ?? 'Lúcia Andrade',
      email: dados.email ?? 'lucia@exemplo.com',
      senha: dados.senha ?? SENHA_PADRAO,
    },
    null,
  );
}

export function setCookies(resposta: Response): string[] {
  const valor = resposta.headers['set-cookie'] as string[] | string | undefined;
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Valor do cookie de refresh no formato do cabeçalho Cookie, ou undefined. */
export function cookieDeRefresh(resposta: Response): string | undefined {
  const cabecalho = setCookies(resposta).find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));
  const par = cabecalho?.split(';', 1)[0];
  return par && par !== `${REFRESH_COOKIE}=` ? par : undefined;
}
