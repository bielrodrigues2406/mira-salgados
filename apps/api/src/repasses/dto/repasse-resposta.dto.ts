import type { FormaRepasse, Repasse } from '../repasse.entity.js';

interface ReferenciaDto {
  id: string;
  nome: string;
}

export class RepasseRespostaDto {
  id: string;
  produtor: ReferenciaDto;
  valorCentavos: number;
  forma: FormaRepasse;
  data: string;
  observacao: string | null;
  registradoPor: ReferenciaDto;
  criadoEm: Date;
  desfeitoEm: Date | null;
  desfeitoPor: ReferenciaDto | null;

  static de(repasse: Repasse): RepasseRespostaDto {
    const { produtor, registradoPor, desfeitoPor } = repasse;
    if (!produtor || !registradoPor) throw new Error('Repasse sem produtor ou autor carregado.');
    return Object.assign(new RepasseRespostaDto(), {
      id: repasse.id,
      produtor: { id: produtor.id, nome: produtor.nome },
      valorCentavos: repasse.valor,
      forma: repasse.forma,
      data: repasse.data,
      observacao: repasse.observacao,
      registradoPor: { id: registradoPor.id, nome: registradoPor.nome },
      criadoEm: repasse.criadoEm,
      desfeitoEm: repasse.desfeitoEm,
      desfeitoPor: desfeitoPor ? { id: desfeitoPor.id, nome: desfeitoPor.nome } : null,
    });
  }
}
