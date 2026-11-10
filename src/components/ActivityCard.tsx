import { CAT_LABEL, type IncidenciaCat } from "../../shared/events";
import { etiqueta } from "../../shared/perfiles";
import { useMe } from "../me";
import { activityMinutes, type DerivedActivity } from "../../shared/derive";
import { fueraDeHorario, turno } from "../../shared/centro";
import { duracion, horaLocal } from "../format";

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "red" | "amber" | "green" | "blue" }) {
  const t = {
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-900",
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${t}`}>{children}</span>;
}

export default function ActivityCard({ a, bare, children }: { a: DerivedActivity; bare?: boolean; children?: React.ReactNode }) {
  const { perfil, horario } = useMe();
  const title = etiqueta(perfil, a.kind);
  const act = a.activity;
  const min = activityMinutes(a);
  const body = (
    <div className={a.status === "ANULADA" ? "opacity-60" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-semibold ${a.status === "ANULADA" ? "line-through" : ""}`}>
            {horaLocal(a.start)}
            {a.end ? `–${horaLocal(a.end)}` : ""} · {title}
          </p>
          <p className="text-sm text-gray-600">
            {[
              a.grupo && `${perfil.campos.grupo}: ${a.grupo}`,
              a.aula && `${perfil.campos.aula}: ${a.aula}`,
              act?.sustituye && `Sustituye a ${act.sustituye}`,
              act?.categoria && CAT_LABEL[act.categoria as IncidenciaCat],
              act?.cantidad !== undefined && `${(perfil.cantidad ?? "Cantidad").replace(" (opcional)", "")}: ${act.cantidad}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {act?.descripcion && <p className="text-sm text-gray-600">{act.descripcion}</p>}
          {a.nota && <p className="text-sm text-gray-600">Nota: {a.nota}</p>}
          {a.motivo && <p className="text-sm text-gray-600">Motivo: {a.motivo}</p>}
        </div>
        {min > 0 && <span className="shrink-0 text-sm font-medium text-gray-700">{duracion(min)}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone="gray">{turno(a.start, horario)}</Badge>
        {a.mode === "MOMENTO" ? <Badge tone="green">En el momento</Badge> : <Badge tone="blue">Apuntado después</Badge>}
        {a.corrected && <Badge tone="amber">Corregida</Badge>}
        {a.status === "ANULADA" && <Badge tone="red">Anulada</Badge>}
        {a.status !== "ANULADA" && a.kind !== "PAUSA" && fueraDeHorario(a.start, a.end, horario) && <Badge tone="amber">Fuera de horario</Badge>}
        <Badge tone="gray">Nº {a.seqs.join(", ")}</Badge>
      </div>
      {children}
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}
