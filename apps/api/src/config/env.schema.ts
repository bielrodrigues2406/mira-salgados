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

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGINS: listaDeOrigens,
  // Número de proxies confiáveis à frente da API. Define de onde o Express lê o IP
  // do cliente, usado pela limitação de taxa.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
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
