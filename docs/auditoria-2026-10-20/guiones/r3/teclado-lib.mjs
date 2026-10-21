// B4 · Teclado: registro de cada foco (qué elemento, si se ve, si lo tapa algo fijo, su indicador y el contraste del
// anillo contra lo que lo rodea) y un conductor que llena formularios sólo con Tab, flechas, Espacio, Enter y Escape.
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { RAIZ } from './lib.mjs';

export const PDF = (n) => ({ name: `${n}.pdf`, mimeType: 'application/pdf', buffer: readFileSync(`${RAIZ}/sitio/datos/documentos/identificacion_oficial.pdf`) });
function pngFicticio(ancho = 400, alto = 500) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const bloque = (tipo, d) => { const t = Buffer.from(tipo, 'ascii'); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, d]))); return Buffer.concat([l, t, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 0;
  const filas = Buffer.alloc((ancho + 1) * alto, 0x9a); for (let y = 0; y < alto; y++) filas[y * (ancho + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas)), bloque('IEND', Buffer.alloc(0))]);
}
export const FOTO = { name: 'foto-ficticia.png', mimeType: 'image/png', buffer: pngFicticio() };

// Se instala antes de que cargue la página (no lo bloquea la política de contenido)
export function registroDeFoco() {
  window.__r3foco = [];
  const lum = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const L = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contraste = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondoDe = (el) => { for (let x = el; x; x = x.parentElement) { const c = lum(getComputedStyle(x).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const nombre = (el) => (el.getAttribute('aria-label') || el.labels && el.labels[0] && el.labels[0].textContent || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  window.__r3desc = (el) => el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.name ? '[name=' + el.name + ']' : ''}${el.type && el.tagName === 'INPUT' ? '[' + el.type + (el.value && /radio|checkbox/.test(el.type) ? '=' + el.value : '') + ']' : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} «${nombre(el)}»` : 'null';
  const fijo = (el) => { for (let x = el; x && x !== document.documentElement; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };
  function mide(el) {
    const b = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = { el: window.__r3desc(el), t: Date.now(), x: Math.round(b.left), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.round(b.height) };
    r.dentro = b.bottom > 0 && b.top < vh && b.right > 0 && b.left < vw && b.width > 0;
    r.completo = b.top >= 0 && b.bottom <= vh && b.left >= 0 && b.right <= vw;
    // Indicador: del propio control, o del rótulo que lo contiene (opciones y casillas)
    let ind = el; let cs = getComputedStyle(el);
    const tiene = (s) => (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none');
    if (!tiene(cs)) {
      const cont = el.closest('label,.opcion,.casilla,.asis-opcion,.zona-carga,.contrasena-caja') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (cont && tiene(getComputedStyle(cont))) { ind = cont; cs = getComputedStyle(cont); }
    }
    r.indicador = tiene(cs) ? (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1 ? `outline ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}` : `sombra ${cs.boxShadow.slice(0, 60)}`) : 'NINGUNO';
    r.enRotulo = ind !== el;
    const col = lum(cs.outlineStyle !== 'none' ? cs.outlineColor : cs.borderColor);
    if (col) r.contrasteAnillo = Math.round(contraste(col, fondoDe(ind.parentElement || ind)) * 100) / 100;
    // ¿Lo tapa algo fijo o pegado (cabecera, barra, botón del menú de pruebas, distintivo de versión)?
    const ib = ind.getBoundingClientRect();
    const pts = [[ib.left + ib.width / 2, ib.top + ib.height / 2], [ib.left + 3, ib.top + 3], [ib.right - 3, ib.top + 3], [ib.left + 3, ib.bottom - 3], [ib.right - 3, ib.bottom - 3]];
    let tapados = 0; const quienes = new Set(); let medidos = 0;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      medidos++;
      const h = document.elementFromPoint(x, y);
      if (!h || ind.contains(h) || h.contains(ind) || el.contains(h)) continue;
      const f = fijo(h);
      if (f && !f.contains(el)) { tapados++; quienes.add(window.__r3desc(f).slice(0, 70)); }
    }
    r.tapado = medidos === 0 ? 'fuera de la ventana' : tapados === 0 ? 'no' : tapados === medidos ? 'TOTAL' : 'parcial';
    if (quienes.size) r.tapadoPor = [...quienes].join(' + ');
    return r;
  }
  window.__r3mide = mide;
  document.addEventListener('focusin', (e) => { const el = e.target; setTimeout(() => { if (document.activeElement === el) window.__r3foco.push(mide(el)); }, 80); }, true);
}

export async function activo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    const campo = a && a.closest('[data-campo]');
    const grupo = a && a.type === 'radio' ? [...document.querySelectorAll(`input[name="${a.name}"]`)].find((x) => x.checked) : null;
    return { desc: window.__r3desc(a), tag: a && a.tagName, type: a && a.type, id: a && a.id, name: a && a.name, value: a && a.value, checked: a && a.checked, campo: campo && campo.dataset.campo,
      texto: a && (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim(), marcado: grupo ? grupo.value : null, enDialogo: Boolean(a && a.closest('dialog[open]')), esBody: a === document.body };
  });
}

// Llena sólo con teclado. V = { texto: {id: valor}, radio: {name: valor}, casilla: [name], select: {id: valor}, archivos: {campo: archivo}, parar: /texto del botón/ }
export async function llenaConTeclado(page, V, max = 400) {
  const pasos = [];
  const vistos = new Set();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(60);
    const a = await activo(page);
    pasos.push(a.desc);
    if (V.parar && V.parar.test(a.texto) && (a.tag === 'BUTTON' || a.tag === 'A')) return { pasos, parado: a.desc };
    if (a.tag === 'INPUT' && /text|email|tel|password|search|number/.test(a.type) && V.texto && V.texto[a.id] != null && a.value !== V.texto[a.id] && !vistos.has(a.id)) {
      vistos.add(a.id);
      await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
      await page.keyboard.type(V.texto[a.id], { delay: 5 });
    } else if (a.tag === 'TEXTAREA' && V.texto && V.texto[a.id] != null && !vistos.has(a.id)) {
      vistos.add(a.id); await page.keyboard.type(V.texto[a.id], { delay: 2 });
    } else if (a.type === 'radio' && V.radio && V.radio[a.name] != null && a.marcado !== V.radio[a.name]) {
      // Flechas hasta la opción buscada (las flechas también la marcan)
      for (let k = 0; k < 12; k++) {
        const b = await activo(page);
        if (b.value === V.radio[a.name]) { if (!b.checked) await page.keyboard.press('Space'); break; }
        await page.keyboard.press('ArrowDown'); await page.waitForTimeout(40);
      }
    } else if (a.type === 'checkbox' && V.casilla && V.casilla.includes(a.name) && !a.checked) {
      await page.keyboard.press('Space');
    } else if (a.tag === 'SELECT' && V.select && V.select[a.id] != null && a.value !== V.select[a.id]) {
      for (let k = 0; k < 40; k++) { const b = await activo(page); if (b.value === V.select[a.id]) break; await page.keyboard.press('ArrowDown'); await page.waitForTimeout(30); }
    } else if (a.tag === 'BUTTON' && a.campo && V.archivos && V.archivos[a.campo] && !vistos.has('arch:' + a.campo) && /Elegir|Cargar|Tomar|Agregar|archivo|foto/i.test(a.texto)) {
      vistos.add('arch:' + a.campo);
      const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), page.keyboard.press('Enter')]);
      if (fc) { await fc.setFiles(V.archivos[a.campo]); await page.waitForTimeout(900); pasos.push(`  ↳ archivo cargado; foco después: ${(await activo(page)).desc}`); }
      else pasos.push('  ↳ Enter no abrió el selector de archivos');
    }
  }
  return { pasos, parado: null };
}

export async function focos(page) { return page.evaluate(() => window.__r3foco.splice(0)); }

// Registro de lo que cambia en las regiones vivas (lo que oiría un lector de pantalla), con la hora relativa
export function registroDeAnuncios() {
  window.__r3anuncios = [];
  const t0 = Date.now();
  const vivas = () => document.querySelectorAll('[aria-live],[role=status],[role=alert],[role=log],[role=timer],output');
  const vistos = new WeakSet();
  const observa = (n) => {
    if (vistos.has(n)) return; vistos.add(n);
    const tipo = n.getAttribute('aria-live') || (n.getAttribute('role') === 'alert' ? 'assertive' : 'polite');
    new MutationObserver(() => {
      const txt = n.textContent.replace(/\s+/g, ' ').trim();
      if (txt && !n.closest('[hidden]')) window.__r3anuncios.push({ ms: Date.now() - t0, tipo, donde: `${n.tagName.toLowerCase()}.${n.className}`.slice(0, 50), texto: txt.slice(0, 160) });
    }).observe(n, { childList: true, subtree: true, characterData: true });
  };
  document.addEventListener('DOMContentLoaded', () => { vivas().forEach(observa); new MutationObserver(() => vivas().forEach(observa)).observe(document.body, { childList: true, subtree: true }); });
}
export async function anuncios(page) { return page.evaluate(() => (window.__r3anuncios || []).splice(0)); }

// Enfoca con el teclado un control conocido (sin ratón): focus() y luego teclas
export async function teclas(page, selector, ...ks) {
  await page.locator(selector).first().focus();
  for (const k of ks) { if (k.startsWith('texto:')) await page.keyboard.type(k.slice(6), { delay: 3 }); else await page.keyboard.press(k); await page.waitForTimeout(60); }
}
export async function dondeFoco(page) { return page.evaluate(() => window.__r3desc(document.activeElement)); }
