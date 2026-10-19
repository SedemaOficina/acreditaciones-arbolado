# Etapa 1 · Pantallas de la persona solicitante

Versión de prueba 0.N (sube con cada publicación; ver `docs/VERSIONES.md`), con datos ficticios. Construida con el **Estándar de formularios del SIA 1.5.1**
(`SedemaOficina/estandares-sia`, carpeta `formularios/`; desde el 2026-10-19, antes 1.4.1, 1.3.1 y 1.0.0), sin modificarlo. Ninguna pantalla guarda nada fuera de la pestaña:
el envío, el acceso y la consulta están **simulados** sobre `datos/ficticios.json` hasta la etapa 3.

## 1. Pantallas

| Página | Forma | Qué hace | Módulos del estándar |
|---|---|---|---|
| `index.html` | Sin formulario | Qué es, cómo es el trámite, cuándo renovar, requisitos por curso (del catálogo de la base) | acordeon |
| `cuenta.html` | Una página | Crea la cuenta: nombre, primer apellido, segundo apellido (vacío si no hay; los tres y la CURP se escriben en mayúsculas al momento), fecha de nacimiento (escrita como día/mes/año, sin calendario: formato `fecha-dma` y módulo `fecha` del estándar, P70), CURP (comprobada contra nombre, apellidos y fecha, también al cambiar esos datos después), sexo (tomado de la CURP, sólo lectura), fotografía de frente obligatoria (JPG o PNG; en el teléfono, cámara frontal), correo (con confirmación), teléfono, adscripción (fragmento compartido con «Mi perfil»), contraseña (con confirmación), aviso, humano. Si la CURP es del registro de Kobo y el nombre coincide (sin acentos, admite una letra distinta; P14), activa esa cuenta y avisa que hay historial | identificadores, archivos, opciones, otro, combo, fecha, modal, copiar, acuse |
| `entrar.html` | Una página | CURP y contraseña. El error nunca dice cuál de los dos falló. En la versión de prueba, una línea con la contraseña de las personas de ejemplo; escogerlas se hace desde el menú de pruebas | identificadores |
| `tramites.html` | Sin formulario | Tres bloques: «Solicitudes en curso» (incluye la acreditada con la credencial por recoger), «Mis acreditaciones» y «Solicitudes anteriores» (sólo si hay); en espera de curso o con grupo, enlace al material de estudio. Mis acreditaciones (vigencia en palabras, «Renovar» cuando aplica) y mis solicitudes (estado —«En revisión documental»…—, qué sigue, cita con datos de pago —concepto, monto y referencia en amarillo «por confirmar»— y aviso de llevar la identificación para confirmar la fotografía, folio de la solicitud, expediente de la persona, con grupo: preséntate el, el curso termina el, sede; observaciones; asistencia y calificación mientras es el resultado; acreditación emitida: folio, inicio y fin de vigencia; lista para recoger —con la foto de la credencial y el comprobante de recepción que se hacen ahí—, motivo de cierre) | — |
| `solicitud.html` | Por pasos (3) | **Acreditación** (poda y derribo o dictaminador técnico; si es nueva o renovación se informa, no se pregunta; lo que no puede pedir, deshabilitado con su motivo), acreditación que se renueva (sólo lectura), la adscripción con que se enviará (se cambia en «Mi perfil»), estudios en los dos tipos (último nivel en lista desplegable → con licenciatura o posgrado, carrera con autocompletado y situación del grado); en dictaminador, además, experiencia, con el mínimo que pide su perfil y aviso si no cumple · **Documentos** (generados del catálogo; sólo PDF; la CURP con su enlace a gob.mx) · **Revisión** (cada documento con su nombre nuevo y, debajo, el archivo que subió), declaración bajo protesta de decir verdad, aviso, humano · acuse con folio | opciones, combo, pasos, archivos, revision, acuse, modal, copiar |
| `datos.html` | «Mi perfil», por partes | Cabeza con fotografía (en la prueba, la cargada en ese navegador; si no, iniciales), nombre y estado de la fotografía, con «Cambiar fotografía» mientras no esté confirmada; datos de identidad de sólo lectura (CURP, fecha de nacimiento y sexo, tomado de la CURP); sin número de expediente (se ve en «Mis trámites»); los datos como ficha, rótulo y dato (opción B); contacto y adscripción escritos, cada uno con «Editar» que abre su formulario (adscripción: el fragmento compartido con la cuenta). Una parte a la vez; «Cancelar» cierra sin guardar. `?volver=` ofrece regresar a la solicitud | opciones, otro, combo, archivos |
| `verificar.html` | Una página | Verificación pública por número de acreditación: nombre, tipo, fechas y «Vigente / No vigente» | identificadores |
| `material.html` | Sin formulario | Material de estudio, sin cuenta: documentos publicados con su edición, abrir y descargar, «Qué estudiar» con enlace a la página del PDF; filtro poda / dictaminador (P136) | opciones |

