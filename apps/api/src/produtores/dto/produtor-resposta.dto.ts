import type { ProdutoPadrao, ProdutorComProdutos } from '../produtores.service.js';

export class ProdutorRespostaDto {
  id: string;
  nome: string;
  ativo: boolean;
  produtosPadrao: ProdutoPadrao[];
  criadoEm: string;
  atualizadoEm: string;

  static de({ produtor, produtosPadrao }: ProdutorComProdutos): ProdutorRespostaDto {
    return Object.assign(new ProdutorRespostaDto(), {
      id: produtor.id,
      nome: produtor.nome,
      ativo: produtor.ativo,
      produtosPadrao,
      criadoEm: produtor.criadoEm.toISOString(),
      atualizadoEm: produtor.atualizadoEm.toISOString(),
    });
  }
}
