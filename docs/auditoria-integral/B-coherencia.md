# Auditoría B · Coherencia entre documentos, prototipo y base de datos

Repositorio: `/home/claude/acreditaciones-arbolado` (versión de prueba 0.39, 17/10/2026). Revisión de sólo lectura: no se
cambió ningún archivo del repositorio. Todo se comprobó leyendo el código. Las únicas herramientas que se corrieron
fueron las de verificación que sólo leen: `generar-esquema.mjs --verificar` (al día) y `generar-pendientes.mjs --verificar`
(al día), además de búsquedas y conteos. No se reproduce ningún dato personal: las citas son `archivo:línea`.

Impacto: **Alta** = el sistema haría algo equivocado con una persona real, o la base rechazaría o aceptaría algo distinto
de lo que dicen las pantallas o las decisiones. **Media** = regla incompleta, contrato sin definir o documento que lleva
a construir mal. **Baja** = texto viejo, número equivocado o detalle sin efecto en el trámite.

---

## 1. Decisiones (`docs/DECISIONES.md`) contra el prototipo y la base

**1.1 · Un grupo que vuelve a integración no se puede volver a confirmar con su misma fecha si faltan menos de 7 días: choque entre dos decisiones** — Media
- Decisión 2026-10-17: el grupo «conserva su fecha, hora e instructor como propuesta; se vuelve a confirmar al completarse» (`docs/DECISIONES.md:150`). Otra decisión del mismo día: el curso empieza «al menos 7 días después de confirmar» (`docs/DECISIONES.md:147`).
- Base: la regla de anticipación se revisa cada vez que se pasa de `en_integracion` a `confirmado` (`db/apd/03-apd-reglas.sql:1315-1319`), y la baja manda el grupo de regreso a integración (`03-apd-reglas.sql:1447-1449`). La prueba hace lo mismo (`sitio/app/archivos-prueba.js:184` y `:189`), y la pantalla pone la fecha mínima en hoy + 7 (`sitio/app/grupo.js:168-171`).
- Resultado: si una baja ocurre a menos de 7 días del inicio, la fecha que «se conserva» ya no se acepta. Las personas que siguen en el grupo ya recibieron el aviso G1 (`docs/AVISOS-POR-CORREO.md:43`).
- Propuesta: que Liber decida. Opción A: al volver a confirmar se exige sólo que la fecha no haya pasado (regla `anticipacion` únicamente desde un grupo que nunca se confirmó). Opción B: la fecha deja de «conservarse» y se avisa a las personas. Anotar la decisión y ajustar la base, la prueba y `grupo.js`.

**1.2 · La declaración «bajo protesta de decir verdad» y el aviso de privacidad no quedan guardados en la base** — Media
- Decisión: la casilla de protesta es obligatoria (`docs/DECISIONES.md:56`). En el HTML el campo dice que sirve para «Dejar constancia» (`sitio/solicitud.html:560`), y hay otra casilla para el aviso (`sitio/solicitud.html:563-564`).
- Base: `apd.solicitud` no tiene columna para la protesta ni para el aviso (`db/apd/02-apd-tablas.sql:301-354`). La bitácora tampoco lo anota: el alta y el envío sólo registran el folio y el cambio de estado (`03-apd-reglas.sql:652-653` y `:957-958`).
- Propuesta: agregar `protesta_aceptada_en` y `aviso_privacidad_version` (o un renglón de bitácora al enviar) en `db/esquema.json`, exigirlos en `apd.comprobar_envio` y regenerar el modelo.

**1.3 · Nombre y apellidos: la persona podría cambiarlos y la base no lo impide ni lo anota** — Media
- Decisión: los datos ligados a la CURP «sólo los corrige la Secretaría» (`docs/DECISIONES.md:43`).
- Base: la CURP está protegida (sólo el personal, con motivo y bitácora: `03-apd-reglas.sql:393-399`). El nombre y los apellidos no: `apd.solicitante_cambio` sólo los pasa a mayúsculas (`03-apd-reglas.sql:362-364`) y la cuenta del servicio tiene permiso de cambiarlos (`db/apd/05-apd-rol-y-permisos.sql:46`). El nombre se usa en los archivos (`apd.nombre_de_archivo`), en la credencial y en la verificación pública.
- Propuesta: la misma regla que para la CURP (`usuario_tipo = personal` y `apd.motivo`, con un código nuevo, por ejemplo `nombre_sin_motivo`) y su caso en `probar-reglas.mjs`.

**1.4 · La fecha de la cita «desde el día siguiente» y la lista cerrada de horas sólo existen en la pantalla** — Media
- Decisiones: quien revisa elige la fecha «desde el día siguiente» (`docs/DECISIONES.md:70`). Las horas salen de una lista cerrada (`docs/DECISIONES.md:148`).
- Prototipo: el mínimo se pone a mano con `setAttribute('min', …)` (`sitio/app/revisar.js:263` y `sitio/app/cotejo.js:255`). Las horas están escritas a mano en tres listas (`sitio/revisar.html`, `sitio/cotejo.html` y `sitio/grupo.html`, con 11, 11 y 7 opciones).
- Base: `cita_en` sólo se revisa por permiso y por cita abierta (`03-apd-reglas.sql:793-801`). Acepta una cita en el pasado o de hoy, y a cualquier hora. `apd.cita.programada_en` no tiene restricción (`02-apd-tablas.sql:414`).
- Propuesta: en `apd.solicitud_cambio`, rechazar `cita_en` cuyo día sea `<= apd.hoy()` (con un código, por ejemplo `cita_en_el_pasado`). Las ventanas de horario pueden ir como parámetro cuando se resuelvan P69 y P91.