Textos de estado: una sola fuente en `sitio/app/apd.js` (`ESTADOS`, `VIGENCIA`). Ejemplo: `validada_en_linea`
se lee «Acude a tu cita» (el personal ve «Cita asignada»); `lista_para_curso`, «En espera de curso» (el personal ve
«En espera de grupo»).

### Menú de pruebas (sólo versión 0.N)

`app/pruebas.js`, en todas las pantallas: botón fijo «Menú de pruebas» con cinco bloques, siempre en el mismo orden
(maqueta aprobada el 2026-10-16, `maquetas/menu-pruebas/`; el tercero, en dos pasos desde el 2026-10-18):

1. **Estás como**: quién eres (persona, persona nueva, personal o nadie), qué caso es y en qué pantalla estás; «Salir».
2. **En esta pantalla**, sólo lo que aplica (si nada aplica, no aparece): llenar con datos ficticios (cuenta —con una
   fotografía ficticia dibujada en el navegador—, solicitud y verificar); crear la cuenta de alguien del registro
   anterior con su CURP (cuenta); llenar CURP y contraseña con un caso (entrar); ir al paso (solicitud); cómo responde el
   envío —normal, falla, límite, lento— (cuenta, mi perfil, entrar y solicitud).
3. **¿Quién?** (persona nueva, podador, dictaminador, del registro anterior sin cuenta, personal de la Secretaría) y
   **¿En qué momento?** (los casos de ese perfil por etapa, con una línea de qué se puede probar; hoy 39,
   `app/casos-prueba.js`). Cada caso busca en los ficticios la primera persona que lo cumple; la prueba del sitio
   comprueba que todos la encuentran.
4. **Ir a otra pantalla**: agrupadas en público, persona solicitante y personal.
5. **Ajustes de la prueba**: preguntas obligatorias (los formatos y las comprobaciones de la CURP siguen), lo guardado
   en este navegador (solicitudes enviadas con sus documentos y revisiones) con «Borrar lo guardado», y «Empezar de cero»
   (cierra la sesión, borra lo guardado, activa las obligatorias y lleva al inicio).

En «Entrar» ya no hay caja de personas de ejemplo: sólo una línea con su contraseña.
También pone la página en modo de prueba: los **datos internos** (`data-interno`: lo que calcula el sistema, se guarda
en la base y la persona no ve, como el curso que corresponde, `tramite`; lo que sólo usa
la página, los datos calculados `data-auxiliar`, no se muestra) se
muestran en un recuadro amarillo con su nota y su valor; sin este archivo, en producción, quedan ocultos. No
aparece si `VERSION` no es 0.N; al pasar al SIA se quita de las páginas con el acceso simulado.

## 2. Archivos del estándar que se copian

