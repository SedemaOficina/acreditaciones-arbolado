// B1 · Paso 2: barrido de cada estado (b1-descubrir.mjs) y de los estados que requieren acciones (menú de pruebas abierto,
// pasos de la solicitud, formularios enviados vacíos, acuses, el examen de la persona), en uno o varios tamaños.
// Amplía herramientas/auditar-sitio.mjs (sus revisiones se conservan tal cual) con:
//   · 7 tamaños (VISTAS en comun.mjs) y el escenario de volumen;
//   · texto que se sale de su caja aunque la caja no lo recorte;
//   · foco tapado por un elemento fijo o pegajoso, recorriendo la página con Tab (WCAG 2.2, 2.4.11);
//   · contenido que queda bajo un elemento fijo al final de la página (no se puede destapar desplazando);
//   · cada botón presionado en cada tamaño (una vez por pantalla y nombre de botón), con su motivo si no se puede presionar.
// Uso: VISTA=tel390 [SOLO=regex de url] [SIN_CLICS=1] node b1-revisar.mjs
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, navegador, contexto, vigila, carpeta, espera } from './comun.mjs';

const VISTA = process.env.VISTA || 'tel390';
const SAL = carpeta('b1');
const CAP = carpeta('capturas', 'b1', VISTA);
const nav = await navegador();

// ---------- Estados ----------
const fic = JSON.parse(readFileSync(join(SAL, 'estados-ficticios.json'), 'utf8'));
const vol = existsSync(join(SAL, 'estados-volumen.json')) ? JSON.parse(readFileSync(join(SAL, 'estados-volumen.json'), 'utf8')) : [];
// «Mi perfil» se ve igual para cada persona salvo su adscripción y su foto: se recorre con 6 personas distintas y con cada ?volver=
let enDatos = 0;
const base = fic.filter((s) => !(s.url === 'datos.html' && ++enDatos > 6)).map((s) => ({ ...s, datos: 'ficticios', nombre: `${s.url}${s.sesion ? ` [${s.caso}]` : ''}` }));
const PERSONAL = /^(revision|revisar|citas|cotejo|grupos|espera|programar|grupo|asistencia|aplicar|material-personal)\.html/;
const volumen = vol.filter((s) => PERSONAL.test(s.url)).map((s) => ({ ...s, id: `V${s.id}`, datos: 'volumen', nombre: `${s.url} [volumen]` }));

