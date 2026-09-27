# syntax=docker/dockerfile:1

# Atrás de proxy com inspeção TLS, informe a CA do proxy só durante a instalação,
# sem desligar a verificação: docker build --secret id=npm_ca,src=<ca.pem> ...
#
# --ignore-scripts: nenhum script de instalação é necessário na imagem (argon2 e
# esbuild trazem binários prontos) e o prepare da raiz depende do husky.

# Imagem de produção da aplicação web: build do Angular servido pelo nginx, que
# também encaminha /api para o serviço da API. Construída a partir da raiz:
#   docker build -f docker/web.Dockerfile .

FROM node:24.21.0-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=npm_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci --workspace @mira/web --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build --workspace @mira/web

FROM nginx:1.30.5-alpine AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
