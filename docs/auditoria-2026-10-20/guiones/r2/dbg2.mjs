import { navegador, contexto, BASE, espera, COPIA } from './comun.mjs';
import { readFileSync } from 'node:fs';
const est = JSON.parse(readFileSync('../b1/estados-ficticios.json', 'utf8'));
const nav = await navegador();
for (const v of (process.env.VS || 'telH,tel390').split(',')) {
const c = await contexto(nav, v, { sesion: est.find((s) => s.caso === 'nueva').sesion }); const p = await c.newPage();
await p.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
await p.waitForSelector('input[name="tipo"][value="poda"]:visible:enabled');
const m = () => p.evaluate(() => { const s = [...document.querySelectorAll('section[data-paso]')].find((x) => !x.hidden); const h = s.querySelector('h2'); const bar = document.querySelector('.barra-fija'); return { scrollY: Math.round(scrollY), h2top: Math.round(h.getBoundingClientRect().top), barra: bar && [Math.round(bar.getBoundingClientRect().top), Math.round(bar.getBoundingClientRect().bottom)], foco: document.activeElement.tagName + '.' + document.activeElement.className, alto: innerHeight }; });
console.log(v, 'inicio', JSON.stringify(await m()));
await p.locator('input[name="tipo"][value="poda"]').check({ force: true });
await p.selectOption('#nivel_estudios', 'licenciatura'); await p.fill('#carrera', 'Biología'); await p.locator('input[name="estatus_estudios"][value="titulado"]').check({ force: true }); if (await p.locator('#anios_experiencia').isVisible()) await p.fill('#anios_experiencia', '3');
await p.locator('[data-accion="siguiente"]:visible').first().click(); await espera(900);
console.log(v, 'docs', JSON.stringify(await m()));
await p.screenshot({ path: `/home/claude/trabajo/evidencia-2026-10-20/r2/capturas/b6/1x-tras-continuar-${v}.png` });
await c.close(); }
await nav.close();
