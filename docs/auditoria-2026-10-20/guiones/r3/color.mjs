// B4 · El color no es la única señal (1.4.1): capturas con la visión simulada por Chromium (protanopia, deuteranopia,
// tritanopia y acromatopsia = escala de grises; CDP Emulation.setEmulatedVisionDeficiency) y un inventario de lo que se
// distingue por tono: etiquetas de estado (icono + palabra por familia), antigüedad de la bandeja, planeador,
// asistencia y calendario. Uso: node color.mjs → ../color.json y capturas/color-*.png
import { navegador, contexto, guarda, BASE } from './lib.mjs';

const PANTALLAS = [
  ['tramites', 'tramites.html', 'c5f9d9aa-c874-46d3-a037-9d273f6aa2e5'],
  ['tramites-acreditada', 'tramites.html', '7cfb2a2d-d797-42d4-a53c-94758ea964a9'],
  ['revision-volumen', 'revision.html', null, true],
  ['citas-volumen', 'citas.html', null, true],
  ['grupos-volumen', 'grupos.html?curso=poda-nueva', null, true],
  ['programar', 'programar.html?curso=poda-nueva'],
  ['asistencia', 'asistencia.html?folio=APD-G-2026-003'],
  ['asistencia-volumen', 'asistencia.html?folio=APD-G-2026-024', null, true],
  ['aplicar-volumen', 'aplicar.html?folio=APD-G-2026-020', null, true],
  ['grupo-en-curso', 'grupo.html?folio=APD-G-2026-003']
];
const VISIONES = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

function inventario() {
  const vis = (e) => e.checkVisibility();
  const out = { estados: {}, tonos: [], calendario: [], asistencia: [] };
  for (const e of document.querySelectorAll('.estado')) {
    if (!vis(e)) continue;
    const fam = [...e.classList].find((c) => c.startsWith('estado-')) || 'estado-terminado';
    const ic = e.querySelector('use'); const href = ic ? ic.getAttribute('href') : 'SIN ICONO';
    (out.estados[fam] = out.estados[fam] || new Set()).add(href);
  }
  for (const k of Object.keys(out.estados)) out.estados[k] = [...out.estados[k]];
  // Elementos con tono propio (data-tono o clases de tono) que no son etiquetas de estado
  for (const e of document.querySelectorAll('[data-tono],[class*="-ambar"],[class*="-rojo"],[class*="tono-"]')) {
    if (!vis(e) || e.closest('.estado')) continue;
    out.tonos.push(`${e.tagName.toLowerCase()}.${e.className} tono=${e.dataset.tono || ''} «${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)}» icono=${Boolean(e.querySelector('svg use'))}`);
  }
  // Calendario: cada día con su nombre accesible, si está deshabilitado y si está elegido
  for (const b of document.querySelectorAll('.cal-dia, [data-dia]')) {
    if (!vis(b) || b.tagName !== 'BUTTON') continue;
    out.calendario.push(`${b.getAttribute('aria-label') || b.textContent.trim()} | disabled=${b.disabled || b.getAttribute('aria-disabled')} pressed=${b.getAttribute('aria-pressed')} clase=${b.className} texto=«${b.textContent.replace(/\s+/g, ' ').trim()}» fondo=${getComputedStyle(b).backgroundColor}`);
  }
  for (const o of document.querySelectorAll('.asis-opcion')) if (vis(o)) out.asistencia.push(`«${o.textContent.replace(/\s+/g, ' ').trim()}» icono=${Boolean(o.querySelector('svg'))} marcada=${Boolean(o.querySelector('input:checked'))}`);
  out.calendario = out.calendario.slice(0, 45); out.asistencia = [...new Set(out.asistencia)].slice(0, 12); out.tonos = [...new Set(out.tonos)].slice(0, 30);
  return out;
}

const nav = await navegador();
const salida = [];
for (const ancho of [1440, 390]) {
  for (const [nombre, url, sesion, vol] of PANTALLAS) {
    const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion, vol });
    const p = await c.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    const s = await c.newCDPSession(p);
    for (const v of VISIONES) {
      await s.send('Emulation.setEmulatedVisionDeficiency', { type: v });
      await p.waitForTimeout(150);
      await p.screenshot({ path: `../capturas/color-${nombre}-${v}-${ancho}.png`, fullPage: ancho === 1440 && !/grupos|revision/.test(nombre) ? true : false });
    }
    salida.push({ nombre, ancho, ...(await p.evaluate(inventario)) });
    process.stdout.write('.');
    await c.close();
  }
}
await nav.close();
guarda('color.json', salida);
for (const s of salida.filter((x) => x.ancho === 1440)) console.log(JSON.stringify(s, null, 1).slice(0, 2500));