**1.5 · El examen «el último día del curso» no lo exige la base** — Media
- Decisiones: el examen es el último día (`docs/DECISIONES.md:168`). Las pantallas avisan si no es el día (`sitio/app/aplicar.js:52-56`).
- Base: `apd.examen_captura` acepta cualquier `presentado_en` entre el inicio y hoy (`03-apd-reglas.sql:1509-1511`). En un curso nuevo (5 días, mínimo 4) se podría registrar el examen el día 4. La auditoría de tareas ya lo había notado (A2: «Ni la pantalla ni la base exigen que el examen sea el último día», `docs/AUDITORIA-TAREAS-2026-10-17.md:26`) y lo corrigió sólo en la pantalla.
- Propuesta: exigir `presentado_en = fecha_inicio + dias_duracion - 1` en `apd.examen_captura`, con un código nuevo y su caso de prueba.

**1.6 · Sin rastro de quién corrigió la asistencia** — Media
- Decisión: «cada día queda quién capturó la asistencia» (`docs/DECISIONES.md:32`). Se puede corregir mientras el curso siga (`docs/DECISIONES.md:151`).
- Base: la corrección sobrescribe `asistio` y `capturada_por` (permiso en `05-apd-rol-y-permisos.sql:73`; regla en `03-apd-reglas.sql:1458-1484`) y no se anota en la bitácora. La asistencia decide el derecho a examen.
- Propuesta: anotar en `apd.asistencia_captura` cada alta y cada cambio (antes → después, quién).

**1.7 · Sexo: dos decisiones vigentes se contradicen** — Baja
- `docs/DECISIONES.md:18` dice que el sexo tomado de la CURP es un dato interno que la persona no ve. `docs/DECISIONES.md:43-44` dice que la persona lo consulta y que «se muestra de sólo lectura».
- Implementado como dato interno: `sitio/cuenta.html:86-92` y `sitio/app/datos.js:94-96`.
- Propuesta: tachar o ajustar la parte de las filas 43 y 44 que quedó sustituida.

**1.8 · Situación de los estudios en carrera técnica: decisión vieja sin tachar** — Baja
- `docs/DECISIONES.md:53` pide la situación del grado «también en carrera técnica». `docs/DECISIONES.md:54` la pide sólo con licenciatura o posgrado, que es lo que hacen la base (`03-apd-reglas.sql:256-258`) y el formulario.
- Propuesta: tachar esa parte de la fila 53.

**1.9 · Lugar de entrega de la credencial: tres versiones** — Baja
- `docs/REGLAS.md:60` dice que la entrega del mismo día es en el PILARES. `docs/DECISIONES.md:72` dice que la entrega es siempre en el Vivero. El parámetro `sede` también dice «y de la entrega» (`db/apd/04-apd-catalogos.sql:23-24`), y «Mis trámites» muestra «Dónde recogerla: Vivero…» (`sitio/app/tramites.js:166`).
- Propuesta: una sola frase en las tres fuentes (por ejemplo, «PILARES Vivero Nezahualcóyotl, dentro del predio del Vivero») cuando se resuelva P10.

**1.10 · Decisiones que hoy viven sólo en la pantalla o sólo en la base** — Media (lista para el plan de la etapa 3)
- Sólo en la pantalla y en el servidor de formularios, no en la base:
  - coherencia de la CURP con el nombre, los apellidos y la fecha (`docs/DECISIONES.md:33` y `:35`);
  - lista cerrada de horas (1.4) y cita desde mañana (1.4);
  - protesta (1.2);
  - motivos frecuentes de observación, que la Dirección puede ajustar y están escritos en el código (`herramientas/construir-sitio.mjs:147`).
- Sólo en la base, sin pantalla ni pendiente: pasar un grupo a «en curso» y a «concluido» (ver 3.6).

---

## 2. Códigos de error: `docs/REGLAS.md`, `03-apd-reglas.sql` y `probar-reglas.mjs`

Conteo hecho sobre el código. En `db/apd/*.sql` hay **125 llamadas** a `apd.error(...)` con **106 códigos distintos**.
`docs/REGLAS.md` nombra **22** y `herramientas/probar-reglas.mjs` prueba **55**. No hay ningún código en REGLAS ni en
las pruebas que no exista en la base.

**2.1 · 84 códigos no están en `docs/REGLAS.md`** — Media
- Ejemplos con efecto directo en el trámite:
  - `debe_renovar`, `renovacion_anticipada`, `renovacion_vencida`, `sin_poda_vigente`;
  - `sin_factura`, `sin_datos_factura`, `foto_sin_confirmar`;
  - `cupo_minimo`, `cupo_maximo`, `otro_curso`, `otra_organizacion`;
  - `dia_futuro`, `sin_derecho_examen`, `faltan_calificaciones`;
  - `sin_foto_credencial`, `sin_acuse_entrega`, `archivo_grande`, `formato_no_admitido`, `carga_fuera_de_turno`.
- REGLAS dice que «cada regla incumplida trae un mensaje para la persona y un código» (`docs/REGLAS.md:121-122`), pero no tiene la lista. El backend de la etapa 3 necesitará saber qué código va con qué campo.
- Propuesta: generar en REGLAS una tabla «código → regla → campo de la pantalla», sacada de `03-apd-reglas.sql` con un guion igual a `generar-esquema.mjs`. Hoy ninguna pantalla lee códigos de la base: el prototipo usa `{ errores: [{ campo, mensaje }] }`, y nadie dice cómo se pasa de uno a otro (por ejemplo `correo_registrado` → `correo` o `folio_fiscal_repetido` → `factura_folio_fiscal`).

