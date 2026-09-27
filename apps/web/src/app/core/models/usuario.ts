export const PAPEIS = ['ADMIN', 'MEMBRO'] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  MEMBRO: 'Membro',
};

export interface Usuario {
  id: string;
  nome: string;
  /** Celular com DDD, só dígitos: é o login. */
  telefone: string | null;
  papel: Papel;
  /** Senha provisória que ainda precisa ser trocada. */
  trocarSenha: boolean;
  ativo: boolean;
  criadoEm: string;
}

export interface SessaoResposta {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: Usuario;
}

export interface NovoUsuario {
  nome: string;
  telefone: string;
  papel: Papel;
  /** Provisória: a pessoa troca no primeiro acesso. */
  senha: string;
}

export interface AlteracaoUsuario {
  nome?: string;
  telefone?: string;
  papel?: Papel;
  ativo?: boolean;
}

export interface ConsultaUsuarios {
  page: number;
  pageSize: number;
  ativo?: boolean;
}
