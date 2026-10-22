#!/usr/bin/env bash
# PRUEBA COMPLETA DE LA BASE en una base desechable: instala el esquema apd desde cero, la pone en entorno
# de pruebas, carga los expedientes ficticios COMO apd_api (pasando por todas las reglas) y corre las pruebas
# de reglas y permisos, las de concurrencia (dos conexiones a la vez) y la de respaldo y restauración. Al final
# exporta datos/ficticios.json para la interfaz.
#
# Requiere psql y un servidor PostgreSQL 13+ de pruebas al que se llega con las variables estándar de libpq
# (PGHOST, PGPORT, PGUSER con permisos de administración). Nunca se apunta a una base real: la base de
# prueba se borra y se vuelve a crear.
#
#   PGHOST=... PGPORT=... PGUSER=postgres herramientas/probar-base.sh [nombre_de_base]
#
# Si un paso falla, el guion se detiene ahí (set -e) y no corre los siguientes.

set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
base="${1:-apd_prueba}"
temporal="$(mktemp -d)"
trap 'rm -rf "$temporal"' EXIT

case "$base" in
  *prueba*) ;;
  *) echo "Por seguridad, la base de prueba debe llevar «prueba» en el nombre: $base" >&2; exit 1 ;;
esac

echo "1/8 Base desechable $base"
dropdb --if-exists "$base"
createdb "$base"

echo "2/8 Instalación (una sola transacción)"
(cd "$raiz/db/apd" && psql -q -X -d "$base" -v ON_ERROR_STOP=on -f instalar.sql)

echo "3/8 Entorno de pruebas (permite simular la fecha)"
psql -q -X -d "$base" -v ON_ERROR_STOP=on \
  -c "CREATE OR REPLACE FUNCTION apd.entorno() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT 'pruebas'::text \$\$"

echo "4/8 Expedientes ficticios, como apd_api"
node "$raiz/herramientas/ficticios.mjs" > "$temporal/ficticios.sql"
psql -q -X -d "$base" -U apd_api -v ON_ERROR_STOP=on -f "$temporal/ficticios.sql" > /dev/null

echo "5/8 Pruebas de reglas y permisos"
node "$raiz/herramientas/probar-reglas.mjs" "$base"

echo "6/8 Pruebas de concurrencia (dos conexiones de apd_api a la vez, sobre copias de $base)"
bash "$raiz/herramientas/probar-concurrencia.sh" "$base"

# Decisión 5 (2026-10-19): el respaldo se toma con pg_dump, su huella sha256 se guarda APARTE del respaldo (otra carpeta;
# en el SIA, otro lugar y otro responsable) y se comprueba antes de restaurar; la restauración de prueba va a otra base,
# con los mismos conteos por tabla, la misma huella de la bitácora y las mismas reglas. Procedimiento: docs/REGLAS.md.
echo "7/8 Respaldo, huella aparte y restauración de prueba en otra base"
respaldos="$temporal/respaldos"; huellas="$temporal/huellas"; mkdir -p "$respaldos" "$huellas"
restaurada="${base}_restaurada"
pg_dump -Fc -d "$base" -f "$respaldos/$base.dump"
sha256sum "$respaldos/$base.dump" > "$huellas/$base.dump.sha256"
sha256sum --quiet -c "$huellas/$base.dump.sha256"
# Un respaldo alterado (un byte de más) no pasa la comprobación de su huella
cp "$respaldos/$base.dump" "$respaldos/alterado.dump"
printf 'X' >> "$respaldos/alterado.dump"
if sed "s#$respaldos/$base.dump#$respaldos/alterado.dump#" "$huellas/$base.dump.sha256" | sha256sum --status -c - 2>/dev/null; then
  echo "La huella guardada aparte no detectó un respaldo alterado" >&2; exit 1
fi
echo "Huella guardada aparte: el respaldo la cumple y uno alterado no"
dropdb --if-exists "$restaurada"
createdb "$restaurada"
pg_restore --exit-on-error -d "$restaurada" "$respaldos/$base.dump"
conteos() {
  psql -X -At -v ON_ERROR_STOP=1 -d "$1" -c "SELECT string_agg(format('%s=%s', table_name,
      (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM apd.%I', table_name), false, true, '')))[1]::text), ' ' ORDER BY table_name)
    FROM information_schema.tables WHERE table_schema = 'apd' AND table_type = 'BASE TABLE';
    SELECT 'bitacora_md5=' || md5(string_agg(b::text, '|' ORDER BY b.fecha, b.id)) FROM apd.bitacora b;
    SELECT 'disparadores=' || count(*) FILTER (WHERE tgenabled = 'O') FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relnamespace = 'apd'::regnamespace AND NOT t.tgisinternal;"
}
conteos "$base" > "$temporal/conteos-original.txt"
conteos "$restaurada" > "$temporal/conteos-restaurada.txt"
if ! diff "$temporal/conteos-original.txt" "$temporal/conteos-restaurada.txt"; then
  echo "La base restaurada no tiene los mismos datos que la original" >&2; exit 1
fi
echo "Conteos iguales en las $(head -1 "$temporal/conteos-original.txt" | wc -w) tablas, misma huella de la bitácora y mismos disparadores"
node "$raiz/herramientas/probar-reglas.mjs" "$restaurada" | tail -1
dropdb "$restaurada"

echo "8/8 Exportación de datos/ficticios.json (y de la bitácora, aparte: datos/bitacora-ficticia.json)"
node "$raiz/herramientas/exportar-ficticios.mjs" "$base"
# Regenerar no debe cambiar los archivos sin motivo (auditoría 2026-10-19, A3-01): se comparan con los guardados en Git.
# Aquí sólo se informa (quien cambió los ficticios debe guardar los archivos nuevos); la verificación de GitHub falla.
if git -C "$raiz" rev-parse --verify -q HEAD >/dev/null 2>&1; then
  for f in datos/ficticios.json datos/bitacora-ficticia.json; do
    if git -C "$raiz" diff --quiet -- "$f" && git -C "$raiz" ls-files --error-unmatch "$f" >/dev/null 2>&1; then echo "$f: igual al guardado en Git."
    else echo "$f: cambió respecto al guardado en Git (git diff $f)."; fi
  done
fi
echo "Listo."
