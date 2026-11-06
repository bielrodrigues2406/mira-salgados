import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { fimDoMes, inicioDaSemana, inicioDoMes, somarDias } from '../../common/utils/datas.js';
import { Pedido } from '../../pedidos/pedido.entity.js';
import { Usuario } from '../../usuarios/usuario.entity.js';
import { AcertoDiarioService } from '../acerto/acerto-diario.service.js';
import { FiadosService } from '../fiados/fiados.service.js';
import { ProducaoDoDiaService } from '../producao/producao-do-dia.service.js';
import { SaldosService } from '../saldos/saldos.service.js';
import { montarPainel, type Painel } from './painel.js';

/** Hoje e os seis dias seguintes. */
export const DIAS_A_FRENTE = 6;

@Injectable()
export class PainelService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly producao: ProducaoDoDiaService,
    private readonly acerto: AcertoDiarioService,
    private readonly fiados: FiadosService,
    private readonly saldos: SaldosService,
  ) {}

  /**
   * Resumo para a tela inicial de quem entrou. A data vem do aparelho: é o
   * "hoje" de quem está olhando, sem depender do fuso do servidor.
   */
  async doUsuario(usuarioId: string, data: string): Promise<Painel> {
    const usuario = await this.dataSource
      .getRepository(Usuario)
      .findOne({ where: { id: usuarioId }, relations: { produtor: true } });
    const produtor = usuario?.produtor
      ? { id: usuario.produtor.id, nome: usuario.produtor.nome }
      : null;

    const ateProximos = somarDias(data, DIAS_A_FRENTE);
    const semana = { de: inicioDaSemana(data), ate: somarDias(inicioDaSemana(data), 6) };
    const mes = { de: inicioDoMes(data), ate: fimDoMes(data) };
    // Uma consulta de acerto cobre a semana e o mês, mesmo quando a semana atravessa a virada.
    const de = semana.de < mes.de ? semana.de : mes.de;
    const ate = semana.ate > mes.ate ? semana.ate : mes.ate;

    const [hoje, proximos, acertos, fiados, rascunhos, saldo] = await Promise.all([
      this.producao.doDia(data),
      this.producao.porDia(data, ateProximos),
      this.acerto.porDia(de, ate),
      this.fiados.resumo(),
      this.dataSource
        .getRepository(Pedido)
        .createQueryBuilder('pedido')
        .where("pedido.status = 'RASCUNHO'")
        .andWhere('pedido.dataEntrega BETWEEN :data AND :ateProximos', { data, ateProximos })
        .getCount(),
      produtor ? this.saldos.doProdutor(produtor.id, data) : Promise.resolve(null),
    ]);

    return montarPainel({
      data,
      produtor,
      semana,
      mes,
      hoje,
      proximos,
      acertos,
      fiados,
      rascunhos,
      saldo,
    });
  }
}
