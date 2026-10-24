# Sistema de Acreditaciones de Poda y Dictaminación · Decisiones para el SIA

Las nueve decisiones que se toman antes de programar (`docs/GUIA-PROYECTOS-SIA.md`, sección 2). Cada
respuesta con su fecha y quién la tomó; lo que falta, marcado como pendiente.

| # | Decisión | Respuesta | Fecha y quién |
|---|---|---|---|
| 1 | Siglas (esquema, cuenta `apd_api`, ruta, variables) | `apd` (Acreditación de Podadores y Dictaminadores). Variables `APD_DB_USER` y `APD_DB_PASS`. Confirmadas con el SIA: **pendiente** | 2026-10-14 · Liber Saltijeral |
| 2 | ¿Estático o con backend? | Con backend: escribe solicitudes, guarda documentos y lleva cuentas | 2026-10-14 · Liber Saltijeral |
| 3 | ¿Quién entra? | **Solicitantes:** siempre con cuenta propia en el esquema `apd`, creada por ellos mismos; identificador único: CURP. **Personal de la Secretaría** (revisión y cotejo, instructores, emisión, consulta, administración): cuentas del esquema `acceso` del SIA. **Público:** verificación de acreditaciones sin cuenta. Restablecimiento de contraseñas de solicitantes: por correo, con un enlace de un solo uso (P23; el sistema no se lanza sin correo, decisión 2026-10-17) | 2026-10-14 · Liber Saltijeral |
| 4 | Capas | Ninguna. No se captura domicilio ni ubicación. El comprobante de domicilio se pide siempre, sólo como documento (P03: Liber, sesión de trabajo del 23/10/2026, deja sin efecto la corrección 13). No se cruza con `territorio` | 2026-10-14 · Liber Saltijeral |
| 5 | Datos personales | **Pendiente.** Se recaban identificación oficial, CURP, comprobante de domicilio, constancia de situación fiscal, estudios declarados, comprobantes de estudios y experiencia, currículum, adscripción, dos fotografías (la de la cuenta y la de la credencial, P50) y la factura del pago que emite la Secretaría. Aviso de privacidad o constancia de la Unidad de Transparencia antes del primer dato real | 2026-10-14 · Liber Saltijeral |
| 6 | Archivos | Sí. Documentos sólo en PDF y fotografías en JPG o PNG, hasta 5 MB cada uno: de 8 a 12 por solicitud nueva y de 2 a 4 por renovación; y el material de estudio, que sube el personal: 3 PDF, hoy unos 13.5 MB, hasta 30 MB cada uno. Con 1,000 solicitudes al año: **de 10 a 20 GB al año** fuera de lo publicado (tope teórico, si todo llegara al máximo: 60 GB) | 2026-10-14 · Liber Saltijeral |
| 7 | Volumen | 1,000 solicitudes al año. Documentos de uno en uno, organizados por solicitud. La migración del registro de Kobo, por tandas | 2026-10-14 · Liber Saltijeral |
| 8 | ¿Se usa sin señal? | No: siempre con conexión | 2026-10-14 · Liber Saltijeral |
| 9 | Repositorio | `SedemaOficina/acreditaciones-arbolado`, público, sólo con datos ficticios, sin direcciones ni credenciales. La versión de prueba de la parte visible se publica con GitHub Pages | 2026-10-14 · Liber Saltijeral |

## Versión

Versión actual: la del archivo `VERSION` (historial en `docs/VERSIONES.md`) — de prueba hasta
que el SIA lo instale; la primera instalación es `1`. Visible siempre en la interfaz (`docs/GUIA-PROYECTOS-SIA.md`, sección 8).

## Preguntas abiertas para el SIA

1. **¿Hay un servicio de envío de correo institucional que el módulo pueda usar?** Es la pregunta de mayor
   peso del proyecto y condición de lanzamiento (decisión 2026-10-17): sin correo no hay confirmación de cuenta,
   ni recuperación de contraseña, ni avisos de observaciones, cita, grupo o vencimiento (`docs/AVISOS-POR-CORREO.md`).
2. ¿Están libres las siglas `apd` para el esquema, la cuenta y la ruta?
3. ¿Dónde se publica la aplicación, y su API va bajo `/api/apd` o bajo la ruta de la aplicación?
4. ¿Cuál es el límite de subida para la API? (El proyecto necesita 5 MB por documento de la persona y hasta 30 MB por PDF
   de material de estudio, que sube el personal.)
5. Cuentas del personal: ¿se dan de alta como recurso `apd` en `acceso`, con cinco perfiles (revisión y cotejo,
   instructor, emisión, consulta y administración: parámetros, montos, cupos, desbloqueos y correcciones con motivo)?
   Las cuentas de solicitantes van en esquema propio (P27).
6. ¿Cuánto espacio hay para archivos y dónde? Se piden de 10 a 20 GB al año.
7. El examen en línea (prototipo construido, salón de cómputo del PILARES) escribirá calificaciones en esta base: ¿por
   la API del módulo (recomendado, P29) o con su propia cuenta de servicio?
8. ¿Cómo se programa cada noche la tarea que cierra las citas en pausa no retomadas, `apd.cerrar_pausas_vencidas()`
   (cron del servidor o pg_cron, con la cuenta del servicio)? (P80)
9. ¿Cuál es el formato exacto de la contraseña derivada que usa el esquema `acceso`, para usar el mismo? (P30)
10. El cambio de correo en «Mi perfil» envía un enlace de confirmación al correo nuevo y un aviso al anterior (aviso
    C3): ¿lo cubre el mismo servicio de correo? (P55)

## Respuestas del SIA

| Pregunta | Respuesta | Fecha |
|---|---|---|
| | | |
