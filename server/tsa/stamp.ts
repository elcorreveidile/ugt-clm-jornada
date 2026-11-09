import { buildTimeStampRequest, parseTimeStampResponse, type ParsedTimestamp } from "./rfc3161";
import { tsaConfig, type TsaConfig } from "./config";

/** Pide un sello para una huella. Lanza si la TSA no responde o lo deniega. */
export async function requestTimestamp(
  hashHex: string,
  cfg: TsaConfig = tsaConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedTimestamp & { provider: string; qualified: boolean }> {
  const body = buildTimeStampRequest(hashHex, { policyOid: cfg.policyOid });
  const res = await fetchImpl(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/timestamp-query", Accept: "application/timestamp-reply", ...cfg.headers },
    body: Buffer.from(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`La TSA respondió ${res.status}`);
  const parsed = parseTimeStampResponse(new Uint8Array(await res.arrayBuffer()));
  if (parsed.hashedMessage !== hashHex.toLowerCase()) throw new Error("La TSA selló otra huella");
  return { ...parsed, provider: cfg.name, qualified: cfg.qualified };
}
