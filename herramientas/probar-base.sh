#!/usr/bin/env bash
# PRUEBA COMPLETA DE LA BASE en una base desechable: instala el esquema apd desde cero, la pone en entorno
# de pruebas, carga los expedientes ficticios COMO apd_api (pasando por todas las reglas) y corre las pruebas
# de reglas y permisos. Al final exporta datos/ficticios.json para la interfaz.
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

echo "1/6 Base desechable $base"
dropdb --if-exists "$base"
createdb "$base"

echo "2/6 Instalación (una sola transacción)"
(cd "$raiz/db/apd" && psql -q -X -d "$base" -v ON_ERROR_STOP=on -f instalar.sql)

echo "3/6 Entorno de pruebas (permite simular la fecha)"
psql -q -X -d "$base" -v ON_ERROR_STOP=on \
  -c "CREATE OR REPLACE FUNCTION apd.entorno() RETURNS text LANGUAGE sql STABLE AS \$\$ SELECT 'pruebas'::text \$\$"

echo "4/6 Expedientes ficticios, como apd_api"
node "$raiz/herramientas/ficticios.mjs" > "$temporal/ficticios.sql"
psql -q -X -d "$base" -U apd_api -v ON_ERROR_STOP=on -f "$temporal/ficticios.sql" > /dev/null

echo "5/6 Pruebas de reglas y permisos"
node "$raiz/herramientas/probar-reglas.mjs" "$base"

echo "6/6 Exportación de datos/ficticios.json"
node "$raiz/herramientas/exportar-ficticios.mjs" "$base"
echo "Listo."
