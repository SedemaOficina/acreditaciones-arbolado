# Diagnóstico de acomodo en escritorio · Sistema de Acreditaciones de Poda y Dictaminación

Versión de prueba medida: **0.70** (rama `main`, sin cambios en el repositorio). Estándar de formularios del SIA: **1.5.1**.
Fecha de la medición: 25/10/2026. Ventanas: **1440 × 900** y **1920 × 1080**.
Evidencia: 77 capturas de página completa a 1440 px en `capturas/` (lista al final).

---

## 0. En pocas palabras

1. **El ancho no es el problema en las pantallas del personal; el acomodo vertical sí.** En 1440 px el contenido del personal ya ocupa 1360 px de 1440 (sólo quedan 80 px a los lados). Lo que pasa es que ese ancho se usa para estirar renglones (datos con el valor a 200 px de su rótulo y 1100 px de aire a la derecha, campos de 834 px para un nombre, filas de asistencia con 1000 px entre el nombre y «Sí / No») en lugar de poner cosas **lado a lado**.
2. **Antes de cualquier trabajo hay 365 px de encabezados** (37 % del alto de 900): franja de prueba, ubicación de prueba, cabecera institucional de 144 px, sesión y enlace de regreso. En producción, sin las dos franjas de prueba, siguen siendo 291 px (32 %).
3. **En «Revisar» y en el cotejo, la ficha de la persona (555 px) va arriba y fuera del área de trabajo**: al abrir la solicitud, en 1440 × 900 no se ve ni el documento ni la decisión (empiezan en y = 1069 px). Al avanzar de paso, la página baja al título del paso y **la persona (nombre, CURP, folio, tipo y foto) sale de la vista** durante toda la revisión.
4. **Con los datos ficticios casi nada pasa de 3 pantallas, pero con el volumen real sí**: con el escenario de volumen del propio proyecto (`herramientas/escenario-volumen.mjs`), la bandeja mide 6.5 pantallas, «Acreditaciones» 7.5, «Aplicar el examen» 6.5, el paso 3 de «Grupos» 5.2 (con «Siguiente» en la pantalla 4) y «Asistencia» 3.75 (con «Guardar» en la pantalla 4).
5. **El estándar sólo trae una composición de dos columnas: el visor junto al formulario (≥ 1024 px).** No trae panel lateral fijo, maestro-detalle, barra de pasos vertical, encabezado compacto ni encabezado de tabla fijo. Sí trae **pestañas** y **paginación**, que el proyecto no copia.

---

## 1. Cómo se midió

- Sitio servido con `python3 -m http.server 8975` desde `sitio/`; Playwright (Chromium de `/opt/pw-browsers`), zona `America/Mexico_City`, `es-MX`. El mapa de Google se contestó con la página mínima de `herramientas/sin-google.mjs`.
- Se llegó a cada estado como `herramientas/auditar-sitio.mjs`: personas y solicitudes elegidas de `datos/ficticios.json` por su estado, sesión en `localStorage['apd.sesion']`, perfil del personal con `?perfil=` (revisión y cotejo por omisión, `instructor`, `capacitacion`), «Grupos» con `?curso=&paso=` y `?grupo=`, cotejo con «atender como si fuera su día», examen con un código generado en «Aplicar el examen» en el mismo contexto.
- Los formularios por pasos se recorrieron **paso por paso con el camino feliz** (cada documento «Sí, está bien», «Sí, es la persona», «Sí, es igual», «Sí, el pago está bien» con factura, RFC `XAXX010101000` y folio fiscal); «Crea tu cuenta» y la solicitud con «Llenar con datos ficticios» del menú de pruebas. Cada paso se midió **después de contestarlo** (con lo condicional ya a la vista) y con la página arriba.
- Volumen: `node herramientas/escenario-volumen.mjs sitio/datos/ficticios.json <scratch>/volumen.json` (60 solicitudes más en la bandeja, 40 citas el día de corte, 100 personas más en espera, un grupo de 25 en su día 3) servido en lugar de `ficticios.json` con una ruta de Playwright. El repositorio quedó sin cambios (`git status` limpio).
- Qué se anota: **alto** = alto del documento ÷ alto de la ventana; **ancho útil** = de la orilla izquierda de la primera tarjeta a la derecha de la última; **vacío** = ventana − ancho útil; **acción principal** = el botón relleno del paso (pantalla 1 = sin bajar; el decimal es dónde termina el botón, en pantallas).
- Límites: «Registro asistido» se midió en sus pasos 1 y 2 (el llenado automático no pasa la CURP del paso 2; los pasos 3 y 4 son como «Tu fotografía» y «Revisa y crea» de la cuenta). La «Cita de cotejo» medida es de poda (4 documentos); la de dictaminador lleva 7. `corregir.html` sin documento en pausa sólo muestra su estado vacío.

---

## 2. Mediciones (datos ficticios)

Ancho útil / vacío en px. «Pantalla N (x.xx)»: en qué pantalla queda el botón principal y dónde termina, en pantallas.

### 2.1 Personal

| Pantalla · estado | Alto 1440 | Alto 1920 | Útil / vacío 1440 | Útil / vacío 1920 | Acción principal (1440 / 1920) |
|---|---|---|---|---|---|
| Inicio del personal = bandeja «Solicitudes por revisar» + «Registro asistido» | 2.41 | 1.98 | 1360 / 80 | 1488 / 432 | «Revisar» por fila (secundario); la primera fila en pantalla 1; «Avisos por teléfono» en pantalla 2 (2.00 / 1.64) |
| Revisar poda · 1 Identificación oficial | 2.36 | 2.14 | 1360 / 80 | 1488 / 432 | «Siguiente documento» · pantalla 2 (1.82 / 1.52) |
| Revisar poda · 2 CURP | 2.36 | 2.14 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.74 / 1.44) |
| Revisar poda · 3 Comprobante de domicilio | 2.36 | 2.14 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.76 / 1.44) |
| Revisar poda · 4 Constancia de situación fiscal | 2.36 | 2.14 | 1360 / 80 | 1488 / 432 | «Ver el resultado» · pantalla 2 (1.77 / 1.46) |
| Revisar poda · 5 Resultado | 2.10 | 1.73 | 1360 / 80 | 1488 / 432 | «Elegir la fecha de la cita» · pantalla 2 (1.75 / 1.44) |
| Revisar poda · 6 Fecha de la cita | 2.07 | 1.69 | 1360 / 80 | 1488 / 432 | «Validar y dar la cita» · pantalla 2 (1.67 / 1.36) |
| Revisar dictaminador · 1 Perfil | 2.39 | 2.03 | 1360 / 80 | 1488 / 432 | «Revisar los documentos» · pantalla 3 (2.04) / pantalla 2 (1.68) |
| Revisar dictaminador · 2 a 8 (un documento cada uno) | 2.24 | 2.03 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.61–1.65 / 1.34–1.37) |
| Revisar dictaminador · 9 Resultado | 2.16 | 1.78 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.80 / 1.48) |
| Revisar dictaminador · 10 Fecha de la cita | 1.94 | 1.59 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.54 / 1.25) |
| Citas de cotejo (1 cita) | 1.30 | 1.08 | 1360 / 80 | 1488 / 432 | «Atender» / «Retomar» por fila |
| Cita de cotejo · 1 ¿Es la persona? | 1.99 | 1.66 | 1360 / 80 | 1488 / 432 | «Cotejar los documentos» · pantalla 2 (1.63 / 1.36) |
| Cita de cotejo · 2 Documentos originales (4) | **2.89** | 2.34 | 1360 / 80 | 1488 / 432 | «Ver el pago» · **pantalla 3** (2.54 / 2.04) |
| Cita de cotejo · 3 Pago y factura | **2.87** | 2.34 | 1360 / 80 | 1488 / 432 | «Ver el resultado» · **pantalla 3** (2.52 / 2.05) |
| Cita de cotejo · 4 Resultado | 1.79 | 1.49 | 1360 / 80 | 1488 / 432 | «Terminar el cotejo» · pantalla 2 (1.39 / 1.16) |
| Grupos · 1 El curso | 2.42 | 2.00 | 1360 / 80 | 1488 / 432 | «Siguiente» · pantalla 2 (1.03) / pantalla 1 (0.84) |
| Grupos · 2 La semana | **3.03** | 2.52 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.63 / 1.36) |
| Grupos · 3 Quiénes van (6 en espera) | **3.05** | 2.54 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.65 / 1.37) |
| Grupos · 4 Confirmar | 2.85 | 2.37 | 1360 / 80 | 1488 / 432 | «Crear el grupo» · pantalla 2 (1.45 / 1.21) |
| Grupos · completar APD-G-2026-004 (paso 3) | 2.81 | 2.34 | 1360 / 80 | 1488 / 432 | pantalla 2 (1.41 / 1.17) |
| Ficha del grupo · por confirmar (4 personas) | 1.72 | 1.43 | 1360 / 80 | 1488 / 432 | varias acciones secundarias |
| Ficha del grupo · en curso (10 personas) | 2.75 | 2.29 | 1360 / 80 | 1488 / 432 | «Ver la asistencia» al final |
| Capacitación · grupos por asignar y confirmar | 1.44 | 1.20 | 1360 / 80 | 1488 / 432 | «Ver» por fila |
| Ficha del grupo · perfil capacitación | 2.23 | 1.86 | 1360 / 80 | 1488 / 432 | «Cambiar la persona instructora» · pantalla 2 (1.88 / 1.56) |
| Asistencia · grupo en curso (10 personas) | 2.26 | 1.88 | 1360 / 80 | 1488 / 432 | «Guardar la asistencia del día 3» · pantalla 2 (1.71 / 1.43) |
| Aplicar el examen (10 personas) | **3.78** | 3.15 | 1360 / 80 | 1488 / 432 | «Presente» / «No llegó» por fila; «Imprimir los códigos» en pantalla 4 |
| Acreditaciones (57 en el padrón) | **5.44** | 4.53 | 1360 / 80 | 1488 / 432 | «Ver» por fila |
| Ficha de una acreditación | 1.34 | 1.11 | 1360 / 80 | 1488 / 432 | «Cancelar acreditación» |
| Ficha · reposición con acta por revisar | 2.05 | 1.71 | 1360 / 80 | 1488 / 432 | «Registrar la revisión del acta» · pantalla 2 (1.70 / 1.42) |
| Registro asistido · 1 Aviso de privacidad | 1.65 | 1.38 | **900 / 540** | **900 / 1020** | «Siguiente» · pantalla 2 (1.30 / 1.08) |
| Registro asistido · 2 Datos | 2.42 | 2.02 | **900 / 540** | **900 / 1020** | «Siguiente» · pantalla 3 (2.07) / pantalla 2 (1.72) |
| Ventanilla (sin búsqueda) | 1.10 | 1.00 | 1360 / 80 | 1488 / 432 | — |
| Ventanilla · ficha de una persona | 1.99 | 1.66 | 1360 / 80 | 1488 / 432 | «Leerle lo que falta y cargar lo corregido» · pantalla 2 (1.58 / 1.32) |

### 2.2 Persona solicitante y público

