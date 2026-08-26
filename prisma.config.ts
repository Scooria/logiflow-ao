import { defineConfig } from "@prisma/config";

/**
 * Configuração Prisma 7 (substitui o antigo bloco `"prisma"` do
 * package.json). Aponta o comando de seed para prisma/seed.ts.
 *
 * NOTA (ambiente de desenvolvimento deste sandbox): `prisma generate` /
 * `migrate` / `db seed` precisam de descarregar o motor de esquema de
 * binaries.prisma.sh, domínio bloqueado pela política de rede deste
 * ambiente. Este ficheiro e o `prisma/seed.ts` estão prontos para correr
 * em qualquer máquina/CI com acesso normal à internet — ver
 * prisma/seed.ts para instruções completas.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
});
