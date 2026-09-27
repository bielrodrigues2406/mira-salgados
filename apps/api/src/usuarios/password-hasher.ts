import { randomBytes } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';

// Argon2id com 64 MiB, 3 iterações e 1 via: acima do mínimo recomendado pela
// OWASP, com custo aceitável para quatro usuários (algumas dezenas de ms).
const PARAMETROS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private hashDeReferencia = '';

  // Hash de uma senha aleatória, usado quando o e-mail não existe: a verificação
  // leva o mesmo tempo com ou sem usuário, e o tempo de resposta não revela
  // quais e-mails estão cadastrados.
  async onModuleInit(): Promise<void> {
    this.hashDeReferencia = await argon2.hash(randomBytes(32), PARAMETROS);
  }

  hash(senha: string): Promise<string> {
    return argon2.hash(senha, PARAMETROS);
  }

  async verify(hash: string | undefined, senha: string): Promise<boolean> {
    if (hash === undefined) {
      await argon2.verify(this.hashDeReferencia, senha);
      return false;
    }
    return argon2.verify(hash, senha);
  }

  /** Verdadeiro quando o hash foi gerado com parâmetros mais fracos que os atuais. */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, PARAMETROS);
  }
}