**2.2 · 51 códigos sin ninguna prueba** — Media
- Dos están documentados y no se prueban: `documentos_sin_cotejar` (`docs/REGLAS.md:28`) y `sin_adscripcion` (`docs/REGLAS.md:24`).
- 49 no están documentados ni se prueban. Entre ellos, los que cuidan el resultado y la emisión:
  - `sin_examen`, `resultado_no_corresponde`, `con_derecho_examen`, `sin_inscripcion`, `sin_acreditacion`;
  - `emision_con_otra_fecha`, `entrega_futura`, `entrega_al_emitir`, `acreditacion_inmutable`;
  - `documentos_sin_aceptar`, `sin_revision`, `revision_fuera_de_turno`, `solicitud_cerrada`, `curso_fijo`;
  - `grupo_no_en_curso`, `asistencia_cerrada`, `fecha_examen`, `baja_con_examen`, `inscripcion_inactiva`, `cotejo_sin_motivo`, `sigue_inscrita`.
- La bitácora (`docs/BITACORA-PROYECTO.md:468`) dice que `solicitud_cerrada` protege la carrera técnica, pero ningún caso lo prueba.
- Propuesta: un caso por código, como mínimo para los que deciden el resultado, la emisión y la entrega.

**2.3 · Número de casos viejo** — Baja
- `docs/REGLAS.md:127` dice «160 casos». El archivo tiene 162 (bitácora, bloque 59: `docs/BITACORA-PROYECTO.md:835`).
- Propuesta: que REGLAS diga «ver la bitácora», sin el número.

**2.4 · Faltan reglas en REGLAS.md** — Baja
- `docs/REGLAS.md:66` («→ confirmado | Cupo mínimo, instructor, sede y fecha de inicio») no dice que la base también exige `hora_entrada` y la anticipación (`03-apd-reglas.sql:1310-1319`); esto último aparece aparte, en la línea 138.
- `docs/REGLAS.md:24` no menciona que la carrera técnica es obligatoria al enviar (`03-apd-reglas.sql:713`).

**2.5 · Vigencia: la tabla de REGLAS no cuadra con la base por un día** — Baja
- `docs/REGLAS.md:48-49`: «vigente» hasta 31 días antes del vencimiento y «por vencer» en los «últimos 30 días naturales, día del vencimiento incluido».
- La base marca «por vencer» desde 30 días antes del vencimiento, ese día incluido (`03-apd-reglas.sql:496-497`). Son 31 días contando el del vencimiento. Así la ventana coincide con la decisión (`docs/DECISIONES.md:189`) y con la pantalla (`sitio/app/apd.js:197`).
- Propuesta: «por_vencer: desde 30 días antes del vencimiento hasta el día del vencimiento».

**2.6 · Mensajes para el personal todavía en tú** — Baja
- La auditoría anterior dice que se corrigieron (`docs/AUDITORIA-2026-10-17.md:37-38`), pero quedan tres:
  - `sin_foto_credencial` («Carga…», `03-apd-reglas.sql:614`);
  - `sin_acuse_entrega` («Carga…», `:616`);
  - `cotejo_sin_motivo` («Indica…», `:845`).
- Los tres los lee el personal.
- Propuesta: «Cargue…» e «Indique…».

---

## 3. La simulación del navegador contra las reglas de la base

**3.1 · Grupo que vuelve a integración: «Mis trámites» le da la fecha a la persona como si siguiera confirmado** — Alta
- La base conserva `fecha_inicio` y `hora_entrada` cuando el grupo vuelve a `en_integracion` (`03-apd-reglas.sql:1447-1449`; la decisión está en `docs/DECISIONES.md:150`). La prueba hace lo mismo (`sitio/app/archivos-prueba.js:184`).
- «Mis trámites» decide con `if (g.grupo.fecha_inicio)` y no revisa el estado del grupo (`sitio/app/tramites.js:92-96`): muestra «Preséntate el …, a las …», «El curso termina el …» y la sede. El texto «todavía no está confirmado» sólo sale cuando no hay fecha (`tramites.js:99-100`).
- Una persona real iría a un curso que no está confirmado.
- Propuesta: decidir con `g.grupo.estado` (`confirmado` o `en_curso`); en integración, mostrar la fecha como «propuesta, por confirmar». Agregar el caso a `probar-sitio.mjs`.

**3.2 · Solicitud cerrada por dos inasistencias: con datos reales diría «no se corrigió a tiempo»** — Alta
- La base cierra con `concluida_sin_atender` y el motivo «No se presentó a su cita de cotejo N veces» (`03-apd-reglas.sql:1071-1076`). No guarda ninguna marca de la causa.
- La pantalla sólo distingue el caso por `s.cierre_por === 'inasistencia'` (`sitio/app/tramites.js:136` y `:193`), un campo que pone únicamente la simulación (`sitio/app/archivos-prueba.js:353-354`) y que no existe en `apd.solicitud` (`02-apd-tablas.sql:301-331`). Si no lo encuentra, usa el texto por omisión: «Cerrada: no se corrigió a tiempo» / «Las observaciones no se atendieron a tiempo» (`sitio/app/apd.js:34`), y debajo el motivo real de la base, que lo contradice.
- Los textos tampoco coinciden: la simulación dice «por segunda vez» (`archivos-prueba.js:354`) y la base «N veces».
- Propuesta: guardar la causa en la base (por ejemplo `apd.solicitud.cierre_causa`: `inasistencias`, `plazo_observaciones`, `persona`, `personal`), o que la API la saque de `apd.cita`. Quitar `cierre_por` de la simulación y usar el mismo dato.

**3.3 · Pausa vencida: la persona sigue viendo «cárgalo hoy» y la base le acepta la carga** — Alta
- Personal: desde la corrección M6, la cita sale «Pausa vencida» y no se retoma (`sitio/app/personal.js:120-121` y `sitio/app/cotejo.js:101-108`). La base tampoco deja retomarla (`pausa_vencida`, `03-apd-reglas.sql:1043-1048`).
- Persona: «Mis trámites» sigue diciendo «Consigue hoy el documento correcto. Cárgalo aquí…» sin mirar la fecha (`sitio/app/tramites.js:106-113`), y `corregir.js` admite la carga (`sitio/app/corregir.js:19-25`).
- Base: `apd.documento_alta` admite la carga mientras la cita siga `en_pausa`, sin revisar el día (`03-apd-reglas.sql:1153-1159`). Hasta que corra la tarea nocturna (P80), la persona carga un documento y regresa a la sede, y el personal ya no puede retomar el cotejo.
- Propuesta:
  - en la base, admitir la carga en pausa sólo el día de `pausada_en`;
  - en la persona, el mismo criterio que en el personal: «Tu pausa venció; la solicitud regresa con observaciones»;
  - un caso en `probar-reglas.mjs` y otro en `probar-sitio.mjs`.

