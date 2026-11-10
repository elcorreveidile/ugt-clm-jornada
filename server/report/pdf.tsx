// Informe mensual en PDF del registro de jornada.
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { ACTIVITY_KINDS, CAT_LABEL, ENTRY_LABEL, TZ, type IncidenciaCat } from "../../shared/events";
import { etiqueta, type Perfil } from "../../shared/perfiles";
import { CREDITO, horaLocal, turno, type Horario } from "../../shared/centro";
import type { DerivedActivity, LedgerEntry } from "../../shared/derive";
import { hhmm, type MonthReport } from "./data";

const RED = "#B71C1C";

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 8.5, fontFamily: "Helvetica", color: "#111" },
  brand: { fontSize: 8, color: RED, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, color: RED },
  muted: { color: "#555" },
  box: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 8, marginTop: 8 },
  warn: { borderWidth: 1, borderColor: "#f0c36d", backgroundColor: "#fff8e6", borderRadius: 4, padding: 8, marginTop: 8 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  mono: { fontFamily: "Courier", fontSize: 7 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#777", flexDirection: "row", justifyContent: "space-between" },
  kv: { flexDirection: "row", marginBottom: 2 },
  k: { width: 110, color: "#555" },
});

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
const monthName = (mes: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-15T12:00:00Z`));

function detalle(a: DerivedActivity, p: Perfil): string {
  const parts: string[] = [];
  if (a.grupo) parts.push(`${p.campos.grupo}: ${a.grupo}`);
  if (a.aula) parts.push(`${p.campos.aula}: ${a.aula}`);
  const act = a.activity;
  if (act?.cantidad !== undefined) parts.push(`${(p.cantidad ?? "Cantidad").replace(" (opcional)", "")}: ${act.cantidad}`);
  if (act?.sustituye) parts.push(`Sustituye a ${act.sustituye}`);
  if (act?.categoria) parts.push(CAT_LABEL[act.categoria as IncidenciaCat]);
  if (act?.descripcion) parts.push(act.descripcion);
  if (a.nota) parts.push(`Nota: ${a.nota}`);
  if (a.motivo) parts.push(`${a.status === "ANULADA" ? "Anulada" : a.status === "NO_IMPARTIDA" ? "Motivo" : "Corregida"}: ${a.motivo}`);
  return parts.join(" · ");
}

function estado(a: DerivedActivity & { fuera: boolean }): string {
  const f: string[] = [];
  if (a.status === "ANULADA") f.push("ANULADA");
  else if (a.status === "EN_CURSO") f.push("En curso");
  f.push(a.mode === "MOMENTO" ? "En el momento" : "Posterior");
  if (a.corrected) f.push("corregida");
  if (a.fuera) f.push("fuera de horario");
  return f.join(", ");
}

const Col = ({ w, children }: { w: number; children: React.ReactNode }) => (
  <Text style={{ width: w, paddingRight: 4 }}>{children}</Text>
);

export interface PdfOwner {
  name: string;
  email: string;
  nif: string | null;
  centro: string;
  horario: Horario;
  perfil: Perfil;
}

export interface PdfMeta {
  generatedAt: string;
  verifyUrl: string;
  tsaName: string;
}

function ReportDoc({ r, owner, meta }: { r: MonthReport; owner: PdfOwner; meta: PdfMeta }) {
  const t = r.totals;
  const tsaOf = (e: LedgerEntry) => (e.tsa ? `${fmtDateTime(e.tsa.genTime)} (${e.tsa.provider})` : "pendiente");
  const bySeq = new Map(r.entries.map((e) => [e.seq, e]));
  return (
    <Document title={`Registro de jornada ${r.mes} — ${owner.name || owner.email}`} author="Registro de jornada" creator={CREDITO}>
      <Page size="A4" style={s.page} wrap>
        <Text style={s.brand}>REGISTRO PERSONAL DE JORNADA</Text>
        <Text style={s.h1}>Registro de jornada · {monthName(r.mes)}</Text>
        <View style={s.box}>
          <View style={s.kv}><Text style={s.k}>Titular</Text><Text>{owner.name || "(sin nombre)"}</Text></View>
          {owner.nif ? <View style={s.kv}><Text style={s.k}>NIF</Text><Text>{owner.nif}</Text></View> : null}
          <View style={s.kv}><Text style={s.k}>Correo</Text><Text>{owner.email}</Text></View>
          {owner.centro ? <View style={s.kv}><Text style={s.k}>Centro de trabajo</Text><Text>{owner.centro}</Text></View> : null}
          {owner.horario.apertura && owner.horario.cierre ? (
            <View style={s.kv}><Text style={s.k}>Horario del centro</Text><Text>{owner.horario.apertura} a {owner.horario.cierre}</Text></View>
          ) : null}
          <View style={s.kv}><Text style={s.k}>Informe generado</Text><Text>{fmtDateTime(meta.generatedAt)} (hora de Madrid)</Text></View>
        </View>
        <View style={s.warn}>
          <Text>
            Registro personal llevado por la persona trabajadora. No sustituye al registro diario de jornada que la
            empresa está obligada a llevar (art. 34.9 del Estatuto de los Trabajadores). Cada anotación está encadenada
            a la anterior mediante su huella SHA-256 y sellada en el tiempo por una autoridad externa (RFC 3161), de modo
            que cualquier modificación posterior es detectable. Las anotaciones no se pueden editar ni borrar: las
            correcciones y anulaciones quedan como anotaciones nuevas y figuran en este informe.
          </Text>
        </View>

        <Text style={s.h2}>Resumen</Text>
        <View style={s.box}>
          {ACTIVITY_KINDS.filter((k) => k !== "PAUSA" && (t.minutesByKind[k] > 0 || owner.perfil.kinds.includes(k))).map((k) => (
            <View key={k} style={s.kv}><Text style={s.k}>{etiqueta(owner.perfil, k)}</Text><Text>{hhmm(t.minutesByKind[k])}</Text></View>
          ))}
          <View style={s.kv}><Text style={s.k}>Presencia</Text><Text>{hhmm(t.presencia)}</Text></View>
          <View style={s.kv}><Text style={s.k}>Pausas</Text><Text>{hhmm(t.pausas)}</Text></View>
          <View style={s.kv}><Text style={[s.k, { fontFamily: "Helvetica-Bold" }]}>Tiempo efectivo</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{hhmm(t.efectivo)}</Text></View>
          <Text style={[s.muted, { marginTop: 4 }]}>
            Apuntadas en el momento: {t.momento} · apuntadas después: {t.posterior} · corregidas: {t.corregidas} ·
            anuladas: {t.anuladas} · clases no impartidas: {t.noImpartidas} · fuera del horario del centro: {t.fuera} ·
            anotaciones sin sello: {t.sinSello}
          </Text>
        </View>

        {r.avisos.length > 0 ? (
          <>
            <Text style={s.h2}>Posibles incumplimientos a revisar</Text>
            <View style={s.warn}>
              <Text style={{ marginBottom: 3 }}>Indicios calculados a partir de este registro. Revísalos con tu convenio, que puede fijar otra distribución.</Text>
              {r.avisos.map((a, i) => (
                <Text key={i}>· {fmtDate(`${a.fecha}T12:00:00Z`)}: {a.texto}</Text>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.h2}>Actividades del mes</Text>
        <View style={s.head}>
          <Col w={62}>Fecha</Col>
          <Col w={36}>Turno</Col>
          <Col w={52}>Franja</Col>
          <Col w={62}>Tipo</Col>
          <Col w={170}>Detalle</Col>
          <Col w={80}>Cómo se apuntó</Col>
          <Col w={40}>Nº anot.</Col>
        </View>
        {r.activities.length === 0 ? <Text style={[s.muted, { marginTop: 4 }]}>No hay actividades este mes.</Text> : null}
        {r.activities.map((a) => (
          <View key={a.rootId} style={[s.row, a.status === "ANULADA" ? { color: "#999" } : {}]} wrap={false}>
            <Col w={62}>{fmtDate(a.start)}</Col>
            <Col w={36}>{turno(a.start, owner.horario)}</Col>
            <Col w={52}>{horaLocal(a.start)}{a.end ? `–${horaLocal(a.end)}` : ""}</Col>
            <Col w={62}>{etiqueta(owner.perfil, a.kind)}</Col>
            <Col w={170}>{detalle(a, owner.perfil)}</Col>
            <Col w={80}>{estado(a)}</Col>
            <Col w={40}>{a.seqs.join(", ")}</Col>
          </View>
        ))}

        <Text style={s.h2} break>Anotaciones del registro</Text>
        <Text style={[s.muted, { marginBottom: 4 }]}>
          Cada anotación lleva la hora del servidor en que se hizo, la fecha del sello de tiempo y su huella SHA-256.
        </Text>
        {[...bySeq.values()].map((e) => (
          <View key={e.seq} style={s.row} wrap={false}>
            <View style={{ width: 40 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Nº {e.seq}</Text></View>
            <View style={{ flex: 1 }}>
              <Text>
                {ENTRY_LABEL[e.type]} · anotada {fmtDateTime(e.recordedAt)} · {e.mode === "MOMENTO" ? "en el momento" : "posterior"}
              </Text>
              <Text style={s.muted}>Sello de tiempo: {tsaOf(e)}</Text>
              <Text style={s.mono}>Huella: {e.hash}</Text>
              <Text style={s.mono}>Anterior: {e.prevHash}</Text>
            </View>
          </View>
        ))}

        <Text style={s.h2}>Integridad y verificación</Text>
        <View style={r.integrity.ok ? s.box : s.warn}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {r.integrity.ok
              ? `Cadena completa verificada al generar el informe: ${r.integrity.count} anotaciones sin alteraciones.`
              : `ATENCIÓN: la cadena falla en la anotación nº ${r.integrity.seq}: ${r.integrity.reason}.`}
          </Text>
          {r.head ? (
            <>
              <Text style={{ marginTop: 4 }}>Última anotación de la cadena: nº {r.head.seq}, {fmtDateTime(r.head.recordedAt)}</Text>
              <Text style={s.mono}>{r.head.hash}</Text>
              <Text style={s.muted}>Sello: {tsaOf(r.head)}</Text>
            </>
          ) : null}
        </View>
        <View style={s.box}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Cómo comprobarlo sin depender de esta aplicación</Text>
          <Text>1. Cualquier huella de este informe se puede consultar en {meta.verifyUrl}: indica si existe y cuándo se selló, sin mostrar su contenido.</Text>
          <Text>2. El titular puede descargar el «paquete de evidencias» (JSON) del mismo mes. Contiene el texto exacto de cada anotación y su sello de tiempo, y se verifica con la herramienta abierta del proyecto o con OpenSSL:</Text>
          <Text style={s.mono}>  openssl ts -verify -token_in -data anotacion.json -in sello.tsr -CAfile cacert.pem</Text>
          <Text>3. Autoridad de sellado usada: {meta.tsaName}. Un sello acredita que la anotación ya existía en esa fecha; como cada anotación incluye la huella de la anterior, también acredita todas las anteriores.</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Registro de jornada · {owner.email} · {r.mes} · {CREDITO}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderMonthPdf(r: MonthReport, owner: PdfOwner, meta: PdfMeta): Promise<Buffer> {
  return renderToBuffer(<ReportDoc r={r} owner={owner} meta={meta} />);
}