| Pantalla · estado | Alto 1440 | Alto 1920 | Útil / vacío 1440 | Útil / vacío 1920 | Acción principal (1440 / 1920) |
|---|---|---|---|---|---|
| Inicio público | 2.46 | 2.05 | 900 / 540 | 900 / 1020 | cuatro opciones; «Cómo es el trámite» abajo |
| Crea tu cuenta · 1 Quién eres | 2.05 | 1.71 | 900 / 540 | 900 / 1020 | «Siguiente» · pantalla 2 (1.67 / 1.39) |
| Crea tu cuenta · 2 Cómo te avisamos | 1.57 | 1.31 | 900 / 540 | 900 / 1020 | pantalla 2 (1.19) / pantalla 1 (0.99) |
| Crea tu cuenta · 3 Tu fotografía | 1.33 | 1.11 | 900 / 540 | 900 / 1020 | pantalla 1 (0.94 / 0.79) |
| Crea tu cuenta · 4 Tu contraseña | 1.55 | 1.29 | 900 / 540 | 900 / 1020 | «Revisar mis datos» · pantalla 2 (1.17) / 1 (0.98) |
| Crea tu cuenta · 5 Revisa y crea | 1.69 | 1.41 | 900 / 540 | 900 / 1020 | «Crear mi cuenta» · pantalla 2 (1.31 / 1.09) |
| Mis trámites · con cita de cotejo | **3.04** | 2.53 | 900 / 540 | 900 / 1020 | — (la cita, el pago y el mapa, apilados) |
| Mis trámites · con observaciones | **3.18** | 2.65 | 900 / 540 | 900 / 1020 | «Corregir y reenviar» · pantalla 2 (1.31 / 1.09) |
| Mis trámites · con grupo (curso en marcha) | 2.99 | 2.50 | 900 / 540 | 900 / 1020 | — |
| Mis trámites · acreditada | 2.28 | 1.90 | 900 / 540 | 900 / 1020 | — |
| Solicitud nueva · 1 Trámite | 2.31 | 1.92 | 900 / 540 | 900 / 1020 | «Continuar» · pantalla 2 (1.95 / 1.63) |
| Solicitud nueva · 2 Documentos (4) | 2.53 | 2.11 | 900 / 540 | 900 / 1020 | «Continuar» · pantalla 3 (2.18) / 2 (1.82) |
| Solicitud nueva · 3 Revisión | 2.60 | 2.17 | 900 / 540 | 900 / 1020 | «Enviar solicitud» · pantalla 3 (2.25) / 2 (1.88) |
| Solicitud · borrador recuperado | 2.14 | 1.79 | 900 / 540 | 900 / 1020 | pantalla 2 (1.79 / 1.49) |
| Corregir observaciones · 2 Documentos (dictaminador, 7) | **3.69** | 3.08 | 900 / 540 | 900 / 1020 | «Continuar» · **pantalla 4** (3.34) / 3 (2.78) |
| Corregir observaciones · 3 Revisión | 2.97 | 2.47 | 900 / 540 | 900 / 1020 | «Enviar solicitud» · pantalla 3 (2.61 / 2.18) |
| Mi perfil | 1.90 | 1.58 | 900 / 540 | 900 / 1020 | «Editar» por sección |
| Reposición · pedir | 1.66 | 1.38 | 900 / 540 | 900 / 1020 | «Pedir la reposición» · pantalla 2 (1.31 / 1.09) |
| Examen · entrar | 1.14 | 1.00 | 900 / 540 | 900 / 1020 | pantalla 1 (0.72 / 0.60) |
| Examen · ¿Eres tú? | 1.28 | 1.07 | 560 / 880 | 560 / 1360 | pantalla 1 (0.93 / 0.77) |
| Examen · instrucciones | 1.32 | 1.10 | 560 / 880 | 560 / 1360 | pantalla 1 (0.97 / 0.81) |
| Examen · pregunta | 1.33 | 1.11 | 900 / 540 | 900 / 1020 | pantalla 1 (0.89 / 0.74) |
| Examen · revisar antes de enviar | 1.60 | 1.33 | 900 / 540 | 900 / 1020 | pantalla 2 (1.25 / 1.04) |

### 2.3 Con volumen real (escenario de volumen del proyecto)

| Pantalla | Registros | Alto 1440 | Alto 1920 | Acción principal (1440) |
|---|---|---|---|---|
| Bandeja / inicio del personal | 67 solicitudes por revisar | **6.51** | 5.37 | «Avisos por teléfono» en pantalla 7 |
| Revisar (poda) | — | 2.48 | 2.24 | pantalla 2 (1.97) |
| Citas de cotejo | 41 citas del día | **4.20** | 3.50 | por fila |
| Grupos · paso 1 | 8 grupos programados | 2.84 | 2.35 | pantalla 2 (1.05) |
| Grupos · paso 3 (poda nueva) | 66 personas en espera | **5.18** | 4.32 | «Siguiente» en **pantalla 4** (3.39) |
| Ficha del grupo en curso | 25 personas (2 tablas de 25) | **4.19** | 3.49 | — |
| Asistencia | 25 personas | **3.75** | 3.12 | «Guardar» en **pantalla 4** (3.20) |
| Aplicar el examen | 25 personas | **6.47** | 5.39 | por fila |
| Acreditaciones | 90 en el padrón | **7.47** | 6.23 | por fila (el padrón real crecerá a miles: unas 2,000 credenciales al año) |

Capturas: `capturas/v-*.png`.

### 2.4 Datos que quien trabaja necesita a la vista, y si se pierden al bajar

| Pantalla | Datos que siempre hacen falta | Hoy |
|---|---|---|
| Revisar una solicitud | Persona (nombre, CURP, foto), folio, tipo y modalidad, vuelta de revisión, estado; documento actual; decisión; «Siguiente documento» | Ficha de la persona en y = 365–920 px, **fuera del área de trabajo y no fija**. Al abrir: en 1440 × 900 no se ve documento ni decisión (empiezan en y = 1069). Al avanzar de paso la página baja al título (scroll 863 px) y **nombre, CURP, folio y tipo quedan fuera de la vista** el resto de la revisión. Lo fijo: la barra de pasos (126 px con 10 pasos) y el visor; **el título y el archivo del visor quedan 32 px debajo de la barra fija** (`x-revisar-paso2-tras-siguiente-1440x900.png`). |
| Cita de cotejo | Identidad: **foto de la cuenta**, nombre, CURP; folio, cita, expediente; documento que se compara | La foto grande sólo está en el paso 1. En los pasos 2 y 3 la persona y la foto quedan arriba, fuera de la vista; el paso 2 (4 documentos, 7 en dictaminador) mide 1660 px de alto en su columna de 609 px. |
| Grupos | Curso, semana, cupo «n de 25 · mínimo 5», personas elegidas, tipo de grupo, «Siguiente» | La línea «Poda y derribo · nueva · Del 26 al 30 de octubre» va arriba del paso y no es fija; «6 de 25 lugares» va **debajo** de la lista (con 66 en espera, en la pantalla 3–4). La barra de pasos no es fija (P177). Abajo de cada paso se repite «Grupos programados» (≈ 1.2 pantallas). |
| Ficha del grupo | Nombre y folio, situación, cupo, semana, instructor; lista de personas | Los 8 datos en renglones de 1360 px (≈ 360 px); «Personas del grupo» y «Asistencia por día» son dos tablas de las mismas personas, una debajo de otra. |
| Asistencia | Grupo y día; totales «asistieron · faltaron · sin marcar»; «Guardar» | Totales y «Guardar» al final de la lista (pantalla 4 con 25). Entre el nombre y «Sí / No» quedan ≈ 1000 px vacíos. |
| Aplicar el examen | Grupo, día y cuenta «inscritas · con derecho · por pasar lista»; foto de cada persona; su código | Cada fila mide ≈ 160 px por la foto; con 25 personas, 6.5 pantallas. La cuenta va arriba y no es fija. |
| Acreditaciones | Búsqueda, filtros, reposiciones por atender | Tabla sin paginación ni filtros por situación; reposiciones por atender arriba. |
| Bandeja | Búsqueda y filtros; encabezado de la tabla; espera | Los filtros y el encabezado de la tabla se pierden al bajar; «Registro asistido» y «Avisos por teléfono» quedan debajo de toda la bandeja. |
| Mis trámites | Qué sigue y la próxima fecha | Cita, «Qué sigue», «Datos para tu pago», «Dónde es» (mapa de 384 px) y «Mis acreditaciones» apilados en 900 px de ancho, con 540 px vacíos. |
| Corregir | Lo que debe corregir y su campo; «Continuar» | Los documentos ya aceptados se muestran completos (≈ 240 px cada uno): 6 aceptados empujan «Continuar» a la pantalla 4. |

---

## 3. Por qué todo cae en una columna

### 3.1 Lo que viene del Estándar de formularios del SIA 1.5.1

| Regla del estándar | Dónde | Efecto en escritorio |
|---|---|---|
| `.pagina { max-width: var(--ancho-pagina) }` con `--ancho-pagina: 980px`; cabecera y pie se alinean con `--ancho-contenido` | `formkit/css/base.css` (bloque estructura), `tokens.css` | Toda página es **una columna de 900 px útiles**. En 1440 quedan 540 px vacíos; en 1920, 1020. |
| «Una tarjeta es un paso o una pantalla completa; no se anidan tarjetas» | `base.css` | Las secciones se apilan, una tarjeta debajo de otra. |
| Renglones de campos: «en teléfono una columna; en tableta y escritorio las columnas que su nombre indica» (`.fila`, `.fila-3`, `.fila-2-1`), **sólo para datos hermanos**; «Lo demás, en una columna» | `base.css`, `nucleo.css` (≥ 760 px), `docs/06-codigo-y-contrato-html.md` | Los campos ocupan todo el ancho de la tarjeta (834 px para un nombre, una CURP o un teléfono). |
| Tres puntos de quiebre: 560, 760 y **1024** (visor fijo y navegación lateral de la guía); **sólo `min-width`** | `docs/02-guia-de-estilo.md` §6 | No hay un punto de quiebre de escritorio amplio (1280) ni reglas por alto de ventana. |
| La **única composición de dos columnas** para un formulario: `.visor-area` = formulario 5fr + visor 6fr desde 1024, con el visor `position: sticky; top: var(--e-3); height: calc(100dvh − var(--e-6))` | `formkit/modulos/visor/visor.css` | Funciona, pero no sabe de la barra de pasos fija: el visor queda debajo de ella (32 px). Cuando el visor está cerrado (pasos «Resultado» y «Fecha de la cita») la columna derecha queda vacía: el paso usa 609 de 1360 px. |
| Barra de pasos `.barra-fija` (sticky arriba, horizontal); en escritorio, etiquetas bajo cada bolita | `modulos/pasos/pasos.css` | Con 10 pasos mide 126 px y las etiquetas van en dos renglones. No hay variante vertical. |
| Barra de acciones fija (`.acciones-fijas`) **sólo en teléfono**; desde 760 px pasa a estática | `pasos.css` | En escritorio el botón principal siempre queda al final del contenido. |
| Cabecera: «El logotipo es ancho: va en su renglón y el título debajo» | `base.css` (encabezado y pie) | 144 px de cabecera en cada pantalla, también en las del personal. |
| `.datos` de rótulo y valor | **No es del estándar** (ver 3.2). El estándar tiene `revision` (dos columnas rótulo/valor) y `tabla`. | — |
| Componentes de consulta que **sí trae** el estándar 1.5.1: `pestanas` (pestañas con flechas, Home y End), `paginacion` (conserva filtros y lleva el foco a la lista), `migas`, `progreso`, `toggle`; ejemplo `guia-visual/ejemplos/captura-interna.html` («consulta o captura interna del personal: pestañas, tabla, paginación…», `docs/03-guia-de-decision.md`) | `estandares-sia-151/formularios/codigo/modulos/` | **El proyecto no los copia** (su lista de módulos en `sitio/formkit/LEEME.md` no incluye `pestanas`, `paginacion` ni `migas`). |
| Lo que el estándar **no** trae | — | Panel lateral fijo de resumen, maestro-detalle, barra de pasos vertical, franja de contexto fija, encabezado de tabla fijo, tabla compacta, rejilla de tarjetas de personas, cabecera compacta, acciones fijas en escritorio, token de página amplia. |

