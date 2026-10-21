// C5 · Reproducción de los hallazgos de textos: dos vueltas, cada comprobación en un contexto nuevo del navegador.
// Cada caso abre la pantalla, busca el texto exacto y toma una captura (vuelta 1).
//   node c5-repro.mjs → c5-repro.txt y capturas/c5-*.png
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { BASE, CHROMIUM, EVID, sesionInit } from './comun.mjs';
mkdirSync(`${EVID}/capturas`, { recursive: true });
const { casos } = JSON.parse(readFileSync(`${EVID}/c5-pantallas.json`, 'utf8'));
const persona = (k) => casos.find((c) => c.clave === k).persona;
const CASOS = [
  ['C5-01a «Mis trámites» (cita): fecha y hora en dos formas en la misma tarjeta', 'tramites.html', persona('cita'), 390, ['20/10/2026, 10:00', 'el 20/10/2026 a las 10:00']],
  ['C5-01b «Mis trámites» (grupo): «13/10/2026, a las 09:00»', 'tramites.html', persona('grupo'), 390, ['13/10/2026, a las 09:00', 'del 13 al 17 de octubre']],
  ['C5-01c Asistencia: el mismo curso como «del 13/10/2026 al 17/10/2026»', 'asistencia.html?folio=APD-G-2026-003', null, 1280, ['del 13/10/2026 al 17/10/2026']],
  ['C5-01d Grupos: «examen el sábado 17/10» (sin año) junto a «del 13 al 17 de octubre»', 'grupos.html?curso=poda-nueva', null, 1280, ['examen el sábado 17/10 en el PILARES', 'del 13 al 17 de octubre', 'Hoy es miércoles 14/10/2026']],
  ['C5-01e Programar: tres formas en la misma pantalla', 'programar.html?curso=poda-nueva', null, 1280, ['Desde el miércoles 21/10/2026', 'Lunes 2 de noviembre al viernes 6 de noviembre', 'del 2 al 6 de noviembre']],
  ['C5-01f Citas: encabezado del día en fecha larga', 'citas.html', null, 1280, ['Miércoles, 14 de octubre de 2026']],
  ['C5-02 «Mis trámites» (grupo cancelado): «En espera de curso» y «en espera de grupo» en la misma tarjeta', 'tramites.html', persona('grupo-cancelado'), 390, ['En espera de curso', 'Sigues en espera de grupo']],
  ['C5-03 Personal: nombre accesible de tú («Dónde estás…») en una pantalla de usted', 'revision.html', null, 1280, ['aria-label=Dónde estás en el trámite (versión de prueba)']],
  ['C5-04 Grupos (renovación): «Vencida el» y «vence el» en la misma lista; dos «:» seguidos', 'grupos.html?curso=poda-renovacion', null, 1280, ['Vencida el 31/07/2026', 'vence el 30/10/2026', 'El lunes ya no se puede: faltan menos de 7 días: el curso']]
];
const nav = await chromium.launch({ executablePath: CHROMIUM });
const out = [];
for (const vuelta of [1, 2]) {
  for (const [nombre, ruta, ses, ancho, buscar] of CASOS) {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, isMobile: ancho < 600, timezoneId: 'America/Mexico_City', locale: 'es-MX' });
    if (ses) await ctx.addInitScript(sesionInit, ses);
    const p = await ctx.newPage();
    await p.goto(BASE + ruta); await p.waitForLoadState('networkidle'); await p.waitForTimeout(700);
    const txt = await p.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label]')].map((e) => `aria-label=${e.getAttribute('aria-label')}`).join('\n'));
    const ok = buscar.map((b) => [b, txt.includes(b)]);
    const fila = `vuelta ${vuelta} · ${nombre}: ${ok.map(([b, s]) => `${s ? 'SÍ' : 'NO'} «${b}»`).join(' · ')}`;
    out.push(fila); console.log(fila);
    if (vuelta === 1) await p.screenshot({ path: `${EVID}/capturas/${nombre.split(' ')[0]}.png`, fullPage: true });
    await ctx.close();
  }
}
await nav.close();
writeFileSync(`${EVID}/c5-repro.txt`, out.join('\n') + '\n');
