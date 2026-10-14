# Etapa 1 · Pantallas de la persona solicitante

Versión de prueba 0.1, con datos ficticios. Construida con el **Estándar de formularios del SIA v1.0.0**
(`SedemaOficina/estandar-formularios`), sin modificarlo. Ninguna pantalla guarda nada fuera de la pestaña:
el envío, el acceso y la consulta están **simulados** sobre `datos/ficticios.json` hasta la etapa 3.

## 1. Pantallas

| Página | Forma | Qué hace | Módulos del estándar |
|---|---|---|---|
| `index.html` | Sin formulario | Qué es, cómo es el trámite, cuándo renovar, requisitos por curso (del catálogo de la base) | acordeon |
| `cuenta.html` | Una página | Crea la cuenta: nombre, primer apellido, «¿Tienes segundo apellido?» y el segundo si lo hay, fecha de nacimiento, CURP (comprobada contra nombre, apellidos y fecha, también al cambiar esos datos después), correo (con confirmación), teléfono, contraseña (con confirmación), aviso, humano. Si la CURP es del registro de Kobo y el nombre coincide, activa esa cuenta y avisa que hay historial | identificadores, tooltip, modal, copiar, acuse |
| `entrar.html` | Una página | CURP y contraseña. El error nunca dice cuál de los dos falló. Caja de personas de ejemplo (sólo versión de prueba) | identificadores |
| `tramites.html` | Sin formulario | Mis acreditaciones (vigencia en palabras, «Renovar» cuando aplica) y mis solicitudes (estado, qué sigue, cita con datos de pago, expediente de la persona, grupo, observaciones, asistencia y calificación, lista para recoger, motivo de cierre) | — |
| `solicitud.html` | Por pasos (3) | **Trámite** (un solo campo con las 4 combinaciones; lo que no aplica, deshabilitado con su motivo), acreditación que se renueva (sólo lectura), organización (combo abierto), perfil del dictaminador · **Documentos** (generados del catálogo) · **Revisión**, aviso, humano · acuse con folio | opciones, combo, pasos, archivos, revision, acuse, modal, copiar |
| `verificar.html` | Una página | Verificación pública por número de acreditación: nombre, tipo, fechas y «Vigente / No vigente» | identificadores |

Textos de estado: una sola fuente en `sitio/app/apd.js` (`ESTADOS`, `VIGENCIA`). Ejemplo: `validada_en_linea`
se lee «Cita asignada»; `lista_para_curso`, «En espera de grupo».

### Menú de pruebas (sólo versión 0.N)

`app/pruebas.js`, en todas las pantallas: botón fijo «Menú de pruebas» que abre un panel para entrar como
cualquier persona ficticia (una por situación) o como persona nueva, desactivar o activar las preguntas
obligatorias (los formatos y las comprobaciones de la CURP siguen), llenar el formulario con datos ficticios,
saltar a cualquier paso de la solicitud, simular fallo, límite o envío lento, e ir a cualquier pantalla. No
aparece si `VERSION` no es 0.N; al pasar al SIA se quita de las páginas con el acceso simulado.

## 2. Archivos del estándar que se copian

Los copia `herramientas/construir-sitio.mjs` a `sitio/formkit/`, sin cambios: `css/` (tokens, base, núcleo),
`js/` (validaciones.config, iconos, formkit.core), `fuentes/`, `iconos/`, `imagenes/` y los módulos
**opciones, combo, identificadores, pasos, archivos, revision, acuse, modal, copiar, tooltip, acordeon**.
Alternativa equivalente: `dist/formkit.css` y `dist/formkit.js`.

Orden de carga en cada página (contrato del estándar):

1. `formkit/css/tokens.css` → `base.css` → `nucleo.css` → CSS de los módulos usados → `app/version-visible.css` → `app/apd.css`
2. `app/apd.js` → (`datos/catalogos.js`) → `app/config-<página>.js` → `formkit/js/validaciones.config.js` →
   `formkit/js/iconos.js` → `formkit/js/formkit.core.js` → JS de los módulos → script propio de la página →
   `app/version-visible.js`

