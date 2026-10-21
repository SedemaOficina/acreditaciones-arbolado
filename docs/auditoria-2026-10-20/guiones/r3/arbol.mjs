// B4 · Árbol de accesibilidad (lo que leería un lector de pantalla) de las pantallas de los flujos principales, con
// locator.ariaSnapshot() de Playwright 1.63 (page.accessibility ya no existe en esta versión). Uso: node arbol.mjs
import { writeFileSync } from 'node:fs';
import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
const P = [['index', 'index.html'], ['cuenta', 'cuenta.html'], ['entrar', 'entrar.html'], ['tramites-cita', 'tramites.html', 'c5f9d9aa-c874-46d3-a037-9d273f6aa2e5'], ['tramites-obs', 'tramites.html', '3a939f55-5357-4d4b-a426-7c5408f01b7c'],
  ['solicitud', 'solicitud.html?tipo=poda', '7cfb2a2d-d797-42d4-a53c-94758ea964a9'], ['revision', 'revision.html'], ['revisar', 'revisar.html?folio=APD-S-2026-00044'], ['citas', 'citas.html'], ['cotejo', 'cotejo.html?folio=APD-S-2026-00042'],
  ['grupos', 'grupos.html?curso=poda-nueva'], ['programar', 'programar.html?curso=poda-nueva'], ['asistencia', 'asistencia.html?folio=APD-G-2026-003'], ['aplicar', 'aplicar.html?folio=APD-G-2026-006'], ['examen', 'examen.html'], ['verificar', 'verificar.html']];
for (const [n, u, s] of P) {
  const { c } = await contexto(nav, { ancho: 1440, alto: 900, sesion: s }); const p = await c.newPage();
  await p.goto(BASE + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const y = await p.locator('body').ariaSnapshot();
  writeFileSync(`../arbol/${n}.yml`, y);
  console.log(n, y.split('\n').length, 'líneas');
  await c.close();
}
await nav.close();
