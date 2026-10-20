// B1 · Reproducción de cada hallazgo, dos veces, cada una en un contexto nuevo (regla 3 del encargo).
// Uso: node b1-repro.mjs      Salida: <evidencia>/b1/repro.json y capturas/b1/repro-*.png
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, navegador, contexto, carpeta, espera } from './comun.mjs';

const SAL = carpeta('b1');
const CAP = carpeta('capturas', 'b1');
const nav = await navegador();
const salida = {};
async function caso(nombre, fn) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  salida[nombre] = [];
  for (const r of [1, 2]) { let x; try { x = await fn(r); } catch (e) { x = { errorDeLaPrueba: e.message.split('\n')[0] }; } salida[nombre].push(x); console.log(nombre, r, JSON.stringify(x).slice(0, 500)); }
}
// Recorre con Tab y devuelve los controles cuyo foco queda tapado ≥ 99 % por un elemento fijo o pegajoso
async function tabTapados(p, max = 120) {
  const tapados = [];
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const t = await p.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const b = el.matches('input[type=checkbox],input[type=radio]') && el.closest('label') ? el.closest('label').getBoundingClientRect() : el.getBoundingClientRect();
      let tap = 0; const quien = [];
      for (const f of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(f); if (!(cs.position === 'fixed' || cs.position === 'sticky') || f.contains(el) || cs.display === 'none') continue;
        const fb = f.getBoundingClientRect(); const w = Math.min(b.right, fb.right) - Math.max(b.left, fb.left); const h = Math.min(b.bottom, fb.bottom) - Math.max(b.top, fb.top);
        if (w > 0 && h > 0) { tap += w * h; quien.push(f.className); }
      }
      return { el: `${el.tagName.toLowerCase()} «${(el.getAttribute('aria-label') || el.closest('label')?.innerText || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50)}»`, frac: Math.round(Math.min(1, tap / (b.width * b.height)) * 100), quien: [...new Set(quien)].join(', ') };
    });
    if (t && t.frac >= 99) tapados.push(t);
  }
  return tapados;
}

await caso('B1-01 foco oculto por la barra del planeador (Grupos)', async (r) => {
  const out = {};
  for (const [vista, datos] of [['escritorio', 'ficticios'], ['escritorio', 'volumen'], ['tableta', 'ficticios'], ['telH', 'ficticios']]) {
    const c = await contexto(nav, vista, { datos });
    const p = await c.newPage();
    await p.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await espera(600);
    const t = await tabTapados(p);
    if (t.length && r === 1) {
      // Se vuelve a enfocar el primero tapado para la captura
      await p.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await espera(600);
      for (let i = 0; i < 120; i++) { await p.keyboard.press('Tab'); const ok = await p.evaluate((n) => (document.activeElement.closest('label')?.innerText || '').includes(n), t[0].el.match(/«(.{0,20})/)[1].trim()); if (ok) break; }
      await p.screenshot({ path: join(CAP, `repro-B1-01-${vista}-${datos}.png`) });
    }
    out[`${vista}/${datos}`] = { tapadosPorCompleto: t.length, ejemplos: t.slice(0, 3) };
    await c.close();
  }
  return out;
});

await caso('B1-02 barra de cupo vacía en un grupo cancelado', async (r) => {
  const out = {};
  for (const vista of ['escritorio', 'tel390']) {
    const c = await contexto(nav, vista); const p = await c.newPage();
    await p.goto(BASE + 'grupo.html?folio=APD-G-2026-002', { waitUntil: 'networkidle' }); await espera(600);
    out[vista] = await p.evaluate(() => { const d = document.querySelector('[data-cupo]'); const b = d.getBoundingClientRect(); return { hidden: d.hidden, display: getComputedStyle(d).display, alto: Math.round(b.height), ancho: Math.round(b.width), texto: d.innerText.trim(), estado: (document.querySelector('.estado') || {}).innerText }; });
    if (r === 1) { await p.locator('[data-cupo]').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(CAP, `repro-B1-02-${vista}.png`) }); }
    await c.close();
  }
  return out;
});


