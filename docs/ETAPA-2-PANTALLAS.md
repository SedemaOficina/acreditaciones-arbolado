# Etapa 2 · Pantallas del personal de la Secretaría

Se les habla de usted. Cada pantalla se muestra primero como maqueta (`maquetas/`) y, aprobada, se construye en el
sitio con sus pruebas (decisiones del 2026-10-16). Acceso simulado mientras no haya cuentas del personal (P27).

## 1. Pantallas

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Solicitudes por revisar | `sitio/revision.html` · `app/revision.js` | Bandeja de las solicitudes enviadas, de la que más espera a la más reciente. Búsqueda por nombre, CURP, folio de la solicitud o número de expediente; filtros por acreditación, nueva o renovación y vuelta de revisión (plegados en teléfono bajo «Filtrar»). Señala carrera por clasificar, perfil que podría no cumplir y documentos corregidos |
| Revisar una solicitud | `sitio/revisar.html?folio=…` · `app/revisar.js` | Datos de la persona y de la solicitud, revisiones anteriores, perfil del dictaminador, documentos (aceptar u observar, con motivos frecuentes) y resultado: validar con cita, enviar observaciones o rechazar (con confirmación) |
| Lo común | `app/personal.js` | Perfil ficticio de revisión, cabecera del personal, espera y vuelta de cada solicitud, decisiones de la prueba en la pestaña |

En «Entrar» (caja de pruebas) y en el menú de pruebas hay un enlace a la bandeja.

## 2. Reglas de la revisión

- **Carrera por clasificar** (dictaminador): afín (2 años), disciplina afín (5) o no afín → se rechaza.
- **Perfil declarado que no cumple** (hasta preparatoria, licenciatura en curso o trunca), opción C: si el comprobante
  lo confirma, se rechaza; si muestra otro grado, se observa el comprobante de estudios (la página lo marca con un
  texto propuesto) y la persona corrige su grado.
- Si no se rechaza, cada documento cargado se acepta u observa (observar pide qué corregir). Con alguna observación,
  regresa a la persona (mensaje general opcional); con todo aceptado, se valida con fecha, hora y lugar de la cita.
- La base vuelve a aplicar todo: ver `docs/REGLAS.md` («→ rechazada», «Clasificar una carrera»).

## 3. Formulario y servidor

La revisión es un formulario del estándar que arranca a mano (`data-formkit="manual"`) cuando la página ya calculó sus
campos auxiliares (módulo propio `auxiliar`): `perfil_revision`, `revisar_<requisito>` (documento cargado y sin
rechazo por perfil) y `resultado`. Cada campo depende de una sola condición (P38). Los siete bloques de documentos se
generan del catálogo de requisitos en `herramientas/construir-sitio.mjs` (marcadores `revision-documentos` y
`revision-auxiliares`). Módulos del estándar: `opciones`, `modal` (`FormKit.confirma` para rechazar) y `tabla`
(bandeja). El esquema del servidor es `db/esquemas-formularios/revisar.json`; `herramientas/probar-esquemas.mjs` lo
prueba con el cálculo de los auxiliares que hará la API (14 casos).

## 4. Lo que falta

- Cuentas y perfiles del personal en el SIA (P27); plazos de la espera (P02); catálogo de sedes y su columna (P09);
  motivos frecuentes y quién fija la fecha (P64).
- Visor de documentos: en la prueba no hay archivos reales (etapa 3).
- Siguientes pantallas: citas de cotejo, grupos y asistencia, calificación, emisión y entrega.
- Hallazgos del estándar: P65 (chips con lista fija) y P66 (tabla filtrada y columna de acción en teléfono).
