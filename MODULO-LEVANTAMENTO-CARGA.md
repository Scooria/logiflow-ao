# Módulo — Levantamento de Carga Aérea de Importação

Requisitos recolhidos por nota de voz em 2026-08-26. Cobre o lado da
**chegada** do fluxo aéreo — o inverso da Nova Expedição (Passo 2), que cobre
o lado do envio.

## Fluxo coberto

1. **Chegada do ULD** — o contentor/palete chega com um número próprio
   (distinto do AWB), atribuído pela transportadora aérea.
2. **Conferência e arrumação** — a equipa faz scan do AWB e da posição do
   armazém onde o está a colocar (reaproveita o WMS já existente). Ao
   terminar, o AWB avança automaticamente para "pronto para pagamento".
3. **Consulta pelo destinatário** — o destinatário (já registado, com NIF)
   consulta o estado pelo número do AWB.
4. **Pagamento das taxas** — via Multicaixa Referência ou MCX Express
   (reaproveita a integração EMIS já existente, `emis.service.ts`).
5. **Confirmação e carimbo** — o webhook EMIS confirma o pagamento; a equipa
   carimba/assina o original e marca "pronto para levantamento".
6. **Levantamento ou entrega** — presencial, ou serviço de entrega pago à
   parte.
7. **Estatuto VIP** — recalculado automaticamente a partir do volume de
   movimentos do destinatário (não é definido à mão). Um destinatário VIP
   recebe notificação automática assim que a carga fica pronta para
   pagamento, em vez de ter de consultar por iniciativa própria.

## O que foi construído

- **Modelo de dados** (`prisma/schema.prisma`, secção 12): `Uld`,
  `CargoRelease`, enums `UldType`/`CargoReleaseStatus`, e os campos
  `Party.vipStatus`/`vipSince`.
- **Serviço** (`src/modules/cargo/cargoRelease.service.ts`): todas as
  transições de estado descritas acima, incluindo o cálculo de VIP.
- **Rotas HTTP** (`src/http/routes/cargoRelease.routes.ts`, montadas em
  `/cargo-releases`):
  - `POST /cargo-releases/ulds/arrival`
  - `POST /cargo-releases/breakdown`
  - `GET /cargo-releases/lookup/:awbNumber`
  - `POST /cargo-releases/:cargoReleaseId/pay`
  - `POST /cargo-releases/:cargoReleaseId/ready-for-pickup`
  - `POST /cargo-releases/:cargoReleaseId/request-delivery`
  - `POST /cargo-releases/:cargoReleaseId/collect`
- **Webhook EMIS** (`emisWebhook.controller.ts`): ao confirmar um pagamento,
  avança automaticamente o `CargoRelease` ligado, se existir.

## O que NÃO está feito (por decisão explícita — construir para trás, não para a demo de quinta)

- **Sem interface no frontend.** É só backend + base de dados, tal como
  combinado — não aparece na app nem na demo.
- **Sem envio real de email/SMS.** Os campos `notifiedReadyForPaymentAt` /
  `notifiedReadyForPickupAt` só registam *quando* a notificação deveria ter
  sido enviada — falta ligar a um serviço real (ex.: SES, SendGrid, ou a
  API de SMS/WhatsApp Business, provavelmente mais fiável em Angola do que
  email).
- **Limiar de VIP fixo no código** (`VIP_MIN_MOVEMENTS = 4` em 30 dias,
  em `cargoRelease.service.ts`) — em produção deveria ser configurável por
  tenant, não uma constante.
- **Não verificado por execução real** — tal como o resto do backend deste
  projeto, o `prisma generate`/`migrate` não corre neste sandbox (bloqueio
  de rede do ambiente). O código foi revisto com cuidado e o `tsc` só aponta
  os mesmos erros esperados de "cliente Prisma não gerado" — mas só fica
  confirmado a funcionar de verdade assim que o Render (ou outro ambiente
  real) gerar o cliente e correr a migração.

## Próximo passo sugerido

Depois do backend estar no ar (ver `DEPLOY.md`), correr
`npx prisma migrate dev --name cargo_release` localmente ou
`npx prisma migrate deploy` no Render para criar as tabelas novas.
