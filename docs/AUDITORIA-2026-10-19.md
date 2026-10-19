# Auditoría · 19/10/2026 (versión de prueba 0.55)

Sistema de Acreditaciones de Poda y Dictaminación. Repositorio `SedemaOficina/acreditaciones-arbolado`, rama `main`,
commit `f58d284` (18/10/2026, 23:50), estándar de formularios 1.4.1. Auditoría independiente en solo lectura, pedida
por Liber el 19/10/2026. El repositorio no se modificó: las huellas de 247 archivos son iguales antes y después.

**Alcance aprobado por Liber (19/10/2026).** Solo lo que no depende del estándar de formularios: base de datos,
seguridad y datos personales, integridad de datos y construcción, documentos y código, cotejo normativo (incluido el
anteproyecto de lineamientos 0.4), robustez y fechas. El barrido de pantallas, la accesibilidad, los textos y la carga
de la interfaz (A6, B1, B4, C1 a C6, D4) se hacen **después** de actualizar el estándar. La instrucción del Proyecto
pide la 1.4.4 y el estándar ya va en la 1.5.1.

Lo que describe cómo aprovechar puntos débiles de la base, y el cotejo del anteproyecto de lineamientos (que no es
público), está en un informe aparte, en los documentos del Proyecto: `claude/AUDITORIA-2026-10-19-sensible.md`.
**No se sube a este repositorio.**

---

## 1. Veredicto por etapa

| Etapa | Veredicto | Por qué |
|---|---|---|
| En cada cambio (A1 a A6) | **Lista con reservas** | 0 fallas en las 1,163 comprobaciones existentes, pero: las pruebas no corren solas (A1-05); las del sitio se detienen en la primera falla (A1-02); 48 de 108 reglas de la base no tienen prueba (A1-03); hay código sin uso (R4-07). A6 queda para después de actualizar el estándar |
| En cada versión (A y B) | **No lista** | 1 alto abierto del prototipo (R4-01, curso en el año 6110) y los 22 altos de «intentar romperlo» del 18/10, que siguen sin corregir. B1 y B4 quedan para después del estándar |
| Antes de mostrar al área | **No lista** | B2: 5 diferencias en las cifras de «Citas de cotejo» (B2-01); el criterio pide 0. B1, C1 y C5 quedan para después del estándar |
| Antes de cerrar la etapa 2 | **No lista** | Contradicciones abiertas entre documentos y código (sección 7). D4 queda pendiente |
| Antes de usar datos reales | **No lista** | En la base: 4 altos nuevos de integridad (E2-01, E2-02, E2-03 y G1-01, por el dato que se recaba) y los 2 altos de seguridad del 17/10 (D-01 y D-06), que siguen abiertos. No se ha decidido el plazo de conservación (D-11) ni hay aviso de privacidad aprobado (P31) |
| Antes de entregar al SIA (F) | No aplica todavía | Etapa 6 |
| Documento a firma: anteproyecto de lineamientos 0.4 | **No listo para firma** | Las citas que se pudieron cotejar existen, pero un artículo contradice la NADF vigente (registrado como N06) y quedan huecos sin texto oficial disponible para cotejar. Detalle en el informe sensible |

## 2. Resumen ejecutivo

La base de PostgreSQL es sólida en lo que más importa. Con dos o tres conexiones a la vez **no se pasa del cupo de 25**,
no repite ni salta folios, no deja dos solicitudes activas ni dos citas abiertas, no borra nada en cascada y el respaldo
se restaura íntegro. Pero cuatro reglas leen otra fila sin bloquearla, y con dos personas trabajando al mismo tiempo se
rompen: un grupo queda confirmado con 4 personas (el mínimo es 5), una solicitud queda «con observaciones» sin nada que
corregir y una persona dada de baja queda aprobada. Un prototipo con una línea de bloqueo en cada una de esas 4 funciones
las cierra todas y conserva los 173 casos de reglas.

En el prototipo, lo más grave es que **pegar una fecha «2026-11-02» en «Programar un curso» confirma un curso «del 20 al
24 de febrero de 6110»**, y la persona lo ve así en «Mis trámites». Es la misma falla del estándar ya registrada (P152), en
dos pantallas nuevas de la 0.55, y P152 dice que el proyecto ya la corrige, cuando no es así.

Seguridad: 0 secretos en los 176 commits, 0 peticiones a terceros y 0 inyecciones ejecutadas. De los 21 hallazgos de
seguridad del 17/10 solo se corrigieron 3. Las dos altas de la base siguen abiertas.

Normativo: las 26 citas del repositorio y las 27 páginas del material de estudio están correctas. Pero 6 documentos dicen
que «hoy la norma exige» el comprobante de domicilio, y ni la NADF ni la Ley Ambiental lo piden: el requisito sale del
borrador del área. Además, el Aviso de cuotas que P16 daba por conseguir ya se puede leer. La reducción de 75 % que cita P16
es solo para el personal de la Secretaría.

**Totales: 55 hallazgos nuevos: 0 críticos, 5 altos, 16 medios, 29 bajos y 5 informativos.** Además se confirmó el estado
de 91 hallazgos ya registrados (sección 4.2).

## 3. Cobertura

Calificación de 1 a 5: 5 = completa y sin hallazgos críticos ni altos.

