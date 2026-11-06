import type { SaldoDoProdutor } from '../saldos/saldos.service.js';

export class SaldoDoProdutorDto {
  produtor: { id: string; nome: string; ativo: boolean };
  aReceberCentavos: number;
  recebidoCentavos: number;
  faltaCentavos: number;

  static de(saldo: SaldoDoProdutor): SaldoDoProdutorDto {
    return Object.assign(new SaldoDoProdutorDto(), {
      produtor: { id: saldo.produtor.id, nome: saldo.produtor.nome, ativo: saldo.produtor.ativo },
      aReceberCentavos: saldo.aReceber,
      recebidoCentavos: saldo.recebido,
      faltaCentavos: saldo.falta,
    });
  }
}

export class SaldosDto {
  data: string;
  produtores: SaldoDoProdutorDto[];
  totais: { aReceberCentavos: number; recebidoCentavos: number; faltaCentavos: number };

  static de(data: string, saldos: SaldoDoProdutor[]): SaldosDto {
    const soma = (campo: 'aReceber' | 'recebido' | 'falta'): number =>
      saldos.reduce((total, saldo) => total + saldo[campo], 0);
    return Object.assign(new SaldosDto(), {
      data,
      produtores: saldos.map((saldo) => SaldoDoProdutorDto.de(saldo)),
      totais: {
        aReceberCentavos: soma('aReceber'),
        recebidoCentavos: soma('recebido'),
        faltaCentavos: soma('falta'),
      },
    });
  }
}
