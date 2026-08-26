# Guia de Deployment — LogiFlow AO

Este documento cobre como publicar o backend (API + Postgres) e o frontend
em infraestrutura real, e o que falta para que cada integração de
pagamentos deixe de ser uma simulação.

## 0. Dois builds do frontend — qual usar quando

`web/` tem dois scripts de build:

- `npm run build` — build normal, com code-splitting por rota (cada página
  carrega o seu próprio ficheiro JS só quando é visitada). É o que os
  `Dockerfile`/`docker-compose.yml`/`render.yaml` abaixo usam — o ideal para
  qualquer hosting real, porque reduz o JS inicial carregado.
- `npm run build:artifact` — build de ficheiro único (`vite.artifact.config.ts`,
  `codeSplitting: false`), usado apenas para publicar como Claude Artifact
  (uma página estática sem servidor a responder a `/assets/*.js` — os
  `import()` dinâmicos do code-splitting fariam 404 nesse contexto).

Se fores mexer no frontend e quiseres testar o build de Artifact localmente,
usa `npm run build:artifact` e serve `dist-artifact/` — não `npm run build`.

## 1. Local, com Docker

A forma mais rápida de correr a stack completa (Postgres + API + frontend)
numa máquina normal (não neste sandbox — ver nota abaixo):

```bash
docker compose up --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

- Frontend: http://localhost:8080
- API: http://localhost:3000 (`/health` deve devolver `{"status":"ok"}`)

O seed (`prisma/seed.ts`) cria um tenant e utilizador de demonstração com
IDs fixos (`demo-tenant` / `demo-user`) que já coincidem com os valores por
omissão do frontend — não é preciso configurar mais nada para veres dados
reais em vez do mock estático.

> **Nota sobre o ambiente onde este projeto foi desenvolvido:** o sandbox
> desta sessão bloqueia o acesso a `binaries.prisma.sh`, domínio de onde o
> Prisma descarrega o seu motor de base de dados — por isso não consegui
> correr `prisma generate`/`migrate`/`db seed` ali. Numa máquina normal, CI,
> ou em qualquer um dos hostings abaixo, isto **não é um problema** — é
> apenas uma restrição de rede específica daquele sandbox.

## 2. Produção — Render (recomendado, tem "free tier")

1. Cria uma conta em https://render.com e liga a tua conta GitHub/GitLab
   (faz push deste repositório para lá primeiro, se ainda não estiver).
2. No dashboard: **New +** → **Blueprint**, aponta para o repositório —
   o Render lê o `render.yaml` deste projeto e propõe 3 recursos:
   `logiflow-ao-db` (Postgres), `logiflow-ao-api` (a API) e
   `logiflow-ao-web` (o frontend).
3. Antes de confirmar, define no separador de variáveis de ambiente da
   `logiflow-ao-api` as chaves marcadas `sync: false` no `render.yaml`
   (no mínimo `ANTHROPIC_API_KEY` para o Document AI/Copilot funcionarem;
   as `EMIS_*` só se já tiveres o contrato com o banco — ver secção 4).
4. Depois do primeiro deploy, abre um **Shell** no serviço `logiflow-ao-api`
   (botão no dashboard) e corre:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```
5. O frontend fica acessível no URL que o Render atribuir a
   `logiflow-ao-web` (algo como `https://logiflow-ao-web.onrender.com`).

## 3. Alternativas