### 3.2 Lo que es del proyecto (`sitio/app/apd.css` y el HTML)

- **«Página amplia del personal»**: `.pagina-amplia { max-width: calc(var(--ancho-pagina) * 1.6) }` = **1568 px**, y `body:has(.pagina-amplia) { --ancho-contenido: calc(var(--ancho-pagina) * 1.6 − var(--e-pagina) * 2) }` para que cabecera y pie se alineen. La usan 16 pantallas del personal. **Ensancha, pero no reacomoda**: dentro todo sigue siendo un flujo vertical de tarjetas, así que el ancho extra se convierte en renglones más largos, no en menos alto. En 1920 vuelven a quedar 432 px vacíos.
- `asistido.html` es del personal pero usa `.pagina` (980): el registro asistido queda angosto (900 / 540).
- **Ficha de datos** (`.datos`, `.datos-par`): rótulo en una columna de 208 px (`calc(var(--e-11) * 2 + var(--e-4))`) y valor en `1fr`. En 1360 px cada dato es un renglón completo de 48 px; la ficha de la persona de «Revisar» (8 datos) mide 555 px y la del grupo (8 datos) ≈ 360 px.
- **La cabeza de «Revisar» y del cotejo** (`[data-cabeza]`) está **fuera** de `.visor-area` y antes de la barra de pasos: no puede ser fija ni lateral.
- **Las secciones secundarias van debajo de la tarea**: «Grupos programados» bajo cada paso de «Grupos»; «Registro asistido» y «Avisos por teléfono pendientes» bajo la bandeja; «Revisiones anteriores» (plegable) antes de la barra de pasos.
- **Listas como filas o tarjetas de alto fijo grande**: `.asistencia-fila` (≈ 88 px por persona), filas de «Aplicar el examen» con foto (≈ 160 px), `.plan-persona` (≈ 58 px), documentos del cotejo y de «Corregir» como bloques de 220–240 px.
- **Rejillas propias que ya existen**: `.arm-semana-cuerpo` (calendario + lado, desde 1024), `.hoy-grupos` (dos columnas desde 760), `.menu-inicio` (dos columnas), `.persona-con-foto`, `.cotejo-identidad`, `.filtros-bandeja`. Muestran que el proyecto ya acomoda en columnas donde lo decidió; falta un criterio general.
- Sin barra fija en «Grupos» por decisión (P177: la pegajosa ocupaba hasta un tercio del alto en teléfono horizontal).
- Las dos franjas de la versión de prueba (`.entorno-pruebas` y `.ubicacion-prueba`, 74 px) suman al encabezado; desaparecen en producción.
- Nota al margen (no de acomodo): `apd.css` usa `@media (max-width: 759.98px)` para `.barra-pasos-larga`, y el estándar sólo admite `min-width` (`docs/02-guia-de-estilo.md` §6).

### 3.3 El costo fijo de arriba (revisar, 1440 × 900)

| Pieza | y | Alto |
|---|---|---|
| Franja «Versión de prueba» | 0 | 37 |
| Ubicación de prueba «Pantalla: …» | 37 | 37 |
| Cabecera institucional (logo en su renglón y título debajo) | 74 | 144 |
| Sesión (nombre, perfil y secciones) | 238 | 58 |
| «← Solicitudes por revisar» | 316 | 49 |
| Ficha de la solicitud y la persona | 365 | 555 |
| Barra de pasos | 940 | 109–126 |
| **Empieza el paso** | **1069** | — |

---

## 4. Propuestas por pantalla, priorizadas

Prioridad = uso diario del personal × longitud (con volumen). «Proyecto» = se hace en `apd.css` y el HTML del proyecto con los tokens del estándar, sin tocar `formkit/`. «Estándar» = conviene que lo traiga el estándar (o lo necesita, porque toca un módulo).

### Resumen

| # | Pantalla | Uso | Hoy (1440) | Con la propuesta (estimado) | Ahorro | Dónde |
|---|---|---|---|---|---|---|
| 1 | Revisar una solicitud (6 a 10 pasos) | Diario, cada solicitud y cada reenvío | 2.1–2.4 por paso; decisión en pantalla 2 al abrir; persona fuera de la vista | ≈ 1.0 por paso; decisión y persona en pantalla 1 | 1.1–1.3 por paso (7–12 por solicitud de dictaminador) | Proyecto (franja y columnas); estándar para pasos verticales y visor bajo barra |
| 2 | Cita de cotejo | Diario (hasta 40 citas al día) | 1.8–2.9; «Ver el pago» en pantalla 3 | ≈ 1.1–1.3 | 1.5–1.7 en pasos 2 y 3 (más en dictaminador) | Proyecto |
| 3 | Bandeja / inicio del personal | Diario | 2.4 (6.5 con volumen) | ≈ 1.6–2.0 con 25 por página | ≈ 4.5 con volumen | Proyecto + copiar `pestanas` y `paginacion` del estándar |
| 4 | Grupos (4 pasos) | Varias veces por semana | 2.4–3.1 (5.2 con volumen, «Siguiente» en pantalla 4) | ≈ 1.3–2.5; resumen y «Siguiente» siempre a la vista | 1.2 por paso (programados) y ≈ 2.7 en el paso 3 con volumen | Proyecto |
| 5 | Asistencia | Diario durante cada curso | 2.3 (3.75 con 25) | ≈ 1.4 | ≈ 2.3 con 25 | Proyecto |
| 6 | Aplicar el examen | Cada fin de curso, con prisa | 3.8 (6.5 con 25) | ≈ 2.0 | ≈ 4.5 con 25 | Proyecto |
| 7 | Citas de cotejo (agenda) | Diario | 1.3 (4.2 con 41) | ≈ 2.0 | ≈ 2.2 con volumen | Proyecto + `paginacion` opcional |
| 8 | Acreditaciones y su ficha | Varias veces por semana | 5.4 (7.5 con 90; crece sin límite) | ≈ 1.3 por página | ≥ 6, y deja de crecer | Proyecto + `paginacion` y `pestanas` |
| 9 | Ficha del grupo | Varias veces por semana | 1.7–2.8 (4.2 con 25) | ≈ 1.5–2.0 | ≈ 2.2 con 25 | Proyecto (+ `pestanas`) |
| 10 | Corregir observaciones (persona) | Una o dos veces por trámite | 3.7; «Continuar» en pantalla 4 | ≈ 1.8 | ≈ 1.9 | Proyecto |
| 11 | Mis trámites | Cada visita de la persona | 2.3–3.2 | ≈ 1.5–1.8 | ≈ 1.3 | Proyecto |
| 12 | Solicitud por pasos | Una vez por trámite | 2.1–2.6 | ≈ 1.6–1.9 | ≈ 0.6 por paso | Proyecto (+ `.fila`) |
| 13 | Registro asistido y ventanilla | Ocasional | 1.6–2.4 | ≈ 1.1–1.5 | ≈ 0.6–0.9 | Proyecto |
| 14 | Crea tu cuenta | Una vez | 1.3–2.1 | ≈ 1.1–1.5 | ≈ 0.5 en el paso 1 | Proyecto (`.fila-3`, ya previsto en DECISIONES 16/10) |
| 15 | Capacitación | Semanal, poco volumen | 1.4–2.2 | ≈ 1.2–1.4 | ≈ 0.8 en la ficha | Proyecto |
| 16 | Inicio público | Ocasional | 2.5 | ≈ 1.4 | ≈ 1.0 | Proyecto |
| 17 | Examen | Una vez por persona | 1.1–1.6 | sin cambio | — | — (ya cabe; no tocar) |

A todas las pantallas del personal se suma la **cabecera compacta** (regla general 1): ≈ 0.15 pantallas menos en cada una.

### 4.1 Revisar una solicitud (prioridad 1)

- **Siempre visible**: franja de contexto de ≤ 80 px con foto chica (48 × 60), **nombre**, CURP, folio, «Poda y derribo · renovación», «1.ª revisión» / «3.ª (reenviada)», estado y, si aplica, «Última oportunidad» o «Registro asistido»; el documento actual en el visor; la decisión y «Siguiente documento».
- **Acomodo** (≥ 1280): franja de contexto fija arriba → debajo tres columnas: **pasos en barra vertical** (≈ 220 px, con su estado: palomita, alerta, «Por revisar») | **decisión** (≈ 480–520 px: requisito, archivo, «¿El documento está bien?», motivos frecuentes y observación) | **visor** (resto, fijo bajo la franja, alto = ventana − franja). Entre 1024 y 1279: dos columnas (decisión | visor) con la barra de pasos horizontal actual. Menos de 1024: como hoy.
  - Los 8 datos de la persona (expediente, adscripción, dependencia, acreditación que renueva, estudios, contacto) pasan a un plegable «Datos de la persona» dentro de la columna de decisión, o a la primera parte de la barra vertical.
  - «Revisiones anteriores» como plegable en la columna de decisión.
  - En «Resultado» y «Fecha de la cita», la columna del visor no queda vacía: muestra el resumen de decisiones (la lista «Así queda la revisión») y la fecha se elige a la izquierda.
- **Ahorro**: de 2.36 a ≈ 1.0 pantallas por paso; al abrir, la decisión pasa de y = 1069 a y ≈ 250. Por solicitud de dictaminador (10 pasos), ≈ 12 pantallas de desplazamiento menos y nunca perder a la persona.
- **Riesgo**: medio. Tres columnas a 1280 px dejan ≈ 500 px al visor (suficiente para «Ajustar al ancho», poco para leer letra chica: el visor ya tiene acercar y «Abrir en otra pestaña»). La barra vertical requiere la misma accesibilidad del módulo `pasos` (`aria-current="step"`, foco al título). Probar a 1366 × 768: con franja de 80 px quedan 688 px para el visor.
- **Dónde**: la franja y las columnas, **proyecto** (mover `[data-cabeza]` dentro de una rejilla propia). La barra de pasos vertical y el visor que respeta las barras fijas, **estándar** (el visor hoy usa `top: var(--e-3)` sin saber de la barra: hallazgo para el estándar).

### 4.2 Cita de cotejo (prioridad 2)

- **Siempre visible**: **foto de la cuenta grande** (≥ 120 × 150) con nombre, CURP, folio, «cita del 20/10/2026 10:00», expediente («Todavía no tiene…» o EXP-…); el paso; «Siguiente».
- **Acomodo** (≥ 1280): columna izquierda fija «Persona» (≈ 260 px: foto, nombre, CURP, folio, cita, expediente, barra de pasos vertical debajo) | formulario (≈ 520 px) | visor (resto). Paso 2 como **tabla compacta de documentos**: Documento · Archivo y fecha · «Ver lo que cargó» · «Sí, es igual / No es igual» (opción corta del estándar); al elegir «No es igual» se abre debajo su renglón de observación. Paso 3: «Datos para tu pago» (concepto, monto, referencia) en una línea de datos y los campos de la factura en `.fila` (RFC | nombre) y folio fiscal debajo.
- **Ahorro**: paso 2 de 2.89 a ≈ 1.1 (4 filas de ≈ 64 px en lugar de bloques de ≈ 220 px); dictaminador (7 documentos) de ≈ 4 a ≈ 1.3; paso 3 de 2.87 a ≈ 1.3.
- **Riesgo**: bajo-medio. La tabla con radios en cada fila debe conservar el nombre accesible de cada grupo («¿El original de Identificación oficial es igual al que cargó?»). En teléfono la tabla se vuelve tarjetas (módulo `tabla`).
- **Dónde**: proyecto.

