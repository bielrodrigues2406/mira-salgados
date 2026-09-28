import type { Papel } from '../papeis.js';
import type { Usuario } from '../usuario.entity.js';

export class UsuarioRespostaDto {
  id: string;
  nome: string;
  telefone: string | null;
  papel: Papel;
  /** Senha provisória ainda não trocada. */
  trocarSenha: boolean;
  ativo: boolean;
  /** Produtor ligado à conta, ou null para quem não produz. */
  produtorId: string | null;
  criadoEm: string;

  static de(usuario: Usuario): UsuarioRespostaDto {
    return Object.assign(new UsuarioRespostaDto(), {
      id: usuario.id,
      nome: usuario.nome,
      telefone: usuario.telefone,
      papel: usuario.papel,
      trocarSenha: usuario.trocarSenha,
      ativo: usuario.ativo,
      produtorId: usuario.produtorId,
      criadoEm: usuario.criadoEm.toISOString(),
    });
  }
}
