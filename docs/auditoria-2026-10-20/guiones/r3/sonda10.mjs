import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
const { c } = await contexto(nav, { ancho: 1440 }); const p = await c.newPage();
await p.goto(BASE + 'aplicar.html?folio=APD-G-2026-006', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
console.log(await p.evaluate(() => [...document.querySelectorAll('[data-accion]')].map(b => `${b.dataset.accion} vis=${b.checkVisibility()} ${b.getAttribute('aria-label')}`).slice(0, 12)));
console.log(await p.evaluate(() => document.querySelector('main').innerText.slice(1200, 2600)));
await nav.close();
