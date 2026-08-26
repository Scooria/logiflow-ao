import { createApp } from "./http/app";
import { env } from "./lib/env";
import { disconnectPrisma } from "./lib/prisma";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[logiflow-ao] API a correr na porta ${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`[logiflow-ao] Recebido ${signal}, a encerrar graciosamente...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
