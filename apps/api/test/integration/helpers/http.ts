import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response, type Test } from 'supertest';

import { criarUsuario, novoIp, SENHA_PADRAO } from './auth.js';

export interface CorpoDeErro {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export interface MetaDePaginacao {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function erroDe(resposta: Response): CorpoDeErro['error'] {
  return (resposta.body as CorpoDeErro).error;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- asserção do corpo, só em testes
export function dadosDe<T>(resposta: Response): T {
  return (resposta.body as { data: T }).data;
}

export function metaDe(resposta: Response): MetaDePaginacao | undefined {
  return (resposta.body as { meta?: MetaDePaginacao }).meta;
}

export interface ClienteHttp {
  usuarioId: string;
  get(caminho: string): Test;
  post(caminho: string, corpo?: object): Test;
  patch(caminho: string, corpo?: object): Test;
}

/** Cria um usuário, entra pela API e devolve requisições já autenticadas. */
export async function clienteAutenticado(app: NestExpressApplication): Promise<ClienteHttp> {
  const usuario = await criarUsuario(app, { email: `usuario-${crypto.randomUUID()}@exemplo.com` });
  const servidor = app.getHttpServer();
  const login = await request(servidor)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', novoIp())
    .send({ email: usuario.email, senha: SENHA_PADRAO })
    .expect(200);
  const { accessToken } = dadosDe<{ accessToken: string }>(login);
  const autorizacao = `Bearer ${accessToken}`;

  return {
    usuarioId: usuario.id,
    get: (caminho) => request(servidor).get(`/api/v1${caminho}`).set('Authorization', autorizacao),
    post: (caminho, corpo) =>
      request(servidor).post(`/api/v1${caminho}`).set('Authorization', autorizacao).send(corpo),
    patch: (caminho, corpo) =>
      request(servidor).patch(`/api/v1${caminho}`).set('Authorization', autorizacao).send(corpo),
  };
}
