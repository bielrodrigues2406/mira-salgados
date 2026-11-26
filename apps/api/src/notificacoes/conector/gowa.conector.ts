import type { EstadoConexaoNotificacao, ModoConectorNotificacao } from '../dominio/enums.js';
import type {
  ConectorWhatsApp,
  GrupoWhatsApp,
  ResultadoEnvioConector,
  ResultadoPareamento,
} from './conector-whatsapp.js';

const TIMEOUT_ENVIO_MS = 15_000;
const TIMEOUT_CONSULTA_MS = 10_000;
const LIMITE_QR_BYTES = 256 * 1024;
const ORDEM_PT_BR = new Intl.Collator('pt-BR', { sensitivity: 'base' });

export interface OpcoesGowaConector {
  baseUrl: string;
  /** Credencial Basic Auth ("usuario:senha") ou Bearer token. */
  token: string;
  /** Opcional em deployments multi-dispositivo GoWA (`X-Device-Id`). */
  deviceId?: string;
  timeoutEnvioMs?: number;
  timeoutConsultaMs?: number;
}

interface EnvelopeGowa<T = Record<string, unknown>> {
  code?: string;
  message?: string;
  results?: T;
}

function erroDeDesconexao(mensagem: string): boolean {
  return /(not\s+logged\s+in|not\s+connected|disconnected|logged\s+out|device\s+not\s+found|session\s+closed)/i.test(
    mensagem,
  );
}

function normalizarTelefoneBrasil(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return null;
  if ((digitos.length === 10 || digitos.length === 11) && !digitos.startsWith('55')) {
    return `55${digitos}`;
  }
  return digitos;
}

function ehErroDeTimeout(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  return erro.name === 'TimeoutError' || erro.name === 'AbortError';
}

/**
 * Resolve a URL do QR devolvida pelo GoWA garantindo proteção contra SSRF:
 * - Caminhos relativos (`/statics/...`) e URLs cujo host seja `localhost`,
 *   `127.0.0.1`, `0.0.0.0` ou o mesmo origin de `baseUrl` são apontados para o
 *   origin confiável configurado em `baseUrl`.
 * - Qualquer host externo desconhecido é recusado.
 */
export function resolverUrlInternaGowa(baseUrl: string, destinoBruto: string): string | null {
  const base = new URL(baseUrl);
  let alvo: URL;
  try {
    alvo = new URL(destinoBruto, base);
  } catch {
    return null;
  }
  if (alvo.protocol !== 'http:' && alvo.protocol !== 'https:') return null;

  const hostsLocais = new Set(['localhost', '127.0.0.1', '0.0.0.0', base.hostname]);
  if (!hostsLocais.has(alvo.hostname)) return null;

  const resolvido = new URL(alvo.pathname + alvo.search, base.origin);
  return resolvido.toString();
}

/**
 * Adaptador real para GoWA (`aldinokemal/go-whatsapp-web-multidevice` v9.x)
 * sobre a rede interna Docker, sem expor o gateway publicamente (ADR 0019).
 */
export class GowaConector implements ConectorWhatsApp {
  readonly modo: ModoConectorNotificacao = 'GOWA';

  private readonly baseUrl: string;
  private readonly cabecalhoAuth: string;
  private readonly deviceId?: string;
  private readonly timeoutEnvioMs: number;
  private readonly timeoutConsultaMs: number;

  constructor(opcoes: OpcoesGowaConector) {
    this.baseUrl = opcoes.baseUrl.replace(/\/+$/, '');
    this.cabecalhoAuth = opcoes.token.includes(':')
      ? `Basic ${Buffer.from(opcoes.token, 'utf8').toString('base64')}`
      : `Bearer ${opcoes.token}`;
    this.deviceId = opcoes.deviceId;
    this.timeoutEnvioMs = opcoes.timeoutEnvioMs ?? TIMEOUT_ENVIO_MS;
    this.timeoutConsultaMs = opcoes.timeoutConsultaMs ?? TIMEOUT_CONSULTA_MS;
  }

