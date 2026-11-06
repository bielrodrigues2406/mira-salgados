import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DiaDoPainel } from '../../core/models/painel';
import type { SalgadoDoProdutor } from '../../core/models/producao';
import { AuthService } from '../../core/services/auth.service';
import { PainelService } from '../../core/services/painel.service';
import { APARENCIA_DO_PREPARO } from '../../shared/components/chip-preparo/chip-preparo';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { MoedaPipe } from '../../shared/pipes/moeda.pipe';
import { dataCurta, dataPorExtenso, hoje } from '../../shared/utils/datas';
import { contagem, listaDePedidos, numero } from '../../shared/utils/textos';

/** Saudação pela hora do aparelho. */
export function saudacao(agora: Date = new Date()): string {
  const hora = agora.getHours();
  if (hora < 12) return 'Bom dia';
  return hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/**
 * Tela inicial. Para quem produz: o que fazer hoje e nos próximos dias e os
 * ganhos. Para todos: as entregas de hoje, o que precisa de atenção e a
 * semana da família. Novo pedido fica à mão, porque é o que mais se faz.
 */
@Component({
  selector: 'ms-inicio',
  imports: [EstadoErro, Icone, ListaEsqueleto, MoedaPipe, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly auth = inject(AuthService);

  protected readonly hoje = hoje();
  protected readonly dataDeHoje = dataPorExtenso(this.hoje);
  protected readonly saudacao = computed(() => {
    const primeiroNome = this.auth.usuario()?.nome.split(' ')[0] ?? '';
    return primeiroNome ? `${saudacao()}, ${primeiroNome}` : saudacao();
  });
  protected readonly painel = inject(PainelService).doDia(() => this.hoje);
  protected readonly dados = computed(() =>
    this.painel.hasValue() ? this.painel.value() : undefined,
  );
  protected readonly produz = computed(() => Boolean(this.dados()?.produtor));
  protected readonly diaDeHoje = computed(() => this.dados()?.proximosDias[0]);
  protected readonly proximos = computed(() => this.dados()?.proximosDias.slice(1) ?? []);
  /** Base das barras: o dia mais cheio dos próximos. */
  private readonly maiorDia = computed(() =>
    Math.max(1, ...this.proximos().map((dia) => this.unidadesDoDia(dia))),
  );

  protected readonly numero = numero;
  protected readonly contagem = contagem;
  protected readonly dataCurta = dataCurta;
  protected readonly listaDePedidos = listaDePedidos;

  protected unidadesDoDia(dia: DiaDoPainel): number {
    return dia.minhasUnidades ?? dia.unidades;
  }

  protected larguraDaBarra(dia: DiaDoPainel): string {
    return `${String(Math.round((this.unidadesDoDia(dia) / this.maiorDia()) * 100))}%`;
  }

  protected nomeDoSalgado(salgado: SalgadoDoProdutor): string {
    return salgado.preparo === 'FRITO'
      ? salgado.produto.nome
      : `${salgado.produto.nome} (${APARENCIA_DO_PREPARO[salgado.preparo].rotulo.toLowerCase()})`;
  }
}