### 4.3 Bandeja e inicio del personal (prioridad 3)

- **Siempre visible**: búsqueda y filtros, contador «67 solicitudes por revisar: N con 10 días o más…», encabezado de la tabla.
- **Acomodo**: arriba, una fila de **indicadores** que son enlaces (Por revisar 67 · cuántas atrasadas | Citas de hoy 40 · cuántas por atender | Avisos por teléfono 1 | En espera de grupo 112). Debajo, **pestañas** del estándar: «Solicitudes por revisar (67)» | «Avisos por teléfono (1)» | «Registro asistido». Filtros en una sola fila con la búsqueda; **encabezado de tabla fijo**; filas compactas de 44 px; **paginación** de 25 (o «Mostrar 25 / 50 / todas»).
- **Ahorro**: con volumen, de 6.5 a ≈ 1.8 pantallas; los avisos por teléfono pasan de la pantalla 7 a una pestaña.
- **Riesgo**: bajo. La paginación cambia la costumbre de «la más antigua primero»: el orden sigue igual y la página 1 es la de más espera.
- **Dónde**: proyecto, copiando `pestanas` y `paginacion` del estándar 1.5.1. El encabezado fijo y la densidad compacta, mejor como opción del módulo `tabla` (estándar).

### 4.4 Grupos (prioridad 4)

- **Siempre visible**: panel lateral «Tu grupo»: curso, semana elegida, horario, **cupo con barra «6 de 25 · se confirma con al menos 5»**, tipo de grupo, las elegidas (nombres en lista corta con «Quitar»), «Atrás» y «Siguiente».
- **Acomodo** (≥ 1024): dos columnas: el paso (2/3) | panel lateral fijo (1/3, ≈ 380 px). Paso 1: los cuatro cursos como opciones en rejilla de 2 × 2 (cada una con «6 personas en espera» y su nota). Paso 2: el calendario ya tiene su lado (`.arm-semana-cuerpo`): ese lado se vuelve el panel lateral. Paso 3: la espera como **tabla compacta con casilla** (Persona · Organización · Espera · Prioridad), los bloques de una misma institución como grupos plegables con su casilla de bloque; filtro por organización. Paso 4: el resumen en datos de dos columnas. **«Grupos programados» sale de debajo de los pasos**: a una pestaña «Armar un grupo» | «Grupos programados (4)» | «Ya terminaron (2)».
- **Ahorro**: ≈ 1.2 pantallas en cada paso (programados); paso 3 con 66 en espera de 5.2 a ≈ 2.5, con «Siguiente» y el cupo siempre a la vista (de la pantalla 4 a la 1).
- **Riesgo**: medio. P177 y la barra de elegidas que se quitó (B4-01): el panel lateral sólo es fijo desde 1024 px **y** con alto de ventana ≥ 700 px; en teléfono vuelve el resumen arriba del paso, como hoy. Cuidar que «n de 25» se siga anunciando al marcar.
- **Dónde**: proyecto (+ `pestanas`).

### 4.5 Asistencia (prioridad 5)

- **Siempre visible**: «Día 3 de 5 · miércoles 14 de octubre», grupo; **totales** «0 asistieron · 0 faltaron · 10 sin marcar»; «Todas asistieron» y «Guardar la asistencia del día 3».
- **Acomodo** (≥ 1024): personas en **rejilla de tarjetas** (3 por renglón a 1440, 4 a 1920): foto 64 × 80, nombre, tira de días, etiqueta de riesgo, «¿Asistió? Sí / No». **Barra de acción fija abajo** con totales y los dos botones. La leyenda en una línea bajo el título.
- **Ahorro**: con 25 personas, de 3.75 a ≈ 1.4; «Guardar» de la pantalla 4 a siempre visible.
- **Riesgo**: bajo. El orden de lectura de la rejilla es por renglón (igual al alfabético). El botón del menú de pruebas ya se movió a la izquierda en esta pantalla: con barra fija abajo, ponerlo dentro de la barra o reservarle lugar.
- **Dónde**: proyecto; la barra fija en escritorio, mejor como variante de `.acciones-fijas` del estándar.

### 4.6 Aplicar el examen (prioridad 6)

- **Siempre visible**: grupo, «Día 5 de 5 · Pase de lista en el salón de cómputo», cuenta «10 inscritas · 9 con derecho · 3 presentes · 1 no llegó · 5 por pasar lista»; «Imprimir los códigos».
- **Acomodo**: datos del grupo en una línea de datos (no en 5 renglones) y los dos avisos en una sola fila; personas en **rejilla de tarjetas** con **foto grande** (para comparar con la identificación), nombre, folio, días anteriores, «Presente» / «No llegó» y, ya presente, su **código** grande y su avance. Barra fija arriba con la cuenta y «Imprimir los códigos».
- **Ahorro**: con 25, de 6.5 a ≈ 2.0.
- **Riesgo**: bajo. La foto no debe hacerse más chica para ahorrar espacio (es la verificación de identidad).
- **Dónde**: proyecto.
- **Cambio de Liber (25/10/2026, al hacerlo)**: el pase de lista **no** va en rejilla de varias columnas, porque puede
  confundir: va hacia abajo, una persona por renglón, como una lista de asistencia, con cada renglón lo más compacto posible
  sin achicar la foto. La meta deja de ser «2 pantallas o menos»: la cuenta e «Imprimir los códigos» siempre a la vista
  (franja fija arriba). Hecho en la rama `escritorio-c`.

### 4.7 Citas de cotejo (prioridad 7)

- **Siempre visible**: día, «Día anterior / Día siguiente», búsqueda, «Mostrar: Todas / Por atender», contador.
- **Acomodo**: **maestro-detalle**: la agenda del día a la izquierda (≈ 520 px, filas compactas: hora, nombre, folio, situación) y, a la derecha, la cita elegida (foto, nombre, CURP, folio, acreditación, documentos validados el…, «Atender»). Horas pasadas y atendidas, plegadas.
- **Ahorro**: con 41 citas, de 4.2 a ≈ 2.0, y quien atiende ve la foto antes de entrar al cotejo.
- **Riesgo**: bajo-medio (selección de fila con teclado).
- **Dónde**: proyecto; el maestro-detalle conviene como patrón del estándar.

### 4.8 Acreditaciones y su ficha (prioridad 8)

- **Siempre visible**: búsqueda, filtros por acreditación y situación (Vigente, Por vencer, Vencida · puede renovarla, Vencida, Cancelada), contador.
- **Acomodo**: pestañas «Acreditaciones» | «Reposiciones por atender (3)». **Maestro-detalle**: lista paginada a la izquierda (número, titular, situación) y ficha a la derecha (datos en dos columnas, reposición, «Cancelar acreditación»).
- **Ahorro**: de 7.5 (y creciendo) a ≈ 1.3 por página.
- **Riesgo**: bajo.
- **Dónde**: proyecto + `paginacion` y `pestanas`.

### 4.9 Ficha del grupo (prioridad 9)

- **Siempre visible**: nombre y folio, situación («En curso · día 3 de 5»), cupo, acciones del grupo.
- **Acomodo**: cabeza con cupo a la derecha; los 8 datos en **rejilla de 2–3 columnas** (Duración · Primer día · Último día; Horario · Persona instructora; Lugar del curso · Lugar del examen). Una sola tabla «Personas y asistencia» (Persona · Folio · Adscripción · días ✓ ✗ · Días · Examen · Acción) en lugar de dos tablas de las mismas personas, o pestañas «Personas (10)» | «Asistencia por día».
- **Ahorro**: con 25, de 4.2 a ≈ 2.0.
- **Riesgo**: bajo (la unión de tablas la decidió Liber el 18/10 como dos vistas: confirmar).
- **Dónde**: proyecto.

### 4.10 Corregir observaciones (persona; prioridad 10)

- **Siempre visible**: «Lo que debes corregir» y el campo del documento observado; «Continuar».
- **Acomodo** (también sirve en teléfono): lo observado primero (como hoy) y los ya aceptados en **una lista compacta plegada** «Ya aceptados (6)»: nombre, etiqueta «Aceptado», «Ver», «Cambiar este archivo».
- **Ahorro**: de 3.7 a ≈ 1.8; «Continuar» de la pantalla 4 a la 2.
- **Riesgo**: bajo.
- **Dónde**: proyecto.

### 4.11 Mis trámites (prioridad 11)

- **Acomodo** (≥ 1024; ancho hasta 1200): dos columnas: el trámite en curso (estado, cita o curso, «Qué sigue», acción) | lateral con «Datos para tu pago» y «Dónde es» (mapa) y, abajo, «Mis acreditaciones» en tarjetas de 2 columnas.
- **Ahorro**: de 3.0–3.2 a ≈ 1.6.
- **Riesgo**: bajo; en teléfono todo vuelve a una columna, en el orden actual.
- **Dónde**: proyecto (página pública con ancho mayor: ver reglas).

### 4.12 Solicitud por pasos, crear cuenta, registro asistido (prioridades 12–14)

- **Solicitud**: paso 1 con «Tus estudios» en `.fila` (nivel | carrera); paso 2, documentos en dos columnas desde 1024 (cada documento es independiente); paso 3 «Revisa antes de enviar» con el resumen del estándar (`revision`, ya en dos columnas). Panel lateral «Tu solicitud» (acreditación, curso, documentos 3 de 4) opcional.
- **Crea tu cuenta**: nombre | primer apellido | segundo apellido en `.fila-3` (como dice `docs/06` del estándar y la decisión del 16/10/2026 del proyecto; hoy van uno debajo de otro), CURP | fecha | sexo en `.fila-3`; campos con ancho según el dato.
- **Registro asistido**: pasar a `.pagina-amplia` (es del personal) o, mejor, dos columnas: datos | «Qué le digo» (texto para leerle). Paso 2 con `.fila-3` en nombre y apellidos.
- **Riesgo**: bajo. Es público y también se usa en teléfono: nada de esto cambia el orden en teléfono.

### 4.13 Capacitación, inicio público, examen (15–17)

- **Ficha del grupo (capacitación)**: dos columnas: datos y personas | panel «Persona instructora y confirmación» fijo.
- **Inicio público**: las cuatro opciones en una fila de 4 desde 1024 y «Cómo es el trámite» en dos columnas (pasos | «Cuándo renovar»).
- **Examen**: ya cabe en una pantalla; **no tocar** (una pregunta por pantalla, decisión aprobada).

---

## 5. Reglas generales de diseño de escritorio (propuesta para todo el sistema)

1. **Tres tipos de página, tres anchos.**
   - *Trámite de la persona* (cuenta, solicitud, corregir, reposición): `--ancho-pagina` 980 px en una columna; desde 1024 px puede crecer a ≈ 1200 px **sólo** para poner un lateral de resumen.
   - *Consulta de la persona* (Mis trámites, Mi perfil): hasta ≈ 1200 px, dos columnas desde 1024.
   - *Trabajo del personal*: página amplia de 1568 px (la actual), **organizada en columnas**; texto corrido siempre a 70ch (`.texto-corrido`).
