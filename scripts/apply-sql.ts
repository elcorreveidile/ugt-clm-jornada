// Aplica el SQL que Prisma no gestiona (disparadores de solo anotación).
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const url = process.env.JORNADA_DATABASE_URL;
if (!url) {
  console.error("Falta JORNADA_DATABASE_URL");
  process.exit(1);
}
const dir = new URL("../prisma/sql/", import.meta.url);
const client = new pg.Client({ connectionString: url });
await client.connect();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  await client.query(readFileSync(new URL(f, dir), "utf8"));
  console.log(`Aplicado ${f}`);
}
await client.end();
