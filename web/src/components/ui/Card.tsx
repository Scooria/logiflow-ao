import { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-[var(--color-grid)] bg-[var(--color-surface-1)] p-5 shadow-sm",
        className
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