  async enviarTexto(
    destinoExterno: string,
    texto: string,
    _chaveDeduplicacao: string,
  ): Promise<ResultadoEnvioConector> {
    let resposta: Response;
    try {
      resposta = await fetch(`${this.baseUrl}/send/message`, {
        method: 'POST',
        headers: this.cabecalhos({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          phone: destinoExterno,
          message: texto,
        }),
        signal: AbortSignal.timeout(this.timeoutEnvioMs),
      });
    } catch (erro) {
      if (ehErroDeTimeout(erro)) {
        return {
          tipo: 'INCERTO',
          mensagem:
            'Tempo limite atingido aguardando resposta do GoWA. Verifique no grupo antes de reenviar.',
        };
      }
      return {
        tipo: 'FALHA_TRANSITORIA',
        mensagem: erro instanceof Error ? erro.message : 'Falha de rede ao falar com o GoWA.',
      };
    }

    const corpo = await this.lerJson<{ message_id?: string }>(resposta);
    const detalhe = corpo?.message ?? `HTTP ${String(resposta.status)} do GoWA.`;

    if (resposta.ok) {
      const idExterno = corpo?.results?.message_id;
      if (typeof idExterno === 'string' && idExterno.length > 0) {
        return { tipo: 'ACEITO', idExterno };
      }
      return {
        tipo: 'INCERTO',
        mensagem: 'GoWA respondeu sucesso sem message_id. Confirme no grupo antes de reenviar.',
      };
    }

    if (resposta.status === 401 || resposta.status === 403 || erroDeDesconexao(detalhe)) {
      return { tipo: 'DESCONECTADO', mensagem: detalhe };
    }
    if (resposta.status === 400 || resposta.status === 404 || resposta.status === 422) {
      return { tipo: 'FALHA_PERMANENTE', mensagem: detalhe };
    }
    return { tipo: 'FALHA_TRANSITORIA', mensagem: detalhe };
  }

  async obterEstado(): Promise<{ estado: EstadoConexaoNotificacao; detalhe?: string }> {
    let resposta: Response;
    try {
      resposta = await fetch(`${this.baseUrl}/app/status`, {
        method: 'GET',
        headers: this.cabecalhos(),
        signal: AbortSignal.timeout(this.timeoutConsultaMs),
      });
    } catch (erro) {
      return {
        estado: 'DESCONECTADO',
        detalhe: erro instanceof Error ? erro.message : 'GoWA inacessível na rede interna.',
      };
    }

    const corpo = await this.lerJson<{
      is_connected?: boolean;
      is_logged_in?: boolean;
      jid?: string;
    }>(resposta);

    if (!resposta.ok) {
      return {
        estado: 'DESCONECTADO',
        detalhe: corpo?.message ?? `Falha ao consultar GoWA (HTTP ${String(resposta.status)}).`,
      };
    }

    const conectado = corpo?.results?.is_connected === true && corpo.results.is_logged_in === true;
    if (conectado) {
      return {
        estado: 'CONECTADO',
        detalhe: 'WhatsApp conectado via GoWA.',
      };
    }
    return {
      estado: 'DESCONECTADO',
      detalhe: 'WhatsApp não pareado ou desconectado no GoWA.',
    };
  }

  async listarGrupos(): Promise<readonly GrupoWhatsApp[]> {
    const resposta = await fetch(`${this.baseUrl}/user/my/groups`, {
      method: 'GET',
      headers: this.cabecalhos(),
      signal: AbortSignal.timeout(this.timeoutConsultaMs),
    });

    const corpo = await this.lerJson<{
      data?: { JID?: string; Name?: string; jid?: string; name?: string }[];
    }>(resposta);

    if (!resposta.ok) {
      throw new Error(
        corpo?.message ??
          `Não foi possível listar grupos no GoWA (HTTP ${String(resposta.status)}).`,
      );
    }

    const lista = corpo?.results?.data ?? [];
    const unicos = new Map<string, GrupoWhatsApp>();
    for (const item of lista) {
      const id = (item.JID ?? item.jid ?? '').trim();
      const nome = (item.Name ?? item.name ?? '').trim();
      if (!id) continue;
      unicos.set(id, { id, nome: nome || id });
    }
    return [...unicos.values()].sort((a, b) => ORDEM_PT_BR.compare(a.nome, b.nome));
  }

