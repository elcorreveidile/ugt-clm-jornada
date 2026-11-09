# Registro de jornada

Registro **personal** de jornada con valor de prueba: cada persona trabajadora anota sus horas, turnos, pausas,
desplazamientos e incidencias, y obtiene un informe mensual en PDF y un paquete de evidencias que cualquiera puede
verificar sin depender de la aplicación.

Desarrollada por la Sección Sindical de UGT en el Centro de Lenguas Modernas (CLM) de la Universidad de Granada.
Pensada para ofrecerse a cualquier colectivo.

> No sustituye al registro de jornada que la empresa está obligada a llevar (art. 34.9 del Estatuto de los
> Trabajadores). Es un medio de prueba propio de la persona trabajadora.

## Colectivos

Cada persona elige su colectivo al entrar (y lo puede cambiar en Ajustes). Cambian las palabras y los tipos de
anotación; la parte probatoria es la misma para todos. Se definen en `shared/perfiles.ts`: añadir uno nuevo es
añadir un perfil.

| Colectivo | Qué registra |
|---|---|
| Docencia | Clases (grupo y aula), sustituciones, pruebas de nivel, incidencias |
| Hostelería | Turnos (partidos o de noche), pausas, habitaciones o servicios, incidencias |
| Comercio | Turnos, horas complementarias, incidencias |
| Limpieza | Servicios por centro, desplazamientos entre centros |
| Cuidados | Servicios por domicilio, desplazamientos, domicilios atendidos |
| Sanidad y sociosanitario | Turnos, guardias, incidencias |
| Transporte y reparto | Conducción, esperas o disponibilidad, entregas |
| Seguridad privada | Servicios por puesto |
| Campo y manipulado | Jornadas de campaña, cajas o kilos |
| Otro colectivo | Jornada, pausas, desplazamientos, guardias |

Para todos: fichar en el momento (botón), apuntar después con sus horas, horario o cuadrante previsto (la app propone
lo que toca cada día), «no se hizo» con motivo, correcciones y anulaciones, y **avisos de posibles incumplimientos**
(más de 9 h de trabajo efectivo al día, más de 6 h seguidas sin pausa, menos de 12 h entre jornadas), que se señalan
como indicios a revisar con el convenio.

## Cómo se garantiza la prueba

1. **Solo anotación.** Nada se edita ni se borra: una corrección o una anulación es una anotación nueva que remite a
   la original. Un disparador de Postgres (`prisma/sql/append-only.sql`) impide `UPDATE`, `DELETE` y `TRUNCATE` en
   las anotaciones y los sellos. Única excepción: borrar la cuenta entera a petición de su titular (RGPD).
2. **Cadena de huellas.** Cada anotación guarda la SHA-256 de la anterior; su propia huella se calcula sobre su JSON
   canónico (`server/ledger/chain.ts`). Cambiar o quitar una anotación rompe la cadena desde ese punto.
3. **Sello de tiempo RFC 3161** de una autoridad externa en cada anotación (`server/tsa/`). Prueba que existía en esa
   fecha; como incluye la huella anterior, prueba también todas las anteriores. Si la autoridad no responde, la
   anotación queda pendiente y la sella el cron o el botón «Sellar ahora».
4. **En el momento o después.** La hora que cuenta es la del servidor. Lo fichado con el botón se marca «en el
   momento»; lo apuntado después, «posterior».
5. **Verificación independiente.** El paquete de evidencias (JSON) trae el texto exacto de cada anotación y su sello.
   Se comprueba con `pnpm verificar paquete.json` o con OpenSSL:
   `openssl ts -verify -token_in -data anotacion.json -in sello.tsr -CAfile cacert.pem`.
   La página pública `/verificar` dice si una huella existe y cuándo se selló, sin mostrar contenido ni identidad.

Quien administre la base de datos podría desactivar el disparador, pero no puede rehacer los sellos: la prueba fuerte
son la cadena y los sellos, no el disparador. Los tests lo comprueban (`tests/db.test.ts`).

### Autoridad de sellado

Por defecto **FreeTSA** (gratuita, **no cualificada**). Para pasar a una autoridad **cualificada** según eIDAS (con
presunción legal de exactitud de la fecha) solo cambia la configuración:

