# Etapa 2 · Pantallas del personal de la Secretaría

Se les habla de usted. Cada pantalla se muestra primero como maqueta (`maquetas/`) y, aprobada, se construye en el
sitio con sus pruebas (decisiones del 2026-10-16). Acceso simulado mientras no haya cuentas del personal (P27).

## 1. Pantallas

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Solicitudes por revisar | `sitio/revision.html` · `app/revision.js` | Bandeja de las solicitudes enviadas, de la que más espera a la más reciente. Búsqueda por nombre, CURP, folio de la solicitud o número de expediente; filtros por acreditación, nueva o renovación y vuelta de revisión (plegados en teléfono bajo «Filtrar»). Señala carrera por clasificar, perfil que podría no cumplir y documentos corregidos |
| Revisar una solicitud | `sitio/revisar.html?folio=…` · `app/revisar.js` | Datos de la persona y de la solicitud, revisiones anteriores, perfil del dictaminador, documentos (aceptar u observar, con motivos frecuentes) y resultado: validar con cita, enviar observaciones o rechazar (con confirmación) |
| Lo común | `app/personal.js` | Perfil ficticio de revisión, cabecera del personal, espera y vuelta de cada solicitud, decisiones de la prueba en la pestaña |

En el menú de pruebas, «Entrar como» → «Personal de la Secretaría» lleva a la bandeja; también está en «Ir a otra pantalla».

## 2. Reglas de la revisión

- **Carrera por clasificar** (dictaminador): afín (2 años), disciplina afín (5) o no afín → se rechaza.
- **Perfil declarado que no cumple** (hasta preparatoria, licenciatura en curso o trunca), opción C: si el comprobante
  lo confirma, se rechaza; si muestra otro grado, se observa el comprobante de estudios (la página lo marca con un
  texto propuesto) y la persona corrige su grado.
- Si no se rechaza, cada documento cargado se acepta u observa (observar pide qué corregir). Con alguna observación,
  regresa a la persona (mensaje general opcional); con todo aceptado, se valida con fecha y hora de la cita, que siempre
  es en el Vivero Nezahualcóyotl (sede única).
- La base vuelve a aplicar todo: ver `docs/REGLAS.md` («→ rechazada», «Clasificar una carrera»).

## 2 bis. Visor de documentos

`app/visor.js` muestra todas las hojas del PDF con pdf.js (copiado en `vendor/pdfjs/`, sin CDN): contador de hoja,
acercar y alejar, ajustar al ancho, girar y abrir en otra pestaña. En computadora (≥1024 px) queda fijo a la derecha y
abre de entrada el primer documento (el comprobante de estudios si hay que decidir el perfil); en pantalla chica se abre a
pantalla completa. Al aceptar un documento, el visor y la lista pasan al siguiente sin decidir; con todo decidido, la
página baja al resultado. PDF ficticios: `herramientas/documentos-ficticios.py`.

Prueba sin servidor: todo el recorrido se guarda en ese navegador (`app/archivos-prueba.js`: cuentas, fotografías,
solicitudes y documentos en IndexedDB; sesión, cambios de perfil y revisiones en localStorage) y `APD.cargar()` lo suma a
los ficticios en todas las pantallas. Lo enviado en la prueba va primero en la bandeja; la revisión muestra la fotografía
de la persona y el visor el archivo real. Se quita en la etapa 3 junto con el acceso simulado.

## 3. Formulario y servidor

La revisión es un formulario del estándar que arranca a mano (`data-formkit="manual"`) cuando la página ya calculó sus
campos auxiliares (módulo propio `auxiliar`): `perfil_revision`, `revisar_<requisito>` (documento cargado y sin
rechazo por perfil) y `resultado`. Cada campo depende de una sola condición (P38). Los siete bloques de documentos se
generan del catálogo de requisitos en `herramientas/construir-sitio.mjs` (marcadores `revision-documentos` y
`revision-auxiliares`). Módulos del estándar: `opciones`, `modal` (`FormKit.confirma` para rechazar) y `tabla`
(bandeja). El esquema del servidor es `db/esquemas-formularios/revisar.json`; `herramientas/probar-esquemas.mjs` lo
prueba con el cálculo de los auxiliares que hará la API (14 casos).

## 4. Lo que falta

- Cuentas y perfiles del personal en el SIA (P27); plazos de la espera (P02); dirección del Vivero Nezahualcóyotl (P68);
  motivos frecuentes y quién fija la fecha (P64).
- Visor de documentos: en la prueba muestra el archivo cargado en el navegador o un PDF ficticio por requisito; en la etapa 3 la API entrega el archivo de cada solicitud.
- Siguientes pantallas: citas de cotejo, grupos y asistencia, calificación, emisión y entrega.
- Hallazgos del estándar: P65 (chips con lista fija), P66 (tabla filtrada y columna de acción en teléfono) P67 (no hay visor de documentos) y P70 (fecha escrita como día/mes/año, usada en «Crear cuenta»).
