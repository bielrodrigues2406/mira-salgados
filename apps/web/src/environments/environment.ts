// A API é servida pela mesma origem da aplicação: pelo proxy do servidor de
// desenvolvimento (proxy.conf.json) e pelo nginx em produção. Com isso o cookie
// de sessão (SameSite=Strict) acompanha as requisições sem configuração de CORS.
export const environment = {
  apiUrl: '/api/v1',
} as const;
