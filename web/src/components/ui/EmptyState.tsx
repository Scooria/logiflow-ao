export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-grid)] py-10 text-center">
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}
