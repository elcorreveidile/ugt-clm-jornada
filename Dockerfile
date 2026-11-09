# Imagen de producción del registro de jornada (web + API en un solo servicio).
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN corepack enable && apk add --no-cache tini
# Se copian las dependencias completas: el servidor se ejecuta con tsx y Prisma
# necesita su CLI para aplicar el esquema al arrancar.
COPY --from=build /app /app
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/sbin/tini", "--", "sh", "deploy/entrypoint.sh"]
