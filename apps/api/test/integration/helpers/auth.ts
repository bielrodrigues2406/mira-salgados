import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { REFRESH_COOKIE } from '../../../src/auth/refresh-cookie.js';
import type { Papel } from '../../../src/usuarios/papeis.js';
import type { Usuario } from '../../../src/usuarios/usuario.entity.js';
import { UsuariosService } from '../../../src/usuarios/usuarios.service.js';

let ultimoOcteto = 0;

/** IP distinto por chamada, para que o limite de taxa de um teste não afete outro. */
export function novoIp(): string {
  ultimoOcteto = (ultimoOcteto % 250) + 1;
  return `10.0.${Math.floor(Math.random() * 250)}.${ultimoOcteto}`;
}

export const SENHA_PADRAO = 'senha-de-teste-bem-longa';

/** Celular único por chamada: DDD 11, nono dígito e oito dígitos aleatórios. */
export function novoTelefone(): string {
  return `119${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

export function criarUsuario(
  app: INestApplication,
  dados: Partial<{
    nome: string;
    telefone: string;
    senha: string;
    papel: Papel;
    provisoria: boolean;
  }> = {},
): Promise<Usuario> {
  return app.get(UsuariosService).criar(
    {
      nome: dados.nome ?? 'Lúcia Andrade',
      telefone: dados.telefone ?? novoTelefone(),
      senha: dados.senha ?? SENHA_PADRAO,
      papel: dados.papel ?? 'MEMBRO',
      provisoria: dados.provisoria ?? false,
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
