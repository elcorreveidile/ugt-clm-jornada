// Servidor de producción para un VPS (Docker): sirve la web construida (dist/)
// y la API en el mismo puerto. Caddy, delante, pone el HTTPS.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import api from "./app";
import { stampPending } from "./ledger/store";

const DIST = process.env.DIST_DIR || "./dist";
const indexHtml = readFileSync(`${DIST}/index.html`, "utf8");

const root = new Hono();
root.route("/", api);
root.get("/healthz", (c) => c.text("ok"));
// Ficheros con huella en el nombre: se pueden guardar en caché mucho tiempo.
root.use("/assets/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=31536000, immutable");
});
root.use("/*", serveStatic({ root: DIST }));
// Cualquier otra ruta es de la aplicación de una página (/historial, /ajustes…).
root.get("*", (c) => {
  c.header("Cache-Control", "no-cache");
  return c.html(indexHtml);
});

const port = Number(process.env.PORT || 3000);
serve({ fetch: root.fetch, port }, () => console.log(`Registro de jornada en el puerto ${port}`));

// Sellado de lo pendiente (si la autoridad de sellado no respondió en su momento).
const INTERVALO_MS = 15 * 60 * 1000;
setInterval(() => {
  stampPending({}, 200)
    .then((r) => r.done && console.log(`[sellos] sellados ${r.done}, quedan ${r.left}`))
    .catch((e) => console.error("[sellos]", e));
}, INTERVALO_MS).unref();
