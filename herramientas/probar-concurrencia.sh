#!/usr/bin/env bash
# PRUEBAS DE CONCURRENCIA de la base apd: dos conexiones de apd_api a la vez, en READ COMMITTED (el aislamiento por
# omisión), sobre copias desechables de la base que deja probar-base.sh con los ficticios.
#
# Cierra los hallazgos E2-01 a E2-03 (auditoría r3, 19/10/2026) y RI-01 a RI-03 y RI-06 (revisión independiente):
# cada regla que consulta otra fila la bloquea (FOR UPDATE, decisión 4 del 19/10/2026), así que la segunda transacción
# espera a la primera, ve lo que hizo y, si ya no corresponde, recibe el error de su regla con su código (apd:...).
#
# Cómo se corre cada escenario: A abre su transacción, ejecuta sus sentencias y la deja abierta unos segundos; B empieza
# después, mientras A sigue abierta, y confirma al final. Después se revisa (como administración) que la base cumple la
# regla escrita y qué recibió B.
#
#   PGHOST=... PGPORT=... PGUSER=postgres bash herramientas/probar-concurrencia.sh [plantilla]
#
# <plantilla> es la base cargada por probar-base.sh (por omisión apd_prueba); no se modifica: cada escenario la copia
# (createdb -T) en apd_prueba_concurrencia y la borra al final. Lo llama probar-base.sh como uno de sus pasos.
# Variables opcionales: ESPERA_A (segundos que A sostiene su transacción, 2.5) y RETRASO_B (cuándo empieza B, 0.8).
# Sale con 1 si algún escenario falla.

set -uo pipefail
plantilla="${1:-apd_prueba}"
case "$plantilla" in
  *prueba*) ;;
  *) echo "Por seguridad, la base debe llevar «prueba» en el nombre: $plantilla" >&2; exit 2 ;;
esac
ESPERA_A="${ESPERA_A:-2.5}"
RETRASO_B="${RETRASO_B:-0.8}"
caso_base=apd_prueba_concurrencia
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"; dropdb --if-exists "$caso_base" >/dev/null 2>&1' EXIT
fallas=0
total=0

# Contexto que declara el backend al inicio de cada transacción (local a la transacción)
ctx() {
  echo "SELECT set_config('apd.usuario', '$1', true), set_config('apd.usuario_tipo', 'personal', true),
               set_config('apd.procedencia', 'prueba-concurrencia', true), set_config('apd.ahora_simulado', '$2', true);"
}
nueva() { dropdb --if-exists "$caso_base" >/dev/null 2>&1; createdb -T "$plantilla" "$caso_base"; }
q() { psql -X -At -v ON_ERROR_STOP=1 -d "$caso_base" -c "$1"; }
# Preparación del escenario, como apd_api y con todas las reglas
prepara() {
  printf 'BEGIN;\n%s\n%s\nCOMMIT;\n' "$(ctx preparacion "$1")" "$2" \
    | psql -X -q -U apd_api -d "$caso_base" -v ON_ERROR_STOP=1 >/dev/null
}

# par <fecha> <sqlA> <sqlB>: A empieza y sostiene; B empieza RETRASO_B segundos después. Deja $tmp/A.log y $tmp/B.log
par() {
  local fecha=$1 a=$2 b=$3
  printf '\\set ON_ERROR_STOP on\n\\set VERBOSITY verbose\nBEGIN;\n%s\n%s\nSELECT pg_sleep(%s);\nCOMMIT;\n' \
    "$(ctx revisora.a "$fecha")" "$a" "$ESPERA_A" > "$tmp/A.sql"
  printf '\\set ON_ERROR_STOP on\n\\set VERBOSITY verbose\nSELECT pg_sleep(%s);\nBEGIN;\n%s\n%s\nCOMMIT;\n' \
    "$RETRASO_B" "$(ctx revisora.b "$fecha")" "$b" > "$tmp/B.sql"
  ( psql -X -q -U apd_api -d "$caso_base" -f "$tmp/A.sql" > "$tmp/A.log" 2>&1; echo "salida=$?" >> "$tmp/A.log" ) &
  local pa=$!
  ( psql -X -q -U apd_api -d "$caso_base" -f "$tmp/B.sql" > "$tmp/B.log" 2>&1; echo "salida=$?" >> "$tmp/B.log" ) &
  local pb=$!
  wait $pa $pb
}
codigo_de() { grep -o 'HINT:  apd:[a-z_]*' "$1" | head -1 | sed 's/.*apd://'; }
error_de() { grep -m1 -E 'ERROR:' "$1" | sed 's/.*ERROR: *//' | cut -c1-140; }

