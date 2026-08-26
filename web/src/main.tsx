import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ShipmentsProvider } from "./lib/ShipmentsContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchInterval: 15_000, // "tempo real" via polling — trocar por WebSocket/SSE quando disponível no backend
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ShipmentsProvider>
          <App />
        </ShipmentsProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
);
