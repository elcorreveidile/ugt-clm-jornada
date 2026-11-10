import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  buildTimeStampRequest,
  parseTimeStampResponse,
  parseTimeStampToken,
  verifyTimeStampToken,
} from "../server/tsa/rfc3161";

// Respuesta real de FreeTSA para el texto "hola\n" (obtenida con openssl ts).
const RESP = new Uint8Array(readFileSync(new URL("./fixtures/freetsa-hola.tsr", import.meta.url)));
const DATA = new TextEncoder().encode("hola\n");
const HASH = createHash("sha256").update(DATA).digest("hex");
const CA = readFileSync(new URL("../server/tsa/freetsa-cacert.pem", import.meta.url), "utf8");

test("la petición es un TimeStampReq DER con la huella dentro", () => {
  const der = buildTimeStampRequest(HASH, { nonce: Uint8Array.from([0x81, 2, 3, 4]) });
  assert.equal(der[0], 0x30); // SEQUENCE
  assert.ok(Buffer.from(der).toString("hex").includes(HASH));
  assert.throws(() => buildTimeStampRequest("no-es-un-hash"));
});

test("se interpreta una respuesta real de FreeTSA", () => {
  const p = parseTimeStampResponse(RESP);
  assert.equal(p.hashedMessage, HASH);
  assert.match(p.genTime, /^2026-11-09T16:31:37/);
  assert.ok(p.token.length > 1000);
  assert.equal(parseTimeStampToken(p.token).genTime, p.genTime);
});

test("el token se verifica contra la CA de FreeTSA y la huella correcta", async () => {
  const p = parseTimeStampResponse(RESP);
  const ok = await verifyTimeStampToken(p.token, DATA, CA);
  assert.deepEqual(ok, { ok: true, genTime: p.genTime });
});

test("con otra huella o un token alterado, la verificación falla", async () => {
  const p = parseTimeStampResponse(RESP);
  const otra = await verifyTimeStampToken(p.token, new TextEncoder().encode("adios\n"), CA);
  assert.equal(otra.ok, false);
  const roto = Uint8Array.from(p.token);
  roto[roto.length - 40] ^= 0xff; // dentro de la firma
  assert.equal((await verifyTimeStampToken(roto, DATA, CA)).ok, false);
});

test("configuración: FreeTSA por defecto y autenticación para una cualificada", async () => {
  const { tsaConfig } = await import("../server/tsa/config");
  assert.equal(tsaConfig({}).url, "https://freetsa.org/tsr");
  assert.equal(tsaConfig({}).qualified, false);
  const q = tsaConfig({ TSA_URL: "https://tsa.example/tsr", TSA_QUALIFIED: "1", TSA_BASIC_AUTH: "u:p", TSA_AUTH_HEADER: "X-Api-Key: abc" });
  assert.equal(q.qualified, true);
  assert.equal(q.headers.Authorization, "Basic dTpw");
  assert.equal(q.headers["X-Api-Key"], "abc");
});

test("requestTimestamp rechaza un sello de otra huella", async () => {
  const { requestTimestamp } = await import("../server/tsa/stamp");
  const fake = (async () => new Response(RESP)) as unknown as typeof fetch;
  const cfg = { url: "x", name: "t", qualified: false, headers: {} };
  assert.equal((await requestTimestamp(HASH, cfg, fake)).genTime.slice(0, 19), "2026-11-09T16:31:37");
  await assert.rejects(requestTimestamp("1".repeat(64), cfg, fake), /otra huella/);
});