# verifica <nombre> <esperado de B: ok | código | código1|código2> <consulta que devuelve t si la base cumple la regla>
verifica() {
  local nombre=$1 espera=$2 regla=$3
  total=$((total + 1))
  local sa sb cb bien=1 motivo=''
  sa=$(tail -1 "$tmp/A.log"); sb=$(tail -1 "$tmp/B.log"); cb=$(codigo_de "$tmp/B.log")
  if [ "$sa" != "salida=0" ]; then bien=0; motivo="A falló: $(error_de "$tmp/A.log")"; fi
  if [ "$espera" = ok ]; then
    if [ "$sb" != "salida=0" ]; then bien=0; motivo="$motivo B esperaba terminar bien y recibió: $(error_de "$tmp/B.log") [${cb:-sin código}]"; fi
  elif ! [[ "|$espera|" == *"|$cb|"* ]] || [ -z "$cb" ]; then
    bien=0; motivo="$motivo B esperaba apd:$espera y recibió: $( [ "$sb" = salida=0 ] && echo 'ningún error' || echo "$(error_de "$tmp/B.log") [${cb:-sin código}]")"
  fi
  local r
  r=$(q "$regla" 2>&1)
  if [ "$r" != t ]; then bien=0; motivo="$motivo la base quedó contra la regla: $(q "$4" 2>&1 | tr '\n' ' ')"; fi
  if [ $bien = 1 ]; then
    echo "BIEN  $nombre · B: ${cb:+apd:}${cb:-terminó bien}"
  else
    fallas=$((fallas + 1))
    echo "FALLA $nombre"
    echo "      $motivo"
  fi
}

# ─────────────── 1 · Dos revisoras deciden a la vez la misma solicitud (APD-S-2026-00044, enviada) ───────────────
F1='2026-10-14 13:00-06'
SOL="(SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00044')"
ACEPTA="UPDATE apd.documento SET estado = 'aceptado', revisado_por = current_setting('apd.usuario') WHERE solicitud_id = $SOL AND vigente;"
CITA() { echo "UPDATE apd.solicitud SET cita_en = '$1' WHERE id = $SOL;"; }
VALIDA="INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES ($SOL, 'validada', current_setting('apd.usuario'));"
OBSDOC="UPDATE apd.documento SET estado = 'con_observacion', observacion = 'La identificación está vencida.', revisado_por = current_setting('apd.usuario') WHERE solicitud_id = $SOL AND requisito = 'identificacion_oficial' AND vigente;"
OBSDOC_CURP="UPDATE apd.documento SET estado = 'con_observacion', observacion = 'La CURP no se lee.', revisado_por = current_setting('apd.usuario') WHERE solicitud_id = $SOL AND requisito = 'curp' AND vigente;"
ACEPTA_CURP="UPDATE apd.documento SET estado = 'aceptado', observacion = '', revisado_por = current_setting('apd.usuario') WHERE solicitud_id = $SOL AND requisito = 'curp' AND vigente;"
OBSREV="INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES ($SOL, 'con_observaciones', current_setting('apd.usuario'));"
OBSREV_TXT="INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES ($SOL, 'con_observaciones', 'Corrige la identificación.', current_setting('apd.usuario'));"
MOTIVO="SELECT set_config('apd.motivo', 'Revisión documental: identificación vencida', true);"
# La regla: una sola revisión en la vuelta; lo que dice la revisión es el estado de la solicitud; validada con todos sus
# documentos aceptados por quien validó y una cita abierta; con observaciones con texto o documento observado; ninguna
# cita abierta fuera de «Cita asignada»
REGLA_REV="SELECT (SELECT count(*) FROM apd.revision r WHERE r.solicitud_id = s.id) <= 1
   AND NOT EXISTS (SELECT 1 FROM apd.revision r WHERE r.solicitud_id = s.id
                    AND CASE r.resultado WHEN 'validada' THEN 'validada_en_linea' ELSE r.resultado END <> s.estado)
   AND (s.estado <> 'validada_en_linea' OR (
          NOT EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = s.id AND d.vigente
                       AND (d.estado <> 'aceptado' OR d.revisado_por IS DISTINCT FROM (SELECT r.revisor FROM apd.revision r WHERE r.solicitud_id = s.id)))
          AND (SELECT count(*) FROM apd.cita c WHERE c.solicitud_id = s.id AND c.resultado IN ('pendiente', 'en_pausa')) = 1))
   AND (s.estado <> 'con_observaciones'
        OR EXISTS (SELECT 1 FROM apd.revision r WHERE r.solicitud_id = s.id AND trim(r.observacion_general) <> '')
        OR EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = s.id AND d.vigente AND d.estado = 'con_observacion'))
   AND (s.estado = 'validada_en_linea' OR NOT EXISTS (SELECT 1 FROM apd.cita c WHERE c.solicitud_id = s.id AND c.resultado IN ('pendiente', 'en_pausa')))
  FROM apd.solicitud s WHERE s.folio = 'APD-S-2026-00044'"
