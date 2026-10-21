#!/bin/sh
# D4 · tiempos con gzip en scripts, estilos y datos, y el HTML sin comprimir (gzs): ver d4-cascada-*.txt, por qué.
cd "$(dirname "$0")"
PERSONA=index,cuenta,entrar,tramites,datos,solicitud,corregir,verificar,material
PERSONAL=revision,revisar,citas,cotejo,grupos,espera,programar,grupo,asistencia,aplicar,examen,material-personal
for R in 1 2; do
  REPN=$R COMPRIMIR=gzs node d4-tiempos.mjs ficticios 3g 6 $PERSONA 1 > /dev/null
  REPN=$R COMPRIMIR=gzs node d4-tiempos.mjs ficticios 4g 4 "" 1 > /dev/null
  REPN=$R COMPRIMIR=gzs node d4-tiempos.mjs volumen 4g 4 $PERSONAL 1 > /dev/null
done
echo FIN