2. **Cabecera compacta en el personal**: logotipo, título y sesión en una sola banda de ≤ 88 px (hoy 144 + 58 + 49). El regreso («← Solicitudes por revisar») va en la franja de contexto.
3. **Columnas por patrón**, no por pantalla:
   - *Tarea con documento* (revisar, cotejo, acta de reposición): franja de contexto + [pasos | decisión | visor].
   - *Lista con resumen* (Grupos, Asistencia, Aplicar): lista 2/3 + lateral o barra de totales fija.
   - *Maestro-detalle* (Citas, Acreditaciones, Ventanilla): lista ≈ 480 px | ficha.
   - *Tablero* (inicio del personal): indicadores + pestañas.
4. **Puntos de quiebre**: < 1024 px, una columna (lo de hoy, intacto; teléfono primero). **1024 px**: dos columnas (como el visor del estándar). **1280 px**: tres columnas y barra de pasos vertical. Sólo `min-width` (más `min-height` para lo fijo).
5. **Qué es fijo y cuándo** (sólo desde 1024 px **y** `min-height: 700px`): franja de contexto (≤ 80 px), lateral de resumen (debajo de la franja), visor (debajo de la franja o de la barra de pasos), encabezado de tabla larga, barra de acciones de una lista con acción masiva. **Lo fijo, sumado, nunca pasa del 25 % del alto de la ventana** (criterio de P177). En teléfono, sólo lo que el estándar ya permite.
6. **La acción principal y los datos que identifican el caso se ven sin bajar** en 1366 × 768 (o están fijos). Criterio verificable: en la auditoría, el botón principal y la franja de contexto dentro de la ventana en el estado inicial de cada paso.
7. **Campos con el ancho de su dato**: nombre y apellidos en `.fila-3`; CURP ≈ 20ch; teléfono ≈ 12ch; fechas 230 px; textarea hasta 70ch. Nunca un campo de 834 px para un dato corto.
8. **Datos de rótulo y valor en rejilla** en escritorio: 2 o 3 pares por renglón cuando los valores son cortos (fechas, horarios, números); un par por renglón sólo para valores largos (domicilios, observaciones).
9. **Listas largas**: más de 25 registros → paginación del estándar, filtros arriba y contador; filas de 44 px en escritorio; personas con foto, en rejilla de tarjetas.
10. **Lo secundario no va debajo de la tarea**: pestañas o plegables (grupos programados, registro asistido, revisiones anteriores, documentos ya aceptados).
11. **Columna vacía, no**: si el visor se cierra, su columna muestra el resumen del caso.

---

## 6. Lo que habría que proponer al estándar

| # | Propuesta | Por qué no basta con el proyecto |
|---|---|---|
| E1 | **Patrones de composición de escritorio** (`.dos-columnas`, `.con-lateral` con `<aside>` fijo, `.maestro-detalle`, `.tres-columnas` para tarea con documento) con su orden en teléfono | Hoy la única composición es `.visor-area`; cada proyecto del SIA inventaría la suya. |
| E2 | **Franja de contexto fija** (`.contexto-fijo`: foto, nombre, identificador, estado; alto máximo 80 px) | Es la pieza que falta para no perder al caso; debe convivir con `.barra-fija` y el visor. |
| E3 | **Barra de pasos vertical** desde 1280 px (variante del módulo `pasos`), con la misma accesibilidad | Toca el módulo `pasos`; con 10 pasos la horizontal ocupa 126 px y parte las etiquetas. |
| E4 | **Visor que respeta lo fijo**: `top` y alto calculados con la altura de la barra de pasos y de la franja (token `--alto-fijo-arriba`) | Hallazgo: con `.barra-fija`, el título y el archivo del visor quedan 32 px debajo de la barra (`visor.css`: `top: var(--e-3)`, `height: calc(100dvh − var(--e-6))`). |
| E5 | **Cabecera compacta** para pantallas internas (`.cabecera-compacta`: logo, título y sesión en una banda) | La regla «el logotipo va en su renglón y el título debajo» es del estándar. |
| E6 | **Tabla**: encabezado fijo (`.tabla-encabezado-fijo`) y densidad compacta en escritorio (`.tabla-compacta`, filas de 44 px) | Opciones del módulo `tabla`. |
| E7 | **Acciones fijas en escritorio** para listas con acción masiva (variante de `.acciones-fijas`) | Hoy `.acciones-fijas` pasa a estática desde 760 px. |
| E8 | **Rejilla de tarjetas** para listas de personas (`.rejilla-tarjetas`, `auto-fill, minmax(280px, 1fr)`) | Uso común en asistencia, pase de lista y similares. |
| E9 | **Punto de quiebre 1280 px** (`--bp-xl`) y permiso de `min-height` en `@media` para lo fijo | La guía de estilo sólo define 560, 760 y 1024, y el auditor sólo acepta `min-width`. |
| E10 | **Token de página amplia** (`--ancho-pagina-amplia`) con la cabecera y el pie alineados | Hoy el proyecto lo calcula con `* 1.6` y redefine `--ancho-contenido` con `:has()`. |
| E11 | **Datos de rótulo y valor en rejilla** (el `.datos` del proyecto, con variante de 2–3 columnas) | Es el componente más usado en las fichas y no es del estándar. |
| E12 | **Regla de lo fijo**: suma ≤ 25 % del alto, sólo desde 1024 y con alto ≥ 700 px | Generaliza P177. |
| E13 | En `docs/03-guia-de-decision.md`, una fila «pantalla de trabajo en escritorio» que diga cuándo usar cada patrón | Hoy la guía dice «otro catálogo» para la captura interna, sin acomodo. |

Propuestas que salieron al hacer el acomodo (partes A, B y C, 25/10/2026; numeradas al integrar):

| # | Propuesta | Por qué no basta con el proyecto |
|---|---|---|
| E14 | **Pestañas desde un ancho** (`data-pestanas-desde="1024"`): debajo, secciones apiladas con su título; un enlace a un ancla de un panel oculto abre su pestaña | El módulo `pestanas` no se desarma por ancho: el proyecto lo hace en `app/escritorio.js`. |
| E15 | **Tablero de indicadores que son enlaces** (rótulo, cifra y detalle) | Inicio del personal; no hay pieza en el estándar. |
| E16 | **Botones de un paso repetidos en un lateral fijo**: el del lateral es el principal y el del paso, secundario, sólo mientras el lateral es fijo (FRM-34) | «Grupos»; hoy el proyecto cambia la clase del botón. |
| E17 | **`paginacion`**: ocultarse con un total ≤ el tamaño más chico y `.paginacion[hidden]` en su hoja | Hoy dibuja «Página 1 de 1» y su `display` le gana al `[hidden]` del núcleo. |
| E18 | **`.fila` desde 1024 px** (o `.fila-escritorio`) | La `.fila` del estándar empieza en 760 px y cambiaría la tableta (pago y factura del cotejo). |
| E19 | **Opción corta con su pregunta al lado** (leyenda a la izquierda de Sí / No) | Asistencia en renglones; hoy el estándar la pone siempre arriba. |
| E20 | **Lista de personas con foto**: renglón compacto con foto, datos y la opción corta a la derecha | Asistencia y pase de lista (la rejilla de tarjetas, E8, la descartó Liber para estas pantallas). |
| E21 | **`pestanas` no anuncia la pestaña inicial** al cargar la página | Hoy `activa(inicial, false)` llama a `anuncia`. |
| E22 | **Lugar fijo para herramientas de la versión de prueba** en escritorio (abajo a la izquierda) y una medida que lo fijo pueda reservar | El proyecto define `--reserva-menu-ancho` y `--reserva-menu-alto`. |

---

## 7. Textos reales para las maquetas

Los datos son los ficticios del sistema. «·» separa elementos de una misma línea.

### Comunes del personal
- Franja de prueba: «Versión de prueba · datos ficticios · acceso del personal simulado · nada sale de este navegador · fecha simulada: 14/10/2026».
- Ubicación de prueba: «Pantalla: Revisar una solicitud · Fase 2 de 7: Revisión en línea · Ver el mapa del trámite: quién hace qué, fase por fase».
- Cabecera: logotipo «Gobierno de la Ciudad de México · Secretaría del Medio Ambiente»; título «Acreditaciones de arbolado urbano · Personal».
- Sesión (revisión y cotejo): «María Ejemplo Revisora» · «Perfil: revisión y cotejo» · enlaces «Revisión documental · Citas de cotejo · Grupos · Material de estudio · Acreditaciones · Salir».
- Sesión (instructor): «Laura Ejemplo Instructora» · «Perfil: instructor» · «Asistencia · Aplicar el examen · Acreditaciones · Salir».
- Sesión (capacitación): «Patricia Ejemplo Capacitadora» · «Perfil: capacitación» · «Grupos por asignar y confirmar · Salir».
- Pie: «Secretaría del Medio Ambiente de la Ciudad de México · Sistema de Información Ambiental.» · «Versión de prueba 0.70».
- Botón flotante: «Menú de pruebas».

### Bandeja / inicio del personal
- Título «Solicitudes por revisar». Bajada: «Ordenadas por antigüedad: la que más tiempo lleva esperando va primero. Las que la persona reenvió con correcciones lo indican en la columna «Vuelta».»
- Búsqueda «Buscar una solicitud» · ayuda «Nombre, CURP, folio de la solicitud (APD-S-…) o número de expediente (EXP-…).» Filtros: «Acreditación: Todas / Poda y derribo / Dictaminador técnico» · «Nueva o renovación: Todas / Nuevas / Renovaciones» · «Vuelta de revisión: Todas / Primera vez / Reenviadas».
- Contador: «7 solicitudes por revisar: 1 con 10 días o más y 2 de 3 a 9 días.» (volumen: 67).
- Columnas: «Folio de la solicitud · Persona · Acreditación · Llegó a revisión · Espera · Vuelta · A revisar con atención · Acción».
- Filas: `APD-S-2026-00062` · YOLANDA MUESTRA FICTICIO · Poda y derribo · nueva · 17/09/2026 · «27 días · atrasada» (rojo) · 3.ª (reenviada) · 1 documento corregido · «Revisar» / `APD-S-2026-00047` · YOLANDA EJEMPLO PRUEBA · Poda y derribo · nueva · 08/10/2026 · «6 días» (ámbar) · 2.ª (reenviada) · 1 documento corregido / `APD-S-2026-00020` · WENDY FICTICIO SIMULADO · Dictaminador técnico · nueva · 10/10/2026 · «4 días» · 1.ª · «Carrera por clasificar» / `APD-S-2026-00014` · LUIS SIMULADO MUESTRA · Poda y derribo · renovación · 12/10/2026 · «2 días» · 1.ª · — / `APD-S-2026-00048` · ZACARÍAS MUESTRA FICTICIO · Dictaminador técnico · nueva · 13/10/2026 · «1 día» · «Podría no cumplir el perfil» / `APD-S-2026-00044` · VALERIA FICTICIO SIMULADO · Poda y derribo · nueva · 14/10/2026 · «Hoy».
- Nota: «La espera se marca en ámbar desde 3 días y en rojo, como atrasada, desde 10.» · «Pendiente: plazos de la revisión documental que fije la Dirección (P02).»
- «Registro asistido»: «Para personas que no saben leer ni escribir: usted las registra en el Vivero, con ellas presentes, captura su solicitud y les da seguimiento por teléfono y en la ventanilla.» Opciones: «Registrar a una persona — Le lee el aviso de privacidad, crea su cuenta y captura su solicitud.» · «Ventanilla — Busque a una persona por CURP, nombre o folio y dígale en qué va su trámite.»
- «Avisos por teléfono pendientes»: «Llame a cada persona, dígale lo de «Qué decirle» y registre si se le avisó o si no contestó.» · «1 aviso pendiente, del más antiguo al más reciente.» · Tarjeta: AMALIA SUPUESTO EJEMPLO · «00 0000 0076» · «Solicitud con observaciones · Solicitud APD-S-2026-00064 · Desde el 08/10/2026 12:00» · «Qué decirle: Hola, te llamamos de la Secretaría del Medio Ambiente. A tu solicitud APD-S-2026-00064 le falta corregir algo: Comprobante de domicilio. Ven en la ventanilla del Vivero Nezahualcóyotl, de lunes a viernes, de 9:00 a 15:00, para que te digamos qué falta y lo corrijamos contigo. Hay un plazo para corregir. Te quedan 2 oportunidades para corregir.» · botones «Se le avisó» · «No contestó».
- Indicadores propuestos (volumen): «Por revisar 67 · N atrasadas» · «Citas de hoy 40» · «Avisos por teléfono 1» · «En espera de grupo 112».

