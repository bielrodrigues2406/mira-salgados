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
  /** Produtor que esta pessoa é, quando ela produz. */
  produtorId: string | null;
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
  produtorId?: string;
  /** Provisória: a pessoa troca no primeiro acesso. */
  senha: string;
}

export interface AlteracaoUsuario {
  nome?: string;
  telefone?: string;
  papel?: Papel;
  ativo?: boolean;
  /** null desfaz a ligação. */
  produtorId?: string | null;
}

export interface ConsultaUsuarios {
  page: number;
  pageSize: number;
  ativo?: boolean;
}
