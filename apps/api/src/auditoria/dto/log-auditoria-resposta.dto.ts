import type { AcaoAuditoria, LogAuditoria } from '../log-auditoria.entity.js';
import type { SnapshotJson } from '../sanitizar-snapshot.js';

export class LogAuditoriaRespostaDto {
  id: string;
  entidade: string;
  entidadeId: string;
  acao: AcaoAuditoria;
  dadosAntes: SnapshotJson | null;
  dadosDepois: SnapshotJson | null;
  usuarioId: string | null;
  criadoEm: string;

  static de(log: LogAuditoria): LogAuditoriaRespostaDto {
    return Object.assign(new LogAuditoriaRespostaDto(), {
      id: log.id,
      entidade: log.entidade,
      entidadeId: log.entidadeId,
      acao: log.acao,
      dadosAntes: log.dadosAntes,
      dadosDepois: log.dadosDepois,
      usuarioId: log.usuarioId,
      criadoEm: log.criadoEm.toISOString(),
    });
  }
}