- **Railway** (https://railway.app): cria um projeto, adiciona um serviço
  Postgres, e dois serviços "Deploy from Dockerfile" apontados a
  `Dockerfile` (API) e `web/Dockerfile` (frontend) deste repositório.
  Define `DATABASE_URL` a partir do serviço Postgres do Railway e
  `VITE_API_BASE_URL` como build-arg do frontend, apontado ao domínio
  público que o Railway atribuir à API.
- **Fly.io**: `fly launch` na raiz do repositório usa o `Dockerfile` da API
  automaticamente; repete `fly launch` dentro de `web/` para o frontend, ou
  publica o frontend como Artifact/estático noutro CDN (ex.: Cloudflare
  Pages, Vercel) apontado à API já publicada.
- **Base de dados gerida**: em qualquer opção acima podes trocar o Postgres
  auto-hospedado por um serviço gerido (Neon, Supabase, RDS) — basta apontar
  `DATABASE_URL` para lá; o schema/seed funcionam da mesma forma.

## 4. EMIS/Multicaixa e RUPE — o que falta para produção

Isto **não é código em falta** — é acesso institucional que só o operador
do negócio (não um fornecedor de software) consegue obter.

### EMIS (Multicaixa Referência / MCX Express)

`src/modules/payments/emis.service.ts` já tem uma integração **real**
(chamada HTTP autenticada ao endpoint do EMIS, não uma simulação) — falta
apenas configurar `EMIS_API_BASE_URL`, `EMIS_ENTITY_ID`, `EMIS_API_KEY` e
`EMIS_WEBHOOK_SECRET`. Para obter estas credenciais:

1. Contacta o teu banco (BFA, BAI, BIC, etc.) ou um agregador EMIS GPO
   directamente, e formaliza o acordo comercial de aceitação de pagamentos
   Multicaixa como comerciante.
2. O banco/agregador atribui uma **Entidade** (número de 5 dígitos, como o
   `00099` usado como exemplo ilustrativo nesta demonstração) e as
   credenciais de API.
3. Confirma com eles o endpoint exacto e o formato de payload — o nome dos
   campos (`entidade`, `referencia`, etc.) usado no código segue a
   nomenclatura habitual do mercado, mas **deve ser validado contra o
   contrato técnico real**, que varia por banco/agregador.
4. Configura o `EMIS_WEBHOOK_SECRET` (fornecido pelo banco) para que
   `POST /webhooks/emis` valide a assinatura HMAC das confirmações de
   pagamento.

### RUPE (AGT — Referência Única de Pagamento ao Estado)

**Ainda sem integração real neste backend.** O schema já tem os campos
(`Transaction.rupeReference`, `rupeTaxpayerNif`) e o frontend simula a
emissão para demonstração, mas não existe um `rupe.service.ts` a chamar a
AGT. Para implementar:

1. A integração com a AGT para emissão de RUPE faz-se tipicamente através
   do Sistema de Facturação Certificado ou de um integrador/software house
   já certificado pela AGT — contacta a AGT (https://www.agt.minfin.gov.ao)
   ou a Direcção Nacional de Tecnologias de Informação para o processo de
   credenciação.
2. Depois de teres acesso ao webservice, o padrão a seguir é o mesmo do
   `emis.service.ts`: um serviço que chama a API da AGT e grava a
   `Transaction` com `method: "RUPE"`, mais um controller de webhook (se a
   AGT notificar assincronamente) ou consulta de estado.

### Stripe (clientes internacionais)

Ao contrário dos dois anteriores, o Stripe **é auto-serviço** — sem
contrato prévio:

1. Cria uma conta em https://dashboard.stripe.com (gratuita).
2. Em modo de teste, copia a chave `sk_test_...` de
   https://dashboard.stripe.com/test/apikeys para `STRIPE_SECRET_KEY`.
3. Cria um endpoint de webhook em
   https://dashboard.stripe.com/test/webhooks apontado a
   `https://<o-teu-domínio-da-api>/webhooks/stripe`, evento
   `checkout.session.completed`, e copia o "Signing secret" para
   `STRIPE_WEBHOOK_SECRET`.
4. Testa com os números de cartão fictícios da Stripe (ex.:
   `4242 4242 4242 4242`, qualquer validade futura, qualquer CVC) —
   https://docs.stripe.com/testing.
5. Quando estiveres pronto para cobrar dinheiro real, repete os passos 2-3
   com as chaves `sk_live_...` do modo de produção da tua conta.

Com `STRIPE_SECRET_KEY` configurado, o Terminal de Pagamentos do frontend já
chama `POST /payments/stripe/checkout-session` e redireciona o cliente para
a página de checkout real da Stripe — deixa de usar o simulador local
automaticamente (ver `web/src/pages/PagamentosPage.tsx`).
