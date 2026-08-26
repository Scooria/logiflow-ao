/**
 * Copilot conversacional — loop agêntico clássico: envia a conversa + a
 * lista de ferramentas ao Claude; se o modelo pedir uma ferramenta,
 * executa-a contra os serviços reais (routeEngine, chargeableWeight, EMIS,
 * consultas Prisma — ver tools.ts) e devolve o resultado como `tool_result`;
 * repete até o modelo produzir uma resposta final em texto ou até ao limite
 * de iterações (`COPILOT_MAX_TOOL_ITERATIONS`, protecção contra loops).
 *
 * Cada acção executada é registada em `actions` e devolvida ao chamador —
 * a UI deve mostrar este registo ao utilizador (transparência sobre o que
 * o Copilot fez em seu nome), especialmente para ferramentas com efeito
 * colateral como `generate_multicaixa_reference`.
 */
import type { MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { getAnthropicClient } from "../anthropicClient";
import { env } from "../../../lib/env";
import { ConfigurationError, DomainError } from "../../../lib/errors";
import { COPILOT_TOOL_MAP, COPILOT_TOOLS, ToolContext } from "./tools";

const COPILOT_SYSTEM_PROMPT =
  "És o Copilot da LogiFlow AO, uma plataforma de logística multimodal (aérea e " +
  "terrestre) e WMS para Angola. Ajudas operadores a calcular rotas e pesos taxáveis, " +
  "consultar o estado de envios, e gerar referências de pagamento Multicaixa. " +
  "Responde sempre em português. Usa as ferramentas disponíveis em vez de adivinhar " +
  "números — nunca inventes distâncias, pesos ou estados de envio. Para qualquer " +
  "ferramenta que gere uma referência de pagamento real, confirma primeiro o montante " +
  "com o utilizador em texto antes de a chamar com confirmed=true.";

export interface CopilotChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CopilotActionLogEntry {
  tool: string;
  input: unknown;
  output: unknown;
  isError: boolean;
}

export interface CopilotTurnResult {
  reply: string;
  actions: CopilotActionLogEntry[];
  truncated: boolean;
}

function toModelMessages(history: CopilotChatMessage[]): MessageParam[] {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<{ output: unknown; isError: boolean }> {
  const tool = COPILOT_TOOL_MAP[name];
  if (!tool) {
    return { output: { error: `Ferramenta desconhecida: ${name}` }, isError: true };
  }
  try {
    const output = await tool.execute(input, ctx);
    return { output, isError: false };
  } catch (err) {
    if (err instanceof DomainError) {
      return { output: { error: err.code, message: err.message }, isError: true };
    }
    return { output: { error: "UNEXPECTED_ERROR", message: (err as Error).message }, isError: true };
  }
}

/**
 * Corre uma volta completa do Copilot: recebe o histórico da conversa
 * (já incluindo a última mensagem do utilizador) e devolve a resposta
 * final do assistente, depois de resolver quaisquer chamadas de ferramenta
 * que o modelo tenha pedido pelo caminho.
 */
export async function runCopilotTurn(params: {
  tenantId: string;
  userId: string;
  history: CopilotChatMessage[];
}): Promise<CopilotTurnResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ConfigurationError("ANTHROPIC_API_KEY não configurada — Copilot indisponível.");
  }

  const anthropic = getAnthropicClient();
  const ctx: ToolContext = { tenantId: params.tenantId, userId: params.userId };
  const messages = toModelMessages(params.history);
  const actions: CopilotActionLogEntry[] = [];

  for (let iteration = 0; iteration < env.COPILOT_MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: env.ANTHROPIC_MAX_TOKENS,
      system: COPILOT_SYSTEM_PROMPT,
      messages,
      tools: COPILOT_TOOLS.map((t) => t.definition),
    });

    if (response.stop_reason !== "tool_use") {
      const reply = response.content
        .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { reply: reply || "(sem resposta em texto)", actions, truncated: false };
    }

    // O modelo pediu uma ou mais ferramentas — a mensagem do assistente (texto +
    // blocos tool_use) tem de ser reenviada antes dos tool_result. Mapeamos
    // explicitamente para os tipos *Param (em vez de reenviar `response.content`
    // tal-e-qual) para não arrastar tipos de bloco de servidor que esta
    // integração não usa (web_search, code_execution, etc.).
    const assistantContent: MessageParam["content"] = response.content
      .filter((block): block is Extract<typeof block, { type: "text" | "tool_use" }> =>
        block.type === "text" || block.type === "tool_use"
      )
      .map((block) =>
        block.type === "text"
          ? { type: "text" as const, text: block.text }
          : { type: "tool_use" as const, id: block.id, name: block.name, input: block.input }
      );
    messages.push({ role: "assistant", content: assistantContent });

    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const { output, isError } = await executeTool(block.name, block.input, ctx);
      actions.push({ tool: block.name, input: block.input, output, isError });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(output),
        is_error: isError,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    reply:
      "Atingi o limite de passos permitidos para esta pergunta sem chegar a uma resposta " +
      "final — tenta reformular ou dividir o pedido em partes mais pequenas.",
    actions,
    truncated: true,
  };
}
