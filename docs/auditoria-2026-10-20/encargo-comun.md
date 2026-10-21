# Auditoría de seguimiento del 20/10/2026 · Instrucciones comunes a los revisores

Eres revisor independiente de una auditoría profesional, en **solo lectura**. No construiste el proyecto. Tu trabajo
es encontrar lo que quien lo construyó ya no ve, con evidencia. Escribe en español de México, claro, para alguien que no
programa.

## El proyecto
- Sistema de Acreditaciones de Poda y Dictaminación (Secretaría del Medio Ambiente de la Ciudad de México, SEDEMA), para
  pasar al Sistema de Información Ambiental (SIA). Versión de prueba 0.61 más el PR #5, commit `d58c611`. Sitio estático
  en `sitio/` (GitHub Pages) que simula la API con datos ficticios (`sitio/datos/ficticios.json`) y guarda lo hecho en el
  navegador (localStorage e IndexedDB; `sitio/app/archivos-prueba.js`). Estándar de formularios del SIA **1.5.1** copiado
  en `sitio/formkit/`; su repositorio, con sus herramientas, está en `../estandares-sia/formularios (1.5.1)`
  (`herramientas/contraste.mjs`, `pares-contraste.json`, `auditor-css.mjs`, `capturas.mjs`, `auditar-campos.mjs`).
- Pantallas (21): de la persona solicitante, a quien se le habla **de tú** (`index`, `cuenta`, `entrar`, `tramites`,
  `datos`, `solicitud`, `corregir`, `verificar`, `material`) y del personal, a quien se le habla **de usted**
  (`revision`, `revisar`, `citas`, `cotejo`, `grupos`, `espera` (sólo redirige), `programar`, `grupo`, `asistencia`,
  `aplicar`, `examen` (lo usa la persona en el salón), `material-personal`). Hay un **menú de pruebas** (botón en cada
  pantalla) con casos ficticios por perfil (`sitio/app/casos-prueba.js`, `sitio/app/pruebas.js`) para entrar como cada
  persona; la sesión simulada es `localStorage['apd.sesion'] = JSON.stringify({ id })`.
- Volúmenes reales: el guion `herramientas/escenario-volumen.mjs` genera un escenario con 65 solicitudes por revisar, 40
  citas en un día, 112 personas en espera y grupos de 25; `herramientas/probar-volumen.mjs` muestra cómo servirlo en lugar
  de `datos/ficticios.json` (con `context.route`).
- Equipos: personas solicitantes en teléfono sobre todo; personal en computadora; el examen en las computadoras de un
  salón. No se usa en campo sin señal.
- Datos: todos ficticios. Repositorio **público**.
- Documentos que ya existen y debes leer antes de reportar (regla 12: lo ya registrado no es nuevo; cita su clave y di si
  sigue igual): `docs/PENDIENTES.md` (pendientes P02 a P172; los P126–P171 de «Estándar» son fallas del estándar
  compartido), `docs/DECISIONES.md` (decisiones y lo aceptado por el dueño, con fecha: respétalo, regla 14),
  `docs/AUDITORIA-2026-10-19.md` (auditoría de ayer y estado de sus hallazgos), `docs/AUDITORIA-2026-10-18.md`,
  `docs/AUDITORIA-2026-10-18-romper.md`, `docs/AUDITORIA-INTEGRAL-2026-10-17.md`, `docs/AUDITORIA-TAREAS-2026-10-17.md`,
  `docs/ETAPA-1-PANTALLAS.md`, `docs/ETAPA-2-PANTALLAS.md`, `docs/REGLAS.md`, `docs/textos/`.
- Pruebas que ya existen (no las repitas como hallazgo; úsalas): `herramientas/probar-sitio.mjs` (1096 comprobaciones,
  con axe a 390 y 1280 px, política de contenido, licencias), `probar-examen.mjs`, `probar-volumen.mjs`,
  `auditar-sitio.mjs` (60 pantallas × 2 tamaños, 201 botones; 2 avisos conocidos: un enlace del visor bajo el botón del
  menú de pruebas en `revisar-dictaminador` y «Ir al contenido» en `corregir`).
- Las 21 páginas declaran una política de contenido estricta (sin scripts ni estilos en línea): para inyectar código de
  prueba usa `page.evaluate(...)` o `context.addInitScript`, no `addScriptTag` con contenido.

