// B4 · Franja del borrador recuperado en la solicitud: axe, orden de foco y anuncios al aparecer, con cada botón
// (recuperar, descartar → confirmar). Uso: node franja-borrador.mjs <ancho> <corrida>
import { navegador, contexto, BASE, guarda, axe } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, activo, anuncios } from './teclado-lib.mjs';
const ancho = Number(process.argv[2] || 390), corrida = process.argv[3] || '1';
const nav = await navegador();
const R = { ancho, eventos: [] }; const ev = (x) => { R.eventos.push(x); console.log(x); };
const ses = '7cfb2a2d-d797-42d4-a53c-94758ea964a9';
for (const boton of ['recuperar', 'descartar']) {
  const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion: ses });
  await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
  const p = await c.newPage();
  await p.goto(BASE + 'solicitud.html?tipo=dictaminador', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  await p.selectOption('#nivel_estudios', 'licenciatura'); await p.fill('#carrera', 'Biología'); await p.waitForTimeout(1500);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const vis = await p.evaluate(() => [...document.querySelectorAll('[data-borrador]')].filter((b) => b.checkVisibility()).map((b) => `${b.dataset.borrador}: «${b.textContent.trim()}»`));
  ev(`franja visible con: ${vis.join(' | ')}; foco al cargar: ${(await activo(p)).desc}`);
  ev(`anuncios al aparecer: ${JSON.stringify((await anuncios(p)).map((a) => `${a.tipo}: ${a.texto}`))}`);
  const v = await axe(p); ev(`axe con la franja: ${v.length ? v.map((x) => x.id).join(', ') : '0'}`);
  let t = 0; for (; t < 30; t++) { await p.keyboard.press('Tab'); const a = await activo(p); if (a.desc.includes('data-borrador') || /Recuperar|Descartar|Seguir con/.test(a.texto)) break; }
  ev(`Tabs hasta el primer botón de la franja: ${t + 1} (${(await activo(p)).desc})`);
  await p.locator(`[data-borrador="${boton}"]`).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  ev(`Enter en «${boton}» → foco ${(await activo(p)).desc}; anuncios ${JSON.stringify((await anuncios(p)).map((a) => a.texto))}`);
  const v2 = await axe(p); ev(`axe tras «${boton}»: ${v2.length ? v2.map((x) => x.id).join(', ') : '0'}`);
  if (boton === 'descartar' && await p.isVisible('[data-borrador="descartar-si"]')) {
    await p.keyboard.press('Tab'); ev(`siguiente Tab: ${(await activo(p)).desc}`);
    await p.locator('[data-borrador="descartar-si"]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    ev(`Enter en «descartar-si» → foco ${(await activo(p)).desc}`);
  }
  await p.screenshot({ path: `../capturas/franja-borrador-${boton}-${ancho}-${corrida}.png` });
  await c.close();
}
guarda(`franja-borrador-${ancho}-${corrida}.json`, R);
await nav.close();
