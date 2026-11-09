import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: la URL vive aquí y el cliente en runtime usa el driver adapter
// (server/db.ts). La variable es JORNADA_DATABASE_URL —NO DATABASE_URL— para
// que ningún comando de esta app apunte por error a otra base de datos que
// esté en el entorno (p. ej. la de WordNext en el entorno de Claude Code).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.JORNADA_DATABASE_URL ?? "" },
});