Los copia `herramientas/construir-sitio.mjs` a `sitio/formkit/`, sin cambios: `css/` (tokens, base, núcleo),
`js/` (validaciones.config, iconos, formkit.core), `fuentes/`, `iconos/`, `imagenes/` y los módulos
**opciones, otro, combo, identificadores, pasos, archivos, revision, acuse, modal, copiar, tooltip, acordeon, tabla,
visor, version, chips, fecha**, y pdf.js 4.10.38 del propio estándar en `sitio/vendor/pdfjs-dist/`.
Alternativa equivalente: `dist/formkit.css` y `dist/formkit.js`.

Orden de carga en cada página (contrato del estándar):

1. `formkit/css/tokens.css` → `base.css` → `nucleo.css` → CSS de los módulos usados → `formkit/modulos/version/version.css` → `app/apd.css`
2. `app/perfil-academico.js` → `app/apd.js` → (`datos/catalogos.js`) → `app/config-<página>.js` → `formkit/js/validaciones.config.js` →
   (`app/mensajes-usted.js`, en las pantallas del personal) →
   `formkit/js/iconos.js` → `formkit/js/formkit.core.js` → JS de los módulos → script propio de la página →
   `app/version-visible.js`

## 3. Configuración

| Archivo | Qué ajusta |
|---|---|
| `app/perfil-academico.js` | Perfil del dictaminador y experiencia mínima (sin navegador): lo usan la página y el servidor (`limitesSegun`) |
| `app/config-cuenta.js` | Las cruzadas CURP ↔ nombre, apellidos y fecha son del estándar (`curp-nombre`, `curp-segundo-apellido`, `curp-fecha-dma`). Envío simulado: CURP con cuenta → rechazo con motivo; CURP del registro de Kobo → activa y muestra historial; nueva → cuenta |
| `app/config-entrar.js` | Acceso simulado (contraseña ficticia común) y regreso a la pantalla pedida |
| `app/config-solicitud.js` | `archivos`: 5 MB, sólo PDF, 1 por documento (parámetro de la base y `apd.requisito.formatos`). `limitesSegun.experiencia`: mínimo de años según el perfil (`data-min-segun`). Envío simulado con folio `APD-S-AAAA-NNNNN` |
| `app/config-datos.js` | «Mi perfil»: guardado simulado de cada parte (contacto, adscripción, fotografía); en la etapa 3, la API con los esquemas `perfil-*.json` |
| `app/config-verificar.js` | Consulta a la vista `apd.verificacion_publica` |
| `datos/catalogos.js` | Las 16 alcaldías (generado del catálogo inicial de la base) |

La configuración de las pantallas del personal y del examen (`config-cotejo.js`, `config-corregir.js`, `config-examen.js`
y `mensajes-usted.js`, que pone en usted los textos del estándar) se describe en el encabezado de cada archivo; ver
`docs/ETAPA-2-PANTALLAS.md`.

Todas aceptan `?simular=error | limite | lento` para ver las pantallas de fallo. No hay mapa: el proyecto no
pide ubicación (decisión 4 del SIA).

## 4. Validación en el servidor

```sh
node herramientas/probar-esquemas.mjs ../estandares-sia/formularios
```

Regenera `db/esquemas-formularios/<formulario>.json` con `herramientas/esquema-desde-html.mjs` del estándar
y prueba cada esquema con su `codigo/servidor/validar.mjs` (lo correcto pasa; cuenta sin fotografía o con la fotografía en PDF, CURP con dígito incorrecto, CURP ajena, otro segundo apellido u otra fecha de nacimiento,
confirmaciones distintas, contraseña corta, documentos faltantes por trámite y valores fuera de rango se
rechazan; resultados de la última corrida: bitácora, bloque 50 y siguientes). En la etapa 3 la API:

- valida cada envío con `validaPayload(payload, esquema)` antes de tocar la base;
- separa `tramite` en `tipo_acreditacion` y `modalidad`, y **no confía** en `anterior`: la acreditación que se
  renueva la determina la base (`apd.comprobar_elegibilidad`);
- verifica la firma de cada archivo sobre los bytes recibidos, aplica el límite por origen y reconoce la clave
  de idempotencia;
- en la corrección de observaciones, la obligatoriedad de documentos la decide `apd.comprobar_envio` (sólo lo
  observado), no el esquema de la solicitud nueva.