**3.4 · Último día del curso: el pase de lista no llega a `apd.asistencia`, así que la base rechazaría las calificaciones** — Alta (depende de P94)
- La base exige la asistencia mínima con renglones `asistio` (`03-apd-reglas.sql:1504-1508`). En renovación el curso es de 1 día con mínimo 1 (`04-apd-catalogos.sql:35` y `:37`).
- La pantalla de asistencia nunca deja capturar el último día (`for (let n = 1; n < ultimoDia …)`, `sitio/app/asistencia.js:62`). En un curso de 1 día no hay nada que capturar.
- «Aplicar el examen» da derecho con `previos + 1 >= mínimo`, es decir, cuenta el día de hoy (`sitio/app/examen-grupo.js:52`). Pero «Presente» sólo se guarda en el almacenamiento del examen (`sitio/app/examen-servidor.js:217-222`); no llega a `datos.asistencia` ni a la simulación de grupos.
- Si la API no escribe `apd.asistencia` al pasar lista, la base respondería `sin_derecho_examen` a **todas** las renovaciones y a quien faltó un día en un curso nuevo. El prototipo dice que sí tienen derecho.
- Además, P94 y ETAPA-2 afirman que «hoy el prototipo también registra la asistencia del último día» (`docs/ETAPA-2-PANTALLAS.md:56-57`; recomendación de P94 en `docs/pendientes.json`). No es así en los datos: sólo existe en la lista del examen.
- Propuesta:
  - resolver P94;
  - si se queda la opción recomendada, que la API inserte `apd.asistencia(dia = dias_duracion, asistio = true)` en la misma transacción que genera el código (lo anuncia `examen-grupo.js:56-58`);
  - que la simulación lo aplique igual en `mezcla()`;
  - corregir el texto de ETAPA-2 y P94.

**3.5 · Días sin capturar: la prueba los sigue contando como asistidos** — Media (está documentado, pero cambia el resultado)
- `sitio/app/examen-grupo.js:18-21` y `:46-49`: un día pasado sin capturar cuenta como asistido, y se simula una falta en el día 3. La base lo cuenta como falta (`03-apd-reglas.sql:1504-1505`).
- A1 está «corregido» con avisos (`docs/AUDITORIA-TAREAS-2026-10-17.md:71`), pero la divergencia se queda a propósito.
- Propuesta: aceptable mientras sea prueba. Que el modo «sistema» (`aplicar.js:74`) se pruebe también en `probar-examen.mjs`, con un día sin capturar y sin derecho.

**3.6 · Nadie pasa un grupo a «en curso» ni a «concluido», ni en las pantallas ni en la simulación, y no hay pendiente** — Media
- Base: `confirmado → en_curso` exige el cupo y la fecha (`03-apd-reglas.sql:1320-1325`). `en_curso → concluido` pone «sin derecho a examen» a quien no tiene examen (`03-apd-reglas.sql:1326-1338` y `:1363-1368`). La asistencia y el examen sólo se capturan con el grupo en curso (`:1470-1472` y `:1501-1503`).
- La simulación de grupos no tiene evento para iniciar ni para concluir (`sitio/app/archivos-prueba.js:161-205`). `grupo.js` sólo consulta los grupos concluidos (`sitio/app/grupo.js:8`). `ETAPA-2-PANTALLAS.md` §4 no lo menciona y ningún pendiente lo trata (búsqueda en `docs/pendientes.json`: sin resultados).
- Sin eso, quien no presentó examen se queda en «Con grupo asignado» para siempre, y la prueba sólo funciona con el grupo ficticio que ya viene en curso.
- Propuesta: un pendiente nuevo, P124: ¿lo hace una tarea diaria (inicia el día de `fecha_inicio`; concluye al cerrar el examen) o el instructor con un botón? Después, el evento en la simulación.

**3.7 · El resultado del examen en línea no llega al trámite de la persona** — Media
- Decisión: la calificación queda en `apd.examen` y la persona la ve (`docs/DECISIONES.md:173`). La base pasa la solicitud a `aprobada` o `no_acreditada` (`03-apd-reglas.sql:1518-1531`).
- En la prueba, la calificación se queda en `apd.examen.c.<código>` (`examen-servidor.js:130-131`). `mezcla()` no la aplica, así que «Mis trámites» sigue en «Con grupo asignado» y nunca muestra «Aprobaste… recoge tu credencial hoy» (`tramites.js:171`).
- Propuesta: aplicar en `mezcla()` las calificaciones enviadas (y la asistencia del 3.4), como hará la API.

**3.8 · La prueba cuenta un regreso desde el cotejo como otra vuelta de revisión; la base no** — Baja
- `archivos-prueba.js:341` agrega un renglón a `revision` cuando el cotejo regresa con observaciones. La base no crea ninguno: cambia la solicitud con `apd.motivo` (`03-apd-reglas.sql:1067-1069`).
- `APD_PERSONAL.vuelta` y `corregidos` cuentan renglones de revisión (`sitio/app/personal.js:60-69`). Con datos reales, la bandeja mostraría una vuelta menos y otra lista de «documentos corregidos».
- Propuesta: decidir si un regreso del cotejo cuenta como vuelta. Si cuenta, que la API lo saque de `apd.cita`; si no, quitar ese renglón de la simulación.

