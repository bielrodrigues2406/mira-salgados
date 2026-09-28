import type { Preparo } from '../../produtos/preco-produto.entity.js';
import type { ProducaoPorDia } from '../producao/producao-por-dia.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class SalgadoDoProdutorDto {
  produto: ReferenciaDto;
  preparo: Preparo;
  unidades: number;
}

export class ProdutorNoDiaDto {
  produtor: ReferenciaDto;
  unidades: number;
  salgados: SalgadoDoProdutorDto[];
}

export class DiaDeProducaoDto {
  /** AAAA-MM-DD */
  data: string;
  quantidadePedidos: number;
  unidades: number;
  produtores: ProdutorNoDiaDto[];
}

export class ProducaoPorDiaDto {
  de: string;
  ate: string;
  unidades: number;
  dias: DiaDeProducaoDto[];

  // Cópia campo a campo: a resposta não carrega nada além do contrato.
  static de(de: string, ate: string, producao: ProducaoPorDia): ProducaoPorDiaDto {
    return Object.assign(new ProducaoPorDiaDto(), {
      de,
      ate,
      unidades: producao.unidades,
      dias: producao.dias.map((dia) =>
        Object.assign(new DiaDeProducaoDto(), {
          data: dia.data,
          quantidadePedidos: dia.quantidadePedidos,
          unidades: dia.unidades,
          produtores: dia.produtores.map((carga) =>
            Object.assign(new ProdutorNoDiaDto(), {
              produtor: referencia(carga.produtor),
              unidades: carga.unidades,
              salgados: carga.salgados.map((salgado) =>
                Object.assign(new SalgadoDoProdutorDto(), {
                  produto: referencia(salgado.produto),
                  preparo: salgado.preparo,
                  unidades: salgado.unidades,
                }),
              ),
            }),
          ),
        }),
      ),
    });
  }
}

function referencia({ id, nome }: ReferenciaDto): ReferenciaDto {
  return { id, nome };
}
