import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ConsultaAlteracoes, RegistroDeAlteracao } from '../../core/models/auditoria';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { EstadoErro } from '../../shared/components/estado-erro/estado-erro';
import { EstadoVazio } from '../../shared/components/estado-vazio/estado-vazio';
import { Icone } from '../../shared/components/icone/icone';
import { ListaEsqueleto } from '../../shared/components/lista-esqueleto/lista-esqueleto';
import { Paginacao } from '../../shared/components/paginacao/paginacao';
import {
  dataCurta,
  dataDoCalendario,
  deTextoDeData,
  hoje,
  paraTextoDeData,
  somarDias,
} from '../../shared/utils/datas';
import { estadoDeRecurso } from '../../shared/utils/estado-de-recurso';
import { AREAS, iconeDaAcao, mudancas, pedidoDoRegistro, titulo } from './descrever';

const TAMANHO_DA_PAGINA = 30;
const LIMITE_DE_CONTAS = 100;

interface DiaDeAlteracoes {
  data: string;
  rotulo: string;
  registros: RegistroDeAlteracao[];
}

function hora(iso: string): string {
  const data = new Date(iso);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/**
 * Histórico de alterações, só para administradores: o que foi criado,
 * mudado ou removido, por quem e quando, campo a campo e com os nomes em vez
 * dos códigos internos.
 */
@Component({
  selector: 'ms-alteracoes',
  imports: [EstadoErro, EstadoVazio, Icone, ListaEsqueleto, Paginacao, RouterLink],
  templateUrl: './alteracoes.html',
  styleUrl: './alteracoes.css',
})
export class Alteracoes {
  protected readonly areas = AREAS;
  protected readonly hoje = hoje();

  protected readonly area = signal('');
  protected readonly autor = signal('');
  protected readonly de = signal('');
  protected readonly ate = signal('');
  protected readonly pagina = signal(1);

  protected readonly contas = inject(UsuariosService).listar(() => ({
    page: 1,
    pageSize: LIMITE_DE_CONTAS,
  }));
  protected readonly pessoas = computed(() =>
    this.contas.hasValue() ? this.contas.value().itens : [],
  );

  private readonly consulta = computed((): ConsultaAlteracoes => {
    const de = dataDoCalendario(this.de());
    const ate = dataDoCalendario(this.ate());
    return {
      page: this.pagina(),
      pageSize: TAMANHO_DA_PAGINA,
      entidade: this.area() || undefined,
      usuarioId: this.autor() || undefined,
      // Dias do aparelho viram instantes: meia-noite do início até a meia-noite seguinte ao fim.
      de: de ? deTextoDeData(de).toISOString() : undefined,
      ate: ate ? deTextoDeData(somarDias(ate, 1)).toISOString() : undefined,
    };
  });
  protected readonly registros = inject(AuditoriaService).listar(() => this.consulta());
  protected readonly estado = estadoDeRecurso(this.registros, ({ itens }) => itens.length === 0);
  protected readonly meta = computed(() =>
    this.registros.hasValue() ? this.registros.value().meta : undefined,
  );
  protected readonly filtrando = computed(
    () => this.area() !== '' || this.autor() !== '' || this.de() !== '' || this.ate() !== '',
  );

  protected readonly dias = computed((): DiaDeAlteracoes[] => {
    const itens = this.registros.hasValue() ? this.registros.value().itens : [];
    const ontem = somarDias(this.hoje, -1);
    const grupos = new Map<string, RegistroDeAlteracao[]>();
    for (const registro of itens) {
      const data = paraTextoDeData(new Date(registro.criadoEm));
      grupos.set(data, [...(grupos.get(data) ?? []), registro]);
    }
    return [...grupos].map(([data, registros]) => ({
      data,
      rotulo: data === this.hoje ? 'Hoje' : data === ontem ? 'Ontem' : dataCurta(data),
      registros,
    }));
  });

  /** Registros com a lista de campos aberta. */
  protected readonly abertos = signal<ReadonlySet<string>>(new Set());

  protected readonly titulo = titulo;
  protected readonly mudancas = mudancas;
  protected readonly icone = iconeDaAcao;
  protected readonly pedidoDoRegistro = pedidoDoRegistro;
  protected readonly hora = hora;

  protected filtrar(campo: 'area' | 'autor' | 'de' | 'ate', valor: string): void {
    this[campo].set(valor);
    this.pagina.set(1);
  }

  protected limparFiltros(): void {
    this.area.set('');
    this.autor.set('');
    this.de.set('');
    this.ate.set('');
    this.pagina.set(1);
  }

  protected alternar(id: string): void {
    this.abertos.update((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });
  }

  /** Alterações mostram os campos direto; criações e remoções, ao abrir. */
  protected detalhesVisiveis(registro: RegistroDeAlteracao): boolean {
    return (
      (registro.dadosAntes !== null && registro.dadosDepois !== null) ||
      this.abertos().has(registro.id)
    );
  }
}
