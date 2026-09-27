export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
}

export interface SessaoResposta {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: Usuario;
}

export interface ConfiguracaoAuth {
  registroPublico: boolean;
}

export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
}
