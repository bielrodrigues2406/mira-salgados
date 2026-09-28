import type { EntityManager } from 'typeorm';

import { Cliente } from '../clientes/cliente.entity.js';
import { BusinessRuleError } from '../common/errors/domain.errors.js';
import { Produtor } from '../produtores/produtor.entity.js';

export async function garantirClienteAtivo(
  manager: EntityManager,
  clienteId: string,
): Promise<Cliente> {
  const cliente = await manager.getRepository(Cliente).findOneBy({ id: clienteId });
  if (!cliente?.ativo) {
    throw new BusinessRuleError('CLIENTE_INVALIDO', 'Escolha um cliente ativo.');
  }
  return cliente;
}

export async function garantirProdutorAtivo(
  manager: EntityManager,
  produtorId: string,
): Promise<Produtor> {
  const produtor = await manager.getRepository(Produtor).findOneBy({ id: produtorId });
  if (!produtor?.ativo) {
    throw new BusinessRuleError('PRODUTOR_INVALIDO', 'Escolha um produtor ativo.');
  }
  return produtor;
}
