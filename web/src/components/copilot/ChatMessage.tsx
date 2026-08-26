import clsx from "clsx";
import { ScriptedToolCall } from "../../lib/aiDemoData";
import { ToolCallCard } from "./ToolCallCard";

export interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ScriptedToolCall[];
}

export function ChatMessage({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={clsx("animate-fade-up flex", isUser ? "justify-end" : "justify-start")}>
      <div className={clsx("max-w-[85%] space-y-2", isUser && "flex flex-col items-end")}>
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-1.5">
            {message.toolCalls.map((call, i) => (
              <ToolCallCard key={i} call={call} />
            ))}
          </div>
        )}
        <div
          className={clsx(
            "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--color-series-1)] text-white"
              : "border border-[var(--color-grid)] bg-[var(--color-surface-1)] text-[var(--color-text-primary)]"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
