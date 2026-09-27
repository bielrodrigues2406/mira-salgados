import { type Resource, type ResourceStatus, signal } from '@angular/core';

import { estadoDeRecurso } from './estado-de-recurso';

function recursoFalso(status: ResourceStatus, valor?: number[]): Resource<number[] | undefined> {
  return {
    status: signal(status),
    value: signal(valor),
    hasValue: () => valor !== undefined,
  } as unknown as Resource<number[] | undefined>;
}

function estado(status: ResourceStatus, valor?: number[]) {
  return estadoDeRecurso(recursoFalso(status, valor), (lista) => lista.length === 0)();
}

describe('estadoDeRecurso', () => {
  it('mostra carregamento antes da primeira resposta', () => {
    expect(estado('idle')).toBe('carregando');
    expect(estado('loading')).toBe('carregando');
  });

  it('distingue erro, vazio e lista', () => {
    expect(estado('error')).toBe('erro');
    expect(estado('resolved', [])).toBe('vazio');
    expect(estado('resolved', [1])).toBe('pronto');
    expect(estado('local', [1])).toBe('pronto');
  });

  it('mantém a lista durante a recarga e indica nova tentativa sem dados', () => {
    expect(estado('reloading', [1])).toBe('pronto');
    expect(estado('reloading')).toBe('tentando');
  });
});
