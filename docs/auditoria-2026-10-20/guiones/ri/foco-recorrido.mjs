// Revisor independiente (ri), auditoría 20/10/2026 · WCAG 2.2 AA 2.4.11 (foco no oculto, mínimo) y 2.4.7 (foco visible).
// Recorre con Tab cada pantalla de principio a fin (hasta volver al primer elemento) y en cada parada mide:
//   · si el elemento enfocado queda tapado por algo fijo o pegajoso (position fixed/sticky): muestreo de 7×5 puntos con
//     document.elementFromPoint (al elemento fijo se le fuerza pointer-events:auto sólo durante la medición, para que
//     cuenten también los que lo tienen en none), más la intersección geométrica de rectángulos;
//   · qué elemento hay encima en el centro y en las cuatro esquinas;
//   · si hay indicador de foco visible (outline o box-shadow en el elemento o en su envoltura con :has) y si un
//     ancestro con overflow lo recorta.
// Uso: node foco-recorrido.mjs <BASE> <ficticios|volumen> <tamaños: 1440x900,1280x720,1024x768,390x844> <salida.json> [filtro de estados, regex]
// Solo lectura: no toca el proyecto; el escenario de volumen se genera en un temporal y se sirve con context.route.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const COPIA = process.env.COPIA || '/home/claude/trabajo/aud20-ri';
const [, , BASE0 = 'http://localhost:8906/', DATOS = 'ficticios', TAMS = '1440x900,1280x720,1024x768,390x844', SALIDA = 'salida.json', FILTRO = ''] = process.argv;
const BASE = BASE0.replace(/\/?$/, '/');
const MAX_PARADAS = Number(process.env.MAX_PARADAS || 900);
const CAPTURAS = process.env.CAPTURAS || join(dirname(SALIDA), '..', 'capturas');
mkdirSync(CAPTURAS, { recursive: true });

let cuerpo = readFileSync(join(COPIA, 'sitio/datos/ficticios.json'));
if (DATOS === 'volumen') {
  const sal = join(mkdtempSync(join(tmpdir(), 'ri-vol-')), 'volumen.json');
  execFileSync('node', [join(COPIA, 'herramientas/escenario-volumen.mjs'), join(COPIA, 'sitio/datos/ficticios.json'), sal], { stdio: 'ignore' });
  cuerpo = readFileSync(sal);
}
const d = JSON.parse(cuerpo);