  async iniciarPareamento(
    metodo: 'QR' | 'CODIGO',
    telefone?: string,
  ): Promise<ResultadoPareamento> {
    if (metodo === 'CODIGO') {
      const normalizado = telefone ? normalizarTelefoneBrasil(telefone) : null;
      if (!normalizado) {
        throw new Error('Informe o número de celular do chip com DDD (ex.: 11987654321).');
      }
      const url = `${this.baseUrl}/app/login-with-code?phone=${encodeURIComponent(normalizado)}`;
      const resposta = await fetch(url, {
        method: 'GET',
        headers: this.cabecalhos(),
        signal: AbortSignal.timeout(this.timeoutConsultaMs),
      });
      const corpo = await this.lerJson<{ pair_code?: string }>(resposta);
      if (!resposta.ok) {
        throw new Error(
          corpo?.message ??
            `Não foi possível gerar código de pareamento (HTTP ${String(resposta.status)}).`,
        );
      }
      const codigo = corpo?.results?.pair_code?.trim();
      if (!codigo) {
        throw new Error('GoWA não retornou código de pareamento.');
      }
      return {
        codigo,
        mensagem:
          'No WhatsApp do chip dedicado, abra Aparelhos conectados > Conectar com número de telefone e digite o código.',
      };
    }

    const resposta = await fetch(`${this.baseUrl}/app/login`, {
      method: 'GET',
      headers: this.cabecalhos(),
      signal: AbortSignal.timeout(this.timeoutConsultaMs),
    });
    const corpo = await this.lerJson<{ qr_link?: string; qr_duration?: number }>(resposta);
    if (!resposta.ok) {
      throw new Error(
        corpo?.message ??
          `Não foi possível gerar QR Code no GoWA (HTTP ${String(resposta.status)}).`,
      );
    }

    const link = corpo?.results?.qr_link;
    if (!link) {
      throw new Error(
        corpo?.message ?? 'GoWA não retornou QR Code (o aparelho já pode estar conectado).',
      );
    }

    const qrCode = await this.baixarQrComoDataUri(link);
    return {
      qrCode,
      mensagem:
        'No WhatsApp do chip dedicado, abra Aparelhos conectados > Conectar aparelho e escaneie o QR Code.',
    };
  }

  private async baixarQrComoDataUri(qrLink: string): Promise<string> {
    const urlSegura = resolverUrlInternaGowa(this.baseUrl, qrLink);
    if (!urlSegura) {
      throw new Error('URL de QR Code devolvida pelo GoWA fora da origem permitida.');
    }

    const resposta = await fetch(urlSegura, {
      method: 'GET',
      headers: this.cabecalhos(),
      signal: AbortSignal.timeout(this.timeoutConsultaMs),
    });
    if (!resposta.ok) {
      throw new Error(`Falha ao carregar imagem do QR Code (HTTP ${String(resposta.status)}).`);
    }

    const tipo = (resposta.headers.get('content-type') ?? 'image/png').split(';')[0]?.trim();
    if (!tipo?.startsWith('image/')) {
      throw new Error('Resposta de QR Code do GoWA não é uma imagem válida.');
    }

    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LIMITE_QR_BYTES) {
      throw new Error('Imagem de QR Code fora do tamanho esperado.');
    }
    return `data:${tipo};base64,${bytes.toString('base64')}`;
  }

  private cabecalhos(extras: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      authorization: this.cabecalhoAuth,
      accept: 'application/json',
      ...extras,
    };
    if (this.deviceId) {
      headers['x-device-id'] = this.deviceId;
    }
    return headers;
  }

  private async lerJson<T>(resposta: Response): Promise<EnvelopeGowa<T> | null> {
    try {
      return (await resposta.json()) as EnvelopeGowa<T>;
    } catch {
      return null;
    }
  }
}
