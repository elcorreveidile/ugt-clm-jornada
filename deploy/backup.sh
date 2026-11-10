#!/bin/sh
# Copia diaria de la base de datos (comprimida). Guarda las de los últimos 30 días.
# Las copias quedan en el volumen «copias»; hay que sacarlas también fuera del
# servidor (ver docs/DESPLIEGUE-VPS.md).
set -e
while true; do
  f="/copias/jornada-$(date +%Y-%m-%d_%H%M).sql.gz"
  if pg_dump -h db -U jornada -d jornada --no-owner | gzip > "$f.tmp"; then
    mv "$f.tmp" "$f"
    echo "Copia hecha: $f"
  else
    rm -f "$f.tmp"
    echo "ERROR: no se pudo hacer la copia" >&2
  fi
  find /copias -name 'jornada-*.sql.gz' -mtime +30 -delete
  sleep 86400
done