// Estados: los de herramientas/auditar-sitio.mjs (persona y personal), calculados sobre los datos servidos
const sol = (estado, f = () => true) => d.solicitud.find((s) => s.estado === estado && f(s));
const activa = (s) => s && d.solicitante.find((p) => p.id === s.solicitante_id && p.estado === 'activa');
const conPersona = (estado, f) => { const s = d.solicitud.find((x) => x.estado === estado && (!f || f(x)) && activa(x)); return s ? [s, s.solicitante_id] : [null, null]; };
const [borr, pBorr] = conPersona('borrador');
const [obs, pObs] = conPersona('con_observaciones');
const [cita, pCita] = conPersona('validada_en_linea');
const [, pInsc] = conPersona('inscrita');
const [, pAcred] = conPersona('acreditada');
const enviadaDict = sol('enviada', (s) => s.tipo_acreditacion === 'dictaminador');
const enviadaPoda = sol('enviada', (s) => s.tipo_acreditacion === 'poda');
const sinTramite = d.solicitante.find((p) => p.estado === 'activa' && !d.solicitud.some((s) => s.solicitante_id === p.id));
const gInt = d.grupo.find((g) => g.estado === 'en_integracion');
const gCur = d.grupo.find((g) => g.estado === 'en_curso');
const g25 = d.grupo.find((g) => g.folio === 'APD-G-2026-024');
let ESTADOS = [
  // Persona solicitante
  ['P inicio', 'index.html', null],
  ['P cuenta', 'cuenta.html', null],
  ['P entrar', 'entrar.html', null],
  ['P verificar', 'verificar.html', null],
  ['P material', 'material.html', null],
  pCita && ['P tramites-cita', 'tramites.html', pCita],
  pObs && ['P tramites-observaciones', 'tramites.html', pObs],
  pInsc && ['P tramites-grupo', 'tramites.html', pInsc],
  pAcred && ['P tramites-acreditada', 'tramites.html', pAcred],
  pObs && ['P solicitud-observaciones', `solicitud.html?folio=${obs.folio}`, pObs],
  pBorr && ['P solicitud-borrador', `solicitud.html?folio=${borr.folio}`, pBorr],
  sinTramite && ['P solicitud-nueva', 'solicitud.html', sinTramite.id],
  (sinTramite || pCita) && ['P datos', 'datos.html', (sinTramite || { id: pCita }).id],
  pCita && ['P corregir', 'corregir.html', pCita],
  ['P examen-entrar', 'examen.html', null],
  // Personal
  ['S revision', 'revision.html', null],
  enviadaDict && ['S revisar-dictaminador', `revisar.html?folio=${enviadaDict.folio}`, null],
  enviadaPoda && ['S revisar-poda', `revisar.html?folio=${enviadaPoda.folio}`, null],
  ['S citas', 'citas.html', null],
  cita && ['S cotejo', `cotejo.html?folio=${cita.folio}`, null],
  ['S grupos', 'grupos.html?curso=poda-nueva', null],
  ['S programar', 'programar.html?curso=poda-nueva', null],
  gInt && ['S grupo-integracion', `grupo.html?folio=${gInt.folio}`, null],
  gCur && ['S grupo-en-curso', `grupo.html?folio=${gCur.folio}`, null],
  g25 && ['S grupo-25', `grupo.html?folio=${g25.folio}`, null],
  ['S asistencia', g25 ? `asistencia.html?folio=${g25.folio}` : 'asistencia.html', null],
  ['S aplicar', 'aplicar.html', null],
  d.grupo.some((g) => g.folio === 'APD-G-2026-020') && ['S asistencia-020', 'asistencia.html?folio=APD-G-2026-020', null],
  d.grupo.some((g) => g.folio === 'APD-G-2026-020') && ['S grupo-020', 'grupo.html?folio=APD-G-2026-020', null],
  d.grupo.some((g) => g.folio === 'APD-G-2026-020') && ['S aplicar-020', 'aplicar.html?folio=APD-G-2026-020', null],
  ['S material-personal', 'material-personal.html', null]
].filter(Boolean);
if (FILTRO) ESTADOS = ESTADOS.filter(([n]) => new RegExp(FILTRO).test(n));

