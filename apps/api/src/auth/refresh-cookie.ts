import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

import { API_PREFIX } from '../config/api.constants.js';
import type { Env } from '../config/env.schema.js';

export const REFRESH_COOKIE = 'mira_refresh';

// O refresh token vive apenas num cookie httpOnly: nenhum script da página o
// lê, ao contrário de localStorage. SameSite=Strict impede o envio a partir de
// outros sites, e o path restringe o cookie às rotas de autenticação.
@Injectable()
export class RefreshCookie {
  private readonly secure: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.secure = config.get('COOKIE_SECURE', { infer: true });
  }

  write(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE, token, { ...this.options(), expires: expiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, this.options());
  }

  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const valor = cookies?.[REFRESH_COOKIE];
    return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: `/${API_PREFIX}/auth`,
    };
  }
}