| Código | Estado | Cómo se hizo | Hallazgos nuevos | Calif. | Qué faltó |
|---|---|---|---|---|---|
| A1 Pruebas y regresión | Hecha | Las 6 baterías dos veces, más las pruebas nuevas desde 2a08bd7 corridas contra la 0.52; validación de pantalla, servidor y base, regla por regla | 3 M, 4 B | 3 | Las baterías se detienen en la primera falla |
| A2 Integridad de datos | Hecha | Sitio, datos, documentos y base reexportada; recálculo de conteos | 1 M | 4 | — |
| A3 Construcción | Hecha | Dos construcciones desde cero, comparadas con lo publicado | 1 B | 4 | — |
| A4 Calidad estática | Hecha | ESLint 9 sobre `sitio/app` y `herramientas` | 1 B | 4 | Revisión de tipos (no hay TypeScript) |
| A5 Consistencia automática | En parte | Inventario de lo que se comprueba solo y de lo que falta | dentro de A1 | 3 | Escribir las comprobaciones nuevas |
| A6 Estilos y contraste | No hecha | — | — | — | Después del estándar |
| B1 Barrido | No hecha | Solo la línea base (60 pantallas, 201 botones) | — | — | Después del estándar |
| B2 Cifras | Hecha | Recálculo independiente de 155 cifras en 4 pantallas del personal | 1 M | 3 | — |
| B3 Archivos | No aplica | Solo impresión | — | — | — |
| B4 Accesibilidad | En parte | axe a 1280 px además de 390 (0 violaciones) | en A1-04 | — | Después del estándar |
| B5 Robustez | Hecha (en lo nuevo) | Datos dañados o vacíos, inyección, clics repetidos, «Atrás» y recarga en las pantallas de la 0.55 | 4 B | 4 | — |
| B6 Teléfono y continuidad | No hecha | — | — | — | Después del estándar |
| B7 Terceros | Hecha | 14,368 peticiones de 390 visitas con todo dominio externo bloqueado | 1 B | 4 | — |
| B8 Navegadores y fechas | En parte | Chromium: 1,081 comparaciones en 4 zonas horarias y 6 instantes; la base en fechas límite | 1 M, 1 B (B8-03 va en A1) | 4 | Firefox y WebKit: la red bloqueó su descarga |
| B9 Despliegue | No aplica | GitHub Pages no admite cabeceras | — | — | Al llegar al SIA |
| C1 a C6 | No hechas | — | — | — | Después del estándar |
| D1 Coherencia documental | Hecha | Matriz de documentos, código y base; muestreo de 12 + 12 hallazgos del 18/10 | 3 M, 5 B | 3 | — |
| D2 Modelo de datos | Hecha | Esquema, SQL y modelo; índices con 5,160 solicitudes | 1 B, 1 I | 4 | — |
| D3 Datos de referencia | Hecha | Catálogos, material de estudio y enlaces | 2 B | 4 | — |
| D4 Peso y velocidad | No hecha | — | — | — | Después del estándar (el logotipo cambia) |
| D5 Método | No aplica | — | — | — | — |
| E1 Seguridad y datos personales | Hecha | Estado de D-01 a D-21; gitleaks en todo el historial; OCR de 155 capturas; 97 cargas de inyección; control de acceso simulado | 1 M, 1 B | 3 | Leer el informe completo del 17/10 en cada revisor (se usaron sus títulos) |
| E2 Integridad y respaldo | Hecha | 31 escenarios con dos conexiones, repetidos por el revisor independiente (más de 250 órdenes); respaldo, restauración y respaldo alterado | 3 A, 2 M, 2 B, 1 I | 2 | — |
| E3 Romperlo | En parte | Muestreo de 10 de los 22 altos del 18/10: siguen igual | — | — | — |
| F1 Limpieza | Hecha (en lo nuevo) | Referencias, cobertura en el navegador y comentarios | contados en A4 y D1 | 4 | — |
| F2 Revisión de código | Hecha (en lo nuevo) | Diferencias de 2a08bd7 a f58d284 | 1 A, 2 M, 2 B | 2 | — |
| F3 Dependencias y licencias | Hecha | `npm audit`, pdf.js contra los avisos publicados, licencias | 1 B, 1 I | 4 | — |
| F4 a F6 | No aplica | Etapa 6 | — | — | — |
| G1 Cotejo normativo | Hecha | 26 comprobaciones literales, 27 páginas, muestreo del 18/10; anteproyecto 0.4 contra la Ley Ambiental y la NADF | 1 A, 2 M, 3 B, 2 I | 2 | Ley Orgánica, Reglamento Interior, LPA, Código Penal, Código Fiscal y Ley de Datos Personales: sin texto oficial legible aquí |
| G2 Componentes compartidos | Hecha | P126 a P152 contra el estándar 1.4.2 a 1.5.1 | 3 sin clave | 4 | — |
| H1 a H7 | No hechas | Requieren personas y equipos reales; P33 a P36 siguen abiertos | — | — | — |

## 4. Las 10 de mayor prioridad

| # | Clave | Gravedad | Esfuerzo | Qué |
|---|---|---|---|---|
| 1 | R4-01 | Alta | S | Pegar «2026-11-02» en «Programar un curso» o en la ficha del grupo confirma un curso en el año 6110 |
| 2 | E2-02 | Alta | S | Confirmar un grupo mientras otra persona da una baja deja un grupo confirmado con 4 |
| 3 | E2-01 | Alta | S | Dos revisiones de la misma vuelta: la solicitud queda «con observaciones» sin nada que corregir, o con la autoría de la validación dudosa |
| 4 | E2-03 | Alta | S | Capturar el examen mientras se da de baja a la persona: queda aprobada una persona dada de baja |
| 5 | G1-01 | Alta | S | «Hoy la norma exige» el comprobante de domicilio: ninguna norma lo pide |
| 6 | R4-02 | Media | S | P152 dice que el proyecto ya corrige las fechas pegadas, y no hay código que lo haga |
| 7 | A2-01 | Media | S | Al cancelar una solicitud, su cita de cotejo queda «pendiente» para siempre |
| 8 | E2-04 | Media | M | La bitácora no registra 10 de 11 decisiones que cambian un trámite |
| 9 | B2-01 | Media | S | «Citas de cotejo» cuenta como atendidas a quien no se presentó |
| 10 | A1-01 | Media | S | La base acepta CURP, RFC y correos que el formulario rechaza |

## 5. Hallazgos completos

Cada uno se reprodujo 2 de 2, salvo que se diga otra cosa. El detalle (pasos, evidencia, causa y prueba que lo cierra)
está en el informe de cada frente, dentro de `evidencia-2026-10-19.zip`: r1 pruebas y datos, r2 seguridad, r3 robustez
e integridad, r4 documentos y código, r5 normativo, r6 fechas, e independiente.

**Totales por gravedad:** 0 críticos · 5 altos · 16 medios · 29 bajos · 5 informativos.
**Por auditoría:** A1 7 · A2 1 · A3 1 · A4 1 · B2 1 · B5 4 · B7 1 · B8 2 · D1 8 · D2 2 · D3 2 · E1 2 · E2 8 ·
F2 5 · F3 2 · G1 8 (más el detalle del anteproyecto, en el informe sensible).

### 5.1 Altos

**R4-01 · Una fecha pegada como AAAA-MM-DD confirma un curso en el año 6110** · Alta · S · F2/B5 · prototipo y base
- **Dónde:** `programar.html` («Primer día del curso») y `grupo.html` (confirmar); `programar.js:79`, `grupo.js:176`; en la base, `apd.grupo_cambio` (`03-apd-reglas.sql:1285-1363`).
- **Qué pasa:** al pegar «2026-11-02» (como lo deja una hoja de cálculo), el campo queda en 20/02/6110 y «Crear y confirmar el grupo» confirma «Poda nueva · del 20 al 24 de febrero de 6110». La persona ve en «Mis trámites» «Preséntate el 20/02/6110». También se aceptan escritos a mano «01/01/2099» y `?semana=2099-01-05`, y la base no tiene fecha máxima.
- **Consecuencia:** un curso confirmado con una fecha falsa, que se notifica a las personas inscritas.
- **Reproducido:** 2 de 2 por r4, por el revisor independiente y por el auditor principal (`principal/repro-fecha-pegada.log`).
- **Causa:** la escritura guiada del estándar (P152, sin resolver todavía en la 1.5.1) y que no hay fecha máxima ni en la pantalla ni en la base.
- **Corrección:** antes de la escritura guiada, convertir lo pegado en AAAA-MM-DD a dd/mm/aaaa; `data-max` en el primer día; en la base, un tope razonable. Ver «Para decidir» 3.
- **Listo cuando:** una prueba de `probar-sitio` pega «2026-11-02» en las dos pantallas y obtiene 02/11/2026, o un error sin ningún evento guardado.

