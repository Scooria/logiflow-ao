import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  Moon,
  PackagePlus,
  ScanLine,
  Sun,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { isDemoMode } from "../../lib/api";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard Multimodal", icon: LayoutDashboard },
  { to: "/nova-expedicao", label: "Nova Expedição", icon: PackagePlus },
  { to: "/wms", label: "Painel WMS", icon: Warehouse },
  { to: "/scanner", label: "Scanner", icon: ScanLine },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/document-ai", label: "Document AI", icon: FileText },
  { to: "/copilot", label: "Copilot", icon: Bot },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("logiflow-theme") as "light" | "dark") ?? "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("logiflow-theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      className="flex w-full items-center gap-2.5 rounded-md border border-[var(--color-baseline)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-page)]"
      aria-label="Alternar tema claro/escuro"
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {theme === "light" ? "Modo escuro" : "Modo claro"}
    </button>
  );
}

function SidebarNav() {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const nav = navRef.current;
      if (!nav) return;
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) setPill({ top: active.offsetTop, height: active.offsetHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [location.pathname]);

  return (
    <nav ref={navRef} className="relative flex flex-1 flex-col gap-1">
      {pill && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 rounded-lg bg-[var(--color-page)] transition-[top,height] duration-300 ease-out"
          style={{ top: pill.top, height: pill.height }}
        />
      )}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `relative z-10 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--color-series-1)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-up">
      {children}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--color-page)] text-[var(--color-text-primary)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-grid)] bg-[var(--color-surface-1)] px-4 py-5">
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-series-1)] font-bold text-white">
            LF
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">LogiFlow AO</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Logística Multimodal · WMS · TMS</p>
          </div>
        </div>

        <SidebarNav />

        <div className="mt-6 border-t border-[var(--color-grid)] pt-4">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoMode() && (
          <div className="flex items-center gap-2 border-b border-[var(--color-status-warning)]/30 bg-[var(--color-status-warning)]/10 px-6 py-2 text-sm text-[var(--color-text-secondary)]">
            <Truck className="h-4 w-4 shrink-0 text-[var(--color-status-warning)]" aria-hidden="true" />
            Modo demonstração — a mostrar dados de exemplo. Defina <code>VITE_API_BASE_URL</code> para ligar à
            API do Passo 2.
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-8 py-8">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  );
}
