const UM_DIA_MS = 86_400_000;

/** Datas AAAA-MM-DD de `de` a `ate`, inclusive. Conta em UTC: datas de calendário não têm fuso. */
export function diasDoIntervalo(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let atual = Date.parse(de); atual <= Date.parse(ate); atual += UM_DIA_MS) {
    dias.push(new Date(atual).toISOString().slice(0, 10));
  }
  return dias;
}

export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(data) + dias * UM_DIA_MS).toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(data: string): string {
  const diaDaSemana = new Date(Date.parse(data)).getUTCDay();
  return somarDias(data, -((diaDaSemana + 6) % 7));
}

export function inicioDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`;
}

export function fimDoMes(data: string): string {
  const [ano = 0, mes = 0] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}
