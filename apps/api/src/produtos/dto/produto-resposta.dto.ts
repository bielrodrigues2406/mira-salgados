import type { PrecoProduto, Preparo, UnidadeVenda } from '../preco-produto.entity.js';
import type { ProdutoComPrecos } from '../produtos.service.js';

export class PrecoRespostaDto {
  id: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  precoCentavos: number;
  vigenteDesde: string;
  vigenteAte: string | null;

  static de(preco: PrecoProduto): PrecoRespostaDto {
    return Object.assign(new PrecoRespostaDto(), {
      id: preco.id,
      preparo: preco.preparo,
      unidadeVenda: preco.unidadeVenda,
      precoCentavos: preco.preco,
      vigenteDesde: preco.vigenteDesde.toISOString(),
      vigenteAte: preco.vigenteAte?.toISOString() ?? null,
    });
  }
}

export class ProdutoRespostaDto {
  id: string;
  nome: string;
  ativo: boolean;
  produtorPadrao: { id: string; nome: string; ativo: boolean };
  precosVigentes: PrecoRespostaDto[];
  criadoEm: string;
  atualizadoEm: string;

  static de({ produto, produtorPadrao, precos }: ProdutoComPrecos): ProdutoRespostaDto {
    return Object.assign(new ProdutoRespostaDto(), {
      id: produto.id,
      nome: produto.nome,
      ativo: produto.ativo,
      produtorPadrao: {
        id: produtorPadrao.id,
        nome: produtorPadrao.nome,
        ativo: produtorPadrao.ativo,
      },
      precosVigentes: precos.map((preco) => PrecoRespostaDto.de(preco)),
      criadoEm: produto.criadoEm.toISOString(),
      atualizadoEm: produto.atualizadoEm.toISOString(),
    });
  }
}
