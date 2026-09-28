import type { LogLegivel } from '../auditoria.service.js';
import type { AcaoAuditoria } from '../log-auditoria.entity.js';
import type { SnapshotJson } from '../sanitizar-snapshot.js';

export class LogAuditoriaRespostaDto {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  dadosAntes: SnapshotJson | null;
  dadosDepois: SnapshotJson | null;
  usuarioId: string | null;
  /** Quem fez; null nas operações sem autor, como a criação do primeiro administrador. */
  autor: { id: string; nome: string } | null;
  /** Nome legível de cada id citado: o da entidade e os campos de relação. */
  referencias: Record<string, string>;
  criadoEm: string;

  static de({ log, autor, referencias }: LogLegivel): LogAuditoriaRespostaDto {
    return Object.assign(new LogAuditoriaRespostaDto(), {
      id: log.id,
      entidade: log.entidade,
      entidadeId: log.entidadeId,
      acao: log.acao,
      dadosAntes: log.dadosAntes,
      dadosDepois: log.dadosDepois,
      usuarioId: log.usuarioId,
      autor: autor && { id: autor.id, nome: autor.nome },
      referencias: { ...referencias },
      criadoEm: log.criadoEm.toISOString(),
    });
  }
}