**3.9 · La cita que regresa con observaciones o queda en pausa se guarda sin texto; la base lo exige** — Baja
- `cita_observacion_ck` pide observación en `en_pausa`, `con_observaciones` y `no_es_la_persona` (`02-apd-tablas.sql:426`).
- La simulación cierra la cita con `observacion: cd.nota_identidad || ''` (`archivos-prueba.js:315`): vacía en pausa y con observaciones. El formulario del cotejo sólo tiene `diferencia_<requisito>` por documento (`herramientas/construir-sitio.mjs:215-219`).
- Propuesta: escribir en `docs/ETAPA-2-PANTALLAS.md` §3 que la API arma `apd.cita.observacion` con las diferencias, y hacer lo mismo en la simulación.

**3.10 · La simulación de grupos no aplica todas las reglas de la base** — Baja
- Su encabezado dice que «lo que la base rechazaría, aquí no cambia nada» (`archivos-prueba.js:131-133`), pero:
  - la asistencia no revisa si el día ya ocurrió (`dia_futuro`; `archivos-prueba.js:195-203` contra `03-apd-reglas.sql:1479-1481`). Hoy la pantalla lo impide (`asistencia.js:62`);
  - crear un grupo no revisa si el curso está activo (`curso_inactivo`, `archivos-prueba.js:163-171` contra `03-apd-reglas.sql:1247-1249`);
  - cancelar sólo se admite en integración o confirmado (`archivos-prueba.js:191-192`); la base también deja cancelar un grupo en curso (`03-apd-reglas.sql:1300`). No hay decisión sobre cancelar un curso ya iniciado.
- Propuesta: alinear la simulación y registrar si se puede cancelar un grupo en curso.

**3.11 · Acreditación con fecha de emisión futura: la pantalla bloquea la solicitud nueva y la base la admite** — Baja
- `sitio/app/apd.js:198` bloquea si la situación es `no_emitida`. `apd.comprobar_elegibilidad` sólo bloquea una nueva con `vigente`, `por_vencer` o `vencida_renovable` (`03-apd-reglas.sql:696-700`). Sólo pasa con datos migrados.
- Propuesta: agregar `no_emitida` a la regla de la base.

**3.12 · Datos que sólo existen en la simulación y no en el modelo** — Media
- `cotejo_pausa`, `cita_motivo`, `cita_anterior`, `inasistencias`, `cierre_por`, `cotejo_bloqueado`, `organizacion_nombre`, `foto_nueva` y `en_cotejo` los ponen `archivos-prueba.js:249-359` y los leen `tramites.js`, `cotejo.js`, `corregir.js` y `personal.js`. Ninguno está en `db/esquema.json`.
- Esto causa 3.2 y 3.3: el contrato de `GET /apd/mis-tramites` y de la API del personal no está escrito.
- Propuesta: en ETAPA-2 §3, una tabla «campo de la pantalla → de dónde lo saca la API» (por ejemplo, `cotejo_pausa` = cita `en_pausa` más los documentos `con_observacion`; `inasistencias` = cuántas citas `no_se_presento`).

**3.13 · Reenviar sin cambiar el documento observado: la base lo acepta** — Media
- La pantalla vuelve obligatorio cada documento observado (`sitio/app/solicitud.js:139-143`). `apd.comprobar_envio` sólo revisa que haya un documento vigente por requisito, sin mirar su estado (`03-apd-reglas.sql:729-737`). Una solicitud se puede reenviar con el mismo documento `con_observacion`.
- Propuesta: al pasar de `con_observaciones` a `enviada`, rechazar si queda un documento vigente `con_observacion` (código nuevo, por ejemplo `observaciones_sin_atender`).

---

## 4. Modelo de datos (`MODELO-DE-DATOS.md` y `esquema.json`) contra `02-apd-tablas.sql`

`node herramientas/generar-esquema.mjs --verificar` termina sin errores: los dos archivos generados coinciden con el
diccionario. Los hallazgos son del contenido.

**4.1 · Error de dedo en un comentario de la base: «Mi perfos»** — Baja
- `db/esquema.json:135` → `02-apd-tablas.sql:190`: «la cambia en «Mi perfos»». Lo dejó el reemplazo «Mis datos» → «Mi perfil» de la auditoría anterior (`docs/AUDITORIA-2026-10-17.md:38`).
- Propuesta: corregirlo en `esquema.json` y regenerar.

**4.2 · `bitacora`, `migraciones` y las vistas no están en la fuente única del modelo** — Media
- `apd.bitacora` y `apd.migraciones` se crean en `01-apd-esquema.sql:28-77`, y las vistas `verificacion_publica`, `bandeja_demanda` y `vencidas_en_espera` en `03-apd-reglas.sql:524`, `:1540` y `:1566`.
- `MODELO-DE-DATOS.md` no las nombra (búsqueda: 0 resultados), aunque la guía pide una sola fuente del modelo (`docs/GUIA-PROYECTOS-SIA.md:88-90`).
- Propuesta: describirlas en `esquema.json` (aunque el SQL se quede en 01 y 03), o una sección generada «Tablas y vistas fuera del diccionario».

**4.3 · Columna que contradice una decisión: `debe_cambiar_contrasena`** — Baja
- La columna es una «contraseña temporal de un solo uso» (`02-apd-tablas.sql:164` y `:200`). La contraseña se restablece con un enlace por correo y no hay temporal (`docs/DECISIONES.md:100`, `docs/AVISOS-POR-CORREO.md:15`, `docs/DECISIONES-SIA.md:10`). La guía del SIA dice lo contrario, pero el proyecto ya decidió (`docs/GUIA-PROYECTOS-SIA.md:121-123`).
- Propuesta: quitar la columna o volver a describirla, y anotar en el modelo la tabla de enlaces de restablecimiento que hará falta (P23).

