import express, { Application, NextFunction, Request, Response } from "express";
import { wmsRouter } from "./routes/wms.routes";
import { cargoRouter } from "./routes/cargo.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { aiRouter } from "./routes/ai.routes";
import { copilotRouter } from "./routes/copilot.routes";
import { shipmentsRouter } from "./routes/shipments.routes";
import { billingRouter } from "./routes/billing.routes";
import { cargoReleaseRouter } from "./routes/cargoRelease.routes";
import { handleEmisWebhook } from "../modules/payments/emisWebhook.controller";
import { handleStripeWebhook } from "../modules/payments/stripeWebhook.controller";
import { asyncHandler } from "./asyncHandler";
import { DomainError } from "../lib/errors";

export function createApp(): Application {
  const app = express();

  // O webhook EMIS precisa do corpo em bruto (raw bytes) para validar a
  // assinatura HMAC — por isso é montado ANTES do express.json() global e
  // usa o seu próprio parser `express.raw()`.
  app.post("/webhooks/emis", express.raw({ type: "*/*" }), asyncHandler(handleEmisWebhook));
  app.post("/webhooks/stripe", express.raw({ type: "*/*" }), asyncHandler(handleStripeWebhook));

  // Limite alargado (default do Express é 100kb) porque os endpoints do
  // Document AI recebem PDFs em base64 no corpo JSON — para volumes maiores
  // em produção, preferir upload multipart/streaming em vez de base64 inline.
  app.use(express.json({ limit: "20mb" }));

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/wms", wmsRouter);
  app.use("/cargo", cargoRouter);
  app.use("/cargo-releases", cargoReleaseRouter);
  app.use("/payments", paymentsRouter);
  app.use("/ai", aiRouter);
  app.use("/copilot", copilotRouter);
  // Endpoints de leitura (Passo 5) — o Passo 2 só cobria escrita.
  app.use("/", shipmentsRouter);
  app.use("/", billingRouter);

  // Middleware de erro central — traduz DomainError (ValidationError,
  // NotFoundError, ExternalServiceError, ...) para o status HTTP correcto.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DomainError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    console.error("[unhandled-error]", err);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro interno inesperado." });
  });

  return app;
}
