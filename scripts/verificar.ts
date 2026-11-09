// Verificador independiente de un paquete de evidencias.
//   pnpm verificar paquete.json [ca-de-la-tsa.pem]
import { readFileSync } from "node:fs";
import { verifyPackage } from "../server/report/verify-package";
import { trustedTsaPem } from "../server/tsa/config";

const [file, caFile] = process.argv.slice(2);
if (!file) {
  console.error("Uso: pnpm verificar <paquete.json> [ca-de-la-tsa.pem]");
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(file, "utf8"));
const pem = trustedTsaPem() + (caFile ? `\n${readFileSync(caFile, "utf8")}` : "");
const r = await verifyPackage(pkg, pem);
console.log(`Titular: ${pkg.titular?.nombre || ""} <${pkg.titular?.correo}>`);
console.log(`Anotaciones: ${r.entradas} · con sello válido: ${r.selladas}`);
if (r.ok) console.log("RESULTADO: cadena íntegra y sellos válidos.");
else {
  console.log("RESULTADO: se han encontrado problemas:");
  for (const e of r.errores) console.log(` - ${e}`);
}
process.exit(r.ok ? 0 : 1);