const libre = (fic.find((s) => s.caso === 'nueva') || {}).sesion;
const sesionDe = (caso) => (fic.find((s) => s.caso === caso) || {}).sesion;
const abreMenu = async (p) => { await p.click('.menu-pruebas-boton'); await p.waitForSelector('dialog[open]'); };
const enMenu = async (p, texto) => { await abreMenu(p); await p.locator('dialog[open] button', { hasText: texto }).first().click(); await espera(400); if (await p.locator('dialog[open]').count()) await p.keyboard.press('Escape'); await espera(200); };
const llenaSolicitud = async (p) => { await enMenu(p, 'Llenar con datos ficticios'); await espera(1500); };
const irPaso = async (p, k) => { await abreMenu(p); const b = p.locator('dialog[open] button', { hasText: new RegExp(`^${k}\\. `) }); if (!(await b.count())) throw new Error(`no hay paso ${k}`); await b.first().click(); await espera(500); if (await p.locator('dialog[open]').count()) await p.keyboard.press('Escape'); };
const enviaVacio = async (p) => { const b = p.locator('form [data-accion="enviar"]:visible, form [data-accion="siguiente"]:visible, form button[type=submit]:visible').first(); await b.click(); await espera(600); };
async function codigoExamen(p) {
  await p.goto(BASE + 'aplicar.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' });
  const boton = p.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
  const ins = await boton.getAttribute('data-ins');
  await boton.click();
  await p.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
  return (await p.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
}
async function examenHasta(p, vista) {
  const codigo = await codigoExamen(p);
  await p.goto(BASE + 'examen.html', { waitUntil: 'networkidle' });
  await p.fill('#codigo', codigo);
  if (vista === 'codigo') return;
  await p.click('#entrar [data-accion="enviar"]');
  await p.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  if (vista === 'confirmar') return;
  await p.click('[data-ir-vista="instrucciones"]');
  await p.waitForSelector('[data-vista="instrucciones"]:not([hidden])');
  if (vista === 'instrucciones') return;
  await p.click('[data-empezar]');
  await p.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  if (vista === 'pregunta') return;
  for (let i = 0; i < 12; i++) {
    if (await p.locator('[data-vista="revision"]:not([hidden])').count()) break;
    const op = p.locator('[data-vista="pregunta"]:not([hidden]) input[type=radio]').first();
    if (await op.count()) await op.check({ force: true }).catch(() => {});
    await p.click('[data-siguiente]'); await espera(250);
  }
  await p.waitForSelector('[data-vista="revision"]:not([hidden])');
  if (vista === 'revision') return;
  await p.click('[data-enviar]');
  await p.click('.dialogo-confirma [data-r="si"]');
  await p.waitForSelector('[data-vista="resultado"]:not([hidden])');
}
const ACCIONES = [
  ['index.html', null, 'menú de pruebas abierto', abreMenu],
  ['tramites.html', sesionDe('cita'), 'menú de pruebas abierto', abreMenu],
  ['revision.html', null, 'menú de pruebas abierto', abreMenu],
  ['solicitud.html', libre, 'menú de pruebas abierto', abreMenu],
  ['cuenta.html', null, 'enviado vacío', enviaVacio],
  ['entrar.html', null, 'enviado vacío', enviaVacio],
  ['verificar.html', null, 'enviado vacío', enviaVacio],
  ['verificar.html', null, 'con resultado', async (p) => { await enMenu(p, 'Llenar con datos ficticios'); await enviaVacio(p); }],
  ['solicitud.html', libre, 'paso 1 enviado vacío', enviaVacio],
  ['cuenta.html', null, 'llenada (foto cargada)', async (p) => { await enMenu(p, 'Llenar con datos ficticios'); await espera(1200); }],
  ['cuenta.html', null, 'cuenta creada (acuse)', async (p) => { await enMenu(p, 'Llenar con datos ficticios'); await espera(1200); await enviaVacio(p); await p.waitForSelector('text=/[Cc]uenta/', { timeout: 8000 }); await espera(800); }],
  ...[2, 3].map((k) => ['solicitud.html', libre, `paso ${k} (llenada)`, async (p) => { await llenaSolicitud(p); await irPaso(p, k); }]),
  ['solicitud.html', libre, 'acuse', async (p) => {
    // «Llenar» sólo adjunta los documentos que se ven: se llena en cada paso
    for (let i = 0; i < 8 && !(await p.locator('[data-accion="enviar"]:visible').count()); i++) { await llenaSolicitud(p); await p.locator('[data-accion="siguiente"]:visible').first().click(); await espera(600); }
    await llenaSolicitud(p);
    await p.locator('[data-accion="enviar"]:visible').first().click(); await p.waitForSelector('text=/Recibimos tu solicitud/', { timeout: 10000 }); await espera(600);
  }],
  ['datos.html', sesionDe('cita'), 'editar contacto abierto', async (p) => { await p.locator('button', { hasText: /^Editar/ }).first().click(); await espera(500); }],
  ['examen.html', null, 'código escrito', (p) => examenHasta(p, 'codigo')],
  ['examen.html', null, '¿eres tú?', (p) => examenHasta(p, 'confirmar')],
  ['examen.html', null, 'instrucciones', (p) => examenHasta(p, 'instrucciones')],
  ['examen.html', null, 'pregunta', (p) => examenHasta(p, 'pregunta')],
  ['examen.html', null, 'revisión antes de enviar', (p) => examenHasta(p, 'revision')],
  ['examen.html', null, 'resultado', (p) => examenHasta(p, 'resultado')]
].map(([url, sesion, que, accion], i) => ({ id: `A${i}`, url, sesion, perfil: url === 'examen.html' ? 'persona en el examen' : sesion ? 'persona' : /revision/.test(url) ? 'personal' : 'publico', caso: que, datos: 'ficticios', accion, nombre: `${url} · ${que}` }));

