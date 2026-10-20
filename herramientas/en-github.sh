#!/usr/bin/env bash
# en-github.sh · Corre una batería de pruebas y, en GitHub Actions, convierte cada falla (renglones «MAL» o «FALLA») en
# una anotación, que se lee en el resumen del commit o del PR sin abrir la bitácora completa. Devuelve la salida de la
# batería. Fuera de GitHub sólo la corre.
# Uso: bash herramientas/en-github.sh <título> <comando> [argumentos…]
set -uo pipefail
titulo="$1"; shift
salida="$(mktemp)"
trap 'rm -f "$salida"' EXIT
"$@" 2>&1 | tee "$salida"
estado=${PIPESTATUS[0]}
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  anota() { while IFS= read -r l; do l="${l//'%'/%25}"; printf '::error title=%s::%s\n' "$titulo" "${l:0:900}"; done; }
  if grep -qE '^(MAL|FALLA)' "$salida"; then grep -E '^(MAL|FALLA)' "$salida" | head -40 | anota
  elif [ "$estado" -ne 0 ]; then tail -8 "$salida" | anota; fi
fi
exit "$estado"
