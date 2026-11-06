import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { Preparo } from '../../produtos/preco-produto.entity.js';
import { SaldoDoProdutorDto } from '../dto/saldos.dto.js';
import type { ResumoDosFiados } from '../fiados/fiados.service.js';
import type { Ganho, Painel } from './painel.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class EntregaDoDiaDto {
  id: string;
  numero: number;
  horario: string | null;
  tipoEntrega: TipoEntrega;
  enderecoEntrega: string | null;
  cliente: ReferenciaDto;
  unidades: number;
}

export class DiaDoPainelDto {
  data: string;
  unidades: number;
  minhasUnidades: number | null;
  meusSalgados: { produto: ReferenciaDto; preparo: Preparo; unidades: number }[] | null;
}

export class GanhoDto {
  de: string;
  ate: string;
  unidades: number;
  produzidoCentavos: number;
}

export class PainelDto {
  data: string;
  produtor: ReferenciaDto | null;
  hoje: {
    quantidadePedidos: number;
    unidades: number;
    aEntregar: EntregaDoDiaDto[];
    semPagamento: { valorCentavos: number; pedidos: number[] };
  };
  proximosDias: DiaDoPainelDto[];
  ganhos: { semana: GanhoDto; mes: GanhoDto } | null;
  saldo: SaldoDoProdutorDto | null;
  familia: {
    semana: {
      de: string;
      ate: string;
      unidades: number;
      faturamentoCentavos: number;
      caixaCentavos: number;
    };
    fiados: ResumoDosFiados;
    rascunhos: number;
  };

  // Cópia campo a campo: a resposta não carrega nada além do contrato.
  static de(painel: Painel): PainelDto {
    const { hoje, familia } = painel;
    return Object.assign(new PainelDto(), {
      data: painel.data,
      produtor: painel.produtor && referencia(painel.produtor),
      hoje: {
        quantidadePedidos: hoje.quantidadePedidos,
        unidades: hoje.unidades,
        aEntregar: hoje.aEntregar.map((entrega) =>
          Object.assign(new EntregaDoDiaDto(), {
            id: entrega.id,
            numero: entrega.numero,
            horario: entrega.horario,
            tipoEntrega: entrega.tipoEntrega,
            enderecoEntrega: entrega.enderecoEntrega,
            cliente: referencia(entrega.cliente),
            unidades: entrega.unidades,
          }),
        ),
        semPagamento: {
          valorCentavos: hoje.semPagamento.valor,
          pedidos: [...hoje.semPagamento.pedidos],
        },
      },
      proximosDias: painel.proximosDias.map((dia) =>
        Object.assign(new DiaDoPainelDto(), {
          data: dia.data,
          unidades: dia.unidades,
          minhasUnidades: dia.minhasUnidades,
          meusSalgados:
            dia.meusSalgados?.map((salgado) => ({
              produto: referencia(salgado.produto),
              preparo: salgado.preparo,
              unidades: salgado.unidades,
            })) ?? null,
        }),
      ),
      ganhos: painel.ganhos && {
        semana: ganho(painel.ganhos.semana),
        mes: ganho(painel.ganhos.mes),
      },
      saldo: painel.saldo && SaldoDoProdutorDto.de(painel.saldo),
      familia: {
        semana: {
          de: familia.semana.de,
          ate: familia.semana.ate,
          unidades: familia.semana.unidades,
          faturamentoCentavos: familia.semana.faturamento,
          caixaCentavos: familia.semana.caixa,
        },
        fiados: {
          totalEmAbertoCentavos: familia.fiados.totalEmAbertoCentavos,
          quantidadePedidos: familia.fiados.quantidadePedidos,
        },
        rascunhos: familia.rascunhos,
      },
    });
  }
}

function ganho(valor: Ganho): GanhoDto {
  return Object.assign(new GanhoDto(), {
    de: valor.de,
    ate: valor.ate,
    unidades: valor.unidades,
    produzidoCentavos: valor.produzido,
  });
}

function referencia({ id, nome }: ReferenciaDto): ReferenciaDto {
  return { id, nome };
}
