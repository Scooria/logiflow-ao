import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const NovaExpedicaoPage = lazy(() => import("./pages/NovaExpedicaoPage"));
const WmsPage = lazy(() => import("./pages/WmsPage"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const PagamentosPage = lazy(() => import("./pages/PagamentosPage"));
const DocumentAiPage = lazy(() => import("./pages/DocumentAiPage"));
const CopilotPage = lazy(() => import("./pages/CopilotPage"));

function RouteFallback() {
  return <p className="text-sm text-[var(--color-text-muted)]">A carregar…</p>;
}

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/nova-expedicao" element={<NovaExpedicaoPage />} />
          <Route path="/wms" element={<WmsPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/pagamentos" element={<PagamentosPage />} />
          <Route path="/document-ai" element={<DocumentAiPage />} />
          <Route path="/copilot" element={<CopilotPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
