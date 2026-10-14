# Sistema de Acreditaciones de Poda y Dictaminación · Decisiones para el SIA

Las nueve decisiones que se toman antes de programar (`docs/GUIA-PROYECTOS-SIA.md`, sección 2). Cada
respuesta con su fecha y quién la tomó; lo que falta, marcado como pendiente.

| # | Decisión | Respuesta | Fecha y quién |
|---|---|---|---|
| 1 | Siglas (esquema, cuenta `apd_api`, ruta, variables) | `apd` (Acreditación de Podadores y Dictaminadores). Variables `APD_DB_USER` y `APD_DB_PASS`. Confirmadas con el SIA: **pendiente** | 2026-10-14 · Liber Saltijeral |
| 2 | ¿Estático o con backend? | Con backend: escribe solicitudes, guarda documentos y lleva cuentas | 2026-10-14 · Liber Saltijeral |
| 3 | ¿Quién entra? | **Solicitantes:** siempre con cuenta propia en el esquema `apd`, creada por ellos mismos; identificador único: CURP. **Personal de la Secretaría** (revisión, cotejo, instructores, emisión, consulta): cuentas del esquema `acceso` del SIA. **Público:** verificación de acreditaciones sin cuenta. Quién opera los restablecimientos de contraseña de solicitantes: **pendiente** | 2026-10-14 · Liber Saltijeral |
| 4 | Capas | Ninguna. El domicilio se captura con el módulo de código postal del Estándar de formularios; no se cruza con `territorio` | 2026-10-14 · Liber Saltijeral |
| 5 | Datos personales | **Pendiente.** Se recaban identificación oficial, CURP, comprobante de domicilio, constancia de situación fiscal, comprobantes de estudios y experiencia, currículum. Aviso de privacidad o constancia de la Unidad de Transparencia antes del primer dato real | 2026-10-14 · Liber Saltijeral |
| 6 | Archivos | Sí. PDF, JPG o PNG, hasta 5 MB cada uno: de 8 a 12 por solicitud nueva y de 2 a 4 por renovación. Con 1,000 solicitudes al año: **de 10 a 20 GB al año** fuera de lo publicado (tope teórico, si todo llegara al máximo: 60 GB) | 2026-10-14 · Liber Saltijeral |
| 7 | Volumen | 1,000 solicitudes al año. Documentos de uno en uno, organizados por solicitud. La migración del registro de Kobo, por tandas | 2026-10-14 · Liber Saltijeral |
| 8 | ¿Se usa sin señal? | No: siempre con conexión | 2026-10-14 · Liber Saltijeral |
| 9 | Repositorio | `SedemaOficina/acreditaciones-arbolado`, público, sólo con datos ficticios, sin direcciones ni credenciales. La versión de prueba de la parte visible se publica con GitHub Pages | 2026-10-14 · Liber Saltijeral |

## Versión

Versión actual (archivo `VERSION`): `0.1` — de prueba hasta que el SIA lo instale; la primera instalación
es `1`. Visible siempre en la interfaz (`docs/GUIA-PROYECTOS-SIA.md`, sección 8).

## Preguntas abiertas para el SIA

1. **¿Hay un servicio de envío de correo institucional que el módulo pueda usar?** Es la pregunta de mayor
   peso del proyecto: sin correo no hay confirmación de cuenta, ni recuperación de contraseña sin intervención
   del personal, ni avisos automáticos de observaciones, cita, calificación o vencimiento.
2. ¿Están libres las siglas `apd` para el esquema, la cuenta y la ruta?
3. ¿Dónde se publica la aplicación, y su API va bajo `/api/apd` o bajo la ruta de la aplicación?
4. ¿Cuál es el límite de subida para la API? (El proyecto necesita al menos 5 MB por archivo.)
5. Cuentas del personal: ¿se dan de alta como recurso `apd` en `acceso`, con cinco perfiles (revisión,
   cotejo, instructor, emisión, consulta)? Las cuentas de solicitantes van en esquema propio.
6. ¿Cuánto espacio hay para archivos y dónde? Se piden de 10 a 20 GB al año.
7. Más adelante se conectará un sistema de examen en línea (salones de cómputo) que escribirá calificaciones en esta base: ¿con su propia cuenta de servicio o por la API del módulo?

## Respuestas del SIA

| Pregunta | Respuesta | Fecha |
|---|---|---|
| | | |
