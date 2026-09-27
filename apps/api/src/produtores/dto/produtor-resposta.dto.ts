import type { Produtor } from '../produtor.entity.js';

export class ProdutorRespostaDto {
  id: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;

  static de(produtor: Produtor): ProdutorRespostaDto {
    return Object.assign(new ProdutorRespostaDto(), {
      id: produtor.id,
      nome: produtor.nome,
      ativo: produtor.ativo,
      criadoEm: produtor.criadoEm.toISOString(),
      atualizadoEm: produtor.atualizadoEm.toISOString(),
    });
  }
}
