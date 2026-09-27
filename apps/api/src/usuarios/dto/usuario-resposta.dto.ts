import type { Usuario } from '../usuario.entity.js';

export class UsuarioRespostaDto {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;

  static de(usuario: Usuario): UsuarioRespostaDto {
    return Object.assign(new UsuarioRespostaDto(), {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      ativo: usuario.ativo,
      criadoEm: usuario.criadoEm.toISOString(),
    });
  }
}
