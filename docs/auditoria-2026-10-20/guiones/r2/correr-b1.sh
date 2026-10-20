#!/bin/sh
# Corre b1-revisar.mjs en los tamaños dados, uno tras otro; se puede volver a lanzar y sigue donde iba.
cd "$(dirname "$0")"
for v in "$@"; do VISTA=$v node b1-revisar.mjs >> ../b1/revisar-$v.log 2>&1; done
