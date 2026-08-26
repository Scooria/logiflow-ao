import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Build dedicado à publicação como Claude Artifact (ver scripts/build-artifact.mjs).
 *
 * O build normal (vite.config.ts) usa code-splitting por rota — ótimo para
 * hosting real, onde cada chunk é um ficheiro servido normalmente. Mas um
 * Claude Artifact é UM único ficheiro HTML estático, sem servidor a
 * responder a `/assets/*.js` — os `import()` dinâmicos do React.lazy()
 * (ver src/App.tsx) fariam 404 a meio da navegação. `codeSplitting: false`
 * (opção do Rolldown, o bundler usado por esta versão do Vite) força tudo
 * para um único ficheiro JS, mantendo o mesmo código-fonte.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-artifact",
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});
