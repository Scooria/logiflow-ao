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

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev
ENV NODE_ENV=production
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
