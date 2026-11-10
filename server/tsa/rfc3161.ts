// Cliente de sellado de tiempo RFC 3161 (Time-Stamp Protocol).
//
// Se envía a una autoridad de sellado (TSA) la huella SHA-256 de una anotación;
// la TSA devuelve un «token» firmado que dice «esta huella existía en tal
// fecha». El token lo puede verificar cualquiera sin depender de esta app:
//   openssl ts -verify -digest <huella> -in sello.tsr -CAfile <CA de la TSA>
//
// Por defecto se usa FreeTSA (gratuita, no cualificada). Para una autoridad
// cualificada (eIDAS) basta con cambiar las variables TSA_* (ver tsa/config.ts):
// el protocolo es el mismo.
import { createHash, webcrypto, randomBytes } from "node:crypto";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

pkijs.setEngine("node", new pkijs.CryptoEngine({ name: "node", crypto: webcrypto as unknown as Crypto }));

const SHA256_OID = "2.16.840.1.101.3.4.2.1";

/** TimeStampReq (DER) para una huella SHA-256, pidiendo el certificado de la TSA. */
export function buildTimeStampRequest(hashHex: string, opts: { nonce?: Uint8Array; policyOid?: string } = {}): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hashHex)) throw new Error("La huella debe ser SHA-256 en hexadecimal");
  const nonce = opts.nonce ?? randomBytes(8);
  // Un INTEGER positivo: si el primer bit está a 1, se antepone un 0.
  const nonceBytes = nonce[0] & 0x80 ? Uint8Array.from([0, ...nonce]) : nonce;
  const req = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: SHA256_OID, algorithmParams: new asn1js.Null() }),
      hashedMessage: new asn1js.OctetString({ valueHex: Buffer.from(hashHex, "hex") }),
    }),
    nonce: new asn1js.Integer({ valueHex: nonceBytes }),
    certReq: true,
    ...(opts.policyOid ? { reqPolicy: opts.policyOid } : {}),
  });
  return new Uint8Array(req.toSchema().toBER(false));
}

export interface ParsedTimestamp {
  /** Fecha certificada por la TSA (ISO, UTC). */
  genTime: string;
  /** Número de serie del sello en la TSA (hex). */
  serial: string;
  /** Huella que contiene el sello (hex). */
  hashedMessage: string;
  /** OID de la política de la TSA. */
  policy: string;
  /** Token (ContentInfo CMS) en DER: lo que se guarda y se entrega como prueba. */
  token: Uint8Array;
}

function toArrayBuffer(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

function tstInfoOf(contentInfo: pkijs.ContentInfo): pkijs.TSTInfo {
  const signed = new pkijs.SignedData({ schema: contentInfo.content });
  const econtent = signed.encapContentInfo.eContent;
  if (!econtent) throw new Error("El sello no contiene información de fecha");
  return pkijs.TSTInfo.fromBER(econtent.getValue());
}

function describe(tst: pkijs.TSTInfo, token: Uint8Array): ParsedTimestamp {
  return {
    genTime: tst.genTime.toISOString(),
    serial: Buffer.from(tst.serialNumber.valueBlock.valueHexView).toString("hex"),
    hashedMessage: Buffer.from(tst.messageImprint.hashedMessage.valueBlock.valueHexView).toString("hex"),
    policy: tst.policy,
    token,
  };
}

/** Interpreta una TimeStampResp (lo que devuelve la TSA). Lanza si no se concedió. */
export function parseTimeStampResponse(der: Uint8Array): ParsedTimestamp {
  const resp = pkijs.TimeStampResp.fromBER(toArrayBuffer(der));
  const status = resp.status.status;
  if (status !== 0 && status !== 1) {
    const text = resp.status.statusStrings?.map((s) => s.valueBlock.value).join(" ") ?? "";
    throw new Error(`La TSA rechazó la petición (estado ${status}) ${text}`.trim());
  }
  if (!resp.timeStampToken) throw new Error("La respuesta de la TSA no trae sello");
  const token = new Uint8Array(resp.timeStampToken.toSchema().toBER(false));
  return describe(tstInfoOf(resp.timeStampToken), token);
}

/** Interpreta un token ya guardado (ContentInfo en DER). */
export function parseTimeStampToken(token: Uint8Array): ParsedTimestamp {
  const ci = pkijs.ContentInfo.fromBER(toArrayBuffer(token));
  return describe(tstInfoOf(ci), token);
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return toArrayBuffer(Buffer.from(b64, "base64"));
}

export function certificatesFromPem(pem: string): pkijs.Certificate[] {
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  return blocks.map((b) => pkijs.Certificate.fromBER(pemToDer(b)));
}

/**
 * Verifica criptográficamente un token: firma de la TSA, cadena de certificados
 * hasta la CA de confianza y que lo sellado sea la huella SHA-256 de `data`
 * (en este registro, el JSON canónico de la anotación).
 */
export async function verifyTimeStampToken(
  token: Uint8Array,
  data: Uint8Array,
  trustedPem: string,
): Promise<{ ok: boolean; genTime?: string; reason?: string }> {
  try {
    const parsed = parseTimeStampToken(token);
    const hashHex = createHash("sha256").update(data).digest("hex");
    if (parsed.hashedMessage.toLowerCase() !== hashHex)
      return { ok: false, reason: "El sello corresponde a otra huella" };
    const ci = pkijs.ContentInfo.fromBER(toArrayBuffer(token));
    const signed = new pkijs.SignedData({ schema: ci.content });
    const ok = await signed.verify({
      signer: 0,
      // Con un TSTInfo, pkijs comprueba que su huella sea la de estos datos.
      data: toArrayBuffer(data),
      trustedCerts: certificatesFromPem(trustedPem),
      checkChain: true,
      checkDate: new Date(parsed.genTime),
    });
    return ok ? { ok: true, genTime: parsed.genTime } : { ok: false, reason: "Firma de la TSA no válida" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