MIRA_REV="SELECT 'estado=' || s.estado || ' revisiones=' || coalesce((SELECT string_agg(resultado || '/' || revisor, ',') FROM apd.revision r WHERE r.solicitud_id = s.id), '-')
   || ' docs=' || (SELECT string_agg(requisito || ':' || estado || '/' || coalesce(revisado_por, ''), ',' ORDER BY requisito) FROM apd.documento d WHERE d.solicitud_id = s.id AND d.vigente)
   || ' citas_abiertas=' || (SELECT count(*) FROM apd.cita c WHERE c.solicitud_id = s.id AND c.resultado IN ('pendiente', 'en_pausa'))
  FROM apd.solicitud s WHERE s.folio = 'APD-S-2026-00044'"

echo "== 1 · Revisión documental con dos revisoras"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$OBSDOC $OBSREV"
verifica "1a · A valida; B observa un documento y registra observaciones" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$ACEPTA $(CITA '2026-10-22 12:00-06') $VALIDA"
verifica "1b · Las dos validan, con citas distintas (documentos → cita → revisión)" "cita_abierta|revision_ya_registrada" "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA"
verifica "1c · Las dos validan con la misma cita" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$VALIDA $ACEPTA $(CITA '2026-10-21 10:00-06')"
verifica "1d · B registra la revisión antes que los documentos (las dos validan)" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$OBSREV_TXT $OBSDOC"
verifica "1e · A valida; B, revisión primero, con observaciones" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$MOTIVO $OBSREV_TXT $OBSDOC"
verifica "1f · Igual que 1e, con motivo declarado" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$OBSDOC $OBSREV" "$VALIDA $ACEPTA $(CITA '2026-10-21 10:00-06')"
verifica "1g · A observa; B valida (revisión primero)" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
nueva; par "$F1" "$ACEPTA $(CITA '2026-10-21 10:00-06') $VALIDA" "$MOTIVO $OBSREV_TXT"
verifica "1h · A valida; B sólo escribe observaciones generales (con motivo)" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
# Independiente RI-03: con la CURP observada, una acepta la CURP y la otra envía observaciones apoyada en ella
CURP_OBS="UPDATE apd.documento SET estado = 'con_observacion', observacion = 'La CURP no se lee.', revisado_por = 'preparacion' WHERE solicitud_id = $SOL AND requisito = 'curp' AND vigente;"
nueva; prepara "$F1" "$CURP_OBS"; par "$F1" "$ACEPTA_CURP" "$OBSREV"
verifica "1i · A acepta la CURP observada; B envía observaciones sin texto (RI-03)" observaciones_vacias "$REGLA_REV" "$MIRA_REV"
nueva; prepara "$F1" "$CURP_OBS"; par "$F1" "$OBSREV" "$ACEPTA_CURP"
verifica "1j · A envía observaciones apoyada en la CURP; B la acepta (RI-03)" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"
# Independiente RI-06: dos revisiones con observaciones en la misma vuelta
nueva; par "$F1" "$OBSREV_TXT" "$OBSDOC_CURP $OBSREV"
verifica "1k · Las dos envían observaciones (RI-06)" revision_ya_registrada "$REGLA_REV" "$MIRA_REV"

