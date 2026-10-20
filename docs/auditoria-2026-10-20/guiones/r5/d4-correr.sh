#!/bin/sh
# D4 · matriz de tiempos (r5, 20/10/2026). Requiere servidor-r5.mjs en el puerto 8905. Uso: sh d4-correr.sh <repetición>
# Perfiles: «gama baja» = 3G lento + procesador 6× (personas en teléfono); «gama media» = 4G lento + procesador 4×.
# Con los archivos sin comprimir (como el servidor de prueba) y con gzip (como serviría el SIA).
# Personal con el escenario de volumen: sin freno de red (oficina) con procesador 4× y 6×, y 4G lento con gzip.
cd "$(dirname "$0")"
R=${1:-1}
PERSONA=index,cuenta,entrar,tramites,datos,solicitud,corregir,verificar,material
PERSONAL=revision,revisar,citas,cotejo,grupos,espera,programar,grupo,asistencia,aplicar,examen,material-personal
for comp in "" gzip; do
  REPN=$R COMPRIMIR=$comp node d4-tiempos.mjs ficticios 3g 6 $PERSONA 1 > /dev/null
  REPN=$R COMPRIMIR=$comp node d4-tiempos.mjs ficticios 4g 4 "" 1 > /dev/null
done
REPN=$R node d4-tiempos.mjs volumen sin 4 $PERSONAL 1 > /dev/null
REPN=$R node d4-tiempos.mjs volumen sin 6 $PERSONAL 1 > /dev/null
REPN=$R COMPRIMIR=gzip node d4-tiempos.mjs volumen 4g 4 $PERSONAL 1 > /dev/null
echo FIN $R
