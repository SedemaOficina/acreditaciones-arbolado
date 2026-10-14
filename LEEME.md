# Sistema de Acreditaciones de Poda y Dictaminación

Control del trámite para obtener o renovar la acreditación de **poda y derribo** o de **dictaminador
técnico** de arbolado urbano de la Ciudad de México: solicitud en línea con cuenta, revisión documental,
cotejo, integración de grupos de capacitación a demanda, asistencia y examen, emisión de la acreditación,
vigencia, renovación y verificación pública.

Sustituye por completo el uso de Kobo ToolBox. Se construye para instalarse en el Sistema de Información
Ambiental (SIA) de la Secretaría del Medio Ambiente, siguiendo `docs/GUIA-PROYECTOS-SIA.md` desde el
principio.

**Versión de prueba 0.1** (archivo `VERSION`). Todos los datos de este repositorio son **ficticios**.

## Estado

| Etapa | Qué cierra | Estado |
|---|---|---|
| 0. Decisiones previas | Nueve decisiones del SIA, reglas del trámite validadas en el mapa, modelo de datos, base y datos ficticios | **Cerrada** el 14/10/2026, con pendientes que no bloquean |
| 1. Cascarón | Pantallas públicas y de la persona solicitante, con el Estándar de formularios del SIA y datos ficticios, publicadas y probadas en teléfono | Siguiente |
| 2. Administración | Revisión, cotejo, bandeja de demanda, grupos, asistencia, examen, emisión; carga del padrón de Kobo | — |
| 3. Datos reales | Backend `crearRutasApd(pool)` sobre la base | — |
| 4–6 | Trámites, indicadores, cierre y paquete para el SIA | — |

## Dónde está cada cosa

| Ruta | Contenido |
|---|---|
| `docs/DECISIONES.md` | Todas las reglas decididas, con fecha, y lo que hay que corregir en los lineamientos |
| `docs/DECISIONES-SIA.md` | Las nueve decisiones del SIA y las preguntas abiertas al SIA |
| `docs/REGLAS.md` | Qué impone la base: estados, vigencia, grupos, folios, bitácora |
| `docs/MODELO-DE-DATOS.md` | Tablas y campos (generado) |
| `docs/GUIA-PROYECTOS-SIA.md` | Guía del SIA, copia del día de inicio |
| `docs/insumos-lineamientos-borrador.txt` | Borrador de lineamientos de la Dirección de Infraestructura Verde, tal como llegó |
| `db/esquema.json` | **Fuente única del modelo de datos** |
| `db/apd/` | Guiones de instalación del esquema `apd`, en orden; `instalar.sql` los corre en una transacción |
| `datos/ficticios.json` | Expedientes ficticios exportados de la base, con sus mismas tablas (generado) |
| `herramientas/` | Generador del esquema, generador de ficticios, pruebas y exportación |

## Cómo se prueba la base

Requiere Node 18+ y un PostgreSQL 13+ **de pruebas** (no hace falta PostGIS).

```sh
npm run esquema                                    # regenera tablas y documentación desde db/esquema.json
PGHOST=... PGPORT=... PGUSER=... npm run probar-base   # base desechable: instala, carga ficticios, 61 pruebas
```

`probar-base` se niega a correr sobre una base cuyo nombre no contenga «prueba», y se detiene en el primer
paso que falle.

## Lo que este proyecto toca del SIA

- Un esquema propio, `apd`, con su cuenta de servicio `apd_api`. No lee ni copia `territorio`; no usa PostGIS.
- Las cuentas del personal de la Secretaría, en `acceso`, con el recurso `apd` [pendiente de confirmar con el SIA].
- Espacio para documentos: de 10 a 20 GB al año (archivos de hasta 5 MB).

## Datos ficticios

47 personas, 46 solicitudes en todos los estados, 4 grupos (concluido, en curso, en integración y cancelado),
21 acreditaciones en todas las situaciones de vigencia. Nombres con apellidos «Ejemplo», «Muestra», «Prueba»;
correos `@ejemplo.local`; teléfonos de ceros; CURP con prefijo `XAXX` y clave `PRUEB`. La contraseña de las
cuentas ficticias es `Prueba-2026`. Se generan pasando por todas las reglas de la base: si un dato ficticio
viola una regla, la carga falla.