## Tu copia y tus herramientas
- Trabajas en TU copia: `<copia propia del revisor>` (un `git worktree` desprendido en `d58c611`, con
  `node_modules` enlazado). No toques `<proyecto>` ni las copias de otros.
- Sirve el sitio en TU puerto: `python3 -m http.server <puerto> --directory sitio &` y usa la URL directa. Al terminar,
  detén ese servidor con `kill <pid>` (guarda el PID; no uses `pkill -f` con un patrón que también coincida con tu propia
  línea de comandos).
- Chromium: `CHROMIUM=/opt/pw-browsers/chromium` (Playwright: `chromium.launch({ executablePath })`). Fija
  `timezoneId: 'America/Mexico_City'`. axe-core: `../estandares-sia/formularios (1.5.1)/vendor/axe-core/axe.min.js`.
  Firefox y WebKit no están disponibles (la red bloqueó su descarga): decláralo. No hay lector de pantalla real.
- Tus guiones y salidas van a TU carpeta de evidencia: `docs/auditoria-2026-10-20/<tu clave>/`, escritos
  para repetirse en la próxima auditoría. Capturas en `capturas/` dentro de ella.

## Reglas (no se negocian)
1. Solo lectura: no edites ningún archivo del proyecto ni de tu copia (salvo los que genere el servidor). Todo se reporta;
   nada se corrige.
2. Sin evidencia no hay hallazgo: equipo o perfil, pasos, esperado y observado, y prueba (archivo:línea, comando y salida,
   captura).
3. Reproduce cada hallazgo de comportamiento **dos veces** desde un estado limpio (contexto nuevo del navegador). Si sale
   una vez: «Intermitente» con frecuencia; si no se reproduce: «No confirmado».
4. Distingue falla de la prueba y falla del sistema; ante tiempos, repite y quita esperas fijas.
5. No inventes nada. Lo no comprobado va en «Hipótesis»; lo que requiere equipo real, en «No verificable desde aquí».
6. Números, no adjetivos. Referencia externa por frente (WCAG 2.2 AA, heurísticas de Nielsen, el propio estándar 1.5.1).
7. Mide como en la realidad: volúmenes del escenario de volumen, teléfono lento simulado cuando aplique.
8. Lo ya registrado (pendientes, auditorías anteriores) no se reporta como nuevo: cita su clave y di si sigue igual. Lo
   aceptado por el dueño con fecha y motivo no se reporta.
9. Las fallas del estándar compartido (`sitio/formkit/`) se reportan aparte, como «Falla del componente compartido», con
   archivo:línea del estándar y si ya tiene clave (P152–P158, P166, P171).
10. Las decisiones son del dueño: si hay varias salidas válidas, va en «Para decidir» con opciones, costo y recomendación.
    Lo que cambia una pantalla sale como propuesta con antes y después.
11. Nada de contraseñas, direcciones internas ni datos personales reales. Nada de push, publicación ni envíos. No
    instales ni descargues herramientas.

## Gravedad
Crítica (pierde o corrompe información, dato falso, expone datos, impide la tarea principal) · Alta (rompe o distorsiona
un flujo principal) · Media (estorba, confunde o falla en un caso común; inconsistencia visible) · Baja (acabado o caso
raro) · Informativa. Esfuerzo: S (≤2 h), M (≤1 día), L (>1 día).

## Formato de cada hallazgo
Clave (código de auditoría y número, p. ej. B4-01) · Gravedad, esfuerzo · Dónde (pantalla, perfil y ancho, o archivo:línea)
· Qué pasa (esperado contra observado) · Consecuencia concreta · Cómo se reproduce · Evidencia · Reproducido (2 de 2,
intermitente x de n) · Causa probable · Corrección propuesta · Listo cuando (criterio comprobable con una prueba
automática) · Estado (Abierto, Decide el dueño, Falla del componente compartido, Ya registrado como Pnn).

## Entrega
Un archivo `informe.md` en tu carpeta de evidencia con: (1) qué hiciste (método, pantallas, anchos, perfiles, número de
pruebas, herramientas), (2) hallazgos con el formato de arriba, de más a menos graves, con totales por gravedad, (3)
verificado sin hallazgos, (4) fallas del componente compartido, (5) para decidir, (6) no verificable, hipótesis y no
confirmado, (7) pruebas que conviene dejar permanentes. Responde al terminar con un resumen de 15 líneas como máximo.
