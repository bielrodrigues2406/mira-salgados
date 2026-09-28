import { z } from 'zod';

const listaDeOrigens = z
  .string()
  .min(1)
  .transform((valor) =>
    valor
      .split(',')
      .map((origem) => origem.trim())
      .filter((origem) => origem.length > 0),
  )
  // Cada origem precisa ser uma URL completa. Curinga ("*") nunca é aceito: com
  // credentials habilitado o navegador o rejeitaria, e liberá-lo em produção
  // exporia a API a qualquer site.
  .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1));

export const envObjectSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGINS: listaDeOrigens,
  // Número de proxies confiáveis à frente da API. Define de onde o Express lê o IP
  // do cliente, usado pela limitação de taxa.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  // Sem valor padrão: a API não sobe sem um segredo explícito. 32 caracteres é o
  // mínimo para HS256 (256 bits); gere com `openssl rand -base64 48`.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(300).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(14),
  COOKIE_SECURE: z.stringbool().default(true),
});

/** Origem local, que os navegadores tratam como segura mesmo em http. */
const ORIGEM_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
/** Um segredo gerado de verdade tem muitos caracteres diferentes; "aaaa..." ou "123123..." não. */
const CARACTERES_DISTINTOS_MINIMOS = 16;

// Regras que só valem em produção: em desenvolvimento e nos testes, http e
// segredos simples são aceitos para não atrapalhar.
export const envSchema = envObjectSchema.superRefine((env, contexto) => {
  if (env.NODE_ENV !== 'production') return;
  if (!env.COOKIE_SECURE) {
    contexto.addIssue({
      code: 'custom',
      path: ['COOKIE_SECURE'],
      message: 'Em produção o cookie de sessão precisa ser Secure.',
    });
  }
  const inseguras = env.CORS_ORIGINS.filter(
    (origem) => !origem.startsWith('https://') && !ORIGEM_LOCAL.test(origem),
  );
  if (inseguras.length > 0) {
    contexto.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message:
        'Em produção as origens precisam ser https:// (ou localhost, para testar na máquina).',
    });
  }
  if (new Set(env.JWT_ACCESS_SECRET).size < CARACTERES_DISTINTOS_MINIMOS) {
    contexto.addIssue({
      code: 'custom',
      path: ['JWT_ACCESS_SECRET'],
      message: 'Segredo fraco para produção: gere um com `openssl rand -base64 48`.',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(raw);
  if (!resultado.success) {
    // A mensagem cita apenas nomes de variáveis e regras violadas, nunca valores.
    throw new Error(`Configuração de ambiente inválida:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
