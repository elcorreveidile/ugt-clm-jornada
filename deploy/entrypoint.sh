#!/bin/sh
# Al arrancar: aplica el esquema (sin borrar nunca datos: si un cambio implicara
# perder datos, Prisma se niega y el contenedor no arranca) y los disparadores de
# solo anotación. Después, el servidor.
set -e
pnpm exec prisma db push
pnpm exec tsx scripts/apply-sql.ts
exec node --import tsx server/main.ts