## 3. Configuración

| Archivo | Qué ajusta |
|---|---|
| `app/curp-nombre.js` | Validaciones cruzadas propias `curp-nombre`, `curp-segundo-apellido` y `curp-sin-segundo-apellido` (iniciales y consonantes de la CURP contra nombre y apellidos). Se cargan antes de la configuración; el servidor las usa con `validaPayload(…, { config })` |
| `app/config-cuenta.js` | Suma las cruzadas propias (`FORMKIT_CONFIG.cruzadas`). Envío simulado: CURP con cuenta → rechazo con motivo; CURP del registro de Kobo → activa y muestra historial; nueva → cuenta |
| `app/config-entrar.js` | Acceso simulado (contraseña ficticia común) y regreso a la pantalla pedida |
| `app/config-solicitud.js` | `archivos`: 5 MB, PDF/JPG/PNG, 1 por documento (parámetro de la base y tipos de `apd.documento`). Envío simulado con folio `APD-S-AAAA-NNNNN` |
| `app/config-verificar.js` | Consulta a la vista `apd.verificacion_publica` |
| `datos/catalogos.js` | Catálogo de organizaciones (generado de la base; ficticio) |

Todas aceptan `?simular=error | limite | lento` para ver las pantallas de fallo. No hay mapa: el proyecto no
pide ubicación (decisión 4 del SIA).

## 4. Validación en el servidor

```sh
node herramientas/probar-esquemas.mjs <ruta-al-estandar>
```

Regenera `db/esquemas-formularios/<formulario>.json` con `herramientas/esquema-desde-html.mjs` del estándar
y prueba 21 casos con su `codigo/servidor/validar.mjs` (lo correcto pasa; CURP con dígito incorrecto, CURP ajena, otro segundo apellido u otra fecha de nacimiento,
confirmaciones distintas, contraseña corta, documentos faltantes por trámite y valores fuera de rango se
rechazan). En la etapa 3 la API:

- valida cada envío con `validaPayload(payload, esquema)` antes de tocar la base;
- separa `tramite` en `tipo_acreditacion` y `modalidad`, y **no confía** en `anterior`: la acreditación que se
  renueva la determina la base (`apd.comprobar_elegibilidad`);
- verifica la firma de cada archivo sobre los bytes recibidos, aplica el límite por origen y reconoce la clave
  de idempotencia;
- en la corrección de observaciones, la obligatoriedad de documentos la decide `apd.comprobar_envio` (sólo lo
  observado), no el esquema de la solicitud nueva.

## 5. Decisiones técnicas de esta etapa

1. **Trámite en un solo campo** (`poda_nueva`, `poda_renovacion`, `dictaminador_nueva`, `dictaminador_renovacion`).
   Con dos campos y condiciones anidadas, el esquema del servidor sólo leía la condición más cercana y pedía
   documentos de otro curso. Con uno, navegador y servidor aplican la misma condición.
2. **CURP con dígito verificador también en la base** (`apd.curp_valida`): estructura, entidad y dígito, igual
   que el estándar. Las CURP ficticias pasaron a `XAXX…NEXXX0d`, válidas en formato. 71 de 71 pruebas de la base.
3. **Contraseña ficticia** `Prueba-ficticia-2026`: la anterior tenía 11 caracteres y el estándar pide 12.
4. **Experiencia en medios años** (`step 0.5`): un dato ficticio tenía 2.5 años y la base admite un decimal.
5. **Distintivo de versión** con los tokens del estándar (`herramientas/plantillas/version/version-visible.formkit.css`)
   y dentro del pie, para pasar el auditor de CSS y la regla de regiones de axe.
6. Las marcas internas del catálogo (`[pendiente] …`) no se muestran a la persona; siguen en la base.

## 6. Hallazgos para el Estándar de formularios (no se corrigieron aquí)

