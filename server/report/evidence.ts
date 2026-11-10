// Paquete de evidencias: todo lo necesario para que un tercero (Inspección,
// abogada, perito) verifique el registro sin fiarse de esta aplicación.
// Incluye la cadena completa desde la primera anotación hasta el final del
// periodo pedido, porque cada huella depende de todas las anteriores.
import type { Entry, Stamp } from "@prisma/client";
import { fechaLocal } from "../../shared/centro";

export const EVIDENCE_FORMAT = "ugt-clm-jornada/evidencia@1";

export interface EvidencePackage {
  formato: string;
  generado: string;
  titular: { nombre: string; correo: string; nif: string | null; id: string };
  periodo: string | null;
  instrucciones: string[];
  entradas: {
    seq: number;
    hash: string;
    prevHash: string;
    /** Texto exacto (JSON canónico) cuya SHA-256 es `hash` y que se selló. */
    material: string;
    sello: null | { proveedor: string; cualificado: boolean; fecha: string; serie: string; token: string };
  }[];
}

export function buildEvidence(
  rows: (Entry & { stamp: Stamp | null })[],
  owner: { id: string; name: string; email: string; nif: string | null },
  mes: string | null,
  now = new Date(),
): EvidencePackage {
  let upto = rows;
  if (mes) {
    const lastIdx = rows.reduce((acc, r, i) => (fechaLocal(r.recordedAt.toISOString()) <= `${mes}-31` ? i : acc), -1);
    upto = rows.slice(0, lastIdx + 1);
  }
  return {
    formato: EVIDENCE_FORMAT,
    generado: now.toISOString(),
    titular: { nombre: owner.name, correo: owner.email, nif: owner.nif, id: owner.id },
    periodo: mes,
    instrucciones: [
      "Cada entrada tiene un 'material' (JSON canónico). Su SHA-256 en hexadecimal debe ser igual a 'hash'.",
      "El campo 'prev' dentro del material debe ser igual al 'hash' de la entrada anterior (la primera enlaza con 64 ceros).",
      "El 'token' del sello (base64, DER) es un sello RFC 3161 sobre esa misma SHA-256. Para OpenSSL: guarda el material en un fichero sin salto de línea final, decodifica el token a sello.tsr y ejecuta: openssl ts -verify -token_in -data material.json -in sello.tsr -CAfile <certificado raíz de la autoridad>.",
      "Herramienta abierta del proyecto: pnpm verificar <paquete.json> (repositorio ugt-clm-jornada).",
    ],
    entradas: upto.map((r) => ({
      seq: r.seq,
      hash: r.hash,
      prevHash: r.prevHash,
      material: r.material,
      sello: r.stamp
        ? {
            proveedor: r.stamp.provider,
            cualificado: r.stamp.qualified,
            fecha: r.stamp.genTime.toISOString(),
            serie: r.stamp.serial,
            token: Buffer.from(r.stamp.token).toString("base64"),
          }
        : null,
    })),
  };
}
