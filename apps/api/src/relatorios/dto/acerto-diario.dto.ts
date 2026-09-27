import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type { AcertoDiario } from '../acerto/acerto-diario.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class LinhaDoProdutorDto {
  produto: ReferenciaDto;
  preparo: Preparo;
  centos: number;
  avulsas: number;
  valorCentavos: number;
}

export class ParteDoProdutorDto {
  produtor: ReferenciaDto;
  unidades: number;
  /** Décimos de ponto percentual: 568 é 56,8%. Somam 1000. */
  participacaoDecimos: number;
  itens: LinhaDoProdutorDto[];
  valorItensCentavos: number;
  descontoCentavos: number;
  valorProduzidoCentavos: number;
  aReceberCentavos: number;
  pendenteCentavos: number;
}

export class AcertoDiarioDto {
  data: string;
  quantidadePedidos: number;
  unidades: number;
  valorMovimentadoCentavos: number;
  caixa: { pixCentavos: number; dinheiroCentavos: number; totalCentavos: number };
  fiado: { valorCentavos: number; pedidos: number[] };
  semPagamento: { valorCentavos: number; pedidos: number[] };
  totalProduzidoCentavos: number;
  produtores: ParteDoProdutorDto[];
  somaAReceberCentavos: number;
  somaPendenteCentavos: number;

  static de(data: string, acerto: AcertoDiario): AcertoDiarioDto {
    return Object.assign(new AcertoDiarioDto(), {
      data,
      quantidadePedidos: acerto.quantidadePedidos,
      unidades: acerto.unidades,
      valorMovimentadoCentavos: acerto.valorMovimentado,
      caixa: {
        pixCentavos: acerto.caixa.pix,
        dinheiroCentavos: acerto.caixa.dinheiro,
        totalCentavos: acerto.caixa.total,
      },
      fiado: { valorCentavos: acerto.fiado.valor, pedidos: [...acerto.fiado.pedidos] },
      semPagamento: {
        valorCentavos: acerto.semPagamento.valor,
        pedidos: [...acerto.semPagamento.pedidos],
      },
      totalProduzidoCentavos: acerto.totalProduzido,
      produtores: acerto.produtores.map((parte) =>
        Object.assign(new ParteDoProdutorDto(), {
          produtor: { id: parte.produtor.id, nome: parte.produtor.nome },
          unidades: parte.unidades,
          participacaoDecimos: parte.participacaoDecimos,
          itens: parte.itens.map((linha) =>
            Object.assign(new LinhaDoProdutorDto(), {
              produto: { id: linha.produto.id, nome: linha.produto.nome },
              preparo: linha.preparo,
              centos: linha.centos,
              avulsas: linha.avulsas,
              valorCentavos: linha.valor,
            }),
          ),
          valorItensCentavos: parte.valorItens,
          descontoCentavos: parte.desconto,
          valorProduzidoCentavos: parte.valorProduzido,
          aReceberCentavos: parte.aReceber,
          pendenteCentavos: parte.pendente,
        }),
      ),
      somaAReceberCentavos: acerto.somaAReceber,
      somaPendenteCentavos: acerto.somaPendente,
    });
  }
}