**4.4 · Un requisito nuevo aceptaría imágenes por omisión** — Baja
- `requisito.formatos` tiene por omisión PDF, JPG y PNG (`db/esquema.json:60` → `02-apd-tablas.sql:66`). La decisión es sólo PDF para lo que carga la persona (`docs/DECISIONES.md:21`); hoy sólo lo arregla un `UPDATE` del catálogo (`04-apd-catalogos.sql:180-181`).
- Propuesta: que el valor por omisión sea `ARRAY['application/pdf']`.

**4.5 · `requisito.activo` no cuenta en las reglas de envío** — Baja
- La columna dice «Si se pide en solicitudes nuevas» (`02-apd-tablas.sql:85`). `apd.comprobar_envio` (`03-apd-reglas.sql:729-734`) y `apd.documento_alta` (`:1146-1148`) no la revisan, mientras que la página de inicio sí la usa (`sitio/app/inicio.js:27`). Desactivar un requisito lo quitaría de inicio y la base lo seguiría exigiendo.
- Propuesta: agregar `AND r.activo` en las dos reglas, o explicar que se desactiva desde `requisito_curso`.

**4.6 · La calificación con un decimal se redondea hacia arriba en la base** — Baja
- `apd.examen.calificacion numeric(3,1)` (`02-apd-tablas.sql:580`) redondea al guardar (6.75 → 6.8). La decisión es «sin redondear hacia arriba» (`docs/DECISIONES.md:173`, P88). Hoy sólo la cumple el JavaScript (`examen-servidor.js:130`).
- Además, esa línea comete un error de cálculo con decimales en 12 combinaciones de hasta 300 preguntas; por ejemplo, 29 de 50 da 5.7 en lugar de 5.8 (comprobado con node). Ninguna cruza el 7.0 ni el 8.0.
- Propuesta: guardar aciertos y total y calcular en la base con `trunc(aciertos * 10.0 / total, 1)`, o que la API mande el valor ya truncado con aritmética entera (`Math.floor(aciertos * 100 / total) / 10`).

**4.7 · Faltan las tablas del examen en línea y del registro de correos** — Media (ya documentado en parte)
- Las decisiones del examen dicen que el servidor guarda códigos, orden, respuestas y tiempo (`docs/DECISIONES.md:167-174`). En la base sólo está `apd.examen` (`02-apd-tablas.sql:577-588`). ETAPA-2 lo deja para la etapa 3 (`docs/ETAPA-2-PANTALLAS.md:69-70`), pero no hay pendiente con número.
- `AVISOS-POR-CORREO.md:73-74` pide que cada envío quede registrado, y tampoco hay tabla ni pendiente.
- Propuesta: un pendiente «tablas del examen en línea» (o sumarlo a P29) y otro para el registro de avisos (o sumarlo a P23).

**4.8 · Comentarios viejos en la base** — Baja
- `03-apd-reglas.sql:126`: «cupos 10–25». Son 5–25; la auditoría anterior lo dio por corregido (`docs/AUDITORIA-2026-10-17.md:38`).
- `01-apd-esquema.sql:39`: la consulta a RENAPO como «pregunta abierta en docs/DECISIONES.md». Hoy es P15 en `PENDIENTES`.
- `04-apd-catalogos.sql:72-76`: «[pendiente] confirmar con Liber que también aplica a identificación, CURP y domicilio». Ya se confirmó (`docs/DECISIONES.md:193`); lo de Kobo es P21.
- `04-apd-catalogos.sql:45`: la descripción del comprobante de domicilio dice «[pendiente] la Dirección debe declarar su uso». Ya hay decisión (`docs/DECISIONES.md:76`) y P03.

---

## 5. Pendientes

`node herramientas/generar-pendientes.mjs --verificar` responde «al día». Hay 81 abiertos y 58 resueltos; 39 de los
resueltos llevan número en el título. Del P01 al P123 faltan P106, P107 y P108. Ningún archivo los menciona, así que
no se reutilizaron, pero tampoco está dicho por qué no existen.

**5.1 · Una marca visible de pendiente que ya se resolvió** — Media
- `sitio/entrar.html:54`: «Pendiente: definir quién atiende la recuperación del acceso y por qué medio». P13 está resuelto: enlace por correo, aviso C1 (`docs/DECISIONES.md:100`; resueltos en `pendientes.json`). Lo ve la persona en «Entrar».
- Propuesta: «Restablecerás tu contraseña con un enlace que te llegará por correo (cuando el sistema esté en línea)», sin el amarillo de pendiente.

**5.2 · Otras marcas visibles viejas o sin número** — Baja
- `sitio/revision.html:75`: «Pendiente: las pantallas de citas de cotejo, grupos, calificación y entrega». Las de citas y grupos ya existen (`docs/DECISIONES.md:95`).
- `sitio/solicitud.html:599`: «Pendiente: plazo de revisión», sin número; es P02.
- Las marcas con número sí apuntan a pendientes abiertos: P74 (`aplicar.html:61`), P69 (`citas.html:61`), P92 (`grupos.html:46`), P02 (`revision.html:71`) y P79 (`config-entrar.js:43`, `cotejo.js:311`).

**5.3 · Números equivocados en el código** — Baja
- `sitio/app/examen-servidor.js:23` y `:130` atribuyen el redondeo de la calificación a «P86». Es P88; P86 fue la actualización del estándar.
- `herramientas/construir-sitio.mjs:130`: «el esquema del servidor sólo lee el data-si más cercano». Eso era P38, resuelto en la 1.1.0 (`pendientes.json`, resueltos). Lo mismo en `:145` y `:196` («una sola condición por campo, P38»). Los auxiliares `revisar_*` y `cotejar_*` se pueden quedar porque combinan datos de la base, pero el motivo escrito ya no es cierto.
- `docs/ETAPA-1-PANTALLAS.md:120-134` todavía cuenta las soluciones provisionales; está bien como registro, porque el encabezado lo aclara (`:115-116`).

