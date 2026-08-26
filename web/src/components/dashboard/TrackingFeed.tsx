import { TrackingEvent, PROVINCE_NAME_PT } from "../../types/domain";
import { StatusBadge } from "../ui/StatusBadge";
import { EmptyState } from "../ui/EmptyState";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function TrackingFeed({ events }: { events: TrackingEvent[] }) {
  if (events.length === 0) return <EmptyState message="Sem eventos de rastreamento recentes." />;

  return (
    <ol className="space-y-4">
      {events.map((event, i) => (
        <li key={event.id} className="animate-fade-up flex gap-3" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="relative mt-1 flex h-2 w-2 shrink-0">
            {i === 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-series-1)] opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-series-1)]" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{event.shipmentNumber}</span>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{event.description}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {event.province && `${PROVINCE_NAME_PT[event.province]} · `}
              {event.source && `${event.source} · `}
              {relativeTime(event.occurredAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
