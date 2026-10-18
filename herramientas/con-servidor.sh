#!/usr/bin/env bash
# con-servidor.sh · Corre un comando con la versión de prueba servida en http://localhost:8765/ y apaga el servidor al
# terminar. Si ya hay un servidor en ese puerto, lo usa y no lo toca. Así las pruebas del sitio no dejan un servidor
# encendido después de la corrida.
# Uso: bash herramientas/con-servidor.sh <comando> [argumentos…]
set -euo pipefail
cd "$(dirname "$0")/.."
PUERTO=8765
URL="http://localhost:${PUERTO}/"

responde() { curl -s -o /dev/null --max-time 1 "${URL}VERSION"; }

if responde; then
  exec "$@"
fi

python3 -m http.server "$PUERTO" --directory sitio >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill "$SERVIDOR" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  responde && break
  sleep 0.1
done
responde || { echo "No se pudo servir sitio/ en el puerto ${PUERTO}." >&2; exit 1; }

"$@"