**E2-02 · Un grupo queda confirmado por debajo del mínimo de 5** · Alta · S · E2 · base para el SIA
- **Dónde:** `03-apd-reglas.sql:1327` (`grupo_cambio` cuenta sin bloquear) y `:1466-1469` (la baja).
- **Qué pasa:** con 5 inscritas, una conexión confirma el grupo y otra da de baja a una persona al mismo tiempo. El grupo queda «confirmado» con 4 activas. También pasa con dos bajas simultáneas en un grupo de 6: en 8 de 12 órdenes, según el revisor independiente.
- **Consecuencia:** se abre un curso con menos del mínimo, que REGLAS.md:66 dice que se aplica «sin excepción».
- **Corrección:** bloquear la fila del grupo (`FOR UPDATE`) en la baja y en la confirmación, y volver a contar después.

**E2-01 · Dos revisiones de la misma vuelta** · Alta · S · E2 · base para el SIA (amplía P122)
- **Dónde:** `revision_alta` (`03:1128-1134`) y `documento_cambio` (`03:1242-1246`) leen el estado sin bloquear.
- **Qué pasa:** según el orden en que el backend haga sus pasos:
  - quedan dos revisiones «validada» y la bitácora atribuye la validación a quien no dejó la última marca;
  - una solicitud ya validada regresa a «con observaciones» con su cita todavía abierta;
  - una solicitud queda «con observaciones» sin texto y sin ningún documento observado (4 de 6 órdenes, revisor independiente).
  P122 supone que la base rechaza el segundo cambio, y eso no se cumple en todos los órdenes.
- **Consecuencia:** la persona recibe «Corrige y reenvía» sin nada que corregir, o con una cita que sigue en la agenda.
- **Corrección:** bloquear la solicitud al principio de `revision_alta` y de `documento_cambio`. Lo probó el revisor independiente: 10 de 10 órdenes correctos, sin interbloqueos.

**E2-03 · Examen frente a baja y frente a corrección de asistencia** · Alta · S · E2 · base para el SIA
- **Dónde:** `03:1445`, `:1496` y `:1516` (`inscripcion_cambio`, `asistencia_captura` y `examen_captura`, sin bloqueo).
- **Qué pasa:** si se captura el examen al mismo tiempo que se da de baja a la persona, queda una inscripción dada de baja con 9.0 y la solicitud «aprobada». Si a la vez se corrige el día 5 a «faltó», queda un examen sin el pase de lista de ese día.
- **Consecuencia:** se emitiría una acreditación a quien está dado de baja del grupo, o a quien no tiene la asistencia mínima. Lo confirmó el revisor independiente (2 de 6 órdenes, 2 de 2 corridas). Por la consecuencia, sube de Media a Alta.
- **Corrección:** bloquear la inscripción al principio de las tres funciones.

**G1-01 · «Hoy la norma lo exige» (comprobante de domicilio) sin fundamento** · Alta · S · G1 · documentos y datos reales
- **Dónde:** `docs/DECISIONES.md:76` y `:302`, `docs/PENDIENTES.md:19` y `docs/pendientes.json:65-66` (P03). El requisito está en `db/apd/04-apd-catalogos.sql:46-47`.
- **Qué pasa:** la NADF-001-RNAT-2015 no contiene la palabra «comprobante»; «domicilio» aparece solo en los formatos de dictamen de sus Anexos 1 y 2. La Ley Ambiental tampoco lo pide para la acreditación. Las dos dejan los requisitos a los lineamientos (NADF 5.1; Ley art. 111, párr. 2). La única fuente es el borrador interno de la Dirección (`docs/insumos-lineamientos-borrador.txt:29` y `:71`).
- **Consecuencia:** se recaba un dato personal con un fundamento que no se encontró. No es Crítica porque la frase no está en un documento que vaya a firma.
- **Reproducido:** r5 y revisor independiente, cada uno 2 de 2; el auditor principal verificó el texto de la NADF.
- **Corrección:** ver «Para decidir» 1.

### 5.2 Medios

