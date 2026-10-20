import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
const { c } = await contexto(nav, { ancho: 1440 }); const p = await c.newPage();
await p.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' });
console.log(await p.evaluate(() => [...document.querySelectorAll('.sesion-enlaces a, .sesion-enlaces button')].map(a => `${a.textContent.trim()} cur=${a.getAttribute('aria-current')} w=${getComputedStyle(a).fontWeight} c=${getComputedStyle(a).color} deco=${getComputedStyle(a).textDecorationLine}`)));
await p.locator('.sesion-enlaces').screenshot({ path: '../capturas/enlace-actual-1440.png' });
const s = await c.newCDPSession(p); await s.send('Emulation.setEmulatedVisionDeficiency', { type: 'achromatopsia' });
await p.locator('.sesion-enlaces').screenshot({ path: '../capturas/enlace-actual-gris-1440.png' });
await nav.close();
