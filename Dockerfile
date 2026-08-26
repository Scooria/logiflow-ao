# LogiFlow AO — Backend (Passo 2: API Node/Express + Prisma)
#
# Build multi-stage: instala dependências, gera o Prisma Client, compila
# TypeScript, e a imagem final só leva o runtime + dist/ (imagem mais leve
# e sem ferramentas de build).
#
#   docker build -t logiflow-ao-api .
#   docker run --env-file .env -p 3000:3000 logiflow-ao-api
#
# NOTA: `npx prisma generate` precisa de acesso normal à internet (para
# descarregar o motor Prisma de binaries.prisma.sh) — funciona em qualquer
# ambiente de build normal (Render, Railway, GitHub Actions, a tua
# máquina), mas está bloqueado no sandbox onde este projeto foi
# desenvolvido — ver prisma.config.ts.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
# NOTA TEMPORÁRIA (arranque único): `npm ci` completo (não `--omit=dev`)
# para ter `ts-node`/`typescript` disponíveis e correr `prisma db push` +
# `prisma db seed` no arranque, contra uma base de dados Postgres vazia.
# Depois de confirmado que a base de dados já tem as tabelas e os dados de
# demonstração, isto deve reverter para `npm ci --omit=dev` + `CMD ["node",
# "dist/server.js"]` (ver histórico do git) para manter a imagem de produção
# leve e não voltar a semear a cada arranque.
RUN npm ci
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && (npx prisma db seed || true); node dist/server.js"]
