// B4 · Reproducción: en computadora, el visor de «Revisar una solicitud» y «Atender una cita» es un panel no modal al
// final del documento. Al abrir un documento con Enter el foco va a las hojas del visor; para decidir ese documento hay
// que volver con muchos Tab. Uso: node repro-visor-escritorio.mjs <corrida>
import { navegador, contexto, BASE, guarda } from './lib.mjs';
import { registroDeFoco, activo } from './teclado-lib.mjs';
const corrida = process.argv[2] || '1';
const nav = await navegador();
const R = [];
for (const [pag, url, decision] of [['revisar', 'revisar.html?folio=APD-S-2026-00044', 'decision_'], ['cotejo', 'cotejo.html?folio=APD-S-2026-00042', 'coincide_']]) {
  for (const ancho of [1440, 1280, 390]) {
    const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900 }); await c.addInitScript(registroDeFoco);
    const p = await c.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    if (await p.isVisible('[data-atender-simulada]')) { await p.locator('[data-atender-simulada]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
    if (pag === 'cotejo') { for (const [n, v] of [['se_presento', 'si'], ['identidad', 'misma']]) { await p.locator(`input[name="${n}"][value="${v}"]`).focus(); await p.keyboard.press('Space'); } }
    // Tab hasta el primer botón de ver documento
    let t = 0, a; for (; t < 80; t++) { await p.keyboard.press('Tab'); a = await activo(p); if (/^(Ver documento|Ver lo que cargó)/.test(a.texto)) break; }
    const doc = await p.evaluate(() => document.activeElement.dataset.ver || document.activeElement.dataset.cotejarVer || '');
    await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    const alAbrir = await activo(p);
    const modal = await p.evaluate(() => { const d = document.querySelector('dialog[data-visor]'); return d ? `${d.open ? 'abierto' : 'cerrado'}${d.matches(':modal') ? ', modal' : ', no modal'}` : 'sin visor'; });
    await p.screenshot({ path: `../capturas/visor-foco-${pag}-${ancho}-${corrida}.png` });
    // Escape con el foco donde quedó
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const trasEsc = await activo(p);
    const sigueAbierto = await p.evaluate(() => { const d = document.querySelector('dialog[data-visor]'); return d ? d.open : null; });
    // Desde ahí, Tab hasta la primera opción de decisión de la página
    let k = 0; for (; k < 150; k++) { await p.keyboard.press('Tab'); const b = await activo(p); if (b.type === 'radio' && b.name && b.name.startsWith(decision)) break; }
    const r = { pag, ancho, tabsHastaVer: t + 1, doc, alAbrir: alAbrir.desc, visor: modal, escape: trasEsc.desc, abiertoTrasEscape: sigueAbierto, tabsHastaDecidir: k + 1 };
    R.push(r); console.log(JSON.stringify(r));
    await c.close();
  }
}
guarda(`repro-visor-escritorio-${corrida}.json`, R);
await nav.close();