**5.4 · Pendientes abiertos que el código ya implementa (falta sólo confirmar)** — Baja (información)
- P06: la regla está en la base (`03-apd-reglas.sql:694-700`), con un comentario «[pendiente] confirmar con Liber» que no cita P06.
- P93: los 7 días están en la base y en la pantalla.
- P80: la función `apd.cerrar_pausas_vencidas` existe y falta programarla.
- P123: hoy se aplica la opción A.
- Propuesta: que los comentarios «[pendiente]» de la base digan su número (P06 en `:695`, P11 en `:558`, P17 en `:871`, P80 en `:1089`).

**5.5 · Error en el texto de P123** — Baja
- La recomendación de P123 habla de «la decisión del 2026-10-14». La de las inasistencias es del 2026-10-17 (`docs/DECISIONES.md:125`).

**5.6 · Avisos que el catálogo dice que la prueba muestra, pero no** — Baja
- `docs/AVISOS-POR-CORREO.md:4-5` y `:79-80`: «En la versión de prueba cada aviso de esta lista se muestra en «Mis trámites»». No se ven: C1 a C4, S3, T1, G3, A0 a A5, la baja de un grupo (G2: «Mis trámites» sólo avisa si el grupo se canceló, `tramites.js:132-134`) ni el grupo que vuelve a integración.
- Falta un aviso: «acreditación lista para recoger» para quien no pudo quedarse (decisión `docs/DECISIONES.md:198`; P10).
- Propuesta: decir «algunos avisos» y agregar el de la acreditación lista.

---

## 6. Parámetros escritos en el código en lugar de leerse de los datos

Los parámetros de la base sí se leen en: `dias_antes_renovacion` (`apd.js:190`), `meses_despues_renovacion`
(`tramites.js:28`), `dias_alerta_espera` (`personal.js:203`, `grupos.js:31`, `espera.js:26`), `dias_anticipacion_grupo`
(`grupo.js:168`, `archivos-prueba.js:187`), `inasistencias_cotejo_maximas` (`cotejo.js:71`, corrección A4 confirmada),
`sede`, `sede_direccion`, `pago_instrucciones` y `entrega_lugar`. Lo que queda escrito a mano:

**6.1 · Los textos dicen «segunda» aunque el número sale del parámetro** — Baja
- `cotejo.js:212`, `:301` y `:334`, `tramites.js:137` y `archivos-prueba.js:354` dicen «segunda inasistencia» o «por segunda vez», pero el límite sale del parámetro `inasistencias_cotejo_maximas`. Si se cambia a 3, los textos quedan mal. La base dice «%s veces» (`03-apd-reglas.sql:1074`).
- Propuesta: armar el texto con el número.

**6.2 · Límites sin parámetro en la base** — Baja
- La espera de la bandeja de revisión (ámbar 3 y rojo 10) está escrita en `personal.js:28` y no existe en `apd.parametro` (`04-apd-catalogos.sql:6-26`). P02 dice que son valores de prueba.
- 5 MB: `data-mb="5"` está fijo en `herramientas/construir-sitio.mjs:113` y `:230` y en `cuenta.html:97`, `datos.html:48` y `cotejo.html:326`, aunque existe el parámetro `tamano_maximo_archivo_bytes`.
- Lugar del examen y aula del curso: escritos en `examen-grupo.js:25` y `grupo.js:76` y `:184`. Sólo `sede` es parámetro.
- Motivos frecuentes de observación: `construir-sitio.mjs:147`.
- Horas de cita (09:00 a 14:00) y de entrada (07:00 a 10:00): escritas en tres HTML (ver 1.4).
- Propuesta: llevar a `apd.parametro` (o a un catálogo) lo que la Dirección va a ajustar: umbrales de la bandeja, motivos, horarios y lugares. `construir-sitio.mjs` debe tomar `data-mb` de `tamano_maximo_archivo_bytes`.

**6.3 · Textos fijos que repiten un parámetro** — Baja
- `sitio/espera.html:35` («31 días») y `sitio/grupo.html:71` («7 días») se reemplazan al cargar (`espera.js:27`, `grupo.js:178`), así que no se ven mal.
- `sitio/app/tramites.js:36` y `sitio/app/solicitud.js:91` dicen «más de un año» aunque el plazo sale de `meses_despues_renovacion`.

---

## 7. Código sin uso y comentarios que ya no son ciertos (sólo se reporta)

**7.1 · Funciones y constantes que no hacen nada o no se usan** — Baja
- `APD_PERSONAL.datosConPrueba` devuelve los datos sin cambios (`sitio/app/personal.js:276`) y se sigue llamando en `revisar.js:58` y `revision.js:32`. La mezcla ya la hace `APD.cargar`.
- `INTEGRACION` (`personal.js:190`) se exporta y nadie la usa, ni dentro del archivo.
- Se exportan pero sólo se usan dentro de su archivo: `APD.pintaCorte` y `APD.ADSCRIPCIONES` (`apd.js:410`), `APD_PERFIL_ACADEMICO.BASICOS` y `MINIMOS` (`perfil-academico.js:42`) y `APD_CODIGO_EXAMEN.RE`.
- La auditoría anterior dijo «No hay funciones definidas sin usar» (`docs/AUDITORIA-2026-10-17.md:44`); `INTEGRACION` es la excepción.

**7.2 · Clases CSS sin uso: ninguna** — Información
- Revisé las 157 clases de `apd.css` y las 56 de `examen.css` contra el HTML, el JavaScript (sin comentarios), `construir-sitio.mjs` y las plantillas. Todas se usan en algún lado.
- Todos los archivos de `sitio/app/` y `sitio/datos/` están enlazados por al menos una página, y todos los de `herramientas/` se mencionan.