# ─────────────── 2 · Grupos: cupos y bajas ───────────────
F2='2026-10-14 10:00-06'
G4="(SELECT id FROM apd.grupo WHERE folio = 'APD-G-2026-004')"
G5="(SELECT id FROM apd.grupo WHERE folio = 'APD-G-2026-005')"
S() { echo "(SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-$1')"; }
REGLA_GRUPOS="SELECT NOT EXISTS (SELECT 1 FROM apd.grupo g WHERE (g.estado IN ('confirmado', 'en_curso')
                                  AND (SELECT count(*) FROM apd.inscripcion i WHERE i.grupo_id = g.id AND i.activa) < g.cupo_minimo)
                                  OR (SELECT count(*) FROM apd.inscripcion i WHERE i.grupo_id = g.id AND i.activa) > g.cupo_maximo)
   AND NOT EXISTS (SELECT solicitud_id FROM apd.inscripcion WHERE activa GROUP BY solicitud_id HAVING count(*) > 1)"
MIRA_GRUPOS="SELECT string_agg(g.folio || ':' || g.estado || ':' || (SELECT count(*) FROM apd.inscripcion i WHERE i.grupo_id = g.id AND i.activa) || '/' || g.cupo_minimo || '-' || g.cupo_maximo, ' ' ORDER BY g.folio) FROM apd.grupo g"
echo "== 2 · Grupos"
# Cupo máximo: un grupo de poda renovación con cupo 1 a 2 (se baja el cupo del curso sólo para crearlo) y una persona
CUPO2="UPDATE apd.curso SET cupo_minimo = 1, cupo_maximo = 2 WHERE tipo_acreditacion = 'poda' AND modalidad = 'renovacion';
  INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion) VALUES ('00000000-0000-4000-d000-000000000001', 'poda', 'renovacion', 'combinado');
  UPDATE apd.curso SET cupo_minimo = 5, cupo_maximo = 25 WHERE tipo_acreditacion = 'poda' AND modalidad = 'renovacion';
  INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00011), '00000000-0000-4000-d000-000000000001');"
GC="'00000000-0000-4000-d000-000000000001'"
nueva; prepara "$F2" "$CUPO2"
par "$F2" "INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00012), $GC);" "INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00013), $GC);"
verifica "2a · Dos inscripciones a la vez al último lugar" cupo_maximo "$REGLA_GRUPOS" "$MIRA_GRUPOS"
nueva
par "$F2" "INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00040), $G4);" "INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00040), $G5);"
verifica "2b · La misma solicitud a dos grupos a la vez" solicitud_no_lista "$REGLA_GRUPOS" "$MIRA_GRUPOS"
# Cupo mínimo: APD-G-2026-005 (en integración, con fecha, hora e instructor) completa 5 personas
CINCO="INSERT INTO apd.inscripcion (solicitud_id, grupo_id) SELECT id, $G5 FROM apd.solicitud WHERE folio IN ('APD-S-2026-00037', 'APD-S-2026-00038', 'APD-S-2026-00031', 'APD-S-2026-00036');"
CONFIRMA="UPDATE apd.grupo SET estado = 'confirmado' WHERE id = $G5;"
BAJA() { echo "UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Pidió otra fecha' WHERE grupo_id = $G5 AND activa AND solicitud_id = $(S "$1");"; }
nueva; prepara "$F2" "$CINCO"; par "$F2" "$CONFIRMA" "$(BAJA 00037)"
verifica "2c · A confirma el grupo de 5; B da de baja a una persona (el grupo regresa a integración)" ok "$REGLA_GRUPOS" "$MIRA_GRUPOS"
nueva; prepara "$F2" "$CINCO"; par "$F2" "$(BAJA 00037)" "$CONFIRMA"
verifica "2d · A da de baja a una persona; B confirma el grupo" cupo_minimo "$REGLA_GRUPOS" "$MIRA_GRUPOS"
nueva; prepara "$F2" "$CINCO INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES ($(S 00039), $G5); $CONFIRMA"
par "$F2" "$(BAJA 00037)" "$(BAJA 00038)"
verifica "2e · Dos bajas a la vez en un grupo confirmado de 6 (RI-01)" ok "$REGLA_GRUPOS" "$MIRA_GRUPOS"
# Sesión de trabajo del 23/10/2026 (P149): como máximo 2 grupos al mismo tiempo. APD-G-2026-005 ya tiene la semana del
# 26/10; dos personas crean a la vez otro grupo esa semana: sin el candado de apd.comprobar_fechas_grupo, cada una contaría
# un solo grupo y quedarían tres
OTRO_GRUPO() { echo "INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('$1', 'nueva', 'combinado', '2026-10-26');"; }
REGLA_SIMULTANEOS="SELECT NOT EXISTS (SELECT 1 FROM generate_series('2026-10-01'::date, '2026-12-31'::date, interval '1 day') d
   WHERE (SELECT count(*) FROM apd.grupo g JOIN apd.curso c USING (tipo_acreditacion, modalidad)
           WHERE g.estado IN ('en_integracion', 'confirmado', 'en_curso') AND g.fecha_inicio IS NOT NULL
             AND d::date BETWEEN g.fecha_inicio AND g.fecha_inicio + c.dias_duracion - 1) > 2)"
