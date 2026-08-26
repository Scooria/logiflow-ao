# LogiFlow AO — Frontend (React/Vite SPA)
#
# Build multi-stage: compila os assets estáticos e serve-os com nginx.
# A app usa HashRouter (necessário para a publicação como Claude Artifact),
# por isso não é preciso nenhuma regra de rewrite no nginx — cada rota já
# é a mesma index.html com um #fragmento tratado no cliente.
#
#   docker build -t logiflow-ao-web \
#     --build-arg VITE_API_BASE_URL=https://api.o-teu-dominio.com .
#   docker run -p 8080:80 logiflow-ao-web

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=""
ARG VITE_DEMO_TENANT_ID="demo-tenant"
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DEMO_TENANT_ID=${VITE_DEMO_TENANT_ID}
RUN echo ">>> DIAGNOSTICO VITE_API_BASE_URL=[$VITE_API_BASE_URL]"
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