// «Programar» con ?semana=: la misma pantalla con otra semana; se recorren 3 semanas por juego de datos
const semanas = {};
let ESTADOS = [...base, ...volumen, ...ACCIONES].filter((s) => !(/semana=/.test(s.url) && (semanas[s.datos] = (semanas[s.datos] || 0) + 1) > 3));
if (process.env.SOLO) ESTADOS = ESTADOS.filter((s) => new RegExp(process.env.SOLO).test(s.nombre));

// ---------- Revisiones en la página (las de auditar-sitio, más dos) ----------
function revisaEnPagina() {
  const r = { ids: [], aria: [], anclas: [], desborde: null, recortes: [], saleDeCaja: [], encimados: [], chicos: [], bajos: [], ocultos: [], botones: [], bajoFijo: [] };
  const visible = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && !el.closest('[hidden],[aria-hidden="true"]:not(svg)');
  };
  const nombre = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || el.value || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} «${t.slice(0, 50)}»`;
  };
  const caja = (b) => ({ x: Math.round(b.left + window.scrollX), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.round(b.height) });
  const vistos = new Map();
  for (const el of document.querySelectorAll('[id]')) vistos.set(el.id, (vistos.get(el.id) || 0) + 1);
  for (const [id, n] of vistos) if (n > 1) r.ids.push(`id «${id}» repetido ${n} veces`);
  for (const at of ['aria-controls', 'aria-describedby', 'aria-labelledby', 'for']) {
    for (const el of document.querySelectorAll(`[${at}]`)) {
      for (const id of el.getAttribute(at).split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) r.aria.push(`${at}="${id}" en ${nombre(el)}: no existe`);
    }
  }
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (h.startsWith('#') && h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1)))) r.anclas.push(`${nombre(a)} → ${h}`);
  }
  for (const el of document.querySelectorAll('[hidden]')) {
    const b = el.getBoundingClientRect();
    if (getComputedStyle(el).display !== 'none' && b.width > 0 && b.height > 0) r.ocultos.push(nombre(el));
  }
  const de = document.documentElement;
  if (de.scrollWidth > window.innerWidth + 1) {
    // Quién se pasa del ancho de la ventana
    const culpables = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest('.tabla-marco,[data-visor-hojas],.visor-hojas'))
      .filter((el, _, l) => !l.some((o) => o !== el && el.contains(o))).slice(0, 4).map((el) => `${nombre(el)} hasta ${Math.round(el.getBoundingClientRect().right)}px`);
    r.desborde = `${de.scrollWidth}px de ancho en una ventana de ${window.innerWidth}px: ${culpables.join('; ')}`;
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.solo-lector,svg,[data-visor-hojas],.tabla-marco,.visor-hojas')) continue;
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && el.textContent.trim() && !el.matches('textarea,input,select,img,canvas')
      && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && cs.textOverflow !== 'ellipsis') {
      r.recortes.push(`${nombre(el)} (${el.scrollWidth}×${el.scrollHeight} en ${el.clientWidth}×${el.clientHeight})`);
    }
    // Nuevo: texto propio que se sale por la derecha de la caja que lo contiene (caja con borde o fondo), sin recorte
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (propio && !el.matches('input,select,textarea,option')) {
      let padre = el.parentElement;
      while (padre && padre !== document.body) {
        const pc = getComputedStyle(padre);
        if (pc.borderRightWidth !== '0px' || (pc.backgroundColor !== 'rgba(0, 0, 0, 0)' && pc.backgroundColor !== 'transparent')) break;
        padre = padre.parentElement;
      }
      if (padre && padre !== document.body && !/auto|scroll|hidden|clip/.test(getComputedStyle(padre).overflowX)) {
        const pb = padre.getBoundingClientRect();
        // Sólo el texto propio (sin el texto «solo-lector» de sus hijos, que está recortado a propósito)
        const rects = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).flatMap((n) => { const rng = document.createRange(); rng.selectNode(n); return [...rng.getClientRects()]; });
        const sale = Math.max(...rects.map((x) => x.right), -1e9) - pb.right;
        if (sale > 2) r.saleDeCaja.push(`${nombre(el)} sale ${Math.round(sale)} px de ${nombre(padre).slice(0, 80)}`);
      }
    }
  }
  const recorta = (el, b) => {
    let l = b.left, t = b.top, r2 = b.right, bt = b.bottom;
    for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none' || cs.clip !== 'auto') {
        const c = x.getBoundingClientRect();
        l = Math.max(l, c.left); t = Math.max(t, c.top); r2 = Math.min(r2, c.right); bt = Math.min(bt, c.bottom);
      }
      if (cs.position === 'fixed') break;
    }
    return r2 - l > 1 && bt - t > 1 ? { left: l, top: t, right: r2, bottom: bt } : null;
  };
  const fijo = (el) => { for (let x = el; x && x !== document.body; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const hojas = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.solo-lector,svg,canvas,[data-visor-hojas],select,option')) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!(propio || el.matches('input:not([type=hidden]),select,textarea,button,img,svg.icono'))) continue;
    if (el.matches('svg.icono') && el.closest('button,a,label')) continue;
    const rects = propio && !el.matches('button,input,select,textarea') ? [...el.getClientRects()] : [el.getBoundingClientRect()];
    for (const b0 of rects) { const b = recorta(el, b0); if (b) hojas.push({ el, b, fijo: fijo(el) }); }
  }
  const yaVisto = new Set();
  const compuesto = (a, b) => { const c = a.closest('.contrasena-caja,.control-grupo,.fecha-grupo,.combo'); return c && c.contains(b); };
  for (let i = 0; i < hojas.length; i++) {
    for (let j = i + 1; j < hojas.length; j++) {
      const A = hojas[i], B = hojas[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el) || A.fijo !== B.fijo || compuesto(A.el, B.el)) continue;
      const w = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left);
      const h = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top);
      if (w > 3 && h > 3) {
        const comun = A.el.parentElement === B.el.parentElement && getComputedStyle(A.el).display.startsWith('inline') && getComputedStyle(B.el).display.startsWith('inline') && h < 6;
        if (comun) continue;
        const k = `${nombre(A.el)} × ${nombre(B.el)}`;
        if (!yaVisto.has(k)) { yaVisto.add(k); r.encimados.push(`${k} (${Math.round(w)}×${Math.round(h)} px)`); }
      }
    }
  }
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex="0"]')) {
    if (!visible(el)) continue;
    if (el.matches('a') && el.closest('p,li,td,dd,figcaption,.ayuda,.bajada') && getComputedStyle(el).display === 'inline') continue;
    let b = el.getBoundingClientRect();
    if (el.matches('input[type=radio],input[type=checkbox]')) { const l = el.closest('label') || document.querySelector(`label[for="${el.id}"]`); if (l) b = l.getBoundingClientRect(); }
    if (b.width < 24 || b.height < 24) r.chicos.push(`${nombre(el)} (${Math.round(b.width)}×${Math.round(b.height)} px)`);
    else if (el.matches('button,input:not([type=radio]):not([type=checkbox]),select,summary') && b.height < 43.5) r.bajos.push(`${nombre(el)} (${Math.round(b.width)}×${Math.round(b.height)} px)`);
  }
  // Nuevo: al final de la página (no se puede desplazar más), lo que queda bajo un elemento fijo
  window.scrollTo(0, document.documentElement.scrollHeight);
  const fijos = [...document.querySelectorAll('body *')].filter((el) => visible(el) && getComputedStyle(el).position === 'fixed' && !el.closest('dialog'));
  for (const f of fijos) {
    const fb = f.getBoundingClientRect();
    for (const el of document.querySelectorAll('body *')) {
      if (f.contains(el) || el.contains(f) || !visible(el) || el.closest('dialog')) continue;
      const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!propio && !el.matches('a[href],button,input:not([type=hidden]),select,textarea,summary,img')) continue;
      if (fijo(el)) continue;
      const rects = propio && !el.matches('button,a,input,select,textarea') ? (() => { const g = document.createRange(); g.selectNodeContents(el); return [...g.getClientRects()]; })() : [el.getBoundingClientRect()];
      for (const b of rects) {
        const w = Math.min(b.right, fb.right) - Math.max(b.left, fb.left);
        const h = Math.min(b.bottom, fb.bottom) - Math.max(b.top, fb.top);
        if (w > 2 && h > 2) { r.bajoFijo.push(`${nombre(el)} bajo ${nombre(f).slice(0, 60)} (${Math.round(w)}×${Math.round(h)} px)`); break; }
      }
    }
  }
  window.scrollTo(0, 0);
  // Con un diálogo modal abierto, sólo se puede tocar lo que está dentro de él
  const modal = document.querySelector('dialog[open]:modal');
  const botones = [...(modal || document).querySelectorAll('button,summary,[role=button],a[href^="#"]:not([href="#"])')].filter((el) => visible(el) && !el.disabled);
  r.botones = botones.map((el, i) => { el.dataset.auditoria = String(i); return { i, nombre: nombre(el), caja: caja(el.getBoundingClientRect()) }; });
  return r;
}

// Foco: ¿lo tapa un elemento fijo o pegajoso? (WCAG 2.2, 2.4.11: no debe quedar oculto por completo)
function focoTapado() {
  const el = document.activeElement;
  if (!el || el === document.body || el.closest('dialog')) return null;
  const b = el.getBoundingClientRect();
  if (b.width === 0 || b.height === 0) return null;
  const area = b.width * b.height;
  let tapado = 0; const quien = [];
  for (const f of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(f);
    if (!(cs.position === 'fixed' || cs.position === 'sticky') || f.contains(el) || el.contains(f) || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (f.closest('dialog')) continue;
    const fb = f.getBoundingClientRect();
    const w = Math.min(b.right, fb.right) - Math.max(b.left, fb.left);
    const h = Math.min(b.bottom, fb.bottom) - Math.max(b.top, fb.top);
    if (w > 0 && h > 0) { tapado += w * h; quien.push(`${f.tagName.toLowerCase()}.${(f.className || '').toString().trim().split(/\s+/).join('.')}`); }
  }
  // Fuera de la ventana también cuenta como oculto
  const vis = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) * Math.max(0, Math.min(b.right, innerWidth) - Math.max(b.left, 0));
  const fuera = 1 - vis / area;
  const frac = Math.min(1, tapado / area + fuera);
  if (frac < 0.25) return null;
  const t = (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  return { frac: Math.round(frac * 100), quien: [...new Set(quien)].join(', '), fuera: Math.round(fuera * 100), el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} «${t}»` };
}

