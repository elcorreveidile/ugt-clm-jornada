import { createHash } from "node:crypto";
import { verifyChain, type ChainCheck } from "./chain";
import { loadRows, toChain } from "./store";

/** Comprueba la cadena completa de una persona y que lo guardado como «material» cuadre. */
export async function checkIntegrity(userId: string): Promise<ChainCheck & { unstamped: number }> {
  const rows = await loadRows(userId);
  const unstamped = rows.filter((r) => !r.stamp).length;
  for (const r of rows) {
    if (createHash("sha256").update(r.material).digest("hex") !== r.hash)
      return { ok: false, seq: r.seq, reason: "El material guardado no coincide con su huella", unstamped };
  }
  return { ...verifyChain(rows.map(toChain)), unstamped };
}
