import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
for (const [u, vol] of [['index.html'], ['examen.html']]) {
  const { c } = await contexto(nav, { ancho: 390 }); const p = await c.newPage(); await p.goto(BASE + u, { waitUntil: 'networkidle' });
  console.log(u, await p.evaluate(() => [...document.querySelectorAll('main p')].filter(e => e.checkVisibility()).slice(0, 6).map(e => getComputedStyle(e).fontSize + ' .' + e.className + ' «' + e.textContent.trim().slice(0, 50) + '»')));
  await c.close();
}
for (const u of ['revisar.html?folio=APD-S-2026-00044', 'cotejo.html?folio=APD-S-2026-00042', 'grupos.html?curso=poda-nueva']) {
  const { c } = await contexto(nav, { ancho: 320 }); const p = await c.newPage(); await p.goto(BASE + u, { waitUntil: 'networkidle' });
  await p.evaluate(() => { const h = new CSSStyleSheet(); h.replaceSync('*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, h]; });
  await p.waitForTimeout(300);
  console.log(u, await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.right > 321 && el.checkVisibility() && ![...el.children].some(ch => ch.getBoundingClientRect().right > 321)) out.push(`${el.tagName}.${el.className} «${el.textContent.trim().slice(0, 40)}» right=${Math.round(b.right)} ls=${getComputedStyle(el).letterSpacing}`); } return out.slice(0, 6); }));
  await p.screenshot({ path: `../capturas/espaciado-320-${u.split('.')[0]}.png` });
  await c.close();
}
await nav.close();
