import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
const res = { enter: 0, space: 0, n: 0, fallos: [] };
for (let i = 0; i < 10; i++) {
  for (const tecla of ['Enter', 'Space']) {
    const { c } = await contexto(nav, { ancho: i % 2 ? 390 : 1440, alto: 900 }); const p = await c.newPage();
    await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' });
    await p.locator('button.zona-carga').first().focus();
    const desc = await p.evaluate(() => document.activeElement.textContent.trim());
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.keyboard.press(tecla)]);
    if (fc) res[tecla === 'Enter' ? 'enter' : 'space']++; else res.fallos.push(`${i} ${tecla} ${desc}`);
    await c.close();
  }
  res.n++;
}
console.log(JSON.stringify(res));
await nav.close();