MIRA_SIMULTANEOS="SELECT string_agg(folio || ':' || estado || ':' || coalesce(fecha_inicio::text, '-'), ' ' ORDER BY folio) FROM apd.grupo WHERE fecha_inicio >= '2026-10-19'"
nueva; par "$F2" "$(OTRO_GRUPO dictaminador)" "$(OTRO_GRUPO poda)"
verifica "2f · Dos personas crean a la vez otro grupo en una semana que ya tiene uno (P149)" grupos_simultaneos "$REGLA_SIMULTANEOS" "$MIRA_SIMULTANEOS"

# ─────────────── 4 · Examen frente a baja y frente a corrección de asistencia (APD-S-2026-00021, grupo 003) ───────────────
# El grupo 003 va del lunes 12 al viernes 16/10 (sesión del 23/10/2026: de lunes a viernes), con los días 1 y 2 capturados
F4='2026-10-16 10:00-06'
INS="(SELECT i.id FROM apd.inscripcion i JOIN apd.solicitud s ON s.id = i.solicitud_id WHERE s.folio = 'APD-S-2026-00021' AND i.activa)"
ASISTE="INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por) SELECT $INS, d, true, 'preparacion' FROM generate_series(3, 5) d;"
EXAMEN="INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES ($INS, '2026-10-16', 9.0, current_setting('apd.usuario'));"
BAJA21="UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Baja solicitada' WHERE id = $INS;"
FALTA="UPDATE apd.asistencia SET asistio = false, capturada_por = current_setting('apd.usuario') WHERE inscripcion_id = $INS AND dia = 5;"
REGLA_EXAMEN="SELECT NOT EXISTS (SELECT 1 FROM apd.examen e JOIN apd.inscripcion i ON i.id = e.inscripcion_id
                         JOIN apd.grupo g ON g.id = i.grupo_id JOIN apd.curso c ON (c.tipo_acreditacion, c.modalidad) = (g.tipo_acreditacion, g.modalidad)
                        WHERE NOT i.activa
                           OR NOT EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.dia = c.dias_duracion AND a.asistio)
                           OR (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) < c.dias_minimos_asistencia)"
MIRA_EXAMEN="SELECT 'activa=' || i.activa || ' examen=' || coalesce((SELECT calificacion::text FROM apd.examen e WHERE e.inscripcion_id = i.id), '-')
   || ' asistidos=' || (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) || ' solicitud=' || s.estado
  FROM apd.inscripcion i JOIN apd.solicitud s ON s.id = i.solicitud_id WHERE s.folio = 'APD-S-2026-00021' ORDER BY i.inscrita_en DESC LIMIT 1"
echo "== 4 · Examen, baja y asistencia"
nueva; prepara "$F4" "$ASISTE"; par "$F4" "$EXAMEN" "$BAJA21"
verifica "4a · A captura el examen; B da de baja a la persona" baja_con_examen "$REGLA_EXAMEN" "$MIRA_EXAMEN"
nueva; prepara "$F4" "$ASISTE"; par "$F4" "$BAJA21" "$EXAMEN"
verifica "4b · A da de baja a la persona; B captura el examen" inscripcion_inactiva "$REGLA_EXAMEN" "$MIRA_EXAMEN"
nueva; prepara "$F4" "$ASISTE"; par "$F4" "$EXAMEN" "$FALTA"
verifica "4c · A captura el examen; B corrige el día del examen a «faltó»" asistencia_cerrada "$REGLA_EXAMEN" "$MIRA_EXAMEN"
nueva; prepara "$F4" "$ASISTE"; par "$F4" "$FALTA" "$EXAMEN"
verifica "4d · A corrige el día del examen a «faltó»; B captura el examen" sin_pase_de_lista "$REGLA_EXAMEN" "$MIRA_EXAMEN"

echo
echo "$((total - fallas)) de $total escenarios de concurrencia correctos."
[ "$fallas" -eq 0 ]
