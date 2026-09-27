import type { Cliente } from '../cliente.entity.js';

export class ClienteRespostaDto {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;

  static de(cliente: Cliente): ClienteRespostaDto {
    return Object.assign(new ClienteRespostaDto(), {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      ativo: cliente.ativo,
      criadoEm: cliente.criadoEm.toISOString(),
      atualizadoEm: cliente.atualizadoEm.toISOString(),
    });
  }
}
