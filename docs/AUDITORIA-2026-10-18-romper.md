# Auditoría «intentar romperlo» · 2026-10-18 (versión de prueba 0.55)

Cuatro revisores independientes, sin cambiar nada, trataron de romper el sistema: doble clic, dos pestañas, recargar y
«Atrás», datos raros, archivos dañados o en el límite, navegador sin almacenamiento o lleno, datos guardados viejos.
Cada hallazgo se reprodujo dos veces. Informes completos, con pasos, evidencia, causa y propuesta: `docs/auditoria-romper/`.

| Frente | Informe | Altos | Medios | Bajos |
|---|---|---|---|---|
| 1. Persona solicitante | `F1-persona.md` | 6 | 4 | 3 |
| 2. Revisión, citas y cotejo | `F2-revision-cotejo.md` | 7 | 4 | 3 |
| 3. Grupos, programar, asistencia y examen | `F3-grupos-examen.md` | 1 | 9 | 11 |
| 4. Datos, navegador, material y menú de pruebas | `F4-datos-navegador.md` | 8 | 7 | 7 |
| **Total** | | **22** | **24** | **24** |

## Tres familias de errores

1. **Errores de lógica que pasarían al sistema real** (se corrigen ya): fecha pegada «2026-10-20» que se vuelve
   20/02/6102 (estándar, `guiaFechaDma`); atender una cita que todavía no llega; retomar una pausa sin el documento
   nuevo; el reenvío no guarda estudios, experiencia ni adscripción corregidos; «Mi perfil» propone datos viejos; la
   clasificación de la carrera no se guarda; el material de 26 a 30 MB se rechaza; PDF con contraseña aceptado; y los
   medios de grupos y asistencia (F3 M3 a M9).
2. **Dos pestañas o dos personas a la vez** (en el sistema real los detiene la base y la API, pero la versión de prueba
   los deja pasar y anuncia éxitos falsos): solicitud enviada a nombre de otra sesión o sin sesión; dos solicitudes
   activas del mismo tipo; una pestaña vieja que deshace una validación; folio fiscal repetido; mismo expediente para
   dos personas; grupo sobrescrito desde otra pestaña.
3. **Guardados que fallan sin avisar** (sólo en la versión de prueba): con el almacenamiento del navegador bloqueado o
   lleno, casi todas las pantallas dicen «Quedó guardado»; un registro dañado hace que se vean sólo los ficticios.

## Estado de las correcciones

| Bloque | Qué | Dónde se registró |
|---|---|---|
| 1 | Errores de lógica (F1 5 a 13; F2 A1, A6, A7, M2 a M4, B1 a B3; F3 M3 a M5, M7 a M9, B1 a B9, B11; F4 A7, M4 a M7, B1, B2, B4 a B7) | `BITACORA-PROYECTO.md`, bloque 75; `DECISIONES.md` |
| 2 | Dos pestañas, dos personas y doble clic (F1 1 a 4; F2 A2 a A5, M1; F3 A1, M1, M2, M6, B10) | `BITACORA-PROYECTO.md`, bloque 76; `DECISIONES.md` |
| 3 | Guardados que fallan sin avisar y registros dañados: **resueltos F4 A1 a A6, A8, M1 a M3 y B3** (2026-10-19) | `BITACORA-PROYECTO.md`, bloque 77; `DECISIONES.md`; detalle en `auditoria-romper/F4-datos-navegador.md`, «Estado» |