| Clave | Dónde | Qué pasa | Corrección |
|---|---|---|---|
| R4-02 (D1) | P152 en `pendientes.json` y `PENDIENTES.md:141` | Dice «Solución provisional: el proyecto normaliza lo pegado… y valida un año razonable». No hay ese código (`git show --stat 13e5568`: solo documentos). Baja de Alta a Media: es un documento interno, pero hace creer que la falla ya está contenida | Escribir la solución o cambiar el texto a «Sin solución provisional todavía» |
| R4-03 (F2, regresión) | `grupos.js:147-160`, `programar.js:285-293` | El planeador perdió la regla «grupo propio» (DECISIONES:183; corrección M3 de la auditoría de tareas). «Programar» crea un segundo grupo de una organización que ya tiene uno por confirmar. El revisor independiente no lo reprodujo, porque probó sin el escenario de volumen | Ver «Para decidir» 2 |
| R4-04 (F2) | `grupos.js:227-229` | Los grupos con fecha ya pasada aparecen en «Sin fecha» con nombre de fechas pasadas (lo reprodujo también el independiente, RI-07) | Sección «Su fecha ya pasó» |
| R4-05 (D1) | `AUDITORIA-2026-10-18.md:43-58` | 4 de los 8 puntos para decisión no tienen Pnn (borrador de lineamientos publicado, tabla R01-R57, dos botones principales, decisiones de los equipos). El punto 1 ya estaba decidido (DECISIONES:231) | Abrir sus Pnn o registrar la decisión |
| R4-06 (D1) | `DECISIONES.md` | El calendario en las fechas del personal y el examen de prueba de 10 preguntas no tienen fila, aunque el código los cita como decisiones del 18/10 | Agregar las dos filas |
| E1-01 (E1) | `asistencia.js:33`, `aplicar.js:42` | Con `?folio=`, el perfil «instructor» abre y opera el grupo de otro instructor; contradice `personal.js:383`. La base tampoco lo impide (D-06) | Comparar el instructor de la sesión; exigirlo en la API |
| A1-01 (A1) | `01-apd-esquema.sql:40-46`, `02-apd-tablas.sql:171, 345` | La base acepta CURP con fecha imposible o futura, RFC con fecha imposible y correos de más de 120 caracteres o con terminación de una letra, que el formulario y el servidor rechazan | Llevar a la base la fecha real de la CURP y del RFC, y los límites del correo |
| A1-02 (A1) | `probar-sitio.mjs`, `probar-volumen.mjs` | Se detienen en la primera falla: contra la 0.52 corren 347 de 744 comprobaciones, y volumen corre 0 de 52 | Que cada falla se anote y la batería siga |
| A1-03 (A1) | `03-apd-reglas.sql` | 48 de los 108 códigos de error no tienen un caso que los provoque (entre ellos `baja_con_examen`, `asistencia_cerrada`, `cita_fuera_de_turno`) | Un caso por código en `probar-reglas` |
| A2-01 (A2/D2) | `03:976-988` | Al cancelar una solicitud, su cita queda «pendiente» para siempre (ficticio APD-S-2026-00045) | Ver «Para decidir» 8 |
| B2-01 (B2) | `citas.js:88, 103` | La agenda cuenta como «atendidas» las inasistencias, las citas sin pago y las pausas vencidas: 5 diferencias en 18 días. Las otras 150 cifras recalculadas coinciden | Ver «Para decidir» 7 |
| E2-04 (E2) | `documento_cambio`, `asistencia_captura`, `grupo_cambio`, `requisito_curso`, `solicitante` | La bitácora no registra 10 de 11 acciones que cambian un trámite (aceptar u observar un documento, corregir asistencia, mover la fecha de un grupo, quitar un requisito, dar de baja una cuenta). Contradice `REGLAS.md:90` | `apd.registrar` en esos cambios |
| E2-05 (E2) | `01-apd-esquema.sql:54-77` | Un respaldo con una fila de la bitácora alterada se restaura sin ningún aviso; la bitácora no tiene sello ni cadena de huellas | Ver «Para decidir» 5 |
| B8-01 (B8) | `apd.js:119` (`sumaMeses`), `tramites.js:37` | Cuando la acreditación vence un 29 de febrero, «Mis trámites» dice «Puedes renovarla hasta el 01/03/2029», pero la base solo acepta hasta el 28/02/2029 | Calcular como la base; ver «Para decidir» 11 |
| G1-02 (G1) | P16, P140 | La reducción de hasta 75 % del Aviso de la Gaceta del 27/10/2025 es solo para trabajadores de la Secretaría. El Aviso de cuotas de la Gaceta No. 1548 del 14/02/2025 ya se puede leer: poda nueva $4,264 (2.7.1.1), poda renovación $767 (2.7.1.2), dictaminador nuevo $6,025 (2.7.1.2.11), dictaminador renovación $1,210 (2.5.18.1) y reposición $88 (2.5.17.1). Las cifras se leyeron con una herramienta que resume el PDF: hay que confirmarlas en el ejemplar y con Finanzas si siguen vigentes en 2026 | Actualizar P16 y P140 |
| G1-06 (G1) | Anteproyecto de lineamientos | Una fracción de la Ley Ambiental citada como fundamento existe, pero trata de otra materia; hay otra fracción más pertinente. Detalle en el informe sensible | Agregar o sustituir la fracción |

### 5.3 Bajos

| Clave | Qué | Dónde |
|---|---|---|
| R4-07 / A4-01 | Código sin uso que dejaron los bloques 72 a 74: `cupoTexto`, `textoVence`, `HORAS`, `alerta`, `tituloPaso` y 19 clases CSS (unas 45 líneas) | `personal.js:257, 266`, `apd.js:141`, `grupos.js:118`, `apd.css` |
| R4-08 | Duplicación nueva: `nombreCurso` y `cursoLargo`; la fila de persona y el bloque de organización copiados; horas e instructores en 3 lugares | `grupos.js`, `programar.js`, `personal.js` |
| R4-09 | «Quién pasa un grupo a «en curso»» se cita como P92 en vez de P124 | `AUDITORIA-2026-10-18.md:52`, `archivos-prueba.js:409` |
| R4-10 | El planeador muestra 8 semanas; los documentos dicen «al menos seis» o «siete más» | `grupos.js:26`, `DECISIONES.md:256`, `ETAPA-2:18` |
| R4-11 | El parámetro `dias_inhabiles` que se cita no existe en la base | `DECISIONES.md:257`, `ETAPA-2:20`, `personal.js:274` |
| R4-12 | ETAPA-2 describe la «En espera» anterior; la lista de hallazgos del estándar abiertos no incluye P145 a P148 ni P152; LEEME no lista `docs/auditoria-romper/` | `ETAPA-2:87-92, 177`, `LEEME.md:50` |
| R4-13 | Comentarios que cuentan historia y 137 líneas nuevas que citan claves de informes que no están en el repositorio | `espera.js:1`, `apd.js:156`, `aplicar.js:33-35` |
| R4-14 | Una prueba dice que entra desde la ficha del grupo y en realidad entra por otra dirección | `probar-sitio.mjs:1467` |
| R4-15 | `data-calendario` reutilizado en «Programar», y «menos de 7 días» escrito a mano | `programar.html:56, 73` |
| E1-02 | «Programar» repite en pantalla el texto que trae `?grupo=` (no ejecuta código) | `programar.js:40` |
| F3-01 | pdf.js se abre sin `isEvalSupported: false` en el material del personal | `material-personal.js:48` |
| B7-01 | Ninguna de las 21 páginas declara política de contenido (CSP) ni de referente, aunque el sitio ya cumple para una estricta | `sitio/*.html` |
| B5-01 | «Programar» sin datos deja activos los botones, y el envío lleva a una página de error del servidor | `programar.js:407-408` |
| B5-02 | «Programar» no avisa al salir con cambios; «Atrás» y «Adelante» pierden la semana elegida | `programar.js` |
| B5-03 | Si el banco del examen no carga, se le dice a la persona «Ese código no existe» | `examen-servidor.js:62-64` |
| B5-04 | Un registro `null` en los ficticios tumba cuatro pantallas de grupos | lectura de `ficticios.json` |
| E2-07 | La cuenta del servicio puede gastar folios y abrir expedientes directamente (detalle en el informe sensible) | `05-apd-rol-y-permisos.sql` |
| E2-08 | Con concurrencia, la base responde con errores crudos (23505) o con mensajes de otro paso; el código `solicitud_activa` que propone F1-3 no existe | contrato base-API |
| A1-04 | axe solo revisa a 390 px; `corregir.html` nunca pasa por axe; «Programar» no tiene prueba de volumen | `probar-sitio.mjs` |
| A1-05 | No hay gancho de Git ni integración continua | repositorio |
| A3-01 | Los `id` del material de estudio cambian en cada exportación: Git queda con cambios y un «Ocultar» hecho en el navegador se pierde al republicar | `exportar-ficticios.mjs` |
| D2-01 | La bandeja de revisión y el historial de una persona no tienen índice (con 5,160 solicitudes recorren toda la tabla); 5 llaves foráneas sin índice | `02-apd-tablas.sql` |
| D3-01 | El parámetro del tamaño máximo dice que el manual pesa «unos 18 MB»; el publicado pesa 11.7 MB | `04-apd-catalogos.sql` |
| D3-02 | El menú de pruebas del sitio público enlaza a un artefacto de claude.ai que puede ser privado | `pruebas.js` |
| B8-02 | «Mis trámites» compara el día también por el texto de la fecha: fallaría con horas en UTC de la API | `tramites.js:263` |
| B8-03 | Las pruebas del sitio no fijan la zona horaria del navegador | `probar-sitio.mjs`, `probar-examen.mjs` |
| G1-03 | «Anexo 1» nombra tres documentos distintos (anteproyecto, borrador del área y NADF) | documentos |
| G1-07 | Una remisión al Código Penal del anteproyecto no coincide del todo con la que hace la propia Ley Ambiental (informe sensible) | anteproyecto |
| G1-09 | Redacción del anteproyecto: enumeración mal cerrada y «derecho» y «cuota» mezclados (P144); informe sensible | anteproyecto |

