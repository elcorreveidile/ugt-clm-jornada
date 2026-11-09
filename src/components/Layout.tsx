import { NavLink, Outlet } from "react-router";
import { MeProvider, useMe } from "../me";

const tabs = [
  { to: "/", label: "Hoy", icon: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" },
  { to: "/historial", label: "Registro", icon: "M4 6h16M4 12h16M4 18h10" },
  { to: "/horario", label: "Horario", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { to: "/exportar", label: "Exportar", icon: "M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" },
  { to: "/ajustes", label: "Ajustes", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z" },
];

export default function Layout() {
  return (
    <MeProvider>
      <Shell />
    </MeProvider>
  );
}

function Shell() {
  const { me, perfil } = useMe();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <div className="min-w-0">
          <p className="font-bold leading-tight">Registro de jornada</p>
          <p className="truncate text-xs text-gray-500">{[me.perfil ? perfil.nombre : null, me.centro].filter(Boolean).join(" · ") || me.email}</p>
        </div>
      </header>
      <main className="space-y-4 p-4">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-ugt" : "text-gray-500"}`
              }
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.icon} />
              </svg>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok" | "warn"; children: React.ReactNode }) {
  const cls = {
    info: "bg-blue-50 text-blue-900 ring-blue-200",
    error: "bg-red-50 text-red-800 ring-red-200",
    ok: "bg-green-50 text-green-800 ring-green-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ring-1 ${cls}`}>{children}</div>;
}