### Revisar una solicitud
- Regreso «← Solicitudes por revisar».
- Cabeza (poda): título «Poda y derribo · renovación» · «Folio de la solicitud APD-S-2026-00014 · enviada el 12/10/2026 · primera revisión» · estado «En revisión documental». Iniciales «LS». Datos: Persona «LUIS SIMULADO MUESTRA» · CURP «SIML811212HNEMSS04» · Número de expediente «Todavía no tiene: el expediente físico se abre en su primer cotejo» · Adscripción «Dependencia del Gobierno Federal» · Dependencia «Comisión Federal de Electricidad (CFE)» · Acreditación que renueva «PD-2025-K101, vence el 24/10/2026» · Último grado de estudios «Secundaria» · Contacto «persona12@ejemplo.local · 0000000012». Nota: «Es una renovación: sólo la constancia de situación fiscal es obligatoria. Los demás documentos se revisaron en su trámite anterior y aquí hay un paso sólo por los que la persona actualizó.»
- Cabeza (dictaminador): «Dictaminador técnico · solicitud nueva» · «Folio de la solicitud APD-S-2026-00020 · enviada el 10/10/2026 · primera revisión» · WENDY FICTICIO SIMULADO · FISW911022HNECMN08 · Independiente · Poda y derribo «PD-2026-K121, vigente hasta el 17/05/2027» · «persona22@ejemplo.local · 0000000022».
- Pasos (poda renovación): «Identificación oficial · CURP · Comprobante de domicilio · Constancia de situación fiscal · Resultado · Fecha de la cita». Pasos (dictaminador): «Perfil · Identificación oficial · CURP · Comprobante de domicilio · Constancia de situación fiscal · Comprobante de estudios · Currículum vitae · Comprobantes de experiencia · Resultado · Fecha de la cita». Indicador: «Paso 1 de 6 · Identificación oficial».
- Paso de documento: título «Identificación oficial» · etiqueta «Por revisar» / «Aceptado» · «IDENTIFICACION OFICIAL_LUIS SIMULADO MUESTRA.pdf · 660 KB» · «Lo que pide el requisito: Vigente y con fotografía: credencial para votar, pasaporte, cartilla militar o cédula profesional.» · botón «Ver documento» / «En el visor» · pregunta «¿El documento está bien?*» · «Sí, está bien» · «No, tiene un problema — Regresa a la persona para que lo corrija.» · si no: «¿Qué problema tiene? Lo que le diremos a la persona» con motivos frecuentes «No se lee completo · Está vencido · No corresponde al requisito · Falta una página · No coincide con el nombre de la cuenta» · «Atrás» · «Siguiente documento» (el último: «Ver el resultado»).
- Paso «Perfil del dictaminador»: «Último grado declarado: Maestría» · «Carrera: Ingeniería Ambiental» · «Experiencia declarada: 5 años» · «Experiencia que se pide: 2 años (carrera afín)» · «Ver el comprobante de estudios» · «“Ingeniería Ambiental” todavía no está clasificada. Con base en el comprobante de estudios, indique si es afín al manejo del arbolado…» · «¿Cómo se clasifica la carrera?*» · «Carrera afín — Se piden 2 años de experiencia, como con Biología o Ingeniería Forestal.» · «Disciplina afín — Se piden 5 años de experiencia.» · «No afín — No cumple el perfil: la solicitud se rechaza.» · «Revisar los documentos».
- Visor: «Identificación oficial» · nombre del archivo · «− 100 % + · Ajustar al ancho · Girar · Abrir en otra pestaña» · «Hoja 1 de 2» · «Versión de prueba: documento ficticio, el mismo para todas las solicitudes con este requisito.»
- Resultado: «Así queda la revisión» · una fila por documento con «Está bien» · «Los 7 documentos están revisados.» · aviso «La solicitud queda validada. En el siguiente paso elija la fecha de su cita de cotejo.» · «Elegir la fecha de la cita».
- Fecha de la cita: «¿Qué día viene a su cita de cotejo?» · «Todo está en orden. Al validar, la persona recibe su cita de cotejo y los datos para pagar.» · «Fecha de la cita*» (ayuda «Día, mes y año, de lunes a viernes, del 15/10/2026 al 14/04/2027…») · «Hora*» «Elija · 09:30 … 14:30» · «La cita es en el Vivero Nezahualcóyotl…» · «Validar y dar la cita» · «El sistema guarda quién revisó, cuándo y qué decidió en cada documento.»
- Franja de contexto propuesta: [LS] «LUIS SIMULADO MUESTRA · SIML811212HNEMSS04 · APD-S-2026-00014 · Poda y derribo · renovación · 1.ª revisión · En revisión documental» · «Datos de la persona ▾».

### Cita de cotejo
- Regreso «← Citas de cotejo». Cabeza: «Poda y derribo · solicitud nueva» · «Folio de la solicitud APD-S-2026-00042 · cita del 20/10/2026 10:00 · documentos validados en línea el 09/10/2026» · «Cita simulada» · TERESA MUESTRA FICTICIO · MUFT830817HNESCR07 · Número de expediente «Todavía no tiene: el expediente físico se abre al terminar este cotejo (es su primer trámite)» · Adscripción «Independiente».
- Pasos: «¿Es la persona? · Documentos originales · Pago y factura · Resultado».
- Paso 1: «¿La persona está aquí?*» «Sí, está aquí / No se presentó» · «Pídale su identificación oficial y compare su cara con la fotografía de su cuenta y con la de la identificación. El nombre debe ser TERESA MUESTRA FICTICIO…» · foto con pie «La que subió al crear su cuenta» · «¿Es la misma persona de la fotografía y de la identificación?*» «Sí, es la persona / No es la persona — No es la de la fotografía ni la de la identificación.» · «Cotejar los documentos».
- Paso 2: «¿Los originales son iguales a lo que cargó?» · «Tome cada original que trae la persona y compárelo con el que cargó en línea («Ver lo que cargó»)…» · por documento: nombre, etiqueta «Es igual», «CURP_TERESA MUESTRA FICTICIO.pdf · lo cargó el 06/10/2026», «Ver lo que cargó», «¿El original es igual al que cargó?*» «Sí, es igual / No es igual» · documentos: Identificación oficial · Clave Única de Registro de Población (CURP) · Comprobante de domicilio · Constancia de situación fiscal (nota «Debe ser de la persona solicitante y reciente: del mes en curso [pendiente P196…]») · «Ver el pago».
- Paso 3: «¿Trae su comprobante de pago?» · Concepto «Acreditación de poda y derribo de arbolado urbano» · Monto que se le indicó «$1,200.00» · Referencia «APDS202600042» (cada uno «Por confirmar: …») · «¿El comprobante es por ese monto y con esa referencia?*» «Sí, el pago está bien / No trae el pago o no coincide — No se termina el cotejo: se le da otra cita y conserva el monto.» · «Datos para la factura» · «Ver la constancia de situación fiscal» · «Factura*» (PDF) · «RFC a cuyo favor se emitió*» `XAXX010101000` · «Nombre*» «Prueba Ejemplo» · «Folio fiscal*» (36 caracteres) · «Ver el resultado».
- Paso 4: «Así queda la cita» · «¿Es la persona? Sí es la persona» · «Documentos originales: Todos son iguales» · «Pago: El pago está bien» · «Todo coincide y el pago está verificado. Al terminar, se abre su expediente físico (el sistema le da el número al terminar) y el siguiente paso es asignarle un grupo del curso.» · «Terminar el cotejo».

### Citas de cotejo
- «Citas de cotejo» · «Las citas del día en el Vivero Nezahualcóyotl, por hora. Cuando la persona llegue, búsquela por su nombre, su CURP o su folio y presione «Atender».» · «Buscar una cita» · «Mostrar: Todas / Por atender» · «Miércoles 14 de octubre de 2026» · «Día anterior · Día siguiente» · «1 cita: 1 en pausa.» · Columnas «Hora · Persona · Folio de la solicitud · Acreditación · Situación · Acción» · «10:00 · DIEGO SIMULADO MUESTRA · APD-S-2026-00052 · Poda y derribo · nueva · En pausa · esperando el documento · Retomar» (otras: «Atender»).

### Grupos
- «Grupos» · «Hoy es miércoles 14 de octubre de 2026. Arme un grupo en cuatro pasos: el curso, la semana, quiénes van y confirmar.» · «Ver los grupos programados (4)» · «Armar un grupo» · pasos «El curso · La semana · Quiénes van · Confirmar».
- Paso 1 «¿Para qué curso?» · «Cada curso arma sus grupos por separado: nunca se mezclan.» · «Poda y derribo · nueva — 6 personas en espera — 1 espera 15 días o más · Alcanza para un grupo nuevo de hasta 25» · «Poda y derribo · renovación — 3 personas en espera — 1 espera 15 días o más · 1 ya vencida · Falta gente para un grupo (mínimo 5)» · «Dictaminador técnico · nueva — 2 personas en espera…» · «Dictaminador técnico · renovación — 1 persona en espera».
- Paso 2 «¿Qué semana?» · «Poda y derribo · nueva · lunes a viernes, de 9:00 a 15:00. Puede haber 2 grupos al mismo tiempo, de cualquier curso; el curso empieza al menos 7 días después de confirmarlo.» · «Octubre de 2026» · columnas «Semana · Lun … Dom» · semanas «No disponible — Ya pasó / Ya empezó / Faltan menos de 7 días» · «Elegida — 1 lugar libre de 2» · marcas «G-2026-006», «Examen», «Nuevo grupo», «Hoy» · lado «Semana elegida — Del 26 al 30 de octubre — Del lunes 26 de octubre de 2026 al viernes 30 de octubre de 2026, de 9:00 a 15:00. El viernes, repaso de conocimientos y examen final en el PILARES.» · «Primer día del curso* 26/10/2026» · leyenda.
- Paso 3 «¿Quiénes van?» · «Se proponen las 6 personas que más esperan, primero las prioritarias y las de una misma institución de gobierno juntas. Quite o agregue a quien haga falta.» · OLGA FICTICIO SIMULADO · Independiente · «53 días · prioritaria» / HÉCTOR PRUEBA MODELO · Iztapalapa · 13 días / MARTA MUESTRA FICTICIO · Comisión Federal de Electricidad (CFE) · 7 días / NÉSTOR PRUEBA MODELO · Independiente · 7 días / PABLO MODELO EJEMPLO · Jardines Ejemplo del Norte, S.A. de C.V. · Hoy / ROSA SIMULADO MUESTRA · Jardines Ejemplo del Norte, S.A. de C.V. · Hoy · «6 de 25 lugares · se confirma con al menos 5 personas» · «¿De quiénes es el grupo?*» «Combinado — Recibe personas de cualquier organización e independientes.»
- Paso 4 «Revise y confirme» · Grupo «Poda nueva · del 26 al 30 de octubre» / «APD-G-2026-007 (lo asigna el sistema al guardar)» · Curso · Semana «Del lunes 26 de octubre de 2026 al viernes 30 de octubre de 2026» · Horario «De 9:00 a 15:00, de lunes a viernes» · Lugar del curso «Aula de capacitación del Vivero Nezahualcóyotl» · Examen final «El viernes 30 de octubre de 2026, en el salón de cómputo del PILARES» · Personas «6 de 25» · Tipo «Combinado» · Persona instructora «La asigna el área de Instructores y Capacitación» · aviso «Se crea por confirmar — Ya tiene lo que le toca a usted…» · «Crear el grupo».
- Grupos programados: «Poda y derribo · nueva · 4 grupos» · columnas «Grupo · Semana · Personas · Situación · Lo que falta · Acciones» · `APD-G-2026-006` Combinado · Del 05/10/2026 al 09/10/2026 · 5 de 25 · «En curso · día 5 de 5» / `APD-G-2026-003` Iztapalapa · Del 12/10/2026 al 16/10/2026 · 10 de 25 · «En curso · día 3 de 5» / `APD-G-2026-005` Combinado · Del 26/10/2026 al 30/10/2026 · 1 de 25 · «Por confirmar» · 4 personas · «Completar con las 4 que más esperan · Cambiar la semana · Agregar personas» / `APD-G-2026-004` · Sin semana · 4 de 25 · «Sin semana» · «Semana, 1 persona y persona instructora» · «Completar con la que más espera · Elegir semana · Agregar personas» · «Grupos que ya terminaron · 2».
- Panel lateral propuesto «Tu grupo»: «Poda y derribo · nueva» · «Del 26 al 30 de octubre · 9:00 a 15:00» · barra «6 de 25 · se confirma con al menos 5» · «Combinado» · lista de elegidas con «Quitar» · «Atrás» · «Siguiente».

