// Qué autoridad de sellado se usa. Cambiar a una cualificada (eIDAS) es solo
// configuración: TSA_URL, TSA_NAME, TSA_QUALIFIED=1, su autenticación si la pide
// y su certificado raíz (TSA_CA_PEM) para la verificación.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface TsaConfig {
  url: string;
  name: string;
  qualified: boolean;
  headers: Record<string, string>;
  policyOid?: string;
}

export const FREETSA_URL = "https://freetsa.org/tsr";

export function tsaConfig(env: NodeJS.ProcessEnv = process.env): TsaConfig {
  const headers: Record<string, string> = {};
  if (env.TSA_BASIC_AUTH) headers.Authorization = `Basic ${Buffer.from(env.TSA_BASIC_AUTH).toString("base64")}`;
  if (env.TSA_AUTH_HEADER) {
    const i = env.TSA_AUTH_HEADER.indexOf(":");
    if (i > 0) headers[env.TSA_AUTH_HEADER.slice(0, i).trim()] = env.TSA_AUTH_HEADER.slice(i + 1).trim();
  }
  return {
    url: env.TSA_URL || FREETSA_URL,
    name: env.TSA_NAME || "FreeTSA (no cualificada)",
    qualified: env.TSA_QUALIFIED === "1",
    headers,
    policyOid: env.TSA_POLICY_OID || undefined,
  };
}

/** Certificados raíz de confianza para verificar los sellos (FreeTSA + el que se configure). */
export function trustedTsaPem(env: NodeJS.ProcessEnv = process.env): string {
  const freetsa = readFileSync(fileURLToPath(new URL("./freetsa-cacert.pem", import.meta.url)), "utf8");
  return env.TSA_CA_PEM ? `${freetsa}\n${env.TSA_CA_PEM}` : freetsa;
}
