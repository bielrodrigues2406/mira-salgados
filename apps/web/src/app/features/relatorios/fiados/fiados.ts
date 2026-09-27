import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ClienteComFiado } from '../../../core/models/relatorios';
import { RelatoriosService } from '../../../core/services/relatorios.service';
import { EstadoErro } from '../../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../../shared/components/paginacao/paginacao';
import { MoedaPipe } from '../../../shared/pipes/moeda.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { dataCurta } from '../../../shared/utils/datas';
import { estadoDeRecurso } from '../../../shared/utils/estado-de-recurso';
import { contagem } from '../../../shared/utils/textos';

const TAMANHO_DA_PAGINA = 20;

/**
 * Fiados em aberto, de qualquer data: o fiado registrado de cada pedido,
 * limitado ao que ainda falta receber dele.
 */
@Component({
  selector: 'ms-fiados',
  imports: [
    EstadoErro,
    EstadoVazio,
    Icone,
    ListaEsqueleto,
    MoedaPipe,
    Paginacao,
    RouterLink,
    TelefonePipe,
  ],
  templateUrl: './fiados.html',
  styleUrl: './fiados.css',
})
export class Fiados {
  protected readonly paginaAtual = signal(1);
  protected readonly recurso = inject(RelatoriosService).fiados(() => ({
    page: this.paginaAtual(),
    pageSize: TAMANHO_DA_PAGINA,
  }));
  protected readonly resultado = computed(() =>
    this.recurso.hasValue() ? this.recurso.value() : undefined,
  );
  protected readonly estado = estadoDeRecurso(this.recurso, ({ itens }) => itens.length === 0);
  protected readonly dataCurta = dataCurta;
  protected readonly legenda = computed(() => {
    const resultado = this.resultado();
    if (!resultado) return '';
    return `${contagem(resultado.meta.total, 'cliente', 'clientes')} · ${contagem(resultado.resumo.quantidadePedidos, 'pedido', 'pedidos')}`;
  });

  protected telefoneParaLigar(fiado: ClienteComFiado): string | null {
    return fiado.cliente.telefone ? `tel:+55${fiado.cliente.telefone}` : null;
  }
}
