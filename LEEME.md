# Sistema de Acreditaciones de Poda y Dictaminación

Control del trámite para obtener o renovar la acreditación de **poda y derribo** o de **dictaminador
técnico** de arbolado urbano de la Ciudad de México: solicitud en línea con cuenta, revisión documental,
cotejo, integración de grupos de capacitación a demanda, asistencia y examen, emisión de la acreditación,
vigencia, renovación y verificación pública.

Sustituye por completo el uso de Kobo ToolBox. Se construye para instalarse en el Sistema de Información
Ambiental (SIA) de la Secretaría del Medio Ambiente, siguiendo `docs/GUIA-PROYECTOS-SIA.md` desde el
principio.

**Versión de prueba 0.N** (archivo `VERSION`): sube con cada publicación y se ve abajo de cada pantalla; el historial está en `docs/VERSIONES.md`. Todos los datos de este repositorio son **ficticios**.

## Estado

| Etapa | Qué cierra | Estado |
|---|---|---|
| 0. Decisiones previas | Nueve decisiones del SIA, reglas del trámite validadas en el mapa, modelo de datos, base y datos ficticios | **Cerrada** el 14/10/2026, con pendientes que no bloquean |
| 1. Cascarón | Pantallas públicas y de la persona solicitante, con el Estándar de formularios del SIA y datos ficticios, publicadas y probadas en teléfono | **Construida** el 14/10/2026; falta revisión en dispositivos reales (`docs/ETAPA-1-PANTALLAS.md`) |
| 2. Administración | Revisión, cotejo, bandeja de demanda, grupos, asistencia, examen, emisión; carga del padrón de Kobo | **En construcción**: revisión documental, citas y cotejo, grupos (paso a paso con calendario y grupos programados, desde el 24/10/2026), asistencia, examen en línea y material de estudio; faltan emisión y entrega, y carga del padrón de Kobo (`docs/ETAPA-2-PANTALLAS.md`) |
| 3. Datos reales | Backend `crearRutasApd(pool)` sobre la base | — |
| 4–6 | Trámites, indicadores, cierre y paquete para el SIA | — |

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `docs/pendientes.json` | **Fuente de los pendientes** (número fijo, responsable, recomendación). `npm run pendientes` genera `docs/PENDIENTES.md` y la página del tablero `docs/tablero-pendientes.html` |
| `docs/PENDIENTES.md` | Todo lo que falta decidir o hacer (generado) |
| `docs/DECISIONES.md` | Todas las reglas decididas, con fecha; en «Lineamientos», dónde vive el anteproyecto (fuera de este repositorio público) y la regla para mantenerlo al día |
| `docs/DECISIONES-SIA.md` | Las nueve decisiones del SIA y las preguntas abiertas al SIA |
| `docs/REGLAS.md` | Qué impone la base: estados, vigencia, grupos, folios, bitácora |
| `docs/MODELO-DE-DATOS.md` | Tablas y campos (generado) |
| `docs/GUIA-PROYECTOS-SIA.md` | Guía del SIA, copia del día de inicio |
| `docs/insumos-lineamientos-borrador.txt` | Borrador de lineamientos de la Dirección de Infraestructura Verde, tal como llegó |
| `db/esquema.json` | **Fuente única del modelo de datos** |
| `db/apd/` | Guiones de instalación del esquema `apd`, en orden; `instalar.sql` los corre en una transacción |
| `datos/ficticios.json` | Expedientes ficticios exportados de la base, con sus mismas tablas (generado) |
| `datos/examen-ficticio.js` | Banco ficticio del examen en línea: 10 preguntas de opción múltiple sólo para probar la interfaz (el real nunca entra al repositorio, P85) |
| `sitio/` | Versión de prueba de las pantallas de la persona solicitante y del personal (se publica tal cual en GitHub Pages) |
| `sitio/formkit/` | Copia sin cambios del Estándar de formularios del SIA 1.5.1 (`SedemaOficina/estandares-sia`, carpeta `formularios/`; generada) |
| `sitio/material/` | PDF del material de estudio (documentos públicos de la Secretaría) |
| `db/esquemas-formularios/` | Esquema de cada formulario para la validación en el servidor (generado del HTML) |
| `docs/ETAPA-1-PANTALLAS.md` | Pantallas, archivos del estándar, configuración, validación en el servidor y lista de cierre |
| `docs/ETAPA-2-PANTALLAS.md` | Pantallas del personal (revisión, citas, cotejo, examen), sus reglas, formularios y lo que falta |
| `docs/AVISOS-POR-CORREO.md` | Catálogo de avisos por correo a la persona y a la Dirección (condición de lanzamiento, P23) |
| `docs/BITACORA-PROYECTO.md` | Bitácora del proyecto por bloques, con los resultados de cada corrida de pruebas |
| `docs/VERSIONES.md` | Historial de versiones de prueba (generado) |
| `docs/textos/` | Inventario de textos de las pantallas (`npm run textos`) |
| `docs/AUDITORIA-*.md`, `docs/auditoria-integral/`, `docs/auditoria-tareas/` y `docs/auditoria-romper/` | Auditorías (registro). La del 19/10/2026 tiene un informe sensible aparte, en los documentos del Proyecto (no en este repositorio) |
| `maquetas/` | Maquetas aprobadas de cada pantalla (registro de diseño) |
| `verificacion/capturas/` | Capturas de las pruebas del sitio en teléfono y escritorio (se regeneran en cada corrida; no se versionan, `.gitignore`) |
| `verificacion/auditoria/` | Resultado de `herramientas/auditar-sitio.mjs`: recorre todas las pantallas en teléfono y escritorio (consola, enlaces, encimados, objetivos táctiles, botones sin efecto) |
| `herramientas/` | Generador del esquema, generador de ficticios, construcción y pruebas del sitio, pruebas y exportación |

