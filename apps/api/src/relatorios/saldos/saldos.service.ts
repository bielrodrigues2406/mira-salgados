import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { type Centavos, subtrair, ZERO_CENTAVOS } from '../../common/utils/dinheiro.js';
import { Produtor } from '../../produtores/produtor.entity.js';
import { RepassesService } from '../../repasses/repasses.service.js';
import { AcertoDiarioService } from '../acerto/acerto-diario.service.js';

export interface SaldoDoProdutor {
  produtor: { id: string; nome: string; ativo: boolean };
  /** Valor dos salgados que fez, com a parte dos descontos, até a data. */
  aReceber: Centavos;
  /** Soma dos repasses que não foram desfeitos. */
  recebido: Centavos;
  /** aReceber - recebido; negativo quando recebeu adiantado. */
  falta: Centavos;
}

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Quanto cada produtor tem a receber e quanto já recebeu, acumulado desde o
 * começo (ADR 0017). Não há divisão do caixa: o saldo só diminui com repasses,
 * registrados quando a família quiser.
 */
@Injectable()
export class SaldosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly acerto: AcertoDiarioService,
    private readonly repasses: RepassesService,
  ) {}

  async ate(data: string): Promise<SaldoDoProdutor[]> {
    const [produtores, produzido, recebido] = await Promise.all([
      this.dataSource.getRepository(Produtor).find(),
      this.acerto.produzidoAte(data),
      this.repasses.recebidoPorProdutor(),
    ]);
    const produzidoPorId = new Map(produzido.map((parte) => [parte.produtor.id, parte]));
    return produtores
      .map((produtor) => {
        const aReceber = produzidoPorId.get(produtor.id)?.valorProduzido ?? ZERO_CENTAVOS;
        const pago = recebido.get(produtor.id) ?? ZERO_CENTAVOS;
        return {
          produtor: { id: produtor.id, nome: produtor.nome, ativo: produtor.ativo },
          aReceber,
          recebido: pago,
          falta: subtrair(aReceber, pago),
        };
      })
      .filter((saldo) => saldo.produtor.ativo || saldo.aReceber > 0 || saldo.recebido > 0)
      .sort(
        (a, b) =>
          Number(b.produtor.ativo) - Number(a.produtor.ativo) ||
          ordemAlfabetica.compare(a.produtor.nome, b.produtor.nome),
      );
  }

  async doProdutor(produtorId: string, data: string): Promise<SaldoDoProdutor | null> {
    return (await this.ate(data)).find((saldo) => saldo.produtor.id === produtorId) ?? null;
  }
}
