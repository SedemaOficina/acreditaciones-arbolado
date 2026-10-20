import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
for (const [ancho, mov] of [[1440, 'reduce'], [1440, 'no-preference'], [390, 'reduce'], [1280, 'reduce'], [1024,'reduce'], [800,'reduce']]) {
  for (const u of ['cuenta.html', 'index.html', 'revision.html']) {
  const { c } = await contexto(nav, { ancho, alto: 900, movimiento: mov }); const p = await c.newPage(); await p.goto(BASE + u, { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const a = document.activeElement; const b = a.getBoundingClientRect(); const cs = getComputedStyle(a); return `${a.className} top=${Math.round(b.top)} bottom=${Math.round(b.bottom)} left=${Math.round(b.left)} transform=${cs.transform} outline=${cs.outlineStyle} ${cs.outlineWidth} pos=${cs.position} scrollY=${scrollY}`; });
  console.log(ancho, mov, u, r);
  if (u === 'cuenta.html') await p.screenshot({ path: `../capturas/salto-${ancho}-${mov}.png`, clip: { x: 0, y: 0, width: ancho, height: 200 } });
  await c.close(); }
}
await nav.close();