| Módulo o herramienta | Hallazgo | Cómo se resolvió en el proyecto |
|---|---|---|
| `combo` | `docs/06` dice que acepta `{filas, fuente, corte, es_ficticio}`; `combo.js` sólo lee arreglos (`fuente.map is not a function`) | Catálogo como arreglo; fuente y corte en comentario |
| `esquema-desde-html.mjs` | Con `data-si` anidados sólo toma el más cercano; el navegador sí los combina | Un campo `tramite`, sin anidar |
| `archivos` | Con `data-max="1"` dice «Hasta 1 archivos» | Sin cambio |
| `numero` | `step` menor que 1 (p. ej. 0.5) no se valida | La base acota con `numeric(4,1)` |
| Núcleo | No hay forma prevista de marcar en un campo un error que devuelve el servidor (CURP ya registrada) | Se muestra en el aviso de envío |
| Catálogo | No hay «mostrar contraseña» | Sin cambio; se propone para el estándar |
| Validaciones cruzadas | No hay una de CURP contra nombre y apellidos (sólo fecha, sexo y entidad) | Cruzadas propias en `app/curp-nombre.js`; se propone llevarlas al estándar |
| Validaciones cruzadas | Un rol vacío (segundo apellido) impide que corra la cruzada | Pregunta «¿Tienes segundo apellido?» y una cruzada para el «No» (X en las posiciones 3 y 15) |
| Validaciones cruzadas | No se repiten si cambia el otro dato y el campo que las declara no tenía error | `app/cuenta.js` vuelve a validar la CURP al cambiar nombre, apellidos o fecha |
| Plantilla de versión del SIA | `version-visible.css` usa valores literales y no pasa el auditor | Hoja equivalente con tokens |

## 7. Verificación

Automática (Chromium 390 × 844 táctil y 1280 × 900):

- `herramientas/probar-sitio.mjs`: **92 comprobaciones correctas** — inicio, cuenta nueva, cuenta del registro de Kobo,
  solicitud de poda nueva, renovación, dictaminador nueva con perfil y 8 documentos, corrección de observaciones
  (sólo lo observado es obligatorio), grupo asignado, error de acceso, verificación vigente y no vigente,
  fallo de envío, CURP ajena o con otra fecha rechazada, menú de pruebas; sin errores de consola ni desborde horizontal; **axe-core sin hallazgos** en 8 pantallas.
- `auditar-campos.mjs`: 48 campos correctos (uso, finalidad, autocompletado, sensibilidad, teclado).
- `auditor-css.mjs` sobre `apd.css` y `version-visible.css`: 0 hallazgos.
- `probar-esquemas.mjs`: 21 de 21. `probar-base.sh`: 82 de 82.
- Capturas en `verificacion/capturas/` (10 pantallas × 2 anchos).

Lista para personas (`docs/08` del estándar, sección 2) — **pendiente**, no se pudo hacer en el entorno de construcción:

- [ ] Recorrido sólo con teclado.
- [ ] Lector de pantalla real (NVDA, VoiceOver, TalkBack).
- [ ] iPhone y Android reales, con red limitada; cámara en la carga de documentos.
- [ ] Firefox y Safari (`:has()`, `<dialog>`).
- [ ] Alto contraste forzado; impresión del acuse.
- [ ] Contenido revisado por la Dirección (etiquetas, «qué sigue», ningún plazo prometido).
- [ ] Inventario de datos personales y aviso de privacidad con la Unidad de Transparencia (fundamento en `[Art. __, fracc. __]`).
- [ ] Servidor: `validar.mjs` integrado con el esquema del HTML final (etapa 3).
- [ ] **Verificado en móvil y en escritorio** — nombre y fecha de quien probó.

## 8. Lo que falta antes de liberar

Todo está numerado en `docs/PENDIENTES.md`.

## 8 bis. Resumen (no es de esta etapa)

Acceso real y sesiones (etapa 3), recuperación de contraseña (pendiente 2), correo institucional (pregunta 1 al
SIA), aviso de privacidad (pendiente 1), lugar de la cita y de la sede (pendiente 11), titularidad al activar
una cuenta del registro de Kobo (pendiente 10).
