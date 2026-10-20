import { navegador, contexto, BASE, datos } from './lib.mjs';
import { PDF } from './teclado-lib.mjs';
const nav = await navegador();
const s = datos.solicitud.find((x) => x.folio === 'APD-S-2026-00052');
for (let i = 0; i < 4; i++) {
  const { c } = await contexto(nav, { ancho: i % 2 ? 1440 : 390, sesion: s.solicitante_id }); const p = await c.newPage();
  await p.goto(BASE + 'corregir.html?folio=' + s.folio, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const info = await p.evaluate(() => [...document.querySelectorAll('button.zona-carga')].map(b => `${b.textContent.trim()} vis=${b.checkVisibility()} dis=${b.disabled} campo=${b.closest('[data-campo]')?.dataset.campo}`));
  const b = p.locator('button.zona-carga:visible').first();
  await b.focus();
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.keyboard.press('Enter')]);
  console.log(i, info, 'filechooser:', Boolean(fc), 'activo:', await p.evaluate(() => document.activeElement.textContent.trim().slice(0, 40)));
  if (fc) { await fc.setFiles(PDF('x')); await p.waitForTimeout(800); console.log('  tras cargar foco:', await p.evaluate(() => document.activeElement.outerHTML.slice(0, 100))); }
  await c.close();
}
await nav.close();
