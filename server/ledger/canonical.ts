// JSON canónico: claves ordenadas, sin espacios y sin campos `undefined`.
// Es lo que se resume con SHA-256, así que debe ser estable y reproducible por
// cualquiera (el verificador independiente usa la misma regla).
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error("Número no representable en JSON");
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
    }
    default:
      throw new Error(`Tipo no admitido en JSON canónico: ${typeof value}`);
  }
}
