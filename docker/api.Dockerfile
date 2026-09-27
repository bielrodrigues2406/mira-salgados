# syntax=docker/dockerfile:1

# Atrás de proxy com inspeção TLS, informe a CA do proxy só durante a instalação,
# sem desligar a verificação: docker build --secret id=npm_ca,src=<ca.pem> ...
#
# --ignore-scripts: nenhum script de instalação é necessário na imagem (argon2 e
# esbuild trazem binários prontos) e o prepare da raiz depende do husky.

# Imagem de produção da API. Construída a partir da raiz do repositório:
#   docker build -f docker/api.Dockerfile .

FROM node:24.21.0-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM base AS build
RUN --mount=type=secret,id=npm_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci --workspace @mira/api --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace @mira/api

FROM base AS production-dependencies
RUN --mount=type=secret,id=npm_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci --workspace @mira/api --omit=dev --ignore-scripts

FROM node:24.21.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app /app
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
# Sem privilégios de root em tempo de execução.
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
