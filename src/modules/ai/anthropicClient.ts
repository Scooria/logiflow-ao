/**
 * Wrapper fino sobre o Anthropic Messages API, usado tanto pela extração de
 * documentos (Document AI) como pelo Copilot conversacional.
 *
 * `extractStructured` força o modelo a devolver a resposta através de uma
 * única chamada de ferramenta (`tool_choice: { type: "tool", name }`), em
 * vez de pedir "responde em JSON" em texto livre — isto elimina a
 * necessidade de fazer parsing best-effort de markdown/JSON solto e garante
 * que a resposta respeita o `input_schema` fornecido. O resultado é depois
 * validado outra vez com Zod no lado do servidor (defesa em profundidade —
 * nunca confiar cegamente na saída de um modelo, mesmo com tool-use forçado).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { env } from "../../lib/env";
import { ConfigurationError, ExternalServiceError, ValidationError } from "../../lib/errors";

let client: Anthropic | null = null;

/** Devolve o cliente Anthropic partilhado (extração de documentos e Copilot). */
export function getAnthropicClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ConfigurationError(
      "ANTHROPIC_API_KEY não configurada — necessária para Document AI e Copilot."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface DocumentSourceInput {
  /** PDF em base64 (sem o prefixo "data:application/pdf;base64,"). */
  base64Pdf?: string;
  /** Texto simples (ex.: corpo de um e-mail de cotação). */
  text?: string;
}

/**
 * Chama o Claude com uma única ferramenta cujo `input_schema` define a
 * forma exacta da extração pretendida, obriga o modelo a usá-la
 * (`tool_choice`), e valida o `input` devolvido com o schema Zod fornecido.
 */
export async function extractStructured<T>(params: {
  systemPrompt: string;
  userInstruction: string;
  source: DocumentSourceInput;
  tool: Tool;
  zodSchema: z.ZodType<T>;
}): Promise<{ data: T; modelUsed: string }> {
  const anthropic = getAnthropicClient();

  const content: MessageParam["content"] = [];
  if (params.source.base64Pdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: params.source.base64Pdf },
    });
  }
  content.push({ type: "text", text: params.userInstruction + (params.source.text ? `\n\n---\n${params.source.text}` : "") });

  let response;
  try {
    response = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: env.ANTHROPIC_MAX_TOKENS,
      system: params.systemPrompt,
      messages: [{ role: "user", content }],
      tools: [params.tool],
      tool_choice: { type: "tool", name: params.tool.name },
    });
  } catch (err) {
    throw new ExternalServiceError("Anthropic", (err as Error).message);
  }

  const toolUseBlock = response.content.find(
    (block): block is ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUseBlock) {
    throw new ExternalServiceError(
      "Anthropic",
      `O modelo não devolveu uma chamada de ferramenta (stop_reason: ${response.stop_reason}).`
    );
  }

  const parsed = params.zodSchema.safeParse(toolUseBlock.input);
  if (!parsed.success) {
    throw new ValidationError(
      `A extração devolvida pelo modelo não respeita o formato esperado: ${parsed.error.message}`
    );
  }

  return { data: parsed.data, modelUsed: response.model };
}