### 5.4 Informativos

E2-09 (una transacción abierta detiene las altas de folio de su serie: pedir el folio en una transacción corta) ·
F3-02 (licencias de terceros sin anotar y repositorio sin licencia propia) · D2-02 (siete nombres distintos para «quién lo
hizo») · G1-04 (el plazo del Octavo Transitorio venció hacia el 28/03/2025, según el calendario de días inhábiles) ·
G1-05 (el Manual técnico de poda tiene cuota de $299 por ejemplar y el sistema lo publica gratis: Para decidir 14).

## 6. Verificado sin hallazgos

- **Pruebas existentes:** base 173 de 173, esquemas 120, sitio 744 (con axe), examen 74, volumen 52 y barrido de 60 pantallas con 201 botones. Las mismas cifras al principio y al final, y en cuatro revisores.
- **Construcción:** el sitio sale igual dos veces e igual al commit.
- **Concurrencia en la base:** cupo de 25 (90 órdenes con 3 conexiones), la misma persona en dos grupos, folios de solicitud y de acreditación sin repetirse ni saltarse, dos solicitudes activas, citas simultáneas y validar contra observar (155 órdenes). Nada se borra en cascada: 22 llaves NO ACTION.
- **Respaldo:** `pg_dump` y `pg_restore` dejan las 22 tablas con los mismos conteos, la bitácora con la misma huella, 39 disparadores, 134 restricciones y 173 de 173 reglas.
- **Fechas en la base:** vigencia el 1/1, el 31/12, el 28/2 y el 29/2 de 2028 y el 1/3; ventana de renovación en el segundo límite; los 7 días al cruzar mes y año; sesión en UTC, Ciudad de México, Tijuana y Madrid. En las pantallas, 0 diferencias en 1,081 comparaciones.
- **Seguridad:** gitleaks 0 en los 176 commits, cada uno por separado; 116 CURP del historial, todas ficticias; 0 IP reales; OCR de 155 capturas sin datos; 0 peticiones fuera del origen de 14,368; 0 de 97 cargas de inyección ejecutadas; `?volver=` hacia otro sitio siempre regresa a «Mis trámites»; `npm audit` 0; pdf.js 4.10.38 fuera del rango de los avisos publicados; D-02, D-03 y D-04 corregidos (lo guardado hace 8 días se borra; `noindex` en las 21 pantallas).
- **Normativo:** 26 citas literales correctas; 27 páginas del material de estudio iguales a los PDF; el muestreo del 18/10, correcto. Del anteproyecto, todas las citas de la Ley Ambiental y de la NADF que se pudieron cotejar existen y dicen lo que se les atribuye, salvo lo anotado en G1-06 y G1-07 (detalle en el informe sensible).
- **Auditorías anteriores:** 12 de 12 del frente A y 12 de 12 del frente E del 18/10 siguen corregidos. Los 10 altos de «romperlo» que se tomaron de muestra siguen igual (no se cuentan como nuevos).
- **Código nuevo:** sin `innerHTML` ni `eval`; parámetros validados; `?v=` en todas las referencias de los 21 HTML.

## 7. Contradicciones entre documentos y datos atrasados

| Tema | Fuente A | Fuente B |
|---|---|---|
| Comprobante de domicilio | `DECISIONES.md:76, 302`, `PENDIENTES.md:19`: «la norma lo exige» | NADF y Ley Ambiental: no lo piden (G1-01) |
| Solución provisional de P152 | `PENDIENTES.md:141` | No existe en `sitio/app/` (R4-02) |
| Mínimo del grupo | `02-apd-tablas.sql:517`, `REGLAS.md:66`: «sin excepción» | Con concurrencia se confirma con 4 (E2-02) |
| Bitácora | `REGLAS.md:90-91`: «cada alta y cambio de estado queda… ni siquiera por la administración» | 10 de 11 acciones no se registran (E2-04); la cuenta del servicio escribe filas (D-13) |
| P122 | «la base rechaza el segundo cambio de estado» | No en todos los órdenes (E2-01) |
| Folios | `03-apd-reglas.sql:117`: «la cuenta del servicio no toca folio_contador» | `05-apd-rol-y-permisos.sql:92` se lo permite (E2-07) |
| Validación de la CURP | `01-apd-esquema.sql:36-39`, `REGLAS.md:89`: la base no acepta lo que el formulario rechaza | Acepta 6 casos que el formulario rechaza (A1-01) |
| «Por vencer» | `REGLAS.md:49`: 30 días | La base usa 31 |
| `dias_inhabiles` | `DECISIONES.md:257`, `ETAPA-2:20`: «parámetro, hoy vacío» | No existe (R4-11) |
| Semanas del planeador | «al menos seis» (`DECISIONES.md:256`) | 8 (`grupos.js:26`) |
| Clave de «en curso» | P92 | P124 |
| Grupo propio | `DECISIONES.md:183`, `ETAPA-2:87-92` | El planeador no lo dice (R4-03) |
| Guía del SIA | `AUDITORIA-2026-10-18.md:45-46`: abierta | `DECISIONES.md:231`: decidida el 18/10 |
| Hallazgos del estándar abiertos | `ETAPA-2:177`: P126 a P135 | Además P145 a P148 y P152 |
| Peso del manual | `04-apd-catalogos.sql`: «unos 18 MB» | 11.7 MB publicados |
| Cifras del 18/10 | `AUDITORIA-2026-10-18.md:71-73`: 658, 73, 118, 56, 153 | Hoy 744, 74, 120, 60, 201. Las del informe eran ciertas en la 0.53: se dejan como registro histórico |

## 8. Para decidir (Liber)

