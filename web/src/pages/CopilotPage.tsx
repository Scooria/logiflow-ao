import { FormEvent, useEffect, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { ChatMessage, DisplayMessage } from "../components/copilot/ChatMessage";
import { sendCopilotMessage } from "../lib/api";
import { COPILOT_SCENARIOS } from "../lib/aiDemoData";
import { CopilotChatMessage } from "../types/ai";

const AVAILABLE_TOOLS = [
  { icon: "🗺️", label: "Calcular Rota", name: "find_route" },
  { icon: "⚖️", label: "Calcular Peso Taxável", name: "calculate_chargeable_weight" },
  { icon: "📋", label: "Listar Envios", name: "list_shipments" },
  { icon: "📍", label: "Consultar Rastreamento", name: "get_shipment_tracking" },
  { icon: "💳", label: "Gerar Referência Multicaixa", name: "generate_multicaixa_reference" },
];

const WELCOME: DisplayMessage = {
  role: "assistant",
  content:
    "Olá! Sou o Copilot da LogiFlow AO. Posso calcular rotas e pesos taxáveis, consultar o estado de envios e " +
    "gerar referências Multicaixa — sempre com a tua confirmação antes de qualquer acção financeira. Escolhe " +
    "uma sugestão abaixo ou escreve a tua pergunta.",
};

function hasPendingConfirmation(message: DisplayMessage | undefined): boolean {
  if (!message || message.role !== "assistant" || !message.toolCalls) return false;
  return message.toolCalls.some((call) => {
    const result = call.result;
    return typeof result === "object" && result !== null && (result as { requiresConfirmation?: boolean }).requiresConfirmation === true;
  });
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: DisplayMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    const history: CopilotChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));
    const result = await sendCopilotMessage(history);

    setMessages((prev) => [...prev, { role: "assistant", content: result.reply, toolCalls: result.actions }]);
    setIsSending(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void handleSend(input);
  }

  const lastMessage = messages[messages.length - 1];
  const awaitingConfirmation = hasPendingConfirmation(lastMessage) && !isSending;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Copilot Operacional</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Assistente conversacional com acesso directo às operações — rotas, pesos, rastreamento e pagamentos.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="flex h-[600px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            {isSending && (
              <div className="flex items-center gap-1.5 px-1 text-xs text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: "240ms" }} />
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-[var(--color-grid)] p-3">
            {awaitingConfirmation && (
              <button
                type="button"
                onClick={() => void handleSend("Sim, confirmo.")}
                className="animate-fade-up mb-2 rounded-full bg-[var(--color-status-good)]/15 px-3 py-1.5 text-xs font-medium text-[var(--color-status-good)] transition-colors hover:bg-[var(--color-status-good)]/25"
              >
                ✓ Sim, confirmo.
              </button>
            )}
            {!awaitingConfirmation && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {COPILOT_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => void handleSend(scenario.steps[0].userText)}
                    disabled={isSending}
                    className="rounded-full border border-[var(--color-grid)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-series-1)] hover:text-[var(--color-series-1)] disabled:opacity-50"
                  >
                    {scenario.buttonLabel}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                placeholder="Escreve a tua pergunta…"
                className="flex-1 rounded-md border border-[var(--color-grid)] bg-[var(--color-page)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-series-1)]"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex min-w-[84px] items-center justify-center rounded-md bg-[var(--color-series-1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSending ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    role="status"
                    aria-label="A enviar"
                  />
                ) : (
                  "Enviar"
                )}
              </button>
            </form>
          </div>
        </Card>

        <Card title="Ferramentas Disponíveis" subtitle="Acção directa sobre o backend, isolada por tenant">
          <ul className="space-y-2.5">
            {AVAILABLE_TOOLS.map((tool) => (
              <li key={tool.name} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden="true">{tool.icon}</span>
                <span className="text-[var(--color-text-secondary)]">{tool.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-[var(--color-grid)] pt-4 text-xs text-[var(--color-text-muted)]">
            Acções com efeito financeiro (gerar referência Multicaixa) exigem confirmação explícita do
            utilizador antes de executar — o modelo nunca age sozinho sobre dinheiro real.
          </p>
        </Card>
      </div>
    </div>
  );
}
