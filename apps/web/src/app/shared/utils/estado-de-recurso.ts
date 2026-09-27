import { computed, type Resource, type Signal } from '@angular/core';

/**
 * Situação de uma coleção carregada por resource, na ordem em que a tela a
 * trata: esqueleto no primeiro carregamento, erro com nova tentativa, vazio e
 * lista. Uma recarga com dados na tela mantém a lista visível.
 */
export type EstadoDeRecurso = 'carregando' | 'tentando' | 'erro' | 'vazio' | 'pronto';

export function estadoDeRecurso<T>(
  recurso: Resource<T | undefined>,
  estaVazio: (valor: T) => boolean,
): Signal<EstadoDeRecurso> {
  return computed(() => {
    switch (recurso.status()) {
      case 'error':
        return 'erro';
      case 'idle':
      case 'loading':
        return 'carregando';
      case 'reloading':
        return recurso.hasValue() ? 'pronto' : 'tentando';
      case 'resolved':
      case 'local': {
        const valor = recurso.value();
        return valor === undefined || estaVazio(valor) ? 'vazio' : 'pronto';
      }
    }
  });
}
