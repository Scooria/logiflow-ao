/**
 * Validação e tipagem central das variáveis de ambiente.
 * Falha rápido (fail-fast) no arranque se algo obrigatório estiver em falta,
 * em vez de rebentar silenciosamente a meio de um pedido de pagamento.
 */
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),

  // --- EMIS (Multicaixa / MCX Express) ---
  // Endpoint e credenciais fornecidos pelo banco emissor / agregador EMIS GPO.
  // Ajustar ao contrato específico assinado (o payload exacto varia por acordo).
  EMIS_API_BASE_URL: z.string().url().optional(),
  EMIS_ENTITY_ID: z.string().optional(), // "Entidade" EMIS atribuída ao merchant
  EMIS_API_KEY: z.string().optional(),
  EMIS_WEBHOOK_SECRET: z.string().optional(), // usado para validar assinatura HMAC do webhook
  EMIS_REFERENCE_TTL_HOURS: z.coerce.number().int().positive().default(72),

  // --- Stripe (clientes internacionais) ---
  // Chave secreta de teste (sk_test_...) ou produção (sk_live_...) da tua
  // conta Stripe — https://dashboard.stripe.com/apikeys. Auto-serviço, sem
  // acordo comercial prévio, ao contrário do EMIS/RUPE abaixo.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().default("https://example.com/pagamentos/sucesso"),
  STRIPE_CANCEL_URL: z.string().url().default("https://example.com/pagamentos/cancelado"),

  // --- Document AI / Copilot (Passo 4) ---
  // Chave da API Anthropic usada tanto para extração estruturada de
  // documentos (Faturas, Packing Lists, e-mails de cotação) como para o
  // Copilot conversacional. Sem esta variável, os endpoints /ai/* e
  // /copilot/* respondem 500 com uma mensagem de configuração clara.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  COPILOT_MAX_TOOL_ITERATIONS: z.coerce.number().int().positive().default(6),

  // --- Motor de rotas ---
  // Em desenvolvimento/demo, permite estimar distância/tempo por um grafo
  // interprovincial de referência quando o tenant ainda não tem RoadRoute
  // configurado. Em produção recomenda-se desligar e obrigar dados validados.
  ALLOW_SEED_ROUTE_FALLBACK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[env] Configuração inválida:", parsed.error.flatten().fieldErrors);
    throw new Error("Variáveis de ambiente inválidas — ver detalhes acima.");
  }
  return parsed.data;
}

export const env = loadEnv();