function huella() {
  const vis = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
  const t = [...document.querySelectorAll('body *')].filter(vis).length;
  const texto = document.body.innerText;
  const aria = [...document.querySelectorAll('[aria-expanded],[aria-pressed],[aria-selected],[aria-invalid],[open],[data-viendo],[hidden]')].map((e) => [e.getAttribute('aria-expanded'), e.getAttribute('aria-pressed'), e.getAttribute('aria-invalid'), e.hasAttribute('open'), e.hasAttribute('hidden'), e.hasAttribute('data-viendo')].join()).join('|');
  const valores = [...document.querySelectorAll('input,textarea,select')].map((e) => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value)).join('|');
  const foco = document.activeElement ? document.activeElement.outerHTML.slice(0, 80) : '';
  return `${location.href}#${t}#${texto.length}#${texto.slice(0, 2000)}#${aria}#${valores}#${foco}#${window.scrollY}`;
}

// ---------- Recorrido ----------
async function prepara(s, { tab = false } = {}) {
  const ctx = await contexto(nav, VISTA, { sesion: s.sesion, datos: s.datos });
  const page = await ctx.newPage();
  page.dialogos = 0;
  page.on('dialog', (d) => { if (d.type() === 'beforeunload') { d.accept().catch(() => {}); return; } page.dialogos++; d.dismiss().catch(() => {}); });
  const log = vigila(page);
  await page.goto(BASE + s.url, { waitUntil: 'networkidle' });
  await espera(500);
  if (s.accion) await s.accion(page);
  await espera(300);
  return { ctx, page, log };
}

