# Registro de jornada

App de registro personal de jornada con valor de prueba (web + Android + iOS). Desarrollada por la Sección Sindical
de UGT en el CLM (Universidad de Granada) y pensada para cualquier colectivo. El crédito va discreto (`CREDITO` en
`shared/centro.ts`): no protagoniza la app. Ver README para la arquitectura completa.

## Reglas que no se rompen

- **Solo anotación.** `Entry` y `Stamp` nunca se actualizan ni se borran desde el código (el disparador de
  `prisma/sql/append-only.sql` lo impide). Corregir = anotación `CORRECCION`; anular = `ANULACION`. La única
  excepción es borrar la cuenta (transacción con `SET LOCAL jornada.allow_delete = 'on'`).
- **La huella no cambia de forma.** El material que se resume (`HashMaterial`, `server/ledger/chain.ts`) y el JSON
  canónico (`canonical.ts`) son contrato con los paquetes de evidencias ya emitidos. Si hiciera falta cambiarlos,
  subir `HASH_VERSION` y mantener la verificación de la versión anterior.
- **La hora que cuenta es la del servidor** (`recordedAt`); `INICIO`/`FIN` son «en el momento», el resto «posterior».
- **Toda entrada se valida en el servidor** con `shared/events.ts` y las reglas de `shared/derive.ts` (`checkEntry`).
- **`JORNADA_DATABASE_URL`**, nunca `DATABASE_URL` (en el entorno de Claude Code esa apunta a otra base de datos).
- Datos de terceros fuera: en cuidados o sanidad, referencias, no nombres de usuarios o pacientes.

## Colectivos

`shared/perfiles.ts`: cada perfil fija tipos de actividad, nombres de campos (internamente `grupo` y `aula`),
incidencias, horario típico y textos. Añadir un colectivo = añadir un perfil. El perfil no cambia lo ya registrado.

## Validación antes de subir

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Los tests de integración (`tests/db.test.ts`) usan
`JORNADA_TEST_DATABASE_URL` (Postgres con el SQL aplicado) y piden sellos reales a FreeTSA; la CI los corre.

## Registro de decisiones

- **2026-11-09**: primera versión (0.1.0). Decidido con Javier: app independiente (no dentro de WordNext); medidas
  probatorias = solo anotación + cadena de huellas + sello RFC 3161 (FreeTSA gratis, preparado para una autoridad
  cualificada eIDAS por configuración) + PDF mensual y paquete de evidencias verificable; cada persona ve solo lo suyo;
  horario por periodos (en el CLM llega en las actas de la intranet: grupo, aula y horario); clases de 8:30 a 22:00
  con turnos de mañana y tarde. Después, por petición de Javier: marca discreta (no predominante) y app para otros
  colectivos (hostelería y otros), con pausas, turnos de noche, desplazamientos, guardias, cantidad opcional y avisos
  de posibles incumplimientos de los arts. 34.3 y 34.4 ET. Acceso por enlace (web) y código de 6 cifras (apps).
  Pendiente: importar actas/cuadrantes (falta un ejemplo), recordatorios y biometría en las apps, revisión jurídica.
- **2026-11-09**: 0.2.0. Importador de actas del CLM (`shared/acta.ts`; PDF con pdf.js o texto pegado, en el
  dispositivo; año del período según el curso académico: septiembre-diciembre el primero, enero-agosto el segundo;
  no se guardan nombres de profesores ni alumnado). Responsable del tratamiento configurable (`RESPONSABLE_*`,
  `GET /api/info`): Javier decidirá si figura él o la Sección Sindical. Dominio: `jornada.ugtclmgranada.org`.
- **2026-11-09**: 0.3.0. Despliegue elegido por Javier: **VPS en España con Docker** (no Vercel; `vercel.json`
  queda como alternativa). `docker-compose.yml` = app (`server/main.ts`: web + API, sellado de pendientes cada
  15 min) + Postgres 16 + Caddy (HTTPS) + copias diarias (`deploy/backup.sh`). El arranque aplica el esquema con
  `prisma db push` (sin aceptar pérdida de datos). Guía en `docs/DESPLIEGUE-VPS.md`. Probado con Docker de punta a
  punta (HTTPS, sello real, PDF, disparador, copia y restauración).