| # | Pregunta | Opciones y costo | Recomendación |
|---|---|---|---|
| 1 | ¿Se sigue pidiendo el comprobante de domicilio? (G1-01, P03) | (a) Dejar de pedirlo ya: S; (b) seguir pidiéndolo citando la fuente real (borrador o ficha del trámite): S; (c) consultar a Jurídico | **(c)** y, mientras, cambiar «la norma lo exige» por la fuente real |
| 2 | ¿El planeador vuelve a decir «su grupo» de cada organización? (R4-03) | (a) Sí, y avisar en «Programar» antes de crear un segundo: M; (b) quitar la regla y tachar DECISIONES:183: S | **(a)** |
| 3 | Tope del primer día del curso (R4-01) | (a) Un año desde hoy: S; (b) un parámetro nuevo: M. En los dos casos, también en la base | **(a)** |
| 4 | Cómo cerrar las carreras de la base (E2-01 a E2-03) | (a) `FOR UPDATE` en 4 funciones: S, ya probado; (b) SERIALIZABLE con reintentos: M; (c) control de versión en la API (409): M | **(a) ahora y (c) en la etapa 3** |
| 5 | Integridad de la bitácora y de los respaldos (E2-05, D-13) | (a) Cadena de huellas: M; (b) copia en un almacén del SIA de solo agregar: M a L; (c) procedimiento: huella del respaldo guardada aparte y restauración de prueba mensual: S | **(c) ya y (a) antes de datos reales** |
| 6 | Folios directos de la cuenta del servicio (E2-07) | (a) Quitar el permiso directo: S; (b) aceptar huecos | **(a)** |
| 7 | ¿Qué cuenta el encabezado de «Citas de cotejo»? (B2-01) | (a) «atendidas · no se presentaron · sin pago»: S; (b) «resueltas» en lugar de «atendidas»: S | **(a)** |
| 8 | ¿Cómo se cierra la cita de una solicitud cancelada? (A2-01) | (a) Un resultado nuevo, «cancelada»: S; (b) uno existente con motivo: S | **(a)** |
| 9 | Política de contenido (CSP) en una etiqueta `meta` (B7-01) | (a) Ahora: S; (b) solo en el SIA, como cabecera | **(a)** |
| 10 | Licencia del repositorio público (F3-02) | Elegir una o declarar «todos los derechos reservados» | Consultar con la Secretaría |
| 11 | Aniversario de una acreditación emitida un 29 de febrero (B8-01) | Fijar el cálculo de la base y escribirlo en REGLAS y en los lineamientos | Esa |
| 12 | ¿El instructor puede abrir el grupo de otro? (E1-01) | (a) No: S; (b) sí, con registro de quién lo hizo | **(a)** |
| 13 | ¿Las pruebas corren solas? (A1-05) | (a) Gancho de Git local: S; (b) verificación en cada push (GitHub Actions): M | **(b)** |
| 14 | Manual técnico con cuota de $299 publicado gratis (G1-05) | Confirmar con el área si puede ser gratuito para quien se acredita | Confirmar |
| 15 | Puntos del 18/10 sin Pnn (R4-05) | Abrir pendientes nuevos (quedaron como P162 a P165), o registrarlos como decididos | Abrir |

### Decisiones de Liber (19/10/2026, 09:14)

| # | Decisión |
|---|---|
| 1 | Comprobante de domicilio: se consulta a Jurídico. Mientras, se sigue pidiendo y los documentos citan la fuente real (borrador del área), no «la norma lo exige» |
| 2 | El planeador vuelve a decir «su grupo» de cada organización y «Programar» avisa antes de crearle un segundo |
| 3 | El primer día de un curso tiene como máximo un año desde hoy, en la pantalla y en la base |
| 4 | Bloqueo en la base ahora (`FOR UPDATE`); en la etapa 3, aviso «la solicitud cambió» en la pantalla |
| 5 | Ya: huella de cada respaldo guardada aparte y restauración de prueba mensual. Antes de datos reales: bitácora sellada en cadena |
| 6 | Se quita a la cuenta del servicio el permiso de pedir folios y abrir expedientes directamente |
| 7 | «Citas de cotejo» desglosa: atendidas, no se presentaron, sin pago, pausa vencida |
| 8 | Al cancelar una solicitud, su cita se cierra con un resultado nuevo, «cancelada» |
| 9 | Política de contenido (CSP) en las 21 páginas desde ya |
| 10 | Licencia: se pregunta a la Secretaría; mientras, «Todos los derechos reservados» |
| 11 | Aniversario de una acreditación del 29 de febrero: el cálculo de la base (vence el 28 de febrero) |
| 12 | El instructor sólo abre sus grupos |
| 13 | Las pruebas corren solas en cada subida a GitHub |
| 14 | Manual técnico con cuota: se confirma con el área; mientras, se queda publicado |
| 15 | Se abren P162 en adelante para los cuatro puntos del 18/10 sin número |

Aprobado: corregir los bloques 1 (fechas) y 2 (base) del plan.

### Estado de los hallazgos al 19/10/2026 (versión de prueba 0.57, bloques 1 y 2)

