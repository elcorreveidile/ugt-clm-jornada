// Verificación completa de un paquete de evidencias (la usa el script
// `pnpm verificar` y los tests). No toca la base de datos.
import { createHash } from "node:crypto";
import { GENESIS } from "../ledger/chain";
import { verifyTimeStampToken } from "../tsa/rfc3161";
import { EVIDENCE_FORMAT, type EvidencePackage } from "./evidence";

export interface PackageCheck {
  ok: boolean;
  entradas: number;
  selladas: number;
  errores: string[];
}

export async function verifyPackage(pkg: EvidencePackage, trustedPem: string): Promise<PackageCheck> {
  const errores: string[] = [];
  if (pkg.formato !== EVIDENCE_FORMAT) errores.push(`Formato desconocido: ${pkg.formato}`);
  let prev = GENESIS;
  let selladas = 0;
  for (const [i, e] of pkg.entradas.entries()) {
    if (e.seq !== i + 1) errores.push(`Falta la anotación nº ${i + 1}`);
    const h = createHash("sha256").update(e.material).digest("hex");
    if (h !== e.hash) errores.push(`Nº ${e.seq}: el material no corresponde a su huella`);
    let m: { prev?: string; seq?: number; user?: string };
    try {
      m = JSON.parse(e.material);
    } catch {
      errores.push(`Nº ${e.seq}: material ilegible`);
      continue;
    }
    if (m.prev !== prev || e.prevHash !== prev) errores.push(`Nº ${e.seq}: no enlaza con la anterior`);
    if (m.seq !== e.seq) errores.push(`Nº ${e.seq}: número de anotación incoherente`);
    if (m.user !== pkg.titular.id) errores.push(`Nº ${e.seq}: pertenece a otra persona`);
    if (e.sello) {
      const v = await verifyTimeStampToken(Buffer.from(e.sello.token, "base64"), new TextEncoder().encode(e.material), trustedPem);
      if (v.ok) selladas++;
      else errores.push(`Nº ${e.seq}: sello no válido (${v.reason})`);
    }
    prev = e.hash;
  }
  return { ok: errores.length === 0, entradas: pkg.entradas.length, selladas, errores };
}
