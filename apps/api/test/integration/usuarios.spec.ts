import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UsuariosService } from '../../src/usuarios/usuarios.service.js';
import {
  cookieDeRefresh,
  criarUsuario,
  novoIp,
  novoTelefone,
  SENHA_PADRAO,
} from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Sessao {
  accessToken: string;
  cookie: string | undefined;
  usuario: { id: string; papel: string; trocarSenha: boolean };
}

interface UsuarioResposta {
  id: string;
  nome: string;
  telefone: string;
  papel: string;
  trocarSenha: boolean;
  ativo: boolean;
}

describe('usuários', () => {
  let app: NestExpressApplication;
  let admin: Sessao;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    const conta = await criarUsuario(app, { nome: 'Gabriel', papel: 'ADMIN' });
    admin = await entrar(conta.telefone ?? '');
  });

  afterAll(async () => {
    await app.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  async function entrar(telefone: string, senha = SENHA_PADRAO): Promise<Sessao> {
    const resposta = await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone, senha })
      .expect(200);
    return { ...dadosDe<Omit<Sessao, 'cookie'>>(resposta), cookie: cookieDeRefresh(resposta) };
  }

  function como(sessao: Sessao) {
    const autorizacao = `Bearer ${sessao.accessToken}`;
    return {
      get: (caminho: string) => http().get(`/api/v1${caminho}`).set('Authorization', autorizacao),
      post: (caminho: string, corpo: object) =>
        http()
          .post(`/api/v1${caminho}`)
          .set('Authorization', autorizacao)
          .set('X-Forwarded-For', novoIp())
          .send(corpo),
      patch: (caminho: string, corpo: object) =>
        http()
          .patch(`/api/v1${caminho}`)
          .set('Authorization', autorizacao)
          .set('X-Forwarded-For', novoIp())
          .set('Cookie', sessao.cookie ?? '')
          .send(corpo),
    };
  }

  async function novaConta(papel: 'ADMIN' | 'MEMBRO' = 'MEMBRO'): Promise<UsuarioResposta> {
    return dadosDe<UsuarioResposta>(
      await como(admin)
        .post('/usuarios', {
          nome: 'Célia Souza',
          telefone: novoTelefone(),
          papel,
          senha: 'provisoria-123',
        })
        .expect(201),
    );
  }

  it('administrador cria conta com senha provisória, e o telefone é o login', async () => {
    const criado = await como(admin)
      .post('/usuarios', {
        nome: '  Célia Souza ',
        telefone: '(11) 97777-6666',
        papel: 'MEMBRO',
        senha: 'provisoria-123',
      })
      .expect(201);

    expect(dadosDe(criado)).toMatchObject({
      nome: 'Célia Souza',
      telefone: '11977776666',
      papel: 'MEMBRO',
      trocarSenha: true,
      ativo: true,
    });
    expect(JSON.stringify(criado.body)).not.toMatch(/"senha(Hash)?"|argon2/i);

    const lista = await como(admin).get('/usuarios').expect(200);
    expect(dadosDe<UsuarioResposta[]>(lista).map((u) => u.nome)).toEqual([
      'Célia Souza',
      'Gabriel',
    ]);
  });

  it('aceita senha de 8 caracteres e recusa a de 7', async () => {
    const corpo = { nome: 'Lia', telefone: '11966665555', papel: 'MEMBRO' };
    await como(admin)
      .post('/usuarios', { ...corpo, senha: '1234567' })
      .expect(400);
    await como(admin)
      .post('/usuarios', { ...corpo, senha: '12345678' })
      .expect(201);
  });

  it('valida entrada e recusa telefone repetido', async () => {
    const invalido = await como(admin)
      .post('/usuarios', { nome: '', telefone: '123', papel: 'DONO', senha: 'curta' })
      .expect(400);
    expect((erroDe(invalido).details as { field: string }[]).map((d) => d.field).sort()).toEqual([
      'nome',
      'papel',
      'senha',
      'telefone',
    ]);

    const existente = await novaConta();
    const repetido = await como(admin)
      .post('/usuarios', {
        nome: 'Outra',
        telefone: existente.telefone,
        papel: 'MEMBRO',
        senha: 'provisoria-123',
      })
      .expect(409);
    expect(erroDe(repetido).code).toBe('TELEFONE_EM_USO');
  });

  it('membro não gerencia contas', async () => {
    const membro = await criarUsuario(app, { papel: 'MEMBRO' });
    const sessao = await entrar(membro.telefone ?? '');

    for (const resposta of [
      await como(sessao).get('/usuarios'),
      await como(sessao).post('/usuarios', {
        nome: 'X',
        telefone: novoTelefone(),
        papel: 'ADMIN',
        senha: 'provisoria-123',
      }),
      await como(sessao).patch(`/usuarios/${membro.id}`, { papel: 'ADMIN' }),
      await como(sessao).post(`/usuarios/${membro.id}/senha`, { senha: 'provisoria-123' }),
    ]) {
      expect(resposta.status).toBe(403);
      expect(erroDe(resposta).code).toBe('SOMENTE_ADMIN');
    }
  });

  it('com senha provisória só troca a senha; depois disso, usa o sistema', async () => {
    const conta = await novaConta();
    const sessao = await entrar(conta.telefone, 'provisoria-123');
    expect(sessao.usuario.trocarSenha).toBe(true);

    const bloqueada = await como(sessao).get('/pedidos').expect(403);
    expect(erroDe(bloqueada).code).toBe('TROCA_DE_SENHA_OBRIGATORIA');

    const errada = await como(sessao)
      .patch('/auth/senha', { senhaAtual: 'outra-coisa-qualquer', novaSenha: 'minha-senha-nova-1' })
      .expect(401);
    expect(erroDe(errada).code).toBe('SENHA_ATUAL_INCORRETA');
    const repetida = await como(sessao)
      .patch('/auth/senha', { senhaAtual: 'provisoria-123', novaSenha: 'provisoria-123' })
      .expect(422);
    expect(erroDe(repetida).code).toBe('SENHA_REPETIDA');

    const trocada = await como(sessao)
      .patch('/auth/senha', { senhaAtual: 'provisoria-123', novaSenha: 'minha-senha-nova-1' })
      .expect(200);
    expect(dadosDe(trocada)).toMatchObject({ trocarSenha: false });

    await como(sessao).get('/pedidos').expect(200);
    await entrar(conta.telefone, 'minha-senha-nova-1');
  });

  it('trocar a própria senha encerra as outras sessões e mantém a atual', async () => {
    const telefone = (await criarUsuario(app)).telefone ?? '';
    const celular = await entrar(telefone);
    const computador = await entrar(telefone);

    await como(celular)
      .patch('/auth/senha', { senhaAtual: SENHA_PADRAO, novaSenha: 'minha-senha-nova-1' })
      .expect(200);

    const renovaCelular = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', novoIp())
      .set('Cookie', celular.cookie ?? '');
    const renovaComputador = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', novoIp())
      .set('Cookie', computador.cookie ?? '');
    expect(renovaCelular.status).toBe(200);
    expect(renovaComputador.status).toBe(401);
  });

  it('desativar corta o acesso na hora, sem esperar o token expirar', async () => {
    const conta = await criarUsuario(app);
    const sessao = await entrar(conta.telefone ?? '');
    await como(sessao).get('/pedidos').expect(200);

    await como(admin).patch(`/usuarios/${conta.id}`, { ativo: false }).expect(200);

    expect((await como(sessao).get('/pedidos')).status).toBe(401);
    const renova = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', novoIp())
      .set('Cookie', sessao.cookie ?? '');
    expect(renova.status).toBe(401);
    const login = await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: conta.telefone, senha: SENHA_PADRAO });
    expect(login.status).toBe(401);
  });

  it('rebaixar para membro tira o acesso de administrador na hora', async () => {
    const outro = await novaConta('ADMIN');
    await como(admin).post(`/usuarios/${outro.id}/senha`, { senha: 'provisoria-456' }).expect(200);
    const sessao = await entrar(outro.telefone, 'provisoria-456');
    await como(sessao)
      .patch('/auth/senha', { senhaAtual: 'provisoria-456', novaSenha: 'senha-do-outro-admin' })
      .expect(200);
    await como(sessao).get('/usuarios').expect(200);

    await como(admin).patch(`/usuarios/${outro.id}`, { papel: 'MEMBRO' }).expect(200);

    expect((await como(sessao).get('/usuarios')).status).toBe(403);
  });

  it('ninguém desativa nem rebaixa a si mesmo, e sempre sobra um administrador', async () => {
    const propria = await como(admin)
      .patch(`/usuarios/${admin.usuario.id}`, { ativo: false })
      .expect(422);
    expect(erroDe(propria).code).toBe('ALTERACAO_DA_PROPRIA_CONTA');

    // Com um segundo administrador, este pode rebaixar o primeiro; o contrário
    // deixaria o sistema sem nenhum.
    const segundo = await novaConta('ADMIN');
    await como(admin).patch(`/usuarios/${segundo.id}`, { papel: 'MEMBRO' }).expect(200);
    const ultimo = await app
      .get(UsuariosService)
      .atualizar(admin.usuario.id, { papel: 'MEMBRO' }, segundo.id)
      .catch((erro: unknown) => erro);
    expect(ultimo).toMatchObject({ code: 'ULTIMO_ADMINISTRADOR' });
  });

  it('redefinir a senha encerra as sessões e exige troca no próximo acesso', async () => {
    const conta = await criarUsuario(app);
    const sessao = await entrar(conta.telefone ?? '');

    const redefinida = await como(admin)
      .post(`/usuarios/${conta.id}/senha`, { senha: 'provisoria-789' })
      .expect(200);
    expect(dadosDe(redefinida)).toMatchObject({ trocarSenha: true });

    const renova = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', novoIp())
      .set('Cookie', sessao.cookie ?? '');
    expect(renova.status).toBe(401);
    const nova = await entrar(conta.telefone ?? '', 'provisoria-789');
    expect(nova.usuario.trocarSenha).toBe(true);
  });

  it('o comando de recuperação devolve o acesso de administrador pelo servidor', async () => {
    const conta = await criarUsuario(app, { papel: 'MEMBRO' });
    await como(admin).patch(`/usuarios/${conta.id}`, { ativo: false }).expect(200);

    await app.get(UsuariosService).restaurarAdmin(conta.telefone ?? '', 'senha-recuperada-1');

    const sessao = await entrar(conta.telefone ?? '', 'senha-recuperada-1');
    expect(sessao.usuario).toMatchObject({ papel: 'ADMIN', trocarSenha: false });
  });
});