| Estado | Hallazgos |
|---|---|
| **Corregidos** (con la prueba que los encontró: fallaba antes, pasa después) | Altos: R4-01, E2-01, E2-02, E2-03. Medios: R4-02, A1-01, A1-03 (de 49 códigos sin caso queda 1, inalcanzable), A2-01, E2-04, B8-01, G1-02 (P16 y P140), R4-05 (P162 a P165). Bajos: E2-07, D2-01, B8-02, B8-03. Registrados antes: D-01, D-07, D-10 (el permiso de `public` en PostgreSQL 13-14 queda como paso de instalación), D-13 (= E2-06), F2-A1 |
| **Corregido en parte** | E2-05: huella del respaldo y restauración de prueba en `probar-base`; el sello en cadena de la bitácora queda para antes de datos reales (P169). D-06: asistencia y examen exigen sesión de personal; la pertenencia de la fila a la persona queda para la etapa 3 (P170). G1-01: los documentos ya citan la fuente real; el fondo se consulta con Jurídico (P03) |
| **Corregidos en el bloque 3** (rama del PR #2) | R4-03, R4-04 (y RI-07), B2-01, E1-01, E1-02, B5-02, B5-03, B5-04, F3-01, R4-07 / A4-01 (en el sitio; quedan variables sin uso en tres herramientas), R4-14, R4-15. B5-01 ya estaba corregido en 0.58. R4-08 en parte: las listas de horas e instructores se quedan en el HTML porque de ahí sale el esquema del servidor |
| **Abiertos** (bloques 4 a 7) | Los demás de la sección 5. |

**Trabajo en paralelo.** Mientras se corregían los bloques 1 y 2, otra sesión subió a `main` las correcciones de «intentar romperlo», bloques 1 a 3 (versión 0.56; estado en `docs/AUDITORIA-2026-10-18-romper.md`). Con ellas cambian el estado de F2-A1, F1-8 y de los altos de «romperlo» que este informe daba como abiertos. Las dos líneas se integraron en la 0.57: la fecha pegada quedó con la solución de esa sesión (`app/apd.js`, más completa) y esta agrega el tope de un año, la base y lo demás.

Pruebas al cierre (0.57, integrada): base 303 de 303, concurrencia 20 de 20, restauración 303 de 303, esquemas 128,
sitio 927, examen 79, volumen 52, barrido de 60 pantallas sin avisos nuevos. Sin fallas nuevas contra la línea base.

## 9. Fallas de componentes compartidos (estándar de formularios)

| Pendiente | Resuelto en | Qué hace el proyecto al actualizar |
|---|---|---|
| P126 etiqueta de estado | 1.4.2 | Quitar las reglas de `.estado` de `apd.css`; revisar la bandeja y el planeador, que no usan `.tabla` |
| P127 EXIF (D-05) | 1.4.2 y 1.4.3 | Nada |
| P128 24 horas | 1.4.2 | Nada |
| P129 RFC con Ñ | 1.4.2 | Nada (los RFC ya guardados con N no se corrigen solos) |
| P130 logotipo | 1.4.2 | `width="477" height="96"` en los 21 HTML |
| P131 `FormKit.aviso` | 1.4.2 | Sustituir `APD.aviso` (13 usos) |
| P134 bajada y líneas de datos | 1.4.4 | Quitar `max-width: none`; `APD.meta` (6 usos) pasa a `.linea-datos` |
| P135 chips | 1.4.4 | Quitar las reglas de `.chip-fijo` |
| P145 tabla | 1.5.0 | Quitar las reglas de `.tabla-bandeja` |
| P146 a P148 | 1.5.0 y 1.5.1 | P148: quitar el borrador propio de `solicitud.js` y pasar el almacén como proveedor |
| **P152 fecha pegada** | **Sin resolver en 1.5.1** | El proyecto necesita su propia corrección (R4-01) |
| Sin clave: solo se bloquea el primer botón de envío (F3-M6) | Sin resolver en 1.5.1 | Registrar Pnn para el estándar |
| Sin clave: foto enorme leída completa antes de revisar su peso (D-20) | Sin resolver en 1.5.1 | Registrar Pnn |
| Sin clave: PDF con contraseña aceptado (F1-8) | Sin resolver en 1.5.1 | Registrar Pnn |

Al pasar a la 1.5.1 también: `mensajes-usted.js:86` define `sesionExpira`, que se retiró; hay 44 textos configurables
nuevos que necesitan su versión en usted (por ejemplo `archRechazoProceso`); la franja del borrador cambia sus botones
y puede afectar las pruebas de la solicitud.

## 10. No verificable desde aquí, hipótesis, no confirmado y no aplica

- **No verificable:**
  - Firefox y WebKit: la red bloqueó su descarga. Se verifica con P35, en equipos reales.
  - Los textos vigentes de la Ley Orgánica del Poder Ejecutivo (art. 35), el Reglamento Interior (art. 190), la Ley de Procedimiento Administrativo, el Código Penal (211 Bis, 323, 345 Bis y 350), el Código Fiscal y la Ley de Protección de Datos Personales: las fuentes oficiales no se dejan leer de forma automática. Se verifica con los PDF oficiales subidos al Proyecto.
  - Si las cuotas de 2025 siguen vigentes en 2026: se verifica con Finanzas.
  - El orden real de las operaciones del backend: decide cuál variante de E2-01 se da. Se verifica en la etapa 3, con pruebas de la API con dos clientes.
  - El procedimiento de respaldo del SIA: se verifica con el área del SIA.
- **Hipótesis:** que el backend declare `apd.motivo` en la revisión documental. De eso depende la variante de E2-01 en que una solicitud validada regresa a «con observaciones».
- **No confirmado:** R4-03 no lo reprodujo el revisor independiente sin el escenario de volumen; r4 lo reprodujo 2 de 2 con volumen.
- **Falla de la prueba, no del sistema:** dos revisores tuvieron fallas por una hora simulada anterior al envío y por una casilla repintada; se repitieron bien y solo cuentan las repeticiones.
- **No aplica:** B3, B6 sin conexión, B9, D5 y F4 a F6, por lo dicho en la sección 3.
- **Pospuesto por decisión del dueño:** A6, B1, B4 completa, B6, C1 a C6 y D4, hasta después de actualizar el estándar.

## 11. Plan de corrección en bloques cerrados

Cada bloque se cierra con su prueba y sube la versión de prueba. Los bloques 1 a 3 no cambian la interfaz más que en lo
indicado. El 4 es la actualización del estándar que pide el Proyecto, y el barrido de pantallas va después de él.

| Bloque | Qué va junto | Prueba que lo cierra | Versión |
|---|---|---|---|
| 1. Fechas | R4-01, F2-A1 (romper), la solución provisional de P152 (lo pegado en AAAA-MM-DD y el tope de año), R4-02, B8-01, B8-02, B8-03 | Pegar «2026-11-02» en revisar, cotejo, programar y la ficha del grupo da 02/11/2026; una acreditación que vence el 29/02 ofrece hasta el 28/02; las pruebas fijan `timezoneId` | 0.56 |
| 2. Base: integridad | E2-01, E2-02, E2-03 (`FOR UPDATE` en 4 funciones), A2-01, A1-01, E2-04, D-13/E2-06, E2-07, D-01, D-07, D-10, D2-01 (índices), A1-03 | `probar-concurrencia.sh` nuevo (31 escenarios, todos bien), los 15 casos SQL de seguridad pasan, `probar-reglas` con un caso por código | 0.57 |
| 3. Grupos y personal | R4-03, R4-04, B5-01, B5-02, B5-03, B5-04, E1-01, E1-02, B2-01, F3-01, R4-07, R4-08, R4-15 | `probar-volumen` lee «Su grupo…» y la agenda cuadra con la base; `f1-*.py` sin resultados | 0.58 |
| 4. Estándar 1.5.1 | P126 a P148 (sección 9), quitar las soluciones provisionales; registrar los 3 hallazgos sin clave | Las baterías completas, más la revisión en teléfono y escritorio que pide el Proyecto | 0.59 |
| 5. Documentos | G1-01 (con la decisión 1), G1-02, R4-05, R4-06, R4-09 a R4-12, D3-01, «por vencer» 30/31, G1-03 | Un guion de coherencia (cifras, claves y versión) sale vacío; `grep "norma lo exige"` vacío o con su cita | junto con el 4 |
| 6. Pruebas y repositorio | A1-02, A1-04, A1-05, A3-01, B7-01, F3-02 | Las baterías siguen después de una falla; CI en verde; dos exportaciones iguales | 0.60 |
| 7. Anteproyecto de lineamientos | G1-06, G1-07, G1-09 y la transición de la NADF (N06) | Cotejo de cada cita contra el texto oficial, con los textos que faltan | versión de trabajo 0.5 |
| Después | Barrido de pantallas, accesibilidad, textos y peso sobre la 0.59 (lo pospuesto) | Auditoría de seguimiento | — |

**Propuestas que cambian pantalla** (requieren aprobación, con su antes y después):

- R4-03: la cabeza del bloque de cada organización pasa de «Jardines… · 13 personas, juntas» a «Jardines… · 13 personas · su grupo APD-G-2026-021: 3 de 25, le faltan 2».
- R4-04: una sección nueva, «Su fecha ya pasó», arriba de «Sin fecha».
- B2-01: el encabezado de la agenda pasa de «8 citas: 8 atendidas» a «8 citas: 7 atendidas, 1 no se presentó».
- E1-01: el instructor que abre un grupo ajeno ve «Este grupo lo da otra persona».

## 12. Pruebas nuevas que deben quedar permanentes

| Prueba | Serie |
|---|---|
| Fecha pegada en las 4 pantallas con fecha; tope de año (r4 `c1b-confirmar-6110.mjs`, principal `repro-fecha-pegada.mjs`) | Cada cambio |
| `probar-concurrencia.sh` (r3 `guiones/base-lib.sh` y base-1 a base-4; independiente `f1-base/`) | Cada versión |
| 15 casos SQL de seguridad (r2 `pruebas-seguridad-base.mjs`) | Cada versión |
| Bitácora: `DESPUES = ANTES + 1` en las 11 acciones (r3 base-5) | Cada versión |
| Respaldo y restauración como paso 7 de `probar-base.sh` (r3 base-6) | Cada versión |
| Cruce de validación pantalla-servidor-base (r1 `a1/cruce-validacion.mjs`) | Cada cambio |
| Recálculo de cifras (r1 `b2/`) | Cada versión |
| Fechas límite y zonas horarias (r6 `b8-*.mjs`) | Cada versión |
| Red bloqueada y sin peticiones a terceros (r2 `privacidad-red.mjs`) | Antes de entregar |
| Inyección en el DOM (r2 `inyeccion-dom.mjs`) | Cada versión |
| Reproducción de los altos de «romperlo» (r3 `repro-altos.mjs`): cada caso pasa a «no se reprodujo» al corregirse | Cada versión |
| Código y CSS sin uso, `?v=` (r4 `f1-*.py`, `f2-cache-v.sh`) | Antes de entregar |
| Cotejo literal de citas (r5 `cotejo.sh`, `paginas.sh`) | Cuando cambie una norma o el material |

## 13. Criterios de salida

| Momento | Criterio | Resultado |
|---|---|---|
| En cada cambio | 0 fallas | **Cumple** en las pruebas existentes (1,163 comprobaciones); no corren solas |
| En cada versión | 0 críticos y 0 altos | **No cumple:** 1 alto nuevo del prototipo y 22 de «romperlo» |
| Antes de mostrar al área | Sin altos y 0 diferencias en cifras | **No cumple:** 5 diferencias (B2-01) |
| Antes de cerrar la etapa | Sin contradicciones abiertas | **No cumple:** 16 (sección 7) |
| Antes de datos reales | 0 críticos y 0 altos; plazo de conservación; aviso aprobado | **No cumple:** 4 altos de base o de datos nuevos, más D-01 y D-06; D-11 y P31 abiertos |
| Documentos a firma | 0 citas equivocadas | **No cumple todavía** para el anteproyecto: una contradicción con la NADF vigente (N06) y citas sin verificar |
| Siempre (G2) | Registrada y avisada | **No cumple:** 3 fallas del estándar sin clave |

## 14. Calendario

| Auditoría | Cada cuándo |
|---|---|
| A1 a A5 (con las pruebas nuevas) | En cada cambio, de forma automática cuando haya CI |
| E2 concurrencia, E1 base, B2 cifras, B8 fechas | En cada versión |
| Barrido de pantallas, B4, C1 a C6, D4 | Después de pasar al estándar 1.5.1, y luego en cada cambio grande de interfaz |
| G1 | Cuando cambie la NADF, la Ley o el anteproyecto, y antes de enviar los lineamientos a firma |
| E1 completa y E3 | Antes de instalar la base en el SIA |
| H7 (dependencias, fuentes oficiales, enlaces) | Cada trimestre en operación |

## 15. Método

- **Revisores:** el auditor principal más seis revisores en paralelo, cada uno con su propia copia fuera del repositorio:
  - r1: pruebas, datos y construcción;
  - r2: seguridad y datos personales (OWASP ASVS 4.0.3, nivel 1 para el sitio y 2 para la base);
  - r3: robustez e integridad de la base;
  - r4: documentos, limpieza y código desde 2a08bd7;
  - r5: cotejo normativo;
  - r6: fechas.

  Un revisor independiente repitió los frentes con altos sin ver los primeros resultados (concurrencia en la base, fechas del personal y comprobante de domicilio), y el auditor principal reprodujo el alto de pantalla. El cotejo del anteproyecto lo hizo el auditor principal, porque los revisores no tenían acceso a los documentos del Proyecto.
- **Herramientas:** Node 22; Playwright 1.63 con Chromium 1194; axe-core 4.13.0; PostgreSQL 16.15 (un clúster desechable por revisor); ESLint 9.39.1; gitleaks 8.28.0; pdftotext. Firefox y WebKit no se pudieron instalar.
- **Pantallas y anchos:** 390 × 844 y 1280 × 900 (axe también a 1280); zonas America/Mexico_City, UTC, America/Tijuana y Europe/Madrid.
- **Número de pruebas:** más de 3,000 comprobaciones nuevas, entre ellas:
  - 31 escenarios de concurrencia × 2, más más de 250 órdenes del independiente;
  - 1,081 comparaciones de fechas;
  - 14,368 peticiones;
  - 97 cargas de inyección;
  - 155 cifras;
  - 26 citas y 27 páginas.
- **Línea base y resultado final:** al inicio y al final, base 173, esquemas 120, sitio 744, examen 74, volumen 52 y barrido de 60 pantallas con 201 botones. Sin diferencias.
- **Huellas:** «Sin cambios: 247 archivos idénticos» (`principal/huellas-antes.json` y `huellas-despues.json`).

## 16. Qué sigue

Aprobar los bloques 1 y 2 del plan antes de cualquier otra cosa. El 1 es corto y quita el único alto de pantalla. El 2
cierra las carreras de la base con un cambio de pocas líneas ya probado, y deja una prueba permanente de concurrencia.
Después, actualizar al estándar 1.5.1 y hacer la auditoría de pantallas que quedó pospuesta.