### Ficha del grupo
- «← Grupos» · «Poda nueva · del 12 al 16 de octubre · Iztapalapa» · `APD-G-2026-003` · «Poda y derribo · nueva · grupo de Iztapalapa · creado el 01/10/2026» · «En curso · día 3 de 5» · «10 de 25 personas.» · Duración «5 días, de lunes a viernes» · Primer día «12/10/2026» · Último día (repaso de conocimientos y examen final) «16/10/2026» · Hora de entrada «09:00» · Hora de salida «15:00» · Persona instructora «Laura Ejemplo Instructora» · Lugar del curso «Aula de capacitación del Vivero Nezahualcóyotl» · Lugar del examen «Salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio».
- «Personas del grupo»: «Persona · Folio de la solicitud · Adscripción · En el grupo desde · Situación» · FABIÁN EJEMPLO PRUEBA · APD-S-2026-00029 · Iztapalapa · 01/10/2026 · «Inscrita» (y 9 más).
- «Asistencia por día»: «Lo capturado por el instructor, por persona y por día…» · columnas «Persona · 12/10/2026 · 13/10/2026 · 14/10/2026 · 15/10/2026 · 16/10/2026 · repaso de conocimientos y examen final · Días · Examen» · «✓ ✓ Hoy — — · 2 de 5 · Con derecho» / BRUNO PRUEBA MODELO «✗ ✓ Hoy · 1 de 5 · Ya no puede faltar» · «Ver la asistencia».
- Por confirmar (`APD-G-2026-004`): «Poda nueva · sin fecha» · «Por confirmar» · «4 de 25 personas. Falta 1 para el mínimo de 5.» · acción por fila «Dar de baja» · «Agregar personas de la espera (6 en espera)» · «Elegir la semana en el calendario» · «Cancelar el grupo» · «Para confirmar el grupo — Le falta: la semana… y 1 persona más.»
- Capacitación (`APD-G-2026-005`): «Propuesta — Semana propuesta, todavía sin confirmar…» · «Persona instructora y confirmación» · «Para confirmarlo le falta: 4 personas más. Mientras, puede asignarle la persona instructora.» · «Persona instructora*» «Laura Ejemplo Instructora · la asignada ahora / Instructor Ejemplo Dos · libre esas fechas» · «Cambiar la persona instructora».

### Capacitación
- «Grupos por asignar y confirmar» · «2 grupos esperan: 1 sin persona instructora.» · columnas «Grupo · Semana · Personas · Persona instructora · Lo que falta · Acción» · «Poda nueva · del 26 al 30 de octubre / APD-G-2026-005 · Del 26/10/2026 al 30/10/2026 · 1 de 25 · Laura Ejemplo Instructora · 4 personas · Ver» · «Poda nueva · sin fecha / APD-G-2026-004 · Sin semana · 4 de 25 · Sin asignar · Semana (la elige quien arma los grupos), 1 persona y persona instructora · Ver» · «Grupos confirmados y en curso» · «Si hace falta, cambie a la persona instructora, también durante el curso: el cambio queda en la bitácora.» · acción «Cambiar la persona instructora».

### Asistencia
- «Día 3 de 5 · miércoles 14 de octubre de 2026» · «Poda nueva · del 12 al 16 de octubre · Iztapalapa» · `APD-G-2026-003` · «Poda y derribo · nueva · 5 días, de lunes a viernes · del 12/10/2026 al 16/10/2026 · 10 personas» · «Para el examen se necesitan 4 de 5 días: cada persona puede faltar 1.» · leyenda «✓ asistió · ✗ faltó · ◌ sin marcar · ? sin capturar».
- Fila: foto · «ANA MUESTRA FICTICIO» · tira «✓ ✓ ◌» · «¿Asistió?» «Sí / No»; BRUNO PRUEBA MODELO con «✗ ✓ ◌» y «Ya no puede faltar».
- Pie: «0 asistieron · 0 faltaron · 10 sin marcar» · «Todas asistieron» · «Guardar la asistencia del día 3» · «Corregir otro día» · «Queda registrado en el sistema quién capturó cada día y cuándo…».

### Aplicar el examen
- «Aplicar el examen» · «El último día del curso, en el salón de cómputo: primero se pasa lista, que es la asistencia de ese día, y después cada persona presente contesta el examen en línea con su código de un solo uso.» · Grupo «Poda nueva · del 12 al 16 de octubre · Iztapalapa / APD-G-2026-003» · Curso «Poda y derribo · solicitud nueva» · Fecha del examen «16/10/2026 · último día del curso (inició el 12/10/2026)» · Lugar «Salón de cómputo del PILARES Vivero Nezahualcóyotl» · Examen «10 preguntas · 60 minutos · calificación mínima 7.0».
- Avisos: «El examen de este grupo es el viernes 16 de octubre de 2026, no hoy» · «Faltan días del curso por capturar en «Asistencia»».
- «Día 5 de 5 · Pase de lista en el salón de cómputo» · «Compare a cada persona con su fotografía y con su identificación oficial, y márquela «Presente» o «No llegó»…» · «10 personas inscritas, 9 con derecho a examen: 9 por pasar lista.» · columnas «Persona · Asistencia · Pase de lista y código · Avance» · fila: foto «Ampliar» · ANA MUESTRA FICTICIO · APD-S-2026-00024 · «4 de 4 días anteriores» · «Presente» · «No llegó» · «—»; BRUNO PRUEBA MODELO · «2 de 4 días anteriores» · «Sin derecho a examen» · «Necesita 4 de 5 días». Ya presente: código «K7MP-3XQ9» (formato XXXX-XXXX); si llega tarde: «Llegó: marcar presente».
- «Después de pasar lista: el examen» · 1 «Entregue a cada persona presente su código impreso o díganselo…» · 2 «La persona escribe el código en la computadora, en «Entra a tu examen»…» · 3 «Siga el avance en la lista, en «Avance»…» · «Imprimir los códigos» · «Abrir la pantalla del examen».

### Acreditaciones
- «Reposiciones por atender» · «Credenciales que sus titulares pidieron reponer por pérdida o robo: revise el acta y, cuando la persona llegue con su pago, valide la factura y entréguele su credencial.» · «2 esperan a la Secretaría; 1 espera el acta corregida.» · «Persona · Número de acreditación · Pedida el · Situación · Acción» · VALERIA MODELO EJEMPLO · PD-2026-K145 · 06/10/2026 · «Por entregar» · «Entregar» / TERESA PRUEBA MODELO · PD-2026-K141 · 13/10/2026 · «Acta por revisar» · «Revisar el acta» / ULISES FICTICIO SIMULADO · PD-2026-K143 · 08/10/2026 · «Acta con observaciones» · «Ver».
- «Acreditaciones» · «Busque una acreditación por su número, o por el nombre o la CURP de su titular, y abra su ficha.» · «Buscar una acreditación — Número de acreditación (PD-… o DT-…), nombre o CURP.» · «57 acreditaciones en el padrón.» · «Número de acreditación · Titular · Acreditación · Situación · Acción» · DT-2025-K109 · SERGIO SIMULADO MUESTRA · Dictaminador técnico · «Vigente · por vencer» · «Ver» / PD-2024-K105 · PABLO FICTICIO SIMULADO · Poda y derribo · «Vencida» / PD-2024-K129 · MARTA PRUEBA MODELO · «Vencida · puede renovarla» / PD-2025-K140 · ZACARÍAS SIMULADO SIMULADO · «Cancelada» / PD-2026-0004 · MARÍA DE LOS ÁNGELES GUADALUPE EJEMPLO MUESTRA DE LA PRUEBA Y FICTICIO (nombre largo) · «Vigente».
- Ficha: «← Acreditaciones» · «Acreditación PD-2025-K100» · «Poda y derribo · KARLA MODELO EJEMPLO» · «Vigente» · Titular · CURP «MOEK801111MNEDJR05» · Acreditación · Número · Emitida el «20/11/2025» · Vence el «19/11/2026» · Origen «Registro anterior de la Secretaría (Kobo)» · «Cancelar acreditación» (diálogo «¿Cancelar la acreditación?» · «Volver sin cambios»).
- Reposición en la ficha: «Reposición de la credencial» · «Acta por revisar» · Pedida el «13/10/2026 18:30» · Motivo «Pérdida» · Acta «ACTA DE PERDIDA O ROBO_TERESA PRUEBA MODELO.pdf» · «Ver el acta» · «Revisar el acta» · «¿El acta comprueba la pérdida o el robo?*» «Sí, aceptarla — La persona paga la cuota y recoge su credencial.» · «No, tiene observaciones — La persona carga el acta corregida.» · «Registrar la revisión del acta» · después «Entregar la credencial repuesta» · «Registrar la entrega».