// Recorre con Tab y devuelve los controles tapados en parte (25 % a 98 %) por el botón «Menú de pruebas»
async function tabMenu(p, max = 100) {
  const vistos = new Map();
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const t = await p.evaluate(() => {
      const el = document.activeElement; const m = document.querySelector('.menu-pruebas-boton'); if (!el || !m || el === m) return null;
      const b = el.getBoundingClientRect(); const fb = m.getBoundingClientRect();
      const w = Math.min(b.right, fb.right) - Math.max(b.left, fb.left); const h = Math.min(b.bottom, fb.bottom) - Math.max(b.top, fb.top);
      return w > 0 && h > 0 ? { el: (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 50), frac: Math.round(w * h / (b.width * b.height) * 100) } : null;
    });
    if (t && t.frac >= 25) vistos.set(t.el, t.frac);
  }
  return [...vistos].map(([el, frac]) => ({ el, frac }));
}
await caso('B1-03 el botón «Menú de pruebas» tapa en parte controles enfocados', async (r) => {
  const out = {};
  for (const [vista, url, datos] of [['tel390', 'programar.html?curso=poda-nueva', 'ficticios'], ['escritorio', 'revision.html', 'volumen'], ['telH', 'examen.html', 'ficticios']]) {
    const c = await contexto(nav, vista, { datos }); const p = await c.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle' }); await espera(600);
    out[`${vista} ${url} ${datos}`] = await tabMenu(p);
    await c.close();
  }
  return out;
});
await caso('B1-04 «Corregir otro día» mide menos de 44 px de alto', async () => {
  const out = {};
  for (const vista of ['tel390', 'escritorio']) {
    const c = await contexto(nav, vista); const p = await c.newPage();
    await p.goto(BASE + 'asistencia.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' }); await espera(600);
    out[vista] = await p.evaluate(() => { const s = document.querySelector('.asis-otro-dia > summary'); const b = s.getBoundingClientRect(); const o = getComputedStyle(document.documentElement).getPropertyValue('--objetivo-min'); return { alto: Math.round(b.height * 10) / 10, ancho: Math.round(b.width), objetivoMin: o.trim() }; });
    await c.close();
  }
  return out;
});
await caso('C-01 barra de pasos pegajosa en poca altura (Documentos de la solicitud)', async () => {
  const out = {};
  for (const vista of ['telH', 'zoom200', 'tel390', 'escritorio']) {
    const c = await contexto(nav, vista, { sesion: '49bf7af8-a3c7-4375-a792-4a11fd78deec' }); const p = await c.newPage();
    await p.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
    await p.waitForSelector('input[name="tipo"][value="poda"]:visible:enabled');
    await p.locator('input[name="tipo"][value="poda"]').check({ force: true });
    await p.selectOption('#nivel_estudios', 'licenciatura'); await p.fill('#carrera', 'Biología');
    await p.locator('input[name="estatus_estudios"][value="titulado"]').check({ force: true });
    if (await p.locator('#anios_experiencia').isVisible()) await p.fill('#anios_experiencia', '3');
    await p.locator('[data-accion="siguiente"]:visible').first().click(); await espera(900);
    await p.evaluate(() => window.scrollBy(0, 600)); await espera(300);
    out[vista] = await p.evaluate(() => { const b = document.querySelector('.barra-fija').getBoundingClientRect(); return { alto: innerHeight, barra: [Math.round(b.top), Math.round(b.bottom)], pegada: Math.round(b.top) <= 1, porcentaje: Math.round(Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(0, b.top)) / innerHeight * 100) }; });
    if (vista === 'telH') await p.screenshot({ path: join(CAP, 'repro-C-01-telH.png') });
    await c.close();
  }
  return out;
});

await caso('B1-05 asistencia a 360 px: la columna del nombre invade la de «Asistió»', async (r) => {
  const out = {};
  for (const vista of ['tel360', 'tel390']) {
    const c = await contexto(nav, vista); const p = await c.newPage();
    await p.goto(BASE + 'asistencia.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' }); await espera(600);
    out[vista] = await p.evaluate(() => {
      const f = document.querySelector('.asistencia-fila'); const R = (e) => e.getBoundingClientRect();
      const asis = [...f.querySelectorAll('label, span, button')].filter((e) => e.offsetParent && /^Asisti/.test((e.innerText || '').trim())).sort((a, b) => R(b).width * R(b).height - R(a).width * R(a).height)[0];
      const cruce = (a, b) => { const x = Math.min(R(a).right, R(b).right) - Math.max(R(a).left, R(b).left); const y = Math.min(R(a).bottom, R(b).bottom) - Math.max(R(a).top, R(b).top); return x > 0 && y > 0 ? `${Math.round(x)}×${Math.round(y)} px` : 'no'; };
      const chip = f.querySelector('.estado');
      return { asistioEmpiezaEn: Math.round(R(asis).left), nombreTerminaEn: Math.round(R(f.querySelector('.asis-nombre')).right), nombreXAsistio: cruce(f.querySelector('.asis-nombre'), asis), chipXAsistio: chip ? cruce(chip, asis) : 'sin aviso' };
    });
    if (r === 1) { await p.locator('.asistencia-fila').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: join(CAP, `repro-B1-05-${vista}.png`) }); }
    await c.close();
  }
  return out;
});

await caso('C-02 bandeja de revisión: desborde horizontal a 768 y 844 px por un «solo-lector» absoluto', async (r) => {
  const out = {};
  for (const [vista, datos] of [['tableta', 'ficticios'], ['telH', 'ficticios'], ['tableta', 'volumen'], ['tel390', 'ficticios'], ['escritorio', 'ficticios']]) {
    const c = await contexto(nav, vista, { datos }); const p = await c.newPage();
    await p.goto(BASE + 'revision.html', { waitUntil: 'networkidle' }); await espera(600);
    out[`${vista}/${datos}`] = await p.evaluate(() => {
      const de = document.documentElement; const s = [...document.querySelectorAll('.tabla-marco .solo-lector')].sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      return { documento: de.scrollWidth, ancho: de.clientWidth, innerWidth, sobra: de.scrollWidth - de.clientWidth, soloLectorHasta: s ? Math.round(s.getBoundingClientRect().right) : null, texto: s && s.textContent, marcoPosicion: getComputedStyle(document.querySelector('.tabla-marco')).position };
    });
    if (r === 1 && vista === 'tableta' && datos === 'ficticios') { await p.evaluate(() => window.scrollTo(400, 0)); await p.screenshot({ path: join(CAP, 'repro-C-02-tableta-desplazada.png') }); }
    await c.close();
  }
  return out;
});

writeFileSync(join(SAL, 'repro.json'), JSON.stringify(salida, null, 1));
await nav.close();
