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
| 2. Administración | Revisión, cotejo, bandeja de demanda, grupos, asistencia, examen, emisión; carga del padrón de Kobo | **En construcción**: revisión documental, citas y cotejo, prototipo del examen; faltan grupos y asistencia, emisión y entrega, y carga del padrón de Kobo (`docs/ETAPA-2-PANTALLAS.md`) |
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
| `sitio/` | Versión de prueba de las pantallas de la persona solicitante y del personal (se publica tal cual en GitHub Pages) |
| `sitio/formkit/` | Copia sin cambios del Estándar de formularios del SIA 1.3.1 (`SedemaOficina/estandares-sia`, carpeta `formularios/`; generada) |
| `db/esquemas-formularios/` | Esquema de cada formulario para la validación en el servidor (generado del HTML) |
| `docs/ETAPA-1-PANTALLAS.md` | Pantallas, archivos del estándar, configuración, validación en el servidor y lista de cierre |
| `docs/ETAPA-2-PANTALLAS.md` | Pantallas del personal (revisión, citas, cotejo, examen), sus reglas, formularios y lo que falta |
| `docs/AVISOS-POR-CORREO.md` | Catálogo de avisos por correo a la persona y a la Dirección (condición de lanzamiento, P23) |
| `docs/BITACORA-PROYECTO.md` | Bitácora del proyecto por bloques, con los resultados de cada corrida de pruebas |
| `maquetas/` | Maquetas aprobadas de cada pantalla (registro de diseño) |
| `verificacion/capturas/` | Capturas de las pruebas del sitio en teléfono y escritorio |
| `verificacion/auditoria/` | Resultado de `herramientas/auditar-sitio.mjs`: recorre todas las pantallas en teléfono y escritorio (consola, enlaces, encimados, objetivos táctiles, botones sin efecto) |
| `herramientas/` | Generador del esquema, generador de ficticios, construcción y pruebas del sitio, pruebas y exportación |

## Cómo se prueba la base

Requiere Node 18+ y un PostgreSQL 13+ **de pruebas** (no hace falta PostGIS).

```sh
npm run esquema                                    # regenera tablas y documentación desde db/esquema.json
PGHOST=... PGPORT=... PGUSER=... npm run probar-base   # base desechable: instala, carga ficticios y corre las pruebas de reglas
```

`probar-base` se niega a correr sobre una base cuyo nombre no contenga «prueba», y se detiene en el primer
paso que falle. Los resultados de la última corrida de cada prueba están en la bitácora, bloque 50 y siguientes.

## Cómo se construye y se prueba el sitio

Requiere un clon de `SedemaOficina/estandares-sia` junto a este repositorio (el Estándar de formularios del SIA 1.3.1
vive en su carpeta `formularios/`) y `npm install` (Playwright para las pruebas).

```sh
git clone --depth 1 https://github.com/SedemaOficina/estandares-sia ../estandares-sia
npm run construir-sitio -- ../estandares-sia/formularios   # copia el estándar, la versión, los ficticios y genera los documentos
npm run probar-esquemas -- ../estandares-sia/formularios   # esquemas del servidor y su validación con validar.mjs
(cd sitio && python3 -m http.server 8765) &         # cualquier servidor estático
AXE=../estandares-sia/formularios/vendor/axe-core/axe.min.js npm run probar-sitio   # teléfono y escritorio, consola, accesibilidad, capturas
AXE=../estandares-sia/formularios/vendor/axe-core/axe.min.js npm run probar-examen  # examen en línea: aplicar.html y examen.html, de punta a punta
npm run auditar                                     # todas las pantallas en teléfono y escritorio: consola, enlaces, encimados, objetivos táctiles, botones
bash herramientas/publicar-sitio.sh                 # gh-pages = sitio/ (después del commit en main)
node herramientas/construir-artefacto.mjs <carpeta> # la misma versión de prueba como artefacto de Claude
```

## Lo que este proyecto toca del SIA

- Un esquema propio, `apd`, con su cuenta de servicio `apd_api`. No lee ni copia `territorio`; no usa PostGIS.
- Las cuentas del personal de la Secretaría, en `acceso`, con el recurso `apd` [pendiente de confirmar con el SIA].
- Espacio para documentos: de 10 a 20 GB al año (archivos de hasta 5 MB).

## Datos ficticios

Unas 50 personas, solicitudes en todos los estados, 4 grupos (concluido, en curso, en integración y cancelado),
citas de cotejo en cada situación y acreditaciones en todas las situaciones de vigencia (`datos/ficticios.json`).
Nombres con apellidos de prueba («Ejemplo», «Muestra», «Prueba», «Ficticio», «Simulado», «Modelo»);
correos `@ejemplo.local`; teléfonos de ceros; CURP formadas de su nombre y fecha ficticios con entidad `NE` (pasan las mismas comprobaciones que una real). La contraseña de las
cuentas ficticias es `Prueba-ficticia-2026`. Se generan pasando por todas las reglas de la base: si un dato ficticio
viola una regla, la carga falla.
