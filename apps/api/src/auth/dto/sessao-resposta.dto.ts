import { UsuarioRespostaDto } from '../../usuarios/dto/usuario-resposta.dto.js';
import type { SessaoEmitida } from '../auth.service.js';

// O refresh token nunca aparece no corpo: segue apenas no cookie httpOnly.
export class SessaoRespostaDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: UsuarioRespostaDto;

  static de(sessao: SessaoEmitida): SessaoRespostaDto {
    return Object.assign(new SessaoRespostaDto(), {
      accessToken: sessao.accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: sessao.expiresIn,
      usuario: UsuarioRespostaDto.de(sessao.usuario),
    });
  }
}