// ---------- Medición dentro de la página ----------
function mide() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { cuerpo: true };
  const W = innerWidth, H = innerHeight;
  const desc = (x) => {
    if (!x || !x.tagName) return String(x);
    const t = (x.getAttribute('aria-label') || x.textContent || x.value || x.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const cls = typeof x.className === 'string' && x.className.trim() ? '.' + x.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}${cls}${x.type && x.tagName === 'INPUT' ? `[${x.type}]` : ''} «${t.slice(0, 45)}»`;
  };
  // Opacidad efectiva y envoltura que pinta el indicador
  const opacidad = (x) => { let o = 1; for (let y = x; y && y.nodeType === 1; y = y.parentElement) o *= Number(getComputedStyle(y).opacity); return o; };
  const tieneIndicador = (x) => { const cs = getComputedStyle(x); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); };
  let ind = null;
  for (let y = el, k = 0; y && y.nodeType === 1 && k < 4; y = y.parentElement, k++) { if (tieneIndicador(y) && opacidad(y) > 0.05) { ind = y; break; } }
  const op = opacidad(el);
  const visual = op < 0.05 && ind ? ind : el; // lo que la persona ve como «el componente»
  const r = visual.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const invisible = r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || (op < 0.05 && !ind);
  // Ancestro fijo o pegajoso del propio elemento (no lo tapa a sí mismo)
  const fijoDe = (x) => { for (let y = x; y && y !== document.documentElement; y = y.parentElement) { const p = getComputedStyle(y).position; if (p === 'fixed' || p === 'sticky') return y; } return null; };
  const propio = fijoDe(el);
  // Candidatos fijos o pegajosos visibles
  const fijos = window.__riFijos.filter((f) => f.isConnected && f !== propio && !f.contains(el) && !el.contains(f) && !(propio && propio.contains(f)) && f.checkVisibility && f.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
  // Recorte del rectángulo a la ventana
  const dentro = { l: Math.max(r.left, 0), t: Math.max(r.top, 0), r: Math.min(r.right, W), b: Math.min(r.bottom, H) };
  const areaTotal = Math.max(0, r.width) * Math.max(0, r.height);
  const areaDentro = Math.max(0, dentro.r - dentro.l) * Math.max(0, dentro.b - dentro.t);
  const fueraVentana = areaTotal > 0 ? 1 - areaDentro / areaTotal : 0;
  // Intersección geométrica con cada fijo (sólo los que pintan encima, comprobado con elementFromPoint)
  const guardados = fijos.map((f) => [f, f.style.getPropertyValue('pointer-events'), f.style.getPropertyPriority('pointer-events')]);
  for (const [f] of guardados) f.style.setProperty('pointer-events', 'auto', 'important');
  const encima = (x, y) => { const h = document.elementFromPoint(x, y); return h; };
  const quienTapa = (h) => { if (!h) return null; if (h === el || el.contains(h) || h === visual || visual.contains(h) || h.contains(visual)) return null; const f = fijos.find((F) => F === h || F.contains(h)); return f ? { fijo: true, f } : { fijo: false, f: h }; };
  const puntos = [];
  const NX = 7, NY = 5;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const x = r.left + 1 + (r.width - 2) * (i / (NX - 1)); const y = r.top + 1 + (r.height - 2) * (j / (NY - 1));
    puntos.push([x, y, i === (NX - 1) / 2 && j === (NY - 1) / 2 ? 'centro' : (i === 0 || i === NX - 1) && (j === 0 || j === NY - 1) ? 'esquina' : '']);
  }
  let enVentana = 0, tapadosFijo = 0, tapadosOtro = 0; const porQuien = new Map(); const otros = new Map(); const clave = {};
  for (const [x, y, tipo] of puntos) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    enVentana++;
    const q = quienTapa(encima(x, y));
    if (q && q.fijo) { tapadosFijo++; porQuien.set(q.f, (porQuien.get(q.f) || 0) + 1); }
    else if (q) { tapadosOtro++; otros.set(desc(q.f), (otros.get(desc(q.f)) || 0) + 1); }
    if (tipo) { const k = tipo === 'centro' ? 'centro' : `${x < r.left + r.width / 2 ? 'izq' : 'der'}-${y < r.top + r.height / 2 ? 'arr' : 'aba'}`; clave[k] = q ? (q.fijo ? 'FIJO ' : 'otro ') + desc(q.f) : 'libre'; }
  }
  // Intersección geométrica (área) con los fijos que de verdad pintan encima en algún punto
  const inter = [];
  for (const f of fijos) {
    const b = f.getBoundingClientRect();
    const l = Math.max(dentro.l, b.left), t = Math.max(dentro.t, b.top), rr = Math.min(dentro.r, b.right), bb = Math.min(dentro.b, b.bottom);
    const a = Math.max(0, rr - l) * Math.max(0, bb - t);
    if (a > 0) inter.push({ fijo: desc(f), pos: getComputedStyle(f).position, area: Math.round(a), fraccion: areaDentro ? +(a / areaDentro).toFixed(3) : 0, pintaEncima: porQuien.has(f) });
  }
  for (const [f, v, p] of guardados) { if (v) f.style.setProperty('pointer-events', v, p); else f.style.removeProperty('pointer-events'); }
  // Indicador recortado por un ancestro con overflow
  let recortado = null;
  if (ind) {
    const ics = getComputedStyle(ind); const ib = ind.getBoundingClientRect();
    const ext = (parseFloat(ics.outlineWidth) || 0) + Math.max(0, parseFloat(ics.outlineOffset) || 0);
    for (let y = ind.parentElement; y && y !== document.body; y = y.parentElement) {
      const ys = getComputedStyle(y);
      if (ys.overflowX !== 'visible' || ys.overflowY !== 'visible') {
        const c = y.getBoundingClientRect();
        if (ib.left - ext < c.left - 0.5 || ib.top - ext < c.top - 0.5 || ib.right + ext > c.right + 0.5 || ib.bottom + ext > c.bottom + 0.5) { recortado = desc(y); break; }
      }
    }
  }
  const fraccionFijo = enVentana ? tapadosFijo / enVentana : 0;
  return {
    el: desc(el), visual: visual === el ? null : desc(visual), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    scrollY: Math.round(scrollY), focoVisible: el.matches(':focus-visible'), indicador: ind ? desc(ind) : null, invisible, recortado,
    fueraVentana: +fueraVentana.toFixed(3), puntos: enVentana, tapadosFijo, tapadosOtro, fraccionFijo: +fraccionFijo.toFixed(3),
    total: enVentana > 0 && tapadosFijo === enVentana, parcial: tapadosFijo > 0 && tapadosFijo < enVentana,
    porQuien: [...porQuien].map(([f, n]) => `${desc(f)} (${getComputedStyle(f).position}) ×${n}`), otros: [...otros].map(([k, n]) => `${k} ×${n}`), clave, inter,
    viewport: [W, H]
  };
}

function candidatosFijos() {
  window.__riFijos = [...document.querySelectorAll('body *')].filter((x) => { const p = getComputedStyle(x).position; return p === 'fixed' || p === 'sticky'; });
  return window.__riFijos.map((x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}.${String(x.className).trim().split(/\s+/).join('.')} (${getComputedStyle(x).position})`);
}

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const resultados = [];
for (const tam of TAMS.split(',')) {
  const [w, h] = tam.split('x').map(Number);
  for (const [nombre, url, sesion] of ESTADOS) {
    const movil = w < 600;
    const ctx = await navegador.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
    if (DATOS === 'volumen') await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
    if (sesion) await ctx.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) {} }, sesion);
    const pg = await ctx.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(String(e)));
    const reg = { estado: nombre, url, tam, datos: DATOS, paradas: [], errores };
    try {
      await pg.goto(BASE + url, { waitUntil: 'networkidle' });
      await pg.waitForTimeout(800);
      reg.urlFinal = pg.url().replace(BASE, '');
      await pg.evaluate(`window.__riMide = ${mide.toString()}; window.__riCand = ${candidatosFijos.toString()};`);
      reg.fijos = await pg.evaluate(() => window.__riCand());
      reg.focoAlCargar = await pg.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''} «${(a.textContent || '').trim().slice(0, 40)}»` : 'body'; });
      const vistos = [];
      let cuerpos = 0;
      for (let k = 0; k < MAX_PARADAS; k++) {
        await pg.keyboard.press(process.env.TECLA || 'Tab'); // TECLA=Shift+Tab recorre hacia atrás
        const m = await pg.evaluate(async () => {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          if (!window.__riVistos) window.__riVistos = [];
          const a = document.activeElement;
          const idx = window.__riVistos.indexOf(a);
          if (a && a !== document.body && idx === -1) window.__riVistos.push(a);
          const r = window.__riMide();
          r.repetido = idx !== -1; r.indice = idx;
          return r;
        });
        if (k % 25 === 24) await pg.evaluate(() => window.__riCand());
        if (m.cuerpo) { cuerpos++; if (cuerpos >= 2) break; continue; }
        if (m.repetido && m.indice === 0) break; // volvió al primero: vuelta completa
        if (m.repetido) { reg.repeticionRara = (reg.repeticionRara || 0) + 1; if (reg.repeticionRara > 5) break; continue; }
        m.n = reg.paradas.length + 1;
        reg.paradas.push(m);
        if ((m.total || m.parcial) && (reg.capturas || 0) < 4) {
          reg.capturas = (reg.capturas || 0) + 1;
          const archivo = `${DATOS}-${nombre.replace(/\W+/g, '_')}-${tam}-parada${m.n}.png`;
          await pg.screenshot({ path: join(CAPTURAS, archivo) });
          m.captura = archivo;
        }
      }
    } catch (e) { reg.error = String(e.message || e).split('\n')[0]; }
    const p = reg.paradas;
    reg.resumen = { paradas: p.length, totales: p.filter((x) => x.total).length, parciales: p.filter((x) => x.parcial).length, sinIndicador: p.filter((x) => !x.indicador).length, invisibles: p.filter((x) => x.invisible).length, recortados: p.filter((x) => x.recortado).length, fuera: p.filter((x) => x.fueraVentana > 0.01).length, otros: p.filter((x) => x.tapadosOtro > 0).length };
    console.log(`${DATOS} ${tam} ${nombre.padEnd(28)} paradas ${String(p.length).padStart(4)} · totales ${reg.resumen.totales} · parciales ${reg.resumen.parciales} · sin indicador ${reg.resumen.sinIndicador} · invisibles ${reg.resumen.invisibles} · recortado ${reg.resumen.recortados} · fuera ${reg.resumen.fuera} · encimado no fijo ${reg.resumen.otros}${reg.error ? ' · ERROR ' + reg.error : ''}`);
    resultados.push(reg);
    await ctx.close();
  }
}
await navegador.close();
writeFileSync(SALIDA, JSON.stringify(resultados, null, 1));