const clicsHechosPrevios = [];
// Avance en un archivo por renglón: si el proceso se detiene, al volver a correrlo sigue donde iba
const AVANCE = join(SAL, `avance-${VISTA}.jsonl`);
const resultados = existsSync(AVANCE) ? readFileSync(AVANCE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const hechos = new Set(resultados.map((f) => String(f.id)));
for (const f of resultados) for (const k of f.clics || []) clicsHechosPrevios.push(k);
let presionados = 0;
// Los botones presionados en corridas anteriores también cuentan
const presionadosAntes = resultados.reduce((n, f) => n + (f.clics || []).length, 0);
const t0 = Date.now();
const clicsHechos = new Set(clicsHechosPrevios);
for (const s of ESTADOS) {
  if (hechos.has(String(s.id))) continue;
  const fila = { id: s.id, nombre: s.nombre, url: s.url, perfil: s.perfil, caso: s.caso, datos: s.datos, vista: VISTA, hallazgos: [] };
  const agrega = (tipo, detalle) => fila.hallazgos.push({ tipo, detalle });
  let ctx, page, log;
  try { ({ ctx, page, log } = await prepara(s)); } catch (e) { agrega('estado que no se pudo preparar', e.message.split('\n')[0]); resultados.push(fila); if (ctx) await ctx.close(); continue; }
  const destino = page.url().replace(BASE, '');
  if (!s.accion && destino.split('?')[0] !== s.url.split('?')[0] && s.url !== 'espera.html') agrega('redirección', `${s.url} llevó a ${destino}`);
  const r = await page.evaluate(revisaEnPagina);
  for (const c of log) agrega('consola', c);
  for (const x of r.ids) agrega('id repetido', x);
  for (const x of r.aria) agrega('referencia a id inexistente', x);
  for (const x of r.anclas) agrega('ancla rota', x);
  if (r.desborde) agrega('desborde horizontal', r.desborde);
  for (const x of r.recortes) agrega('texto recortado', x);
  for (const x of r.saleDeCaja) agrega('texto fuera de su caja', x);
  for (const x of r.encimados) agrega('encimado', x);
  for (const x of r.chicos) agrega('objetivo chico (<24 px)', x);
  for (const x of r.ocultos) agrega('marcado hidden pero visible', x);
  for (const x of r.bajoFijo) agrega('contenido bajo elemento fijo al final', x);
  fila.avisos44 = r.bajos.length;
  fila.bajos = r.bajos;
  // Recorrido con Tab
  const vistosFoco = new Set(); let primero = null; let tapados = 0;
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('Tab');
    const q = await page.evaluate(() => { const a = document.activeElement; return a ? a.outerHTML.slice(0, 120) + (a.dataset.auditoria || '') : ''; });
    if (i === 0) primero = q; else if (q === primero) break;
    if (vistosFoco.has(q) && i > 3) break;
    vistosFoco.add(q);
    const t = await page.evaluate(focoTapado);
    if (t) {
      tapados++;
      agrega(t.frac >= 99 ? 'foco oculto por completo' : 'foco tapado en parte', `${t.el}: ${t.frac} % (fuera de la ventana ${t.fuera} %) por ${t.quien || '—'}`);
      if (tapados <= 2) await page.screenshot({ path: join(CAP, `${String(s.id).padStart(3, '0')}-foco-${tapados}.png`) });
    }
  }
  fila.tabs = vistosFoco.size;
  const graves = fila.hallazgos.filter((h) => h.tipo !== 'foco tapado en parte');
  if (graves.length || tapados) await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); }).then(() => page.screenshot({ path: join(CAP, `${String(s.id).padStart(3, '0')}.png`), fullPage: true }));
  if (fila.hallazgos.length) fila.captura = join('capturas', 'b1', VISTA, `${String(s.id).padStart(3, '0')}.png`);
  // Botones: cada uno sobre el estado recién preparado (una vez por pantalla y nombre)
  if (!process.env.SIN_CLICS) {
    const pag = s.url.split('?')[0];
    for (const b of r.botones) {
      // Los días del calendario de «Programar» se prueban como un solo tipo de botón por estado (hay 42 por mes)
      const nombreK = /button\.cal-dia/.test(b.nombre) ? `cal-dia|${s.id}|${(fila.calDias = (fila.calDias || 0) + 1) > 3 ? 'resto' : fila.calDias}` : b.nombre;
      const k = s.accion ? `${pag}|${s.caso}|${nombreK}` : `${pag}|${s.datos}|${nombreK}`;
      if (clicsHechos.has(k) || /menu-pruebas-boton/.test(b.nombre) && clicsHechos.has(`menu|${pag}`)) continue;
      clicsHechos.add(k); (fila.clics = fila.clics || []).push(k); if (/menu-pruebas-boton/.test(b.nombre)) { clicsHechos.add(`menu|${pag}`); fila.clics.push(`menu|${pag}`); }
      let c2;
      try {
        if (s.accion) { await ctx.close(); ({ ctx, page } = await prepara(s)); c2 = ctx; }
        else { await page.goto(BASE + s.url, { waitUntil: 'networkidle' }); await espera(300); }
        const listo = await page.evaluate(revisaEnPagina);
        const mismo = listo.botones.find((x) => x.nombre === b.nombre) || listo.botones[b.i];
        if (!mismo) continue;
        const loc = page.locator(`[data-auditoria="${mismo.i}"]`);
        const antes = await page.evaluate(huella);
        page.dialogos = 0;
        const n = ctx.pages().length;
        presionados++;
        if (await loc.evaluate((el) => el.matches('.salto'))) continue; // «Ir al contenido»: lo revisa auditar-sitio con el teclado
        if (await loc.evaluate((el) => el.getAttribute('aria-disabled') === 'true')) { fila.ariaDeshabilitados = (fila.ariaDeshabilitados || 0) + 1; continue; }
        try { await loc.click({ timeout: 2500 }); } catch (e) { agrega('botón que no se puede presionar', `${b.nombre}: ${e.message.split('\n').find((l) => /intercepts|outside|not visible|not stable|Timeout/.test(l)) || e.message.split('\n')[0]}`); await page.screenshot({ path: join(CAP, `${String(s.id).padStart(3, '0')}-boton-${mismo.i}.png`) }); continue; }
        await espera(500);
        const despues = await page.evaluate(huella).catch(() => 'navegó');
        if (antes === despues && !page.dialogos && ctx.pages().length === n) agrega('botón sin efecto visible', b.nombre);
        for (const p of ctx.pages().slice(1)) await p.close();
      } catch (e) { agrega('error de la prueba al presionar', `${b.nombre}: ${e.message.split('\n')[0]}`); }
    }
  }
  await ctx.close();
  resultados.push(fila);
  appendFileSync(AVANCE, JSON.stringify(fila) + '\n');
  process.stdout.write(fila.hallazgos.length ? 'x' : '.');
}
await nav.close();
const porTipo = {};
for (const f of resultados) for (const h of f.hallazgos) porTipo[h.tipo] = (porTipo[h.tipo] || 0) + 1;
writeFileSync(join(SAL, `resultado-${VISTA}${process.env.SOLO ? '-parcial' : ''}.json`), JSON.stringify({ vista: VISTA, estados: resultados.length, presionados: presionados + presionadosAntes, segundos: Math.round((Date.now() - t0) / 1000), porTipo, resultados }, null, 1));
console.log(`\n${VISTA}: ${resultados.length} estados, ${presionados} botones presionados, ${Math.round((Date.now() - t0) / 1000)} s`);
for (const [t, n] of Object.entries(porTipo)) console.log(`  ${t}: ${n}`);