### Registro asistido y ventanilla
- «← Inicio del personal» · pasos «Aviso de privacidad · Datos · Fotografía · Confirmar».
- Paso 1 «Léale el aviso de privacidad» · «Para una persona que no sabe leer ni escribir, con ella presente…» · «Aviso de privacidad simplificado — La Secretaría del Medio Ambiente recaba tu nombre, tu CURP…» · «Fundamento: [Art. __, fracc. __]. Pendiente: lo completa la Unidad de Transparencia.» · casilla «Le leí el aviso de privacidad a la persona y lo aceptó*» · «Queda registrado con su nombre y la hora. Sin esta marca no se continúa.» · «Siguiente».
- Paso 2 «Datos de la persona» · «Capture los datos como vienen en su CURP…» · «Nombre o nombres* · Primer apellido* · Segundo apellido · CURP* · Fecha de nacimiento* (Se toma de la CURP.) · Sexo» · «Cómo se le avisa: Teléfono* (Diez dígitos…) · Correo electrónico (si tiene)» · «Su adscripción: ¿Trabajas para alguna empresa, institución o dependencia?* Sí / No, soy independiente».
- Ventanilla: «Ventanilla» · «Busque a la persona y dígale en qué va su trámite. Lo de «Qué decirle» va escrito para ella: léaselo.» · «CURP, nombre o folio» · «Escriba al menos 3 caracteres para buscar.» · Ficha: AMALIA SUPUESTO EJEMPLO · «Registro asistido · avisos por teléfono» · CURP «SUEA850422MNEPJM05» · Teléfono «00 0000 0076» · Correo «No tiene» · Registrada en el Vivero «06/10/2026 09:00» · «Tiene un aviso por teléfono pendiente» · «Poda y derribo · Con observaciones» · «APD-S-2026-00064 · Solicitud nueva · Enviada el 06/10/2026 · Capturada en el Vivero» · «Qué decirle: A tu solicitud le falta corregir un documento: Comprobante de domicilio: está a nombre de otra persona y no trae una carta de quien es titular. Lo corregimos aquí contigo. Hay un plazo para corregir. Te quedan 2 oportunidades para corregir.» · «Leerle lo que falta y cargar lo corregido».

### Inicio público
- «Acreditación de poda y derribo, y de dictaminador técnico» · «Para trabajar en el arbolado urbano de la Ciudad de México necesitas una acreditación vigente de la Secretaría. Aquí la solicitas por primera vez o la renuevas, y das seguimiento a tu trámite.»
- Opciones: «Crea tu cuenta — La primera vez. Necesitas tu CURP y un correo.» · «Entra a tu cuenta — Inicia o renueva tu acreditación y consulta en qué va tu trámite.» · «Verifica una acreditación — Consulta si una acreditación está vigente. No necesitas cuenta.» · «Material de estudio — Los documentos para preparar el examen. No necesitas cuenta.»
- «Cómo es el trámite» (8 pasos: cuenta, solicitud, revisión, cita de cotejo, curso, examen, credencial, reposición) · «Cuándo renovar — Puedes renovar desde 30 días antes de que venza tu acreditación y hasta 12 meses después…».

### Crea tu cuenta
- Pasos «Quién eres · Cómo te avisamos · Tu fotografía · Tu contraseña · Revisa y crea».
- 1 «¿Quién eres?» · «Una cuenta por persona, ligada a tu CURP. Escribe tus datos como vienen en tu CURP…» · «Nombre o nombres* · Primer apellido* · Segundo apellido (Si no tienes segundo apellido, déjalo vacío.) · CURP* (18 caracteres. Si no la tienes a la mano, consúltala en gob.mx) · Fecha de nacimiento* (Se toma de tu CURP.) · Sexo (Se toma de tu CURP.)» · «Siguiente» · «¿Ya tienes cuenta? Entra aquí.»
- 2 «¿Cómo te avisamos?» · «Aquí te llegarán tu cita, tu curso y tus resultados.» · «Correo electrónico* · Escribe otra vez tu correo* · Teléfono* (Diez dígitos, de preferencia un celular.)» · «Tu adscripción…».
- 5 «Revisa tus datos» · Nombre «TOMÁS EJEMPLO SIMULADO» · CURP «EEST650515HNEJMM07» · Fecha de nacimiento «15/05/1965» · Correo · Teléfono «0000000099» · Adscripción «No, soy independiente» · Fotografía «Lista» · Contraseña «Ya la escribiste (no se muestra)» · cada uno con «Cambiar» · «Crear mi cuenta».

### Mis trámites
- Sesión: «TERESA MUESTRA FICTICIO · Mis trámites · Mi perfil · Salir» · «Mis trámites — Aquí ves tus acreditaciones y en qué va cada solicitud.»
- Con cita: «Solicitudes en curso» · «Poda y derribo · solicitud nueva» · «Acude a tu cita» · Cita de cotejo «martes 20 de octubre de 2026 a las 10:00» · Lugar «Vivero Nezahualcóyotl, Canal de Chalco s/n, colonia Ciénega Grande, Alcaldía Xochimilco» · «Qué sigue: 1 Imprime los mismos documentos que cargaste. 2 Paga los derechos e imprime tu comprobante de pago. 3 Acude a tu cita el martes 20 de octubre de 2026 a las 10:00 con tus documentos y tu comprobante.» · «Datos para tu pago: Concepto · Monto $1,200.00 · Referencia APDS202600042» · «Pendiente: banco, cuenta y forma de pago.» · Folio «APD-S-2026-00042» · «Fecha en que enviaste la solicitud 06/10/2026 11:00» · «Dónde es» + mapa + «Abrir en Google Maps» · «Mis acreditaciones — Todavía no tienes acreditaciones.»
- Con observaciones: «Dictaminador técnico · solicitud nueva» · «Corrige y reenvía» · «Lo que debes corregir — Comprobantes de experiencia: las constancias no indican el periodo ni las funciones realizadas en manejo de arbolado.» · «Te quedan 2 oportunidades para corregir.» · «Corrige antes del — Fecha por definir» · «Corregir y reenviar» · acreditaciones: «Poda y derribo · Vigente · PD-2026-K118 · Emitida el 11/05/2026 · Vence el 10/05/2027 · Vence en 208 días · Podrás renovarla a partir del 10/04/2027. · Pedir la reposición de tu credencial»; «PD-2025-K117 · Vencida · Vencida hace 157 días».
- Con grupo: «Con grupo asignado» · «Tu curso empezó el lunes 12 de octubre de 2026 a las 09:00» · «Hoy es el día 3 de 5» · «Día 5: repaso de conocimientos y examen final — viernes 16 de octubre de 2026, en el salón de cómputo del PILARES Vivero Nezahualcóyotl» · Número de expediente «EXP-2026-0017» · Grupo «Poda nueva · del 12 al 16 de octubre · Iztapalapa / APD-G-2026-003».

### Solicitud y corregir
- Pasos «Trámite · Documentos · Revisión» · «Estás solicitando: Poda y derribo» · «Borrador guardado en este dispositivo.»
- 1 «¿Qué acreditación solicitas?» · «Poda y derribo — Para podar y derribar árboles en la vía pública y en áreas verdes.» · «Dictaminador técnico — Para emitir dictámenes técnicos de arbolado. Necesitas la de poda y derribo vigente y durante al menos dos años consecutivos.» · «Te corresponde la renovación de tu acreditación PD-2025-K132. Curso de 1 día.» · «Tu adscripción: Independiente» · «¿Cuál es tu último nivel o grado de estudios?*» · «¿Qué carrera estudiaste?*» · «Continuar».
- 2 «Carga tus documentos» · «Un archivo por documento, sólo en PDF, de hasta 5 MB…» · «Esta vez carga todos tus documentos» · campos «Identificación oficial* · Clave Única de Registro de Población (CURP)* · Comprobante de domicilio* · Constancia de situación fiscal*» (dictaminador además «Comprobante de estudios · Currículum vitae · Comprobantes de experiencia») · archivo «documento.pdf · 1 KB · Ya adjuntaste el archivo. Para cambiarlo, quítalo.»
- 3 «Revisa antes de enviar» · bloques «TRÁMITE» y «DOCUMENTOS · 4 documentos» con «Editar» · casillas de protesta y aviso de privacidad · «Enviar solicitud».
- Corregir: aviso «Lo que debes corregir — Comprobantes de experiencia — Va primero, con lo que debes corregir junto al documento. Lo demás ya está aceptado. Te quedan 2 oportunidades para corregir.» · «Corrige este documento — Las constancias no indican el periodo ni las funciones realizadas en manejo de arbolado. El que cargaste: COMPROBANTES DE EXPERIENCIA_VALERIA PRUEBA MODELO.pdf» · aceptados: «Identificación oficial · Aceptado · IDENTIFICACION OFICIAL_VALERIA PRUEBA MODELO.pdf · Cargado el 06/10/2026 · 351 KB · Ver · Cambiar este archivo» (y 5 más) · propuesta: «Ya aceptados (6)» plegado.

### Reposición (persona)
- «Si perdiste tu credencial o te la robaron, carga el acta que levantaste…» · Acreditación «Poda y derribo» · Número «PD-2026-K147» · Vigente hasta el «07/06/2027» · Cuota de reposición «$88.00» · «¿Qué pasó con tu credencial?* La perdí / Me la robaron» · «Acta que levantaste por la pérdida o el robo*» · «Elegir archivo» · «Pedir la reposición».

### Examen (no cambia)
- «Entra a tu examen» · «Código del examen*» (ejemplo «K7MP-3XQ9») · «Entrar al examen».
- «¿Eres tú?» · «ANA MUESTRA FICTICIO» · «Poda y derribo · solicitud nueva» · «APD-G-2026-003» · «16/10/2026» · «Sí, soy yo» · «No soy yo».
- «Pregunta 1 de 10 · 0 contestadas» · «Tiempo restante: 60:00» · opciones a) a d) · «Marcarla para revisarla antes de enviar» · «Siguiente» · «Ver todas las preguntas».
- «Revisa antes de enviar» · «Contestaste 9 de 10 preguntas. Te falta la pregunta 10…» · «Enviar mis respuestas» · «Volver a las preguntas».

---

## 8. Capturas (`capturas/`, página completa a 1440 px)

- Personal: `p01-inicio-personal-bandeja`, `p02-revisar-poda-1…6`, `p03-revisar-dictaminador-1…10`, `p04-citas`, `p05-cotejo-1…4`, `p06-grupos-paso1…4`, `p06-grupos-existente-paso3`, `p07-grupo-ficha-integracion`, `p07-grupo-ficha-en-curso`, `p08-capacitacion`, `p08-grupo-capacitacion`, `p09-asistencia-inicio`, `p09-asistencia-grupo`, `p10-aplicar-examen`, `p11-acreditaciones`, `p11-acreditacion-ficha`, `p12-reposicion-acta-por-revisar`, `p12-reposicion-pedir`, `p13-registro-asistido-1…2`, `p13-ventanilla`, `p13-ventanilla-ficha`.
- Persona y público: `s01-inicio-publico`, `s02-crea-tu-cuenta-1…5`, `s03-mis-tramites-{cita,observaciones,grupo,acreditada}`, `s04-solicitud-nueva-1…3`, `s04-solicitud-borrador`, `s05-corregir-observaciones-2…3`, `s05-corregir-documento`, `s06-mi-perfil`, `s07-examen-1…5`.
- Volumen: `v-bandeja`, `v-revisar`, `v-citas`, `v-grupos-paso1`, `v-grupos-paso3`, `v-grupo-en-curso`, `v-asistencia-25`, `v-aplicar`, `v-acreditaciones`.
- Vista de la ventana (1440 × 900, no página completa): `x-revisar-al-abrir-1440x900` (al abrir: sólo encabezados y la ficha), `x-revisar-paso2-tras-siguiente-1440x900` (trabajando: decisión y visor a la vista, persona fuera; visor 32 px bajo la barra), `x-revisar-visor-bajo-barra-1440x900`.

Mediciones en bruto: `mediciones.json` (cada pantalla y paso, en 1440 y 1920: alto, anchos, acción principal, lo fijo, bloques y posición de los datos clave) y `mediciones-volumen.json`. Nada se guardó en el repositorio.