**7.3 · Comentario contrario al código** — Baja
- `sitio/app/solicitud.js:155-156`: «Sin perfil completo, o por clasificar, el mínimo queda en 0». Para «por clasificar», `perfil-academico.js:34` devuelve 5, igual que la base (`03-apd-reglas.sql:245`).

**7.4 · Partes de la base que hoy no usa nadie** — Información
- `apd.fotografia.origen = 'cotejo'`, la carga de la fotografía por el personal (`03-apd-reglas.sql:428-433`; P100, documentado).
- `debe_cambiar_contrasena` (ver 4.3).

---

## 8. Versión visible (debe ser 0.39)

**8.1 · Las versiones coinciden** — Información
- `VERSION` y `sitio/VERSION` dicen 0.39.
- Las 18 páginas llevan 183 `?v=0.39` y ningún otro valor. Todas cargan `version-visible.js` y `modulos/version/version.css`.
- `construir-artefacto.mjs:34` y `:50` toman la versión de `VERSION`. La primera fila de `docs/VERSIONES.md:7` es 0.39. `sitio/formkit/LEEME.md` dice estándar 1.3.1.

**8.2 · Documentos con versión o estado viejos** — Baja
- `docs/DECISIONES-SIA.md:20`: «0.33 al 17/10/2026». Mejor sólo «la del archivo `VERSION`».
- `LEEME.md:20`: la etapa 2 «faltan grupos y asistencia», y ya existen (`docs/ETAPA-2-PANTALLAS.md:18-21`).
- `docs/ETAPA-1-PANTALLAS.md:4-5`: «Ninguna pantalla guarda nada fuera de la pestaña». Desde el 2026-10-17 todo se guarda en el navegador (`docs/DECISIONES.md:91`).
- `docs/ETAPA-1-PANTALLAS.md:73`: `datos/catalogos.js` = «Las 16 alcaldías». Hoy trae empresas y carreras, y las alcaldías van en el fragmento de adscripción (`herramientas/construir-sitio.mjs:82-90` y `:262-264`).

**8.3 · La prueba de la versión no compara con `VERSION`** — Baja
- La guía pide comprobar que el distintivo «dice lo mismo que `VERSION`» (`docs/GUIA-PROYECTOS-SIA.md:204-213`). `probar-sitio.mjs:183` sólo revisa `/Versión de prueba 0\.\d+/`.
- Propuesta: leer `VERSION` y comparar el texto exacto.

---

## Hallazgo nuevo para el Estándar de formularios (propuesta: P124 o el siguiente número libre)

**E-1 · El formato `rfc` del estándar cambia la Ñ por N** — Media
- `normaliza` del formato `rfc` pasa el valor por `sinAcentos`, que descompone en NFD y quita la tilde (`sitio/formkit/js/validaciones.config.js:34` y `:267`). Un RFC con Ñ queda guardado con N.
- La expresión del propio formato acepta Ñ (`:269`), y la base también (`02-apd-tablas.sql:345`).
- Efecto: el personal captura un RFC de factura equivocado sin ningún aviso.
- Propuesta: que `normaliza` del RFC conserve la Ñ (proteger la Ñ antes de NFD, como hace `APD.nombreDeArchivo` en `sitio/app/apd.js:162`). Anotarlo como hallazgo del estándar.

---

## Top 10

1. **3.1 (Alta)** · «Mis trámites» da por confirmada la fecha de un grupo que volvió a integración (`tramites.js:92`, contra `03-apd-reglas.sql:1447`).
2. **3.4 (Alta)** · El pase de lista no escribe `apd.asistencia`: la base rechazaría la calificación de todas las renovaciones y de quien faltó un día (`asistencia.js:62`, `examen-grupo.js:52`, `03-apd-reglas.sql:1504-1508`). Resolver P94 y la API; ETAPA-2 y P94 afirman algo que no pasa.
3. **3.2 (Alta)** · El cierre por dos inasistencias se leería como «no se corrigió a tiempo» porque depende de `cierre_por`, que la base no tiene (`tramites.js:136` y `:193`, `apd.js:34`).
4. **3.3 (Alta)** · Pausa vencida: la persona sigue con «cárgalo hoy» y la base acepta la carga, pero no deja retomar el cotejo (`tramites.js:106-113`, `corregir.js:19`, `03-apd-reglas.sql:1153-1159` contra `:1043-1048`).
5. **3.6 (Media)** · Nadie pasa los grupos a «en curso» ni a «concluido»: sin eso no hay asistencia, examen ni «sin derecho a examen», y no hay pendiente.
6. **1.1 (Media)** · Choque entre decisiones: el grupo que vuelve a integración «conserva su fecha», pero la anticipación de 7 días impide volver a confirmarla.
7. **3.13 y 1.4 (Media)** · La base acepta un reenvío sin cambiar el documento observado y una cita en el pasado o a cualquier hora.
8. **2.1 y 2.2 (Media)** · 84 de 106 códigos de error no están en REGLAS y 51 no se prueban, entre ellos los de emisión y resultado del examen. Falta la tabla código → campo para la API.
9. **1.2, 1.3 y 1.6 (Media)** · La protesta no se guarda, el nombre se puede cambiar sin la Secretaría y la corrección de la asistencia no deja rastro.
10. **E-1 (Media)** · El formato `rfc` del estándar cambia la Ñ por N en la factura: es un hallazgo nuevo para el estándar.

Correcciones que la auditoría anterior dio por hechas y no están completas:
- comentario de cupos 10–25 (4.8);
- tres mensajes al personal en tú (2.6);
- «Mi perfos» (4.1);
- «sin funciones sin uso» (7.1);
- el lado de la persona en M6 (3.3).
Las demás «corregido» de `docs/AUDITORIA-TAREAS-2026-10-17.md` (A1, A2, A3, A4, A5, M1–M10 y los bajos) sí están en el código.
