import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJson } from "../server/ledger/canonical";
import { GENESIS, entryHash, materialOf, verifyChain, type ChainEntry } from "../server/ledger/chain";

test("JSON canónico: claves ordenadas, sin undefined, anidado", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, undefined, "x"], c: null }, z: undefined }), '{"a":{"c":null,"d":[1,null,"x"]},"b":1}');
  assert.throws(() => canonicalJson({ a: NaN }));
});

function build(n: number): ChainEntry[] {
  const out: ChainEntry[] = [];
  let prev = GENESIS;
  for (let i = 1; i <= n; i++) {
    const base = {
      userId: "u1",
      seq: i,
      prevHash: prev,
      type: "REGISTRO",
      payload: { activity: { kind: "CLASE", grupo: `G${i}`, aula: "A1" } },
      start: `2026-11-0${i}T08:00:00.000Z`,
      end: `2026-11-0${i}T10:00:00.000Z`,
      recordedAt: `2026-11-0${i}T12:00:00.000Z`,
      mode: "POSTERIOR" as const,
      hash: "",
    };
    base.hash = entryHash(materialOf(base));
    out.push(base);
    prev = base.hash;
  }
  return out;
}

test("una cadena intacta se verifica", () => {
  const r = verifyChain(build(5));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.count, 5);
});

test("cambiar el contenido de una anotación rompe la cadena en esa anotación", () => {
  const c = build(5);
  (c[2].payload as { activity: { grupo: string } }).activity.grupo = "OTRO";
  const r = verifyChain(c);
  assert.deepEqual(r.ok ? null : r.seq, 3);
});

test("rehacer la huella de la anotación cambiada la desengancha de la siguiente", () => {
  const c = build(5);
  c[2].end = "2026-11-03T11:00:00.000Z";
  c[2].hash = entryHash(materialOf(c[2]));
  const r = verifyChain(c);
  assert.equal(r.ok ? null : r.seq, 4);
});

test("borrar una anotación se detecta", () => {
  const c = build(5);
  c.splice(1, 1);
  const r = verifyChain(c);
  assert.equal(r.ok, false);
});

test("la huella depende del usuario (no se puede trasplantar a otra persona)", () => {
  const c = build(1);
  const m = materialOf(c[0]);
  assert.notEqual(entryHash({ ...m, user: "u2" }), c[0].hash);
});
