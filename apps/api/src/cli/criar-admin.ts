import 'reflect-metadata';

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { AppModule } from '../app.module.js';
import { TELEFONE } from '../common/validation/telefone.js';
import { SENHA_MAXIMA, SENHA_MINIMA } from '../usuarios/dto/usuarios.dto.js';
import { Usuario } from '../usuarios/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';

/**
 * Cria a conta de administrador mestre, sem cadastro público na API:
 *
 *   npm run usuarios:criar-admin -w @mira/api
 *   docker compose run --rm api node dist/cli/criar-admin.js
 *
 * Com --redefinir, recupera uma conta existente (senha esquecida ou conta
 * desativada): ela volta ativa, como administradora e com a senha nova.
 * Com --se-nao-houver, não faz nada se já existe um administrador ativo: é o
 * que o deploy usa, para rodar sempre sem pedir nada.
 * Nome, telefone e senha vêm de ADMIN_NOME, ADMIN_TELEFONE e ADMIN_SENHA ou
 * são perguntados no terminal; a senha nunca aparece na tela nem nos logs.
 */
async function perguntar(texto: string): Promise<string> {
  const leitor = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  try {
    return (await leitor.question(texto)).trim();
  } finally {
    leitor.close();
  }
}

/** Lê a senha sem ecoar o que é digitado; fora de um terminal, lê a linha como está. */
function perguntarSenha(texto: string): Promise<string> {
  if (!stdin.isTTY) return perguntar(texto);
  stdout.write(texto);
  return new Promise((resolver) => {
    let valor = '';
    const aoDigitar = (teclas: string): void => {
      for (const tecla of teclas) {
        if (tecla === '\r' || tecla === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', aoDigitar);
          stdout.write('\n');
          resolver(valor);
          return;
        }
        if (tecla === '\u0003') process.exit(130);
        valor = tecla === '\u007f' ? valor.slice(0, -1) : valor + tecla;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', aoDigitar);
  });
}

function haAdministradorAtivo(app: INestApplicationContext): Promise<boolean> {
  return app.get(DataSource).getRepository(Usuario).existsBy({ papel: 'ADMIN', ativo: true });
}

function falhar(mensagem: string): never {
  stdout.write(`Erro: ${mensagem}\n`);
  process.exit(1);
}

async function principal(): Promise<void> {
  const redefinir = process.argv.includes('--redefinir');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    if (process.argv.includes('--se-nao-houver') && (await haAdministradorAtivo(app))) {
      stdout.write('Já existe um administrador ativo: nada a fazer.\n');
      return;
    }

    const nome = redefinir ? '' : (process.env['ADMIN_NOME'] ?? (await perguntar('Nome: ')));
    const telefone = (
      process.env['ADMIN_TELEFONE'] ?? (await perguntar('Celular com DDD: '))
    ).replace(/\D/g, '');
    const senha = process.env['ADMIN_SENHA'] ?? (await perguntarSenha('Senha: '));

    if (!redefinir && nome === '') falhar('informe o nome.');
    if (!TELEFONE.test(telefone)) falhar('o celular precisa ter DDD e 10 ou 11 dígitos.');
    if (senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA) {
      falhar(
        `a senha precisa ter de ${String(SENHA_MINIMA)} a ${String(SENHA_MAXIMA)} caracteres.`,
      );
    }
    if (!process.env['ADMIN_SENHA'] && stdin.isTTY) {
      if ((await perguntarSenha('Repita a senha: ')) !== senha) falhar('as senhas não conferem.');
    }

    const usuarios = app.get(UsuariosService);
    const conta = redefinir
      ? await usuarios.restaurarAdmin(telefone, senha)
      : await usuarios.criar({ nome, telefone, papel: 'ADMIN', senha, provisoria: false }, null);
    stdout.write(
      `${redefinir ? 'Conta recuperada' : 'Administrador criado'}: ${conta.nome} (${telefone}).\n`,
    );
  } catch (erro) {
    falhar(erro instanceof Error ? erro.message : 'não foi possível concluir.');
  } finally {
    await app.close();
  }
}

await principal();