## 5. Decisiones técnicas de esta etapa

1. **Una sola pregunta: la acreditación.** Si es nueva o renovación lo decide el historial y se informa. El curso
   que corresponde va en un dato calculado `tramite` (`<input type="hidden" data-auxiliar>` del estándar, que no viaja
   al servidor) y de él dependen los documentos. El servidor calcula `tramite` por su cuenta (`validaPayload(…, { auxiliares })`).
2. **CURP con dígito verificador también en la base** (`apd.curp_valida`): estructura, entidad y dígito, igual
   que el estándar. Las CURP ficticias pasaron a `XAXX…NEXXX0d`, válidas en formato (en su momento, 71 de 71 pruebas de la base).
3. **Contraseña ficticia** `Prueba-ficticia-2026`: la anterior tenía 11 caracteres y el estándar pide 12.
4. **Experiencia en medios años** (`step 0.5`): un dato ficticio tenía 2.5 años y la base admite un decimal.
5. **Distintivo de versión** con el módulo `version` del estándar (antes, una hoja propia con sus tokens) y dentro del pie, para pasar el auditor de CSS y la regla de regiones de axe.
6. Las marcas internas del catálogo (`[pendiente] …`) no se muestran a la persona; siguen en la base.

## 6. Hallazgos para el Estándar de formularios (no se corrigieron aquí)

Todos los de esta tabla los resolvió el estándar entre la 1.1.0 y la 1.3.1. Desde el 2026-10-19 el sitio usa la 1.5.1 y ya
no lleva estas soluciones provisionales (bitácora, bloques 50 y 61). La tabla queda como registro.

| Módulo o herramienta | Hallazgo | Cómo se resolvió en el proyecto |
|---|---|---|
| `combo` | `docs/06` dice que acepta `{filas, fuente, corte, es_ficticio}`; `combo.js` sólo lee arreglos (`fuente.map is not a function`) | Catálogo como arreglo; fuente y corte en comentario |
| `esquema-desde-html.mjs` | Con `data-si` anidados sólo toma el más cercano; el navegador sí los combina | Un campo `tramite`, sin anidar |
| `archivos` | Con `data-max="1"` dice «Hasta 1 archivos» | Sin cambio |
| `numero` | `step` menor que 1 (p. ej. 0.5) no se valida | La base acota con `numeric(4,1)` |
| Núcleo | No hay forma prevista de marcar en un campo un error que devuelve el servidor (CURP ya registrada) | Se muestra en el aviso de envío |
| Catálogo | No hay «mostrar contraseña» | Sin cambio; se propone para el estándar |
| Validaciones cruzadas | No hay una de CURP contra nombre y apellidos (sólo fecha, sexo y entidad) | Cruzadas propias en `app/curp-nombre.js`; se propone llevarlas al estándar |
| Validaciones cruzadas | Un rol vacío (segundo apellido) impide que corra la cruzada | Campo auxiliar `sin_segundo_apellido` que calcula la página (y el servidor) y una cruzada que exige X en las posiciones 3 y 15 |
| Núcleo | No lee controles ocultos (`type="hidden"`) | Módulo propio `auxiliar` con el contrato de módulos del estándar |
| Validaciones cruzadas | No se repiten si cambia el otro dato y el campo que las declara no tenía error | `app/cuenta.js` vuelve a validar la CURP al cambiar nombre, apellidos o fecha |
| Plantilla de versión del SIA | `version-visible.css` usa valores literales y no pasa el auditor | Hoja equivalente con tokens |
| `validar.mjs` | Exige en `datos` un valor para un campo obligatorio de archivos, pero el navegador no lo manda ahí (el módulo los declara fuera de datos): una solicitud real con archivos obligatorios se rechazaría (P46) | La API pone en `datos` el número de archivos recibidos de cada campo antes de validar; `probar-esquemas.mjs` lo hace igual |
| `opciones` | En escritorio las tarjetas van en rejilla (varias por renglón) y sin el botón de opción visible: en preguntas de una sola respuesta confunden. La variante `opciones-lista` no tiene estado deshabilitado (P56) | Todo el sistema usa `opciones-lista`; el deshabilitado va en `app/apd.css` |
| Núcleo | Las condiciones no se encadenan entre campos hermanos: si se oculta una pregunta, la que dependía de su respuesta sigue visible (el servidor sí las encadena) (P52) | Envolturas `data-si` anidadas en la adscripción |
| Núcleo + `archivos` | El núcleo pone `aria-required` en el botón de la zona de carga, que no lo admite (axe: aria-allowed-attr) (P47) | `app/apd.js` lo quita sólo de ese botón |