```
TSA_URL=https://…/tsr
TSA_NAME=Nombre de la autoridad (cualificada)
TSA_QUALIFIED=1
TSA_BASIC_AUTH=usuario:clave                # o TSA_AUTH_HEADER="X-Api-Key: …", según el proveedor
TSA_CA_PEM="-----BEGIN CERTIFICATE-----…"   # raíz de la autoridad, para verificar
```

Las anotaciones ya selladas con FreeTSA siguen siendo válidas; las nuevas llevan el sello de la nueva autoridad.

## Arquitectura

- **Web y apps:** React + Vite (`src/`), Tailwind 4. Una sola base de código para la web y para las apps de Android e
  iOS (Capacitor).
- **API:** Hono (`server/app.ts`), servida en Vercel como función (`api/index.ts`); en local, `server/dev.ts`.
- **Base de datos:** Postgres (Neon en producción) con Prisma 7. La variable es **`JORNADA_DATABASE_URL`**, no
  `DATABASE_URL`, para no apuntar por error a otra base de datos del entorno.
- **Acceso:** sin contraseñas. Se pide por correo un enlace (web) y un código de 6 cifras (apps). La sesión es un token
  aleatorio del que solo se guarda la huella: cookie httpOnly en la web, cabecera `Authorization` en las apps.
- **Informes:** PDF con `@react-pdf/renderer` (`server/report/pdf.tsx`) y paquete de evidencias JSON
  (`server/report/evidence.ts`).
- **Lógica compartida y pura** (la usan la app y el servidor): `shared/events.ts` (tipos y validación),
  `shared/derive.ts` (estado de cada actividad, reglas, tiempos), `shared/avisos.ts`, `shared/perfiles.ts`,
  `shared/centro.ts` (zona horaria Europa/Madrid, turnos), `shared/planner.ts`.

## Desarrollo

```
pnpm install
cp .env.example .env        # y rellenar JORNADA_DATABASE_URL
pnpm db:push                # esquema + disparadores de solo anotación
pnpm dev                    # API en :8787 y web en :5173
```

Sin `BREVO_API_KEY`, el enlace y el código de acceso salen en el log de la API.

Validación: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Los tests de integración necesitan un Postgres
con el SQL aplicado: `JORNADA_TEST_DATABASE_URL=postgresql://… pnpm test` (sin ella se saltan).

## Despliegue (Vercel + Neon)

1. Crear el proyecto en Vercel desde este repositorio y una base de datos en Neon.
2. Variables (ver `.env.example`): `JORNADA_DATABASE_URL`, `APP_URL`, `BREVO_API_KEY`,
   `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `CRON_SECRET` y, si se cambia de autoridad, las `TSA_*`.
3. Aplicar el esquema contra producción: `pnpm db:push` (también aplica `prisma/sql/append-only.sql`).
4. Dominio propuesto: `jornada.ugtclmgranada.org`.

## Apps para Google Play y App Store

Las apps empaquetan la web construida y hablan con la API pública.

```
cp .env.mobile.example .env.mobile   # VITE_API_BASE=https://<dominio de la API>
pnpm build:mobile                    # construye y sincroniza con Capacitor
npx cap add android                  # la primera vez
npx cap add ios                      # la primera vez (en un Mac con Xcode)
pnpm cap:android                     # abre Android Studio
pnpm cap:ios                         # abre Xcode
```

Pendiente antes de publicar:
- Cuentas de desarrollador de Google Play y Apple a nombre de quien vaya a figurar como editor.
- Iconos y pantallas de inicio en PNG (`@capacitor/assets`).
- Política de privacidad pública (la de `/aviso`, revisada) y ficha de las tiendas.
- Apple revisa que una app no sea solo una web envuelta (directriz 4.2). Para reforzarlo, el siguiente paso previsto
  son recordatorios locales («¿has empezado el turno?») y el acceso con Face ID o huella.

## Pendiente

- Revisión jurídica de `/aviso` y de los textos de los informes (datos del responsable entre corchetes).
- Importar el horario desde las actas o el cuadrante (se necesita un ejemplo de cada formato).
- Recordatorios y biometría en las apps.
- Autoridad de sellado cualificada cuando la herramienta se abra a más gente.