## Cómo se prueba la base

Requiere Node 18+ y un PostgreSQL 13+ **de pruebas** (no hace falta PostGIS).

```sh
npm run esquema                                    # regenera tablas y documentación desde db/esquema.json
PGHOST=... PGPORT=... PGUSER=... npm run probar-base   # base desechable: instala, carga ficticios, pruebas de reglas, concurrencia (dos conexiones) y respaldo con restauración
```

`probar-base` se niega a correr sobre una base cuyo nombre no contenga «prueba», y se detiene en el primer
paso que falle. Los resultados de la última corrida de cada prueba están en la bitácora, bloque 50 y siguientes.

## Cómo se construye y se prueba el sitio

Requiere un clon de `SedemaOficina/estandares-sia` junto a este repositorio (el Estándar de formularios del SIA 1.5.1
vive en su carpeta `formularios/`) y `npm install` (Playwright para las pruebas). `git clone --depth 1` baja la versión
más reciente del estándar, no una fija: hay que comprobar que la primera versión de `formularios/CHANGELOG.md` sea la
1.5.1 (`construir-sitio` la anota en `sitio/formkit/LEEME.md`). Playwright necesita su navegador:
`npx playwright install chromium`, o `CHROMIUM=<ruta a un Chromium>` en cada prueba. `npm run textos` requiere Python
con `openpyxl`.

```sh
git clone --depth 1 https://github.com/SedemaOficina/estandares-sia ../estandares-sia
npm run construir-sitio -- ../estandares-sia/formularios   # copia el estándar, la versión, los ficticios y genera los documentos
npm run probar-esquemas -- ../estandares-sia/formularios   # esquemas del servidor y su validación con validar.mjs
AXE=../estandares-sia/formularios/vendor/axe-core/axe.min.js npm run probar-sitio   # sirve sitio/ en el puerto 8765 mientras dura (herramientas/con-servidor.sh); teléfono y escritorio, consola, accesibilidad, capturas
AXE=../estandares-sia/formularios/vendor/axe-core/axe.min.js npm run probar-examen  # examen en línea: aplicar.html y examen.html, de punta a punta
npm run auditar                                     # todas las pantallas en teléfono y escritorio: consola, enlaces, encimados, objetivos táctiles, botones
npm run volumen                                     # pantallas del personal con volumen real (sitio servido)
npm run verificar-esquema                           # tablas y modelo de datos generados al día con db/esquema.json
npm run pendientes -- --verificar                   # documentos generados de pendientes al día
bash herramientas/publicar-sitio.sh                 # gh-pages = sitio/ (después del commit en main)
node herramientas/construir-artefacto.mjs <carpeta> # la misma versión de prueba como artefacto de Claude
```

Cada push y cada PR corren solos en GitHub (`.github/workflows/pruebas.yml`, pestaña «Actions»): la base en un
PostgreSQL 16 desechable (`probar-base`, y que los ficticios regenerados sean los guardados), y el sitio con el
estándar 1.5.1 (que `sitio/` sea lo que construye el generador, pendientes y esquemas al día, `probar-sitio` con axe,
`probar-examen` y `probar-volumen`). Si algo falla, el commit o el PR queda en rojo. No publica: la publicación sigue
siendo `publicar-sitio.sh`, a mano. Las baterías anotan cada falla y siguen; una parte que se detiene cuenta como falla.

## Lo que este proyecto toca del SIA

- Un esquema propio, `apd`, con su cuenta de servicio `apd_api`. No lee ni copia `territorio`; no usa PostGIS.
- Las cuentas del personal de la Secretaría, en `acceso`, con el recurso `apd` [pendiente de confirmar con el SIA].
- Espacio para documentos: de 10 a 20 GB al año (archivos de hasta 5 MB; material de estudio hasta 30 MB).

## Datos ficticios

Unas 60 personas, solicitudes en todos los estados, 6 grupos (concluido, en curso, en integración —uno con fecha
propuesta— y cancelado), una persona para cada caso del menú de pruebas, citas de cotejo en cada situación, acreditaciones en todas las situaciones de vigencia y los tres documentos del
material de estudio (`datos/ficticios.json`).
Nombres con apellidos de prueba («Ejemplo», «Muestra», «Prueba», «Ficticio», «Simulado», «Modelo»);
correos `@ejemplo.local`; teléfonos de ceros; CURP formadas de su nombre y fecha ficticios con entidad `NE` (pasan las mismas comprobaciones que una real). La contraseña de las
cuentas ficticias es `Prueba-ficticia-2026`. Se generan pasando por todas las reglas de la base: si un dato ficticio
viola una regla, la carga falla.

## Licencia

Todos los derechos reservados, Secretaría del Medio Ambiente, mientras la Secretaría decide la licencia (P167). Los
componentes de terceros conservan la suya: ver `LICENCIA.md`.