## 7. Verificación

Automática (Chromium 390 × 844 táctil y 1280 × 900):

- `herramientas/probar-sitio.mjs`: inicio, cuenta nueva (sin fotografía no se crea; la de PDF se rechaza; cámara frontal), cuenta del registro de Kobo,
  solicitud de poda nueva, renovación, dictaminador nueva con perfil y 7 documentos, corrección de observaciones
  (sólo lo observado es obligatorio), grupo asignado, error de acceso, verificación vigente y no vigente,
  fallo de envío, CURP ajena o con otra fecha rechazada, menú de pruebas, y las pantallas del personal
  (`docs/ETAPA-2-PANTALLAS.md`); sin errores de consola ni desborde horizontal; **axe-core** en cada pantalla y estado
  que recorre.
- `herramientas/probar-examen.mjs`: examen en línea de punta a punta (`aplicar.html` y `examen.html`), con axe.
- `auditar-campos.mjs`: uso, finalidad, autocompletado, sensibilidad y teclado de cada campo.
- `auditor-css.mjs` sobre `apd.css` (el distintivo de versión ya es el módulo `version` del estándar).
- `herramientas/auditar-sitio.mjs` (`npm run auditar`): todas las pantallas en teléfono y escritorio (consola, enlaces,
  encimados, objetivos táctiles, botones sin efecto); resultado en `verificacion/auditoria/`.
- `probar-esquemas.mjs` y `probar-base.sh`: ver «Validación en el servidor» y `docs/REGLAS.md`.
- Capturas en `verificacion/capturas/` (cada pantalla y estado, en teléfono y escritorio).

Resultados de la última corrida de cada prueba: bitácora (`docs/BITACORA-PROYECTO.md`), bloque 50 y siguientes.

Lista para personas (`docs/08` del estándar, sección 2) — **pendiente**, no se pudo hacer en el entorno de construcción:

- [ ] Recorrido sólo con teclado.
- [ ] Lector de pantalla real (NVDA, VoiceOver, TalkBack).
- [ ] iPhone y Android reales, con red limitada; cámara en la carga de documentos y cámara frontal en la fotografía de la cuenta.
- [ ] Firefox y Safari (`:has()`, `<dialog>`).
- [ ] Alto contraste forzado; impresión del acuse.
- [ ] Contenido revisado por la Dirección (etiquetas, «qué sigue», ningún plazo prometido).
- [ ] Inventario de datos personales y aviso de privacidad con la Unidad de Transparencia (fundamento en `[Art. __, fracc. __]`).
- [ ] Servidor: `validar.mjs` integrado con el esquema del HTML final (etapa 3).
- [ ] **Verificado en móvil y en escritorio** — nombre y fecha de quien probó.

## 8. Lo que falta antes de liberar

Todo está numerado en `docs/PENDIENTES.md`.

## 8 bis. Resumen (no es de esta etapa)

Acceso real y sesiones (etapa 3), recuperación de contraseña (por correo: P13 resuelto con P23), correo institucional
(P23, condición de lanzamiento; pregunta 1 al SIA), aviso de privacidad (P31), dirección del Vivero Nezahualcóyotl
(P68; sede única, P09 resuelto). P14 resuelto: CURP igual y nombre sin acentos, con una letra de tolerancia.
