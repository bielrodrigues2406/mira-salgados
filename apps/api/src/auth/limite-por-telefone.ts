import { Injectable } from '@nestjs/common';

import { LimiteExcedidoError } from '../common/errors/domain.errors.js';

/** Falhas aceitas por telefone dentro da janela antes de bloquear. */
export const FALHAS_PERMITIDAS = 10;
export const JANELA_MS = 15 * 60_000;
/** Acima disso, entradas vencidas são descartadas para o mapa não crescer sem limite. */
const LIMPEZA_ACIMA_DE = 1000;

interface Falhas {
  quantidade: number;
  expiraEm: number;
}

/**
 * Segunda barreira do login, além do limite por IP: quem troca de IP para
 * tentar senhas de um mesmo telefone é barrado pelo telefone. Fica em memória,
 * o que basta para uma instância só da API; reiniciar a API zera a contagem.
 */
@Injectable()
export class LimitePorTelefone {
  private readonly falhas = new Map<string, Falhas>();

  constructor(private readonly agora: () => number = Date.now) {}

  verificar(telefone: string): void {
    const registro = this.vigente(telefone);
    if (registro && registro.quantidade >= FALHAS_PERMITIDAS) {
      throw new LimiteExcedidoError(
        'MUITAS_TENTATIVAS',
        'Muitas tentativas para este telefone. Aguarde 15 minutos ou peça a um administrador uma nova senha.',
      );
    }
  }

  registrarFalha(telefone: string): void {
    if (this.falhas.size > LIMPEZA_ACIMA_DE) this.descartarVencidas();
    const registro = this.vigente(telefone) ?? {
      quantidade: 0,
      expiraEm: this.agora() + JANELA_MS,
    };
    registro.quantidade += 1;
    this.falhas.set(telefone, registro);
  }

  limpar(telefone: string): void {
    this.falhas.delete(telefone);
  }

  private vigente(telefone: string): Falhas | undefined {
    const registro = this.falhas.get(telefone);
    if (registro && registro.expiraEm <= this.agora()) {
      this.falhas.delete(telefone);
      return undefined;
    }
    return registro;
  }

  private descartarVencidas(): void {
    for (const [telefone, registro] of this.falhas) {
      if (registro.expiraEm <= this.agora()) this.falhas.delete(telefone);
    }
  }
}
