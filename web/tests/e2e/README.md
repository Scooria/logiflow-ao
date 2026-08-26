# Suite E2E — LogiFlow AO

Testes end-to-end com [Playwright Test](https://playwright.dev/), cobrindo a
aplicação frontend inteira: navegação, Nova Expedição (Terrestre e Aéreo),
Terminal de Pagamentos, etiquetas de código de barras/QR no WMS, e regressão
dos módulos Scanner/Copilot/Document AI.

## Como correr

```bash
cd web
npm install
npx playwright install chromium   # uma vez, se ainda não tiveres o Chromium do Playwright
npm run test:e2e
```

O `playwright.config.ts` arranca automaticamente `npm run build && npm run
preview` antes dos testes (ver secção `webServer`), por isso não é preciso
nada a correr previamente — basta `npm run test:e2e`.

### Ambientes sem `npx playwright install` (sandboxes com rede restrita)

Se o download do Chromium gerido pelo Playwright não for possível, aponta
para um Chromium já instalado na máquina através da variável de ambiente:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/caminho/para/chrome npm run test:e2e
```

## Estrutura

- `navigation.spec.ts` — sidebar, KPIs do dashboard, filtro Aéreo/Terrestre.
- `nova-expedicao.spec.ts` — emissão de Guia Rodoviária e de AWB, incluindo
  aparecimento imediato da expedição no Dashboard (partilha de estado via
  `ShipmentsContext`).
- `pagamentos.spec.ts` — os três simuladores (Multicaixa, RUPE, Stripe).
- `wms.spec.ts` — geração de etiqueta com código de barras + QR.
- `regressao.spec.ts` — Scanner, Copilot e Document AI (não alterados nesta
  fase, mas sensíveis ao refactor de layout/routing).

## Nota

Estes testes correm contra o **build de produção** (`vite preview`), não o
servidor de desenvolvimento — validam exatamente o que é publicado.
