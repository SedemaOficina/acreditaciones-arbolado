// Auditoría A6 (estilos y contraste) y C6 (sistema visual) · 20/10/2026 · revisor r1
// Recorre las 21 pantallas en sus estados principales a 390 y 1440 px y, en cada estado, mide en el navegador:
//   · texto (incluido ::before/::after, valores de campos y marcadores): color contra el fondo REAL compuesto
//     (fondos de los ancestros con su transparencia y la opacidad), razón WCAG y mínimo (4.5 o 3 si es grande);
//   · líneas y bordes (controles, botones, tarjetas, indicadores), íconos SVG y puntos: contra el fondo de afuera;
//   · el anillo de foco de cada elemento al que se llega con Tab: contra el fondo de afuera;
//   · de dónde viene cada color: se apagan app/apd.css y app/examen.css y se vuelve a leer; si cambia, es del proyecto;
//   · inventario C6: variantes de botón y de lo que parece botón, etiquetas de estado, avisos, tamaños de letra y espacios.
// Uso: node medir.mjs http://localhost:8901/ <salida.json>   (CHROMIUM=<ruta>; con el sitio servido)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA = process.env.COPIA || '/home/claude/trabajo/aud20-r1';
const BASE = (process.argv[2] || 'http://localhost:8901/').replace(/\/?$/, '/');
const SALIDA = process.argv[3] || join(AQUI, 'medicion.json');
const CAPTURAS = process.env.CAPTURAS || '';
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const datos = JSON.parse(readFileSync(join(COPIA, 'sitio/datos/ficticios.json'), 'utf8'));
// Escenario de volumen (65 por revisar, 40 citas, 112 en espera, grupos de 25)
const volJson = join(mkdtempSync(join(tmpdir(), 'r1-vol-')), 'volumen.json');
execFileSync('node', [join(COPIA, 'herramientas/escenario-volumen.mjs'), join(COPIA, 'sitio/datos/ficticios.json'), volJson], { stdio: 'ignore' });
const VOLUMEN = readFileSync(volJson);

// ---------- Personas y folios, tomados de los datos (como probar-sitio.mjs) ----------
const FINALES = ['acreditada', 'rechazada', 'cancelada', 'concluida_sin_atender', 'no_acreditada'];
const activa = (s) => s && datos.solicitante.find((p) => p.id === s.solicitante_id && p.estado === 'activa');
const conPersona = (estado, f) => datos.solicitud.find((x) => x.estado === estado && (!f || f(x)) && activa(x));
const enviadas = datos.solicitud.filter((s) => s.estado === 'enviada');
const porClasificar = enviadas.find((s) => s.perfil_academico === 'por_clasificar') || enviadas[0];
const noCumple = enviadas.find((s) => s.perfil_academico === 'no_cumple') || enviadas[1];
const citaSencilla = (s) => datos.cita.filter((c) => c.solicitud_id === s.id).length === 1 && datos.cita.some((c) => c.solicitud_id === s.id && c.resultado === 'pendiente');
const conCita = datos.solicitud.find((s) => s.estado === 'validada_en_linea' && s.cita_en && citaSencilla(s));
const vigente = datos.verificacion_publica.find((v) => v.situacion === 'Vigente');
const noVigente = datos.verificacion_publica.find((v) => v.situacion !== 'Vigente');
const pausaHoy = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
const sPausa = pausaHoy && datos.solicitud.find((x) => x.id === pausaHoy.solicitud_id);
const obs = conPersona('con_observaciones');
const borr = conPersona('borrador');
const sinTramite = datos.solicitante.find((p) => p.estado === 'activa' && !datos.solicitud.some((s) => s.solicitante_id === p.id));
const gInt = datos.grupo.find((g) => g.estado === 'en_integracion');
const gCurso = datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13') || datos.grupo.find((g) => g.estado === 'en_curso');
// «Mis trámites»: una persona por cada estado de solicitud que exista (para ver todas las familias de etiquetas)
const estadosSol = [...new Set(datos.solicitud.map((s) => s.estado))];
const tramites = estadosSol.map((e) => { const s = conPersona(e); return s && [`tramites-${e}`, 'tramites.html', s.solicitante_id]; }).filter(Boolean);

const clic = (sel) => async (p) => { await p.click(sel); await p.waitForTimeout(400); };
const ESTADOS = [
  // [clave, ruta, sesión, acción, volumen]
  ['inicio', 'index.html', null],
  ['inicio-con-sesion', 'index.html', conCita && conCita.solicitante_id],
  ['cuenta', 'cuenta.html', null],
  ['cuenta-errores', 'cuenta.html', null, clic('[data-accion="enviar"]')],
  ['cuenta-menu-pruebas', 'cuenta.html', null, async (p) => { await p.click('.menu-pruebas-boton'); await p.waitForSelector('dialog.menu-pruebas[open]'); await p.waitForTimeout(300); }],
  ['entrar', 'entrar.html', null],
  ['entrar-errores', 'entrar.html', null, clic('[data-accion="enviar"]')],
  ...tramites,
  ['datos-mi-perfil', 'datos.html', (sinTramite || { id: conCita.solicitante_id }).id],
  ['solicitud-nueva', 'solicitud.html', sinTramite && sinTramite.id],
  ['solicitud-nueva-errores', 'solicitud.html', sinTramite && sinTramite.id, clic('section[data-paso]:not([hidden]) [data-accion="siguiente"]')],
  borr && ['solicitud-borrador', `solicitud.html?folio=${borr.folio}`, borr.solicitante_id],
  obs && ['solicitud-observaciones', `solicitud.html?folio=${obs.folio}`, obs.solicitante_id],
  sPausa && ['corregir', `corregir.html?folio=${sPausa.folio}`, sPausa.solicitante_id],
  sPausa && ['corregir-errores', `corregir.html?folio=${sPausa.folio}`, sPausa.solicitante_id, clic('[data-accion="enviar"]')],
  ['verificar', 'verificar.html', null],
  ['verificar-vigente', 'verificar.html', null, async (p) => { await p.fill('#numero', vigente.numero); await p.click('[data-accion="enviar"]'); await p.waitForSelector('[data-verificacion]:not([hidden])'); }],
  noVigente && ['verificar-no-vigente', 'verificar.html', null, async (p) => { await p.fill('#numero', noVigente.numero); await p.click('[data-accion="enviar"]'); await p.waitForSelector('[data-verificacion]:not([hidden])'); }],
  ['verificar-no-existe', 'verificar.html', null, async (p) => { await p.fill('#numero', 'APD-P-2099-999'); await p.click('[data-accion="enviar"]'); await p.waitForTimeout(500); }],
  ['verificar-errores', 'verificar.html', null, clic('[data-accion="enviar"]')],
  ['material', 'material.html', null],
  // Personal
  ['revision', 'revision.html', null],
  ['revision-volumen', 'revision.html', null, null, true],
  ['revisar', `revisar.html?folio=${porClasificar.folio}`, null],
  ['revisar-errores', `revisar.html?folio=${porClasificar.folio}`, null, clic('[data-accion="enviar"]')],
  noCumple && ['revisar-rechazo', `revisar.html?folio=${noCumple.folio}`, null, async (p) => { await p.check('input[name="comprobante_confirma"][value="si"]'); await p.waitForTimeout(300); }],
  ['revisar-observacion-chip', `revisar.html?folio=${porClasificar.folio}`, null, async (p) => {
    const r = p.locator('input[type="radio"][value="con_observacion"]').first();
    await r.check({ force: true }); await p.waitForTimeout(300);
    const chip = p.locator('.chip-fijo:visible, [data-chips-fijos] button:visible').first();
    if (await chip.count()) { await chip.click(); await p.waitForTimeout(200); }
  }],
  ['revisar-visor', `revisar.html?folio=${porClasificar.folio}`, null, async (p) => { const b = p.locator('[data-ver]').first(); await b.click(); await p.waitForSelector('.visor-lienzo, .visor canvas', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(800); }],
  ['citas', 'citas.html', null],
  ['citas-volumen', 'citas.html', null, null, true],
  conCita && ['cotejo', `cotejo.html?folio=${conCita.folio}`, null, async (p) => { if (await p.isVisible('[data-atender-simulada]')) await p.click('[data-atender-simulada]'); await p.waitForTimeout(300); }],
  conCita && ['cotejo-cita-futura', `cotejo.html?folio=${conCita.folio}`, null],
  conCita && ['cotejo-errores', `cotejo.html?folio=${conCita.folio}`, null, async (p) => { if (await p.isVisible('[data-atender-simulada]')) await p.click('[data-atender-simulada]'); await p.click('[data-accion="enviar"]'); await p.waitForTimeout(400); }],
  conCita && ['cotejo-factura', `cotejo.html?folio=${conCita.folio}`, null, async (p) => {
    if (await p.isVisible('[data-atender-simulada]')) await p.click('[data-atender-simulada]');
    await p.check('input[name="se_presento"][value="si"]'); await p.check('input[name="identidad"][value="misma"]');
    for (const k of await p.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await p.check(`input[name="coincide_${k}"][value="si"]`);
    await p.check('input[name="pago"][value="si"]'); await p.waitForTimeout(400);
  }],
  ['grupos', 'grupos.html', null],
  ['grupos-renovacion', 'grupos.html?curso=poda-renovacion', null],
  ['grupos-elegidas-volumen', 'grupos.html', null, async (p) => {
    const c = p.locator('.plan-persona .casilla-input'); const n = Math.min(3, await c.count());
    for (let i = 0; i < n; i++) await c.nth(i).evaluate((e) => { if (!e.checked) e.click(); });
    await p.waitForTimeout(300);
  }, true],
  ['espera-redirige', 'espera.html', null],
  ['programar', 'programar.html?curso=poda-nueva', null],
  ['programar-sin-curso', 'programar.html', null],
  ['programar-sin-personas', 'programar.html?curso=poda-nueva', null, async (p) => {
    for (const k of await p.$$('[data-personas] input:checked')) await k.uncheck({ force: true });
    await p.click('[data-programar="confirmar"]'); await p.waitForSelector('[data-falta] .aviso', { timeout: 4000 }).catch(() => {});
  }],
  ['grupo-integracion', `grupo.html?folio=${gInt.folio}`, null],
  ['grupo-en-curso', `grupo.html?folio=${gCurso.folio}`, null],
  ['grupo-cancelar', `grupo.html?folio=${gInt.folio}`, null, async (p) => {
    const b = p.locator('button:has-text("Cancelar el grupo")').first();
    if (await b.count()) { await b.click(); await p.waitForTimeout(400); }
    const env = p.locator('section:not([hidden]) [data-accion="enviar"]:visible').last();
    if (await env.count()) { await env.click(); await p.waitForTimeout(400); }
  }],
  ['asistencia-hoy', 'asistencia.html', null],
  ['asistencia', `asistencia.html?folio=${gCurso.folio}`, null],
  ['asistencia-sin-marcar', `asistencia.html?folio=${gCurso.folio}`, null, clic('[data-guardar]')],
  ['asistencia-marcada', `asistencia.html?folio=${gCurso.folio}`, null, async (p) => {
    const si = p.locator('.asis-opcion-si .asis-opcion-input:enabled'); const no = p.locator('.asis-opcion-no .asis-opcion-input:enabled');
    if (await si.count()) await si.first().check({ force: true });
    if (await no.count() > 1) await no.nth(1).check({ force: true });
    await p.waitForTimeout(300);
  }],
  ['asistencia-volumen', 'asistencia.html', null, null, true],
  ['aplicar-hoy', 'aplicar.html', null],
  ['aplicar', 'aplicar.html?folio=APD-G-2026-003', null],
  ['examen-entrar', 'examen.html', null],
  ['examen-errores', 'examen.html', null, clic('#entrar [data-accion="enviar"]')],
  ['examen-pregunta', 'aplicar.html?folio=APD-G-2026-003', null, async (p) => {
    const b = p.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
    const ins = await b.getAttribute('data-ins'); await b.click();
    await p.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
    const codigo = (await p.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
    await p.goto(BASE + 'examen.html'); await p.fill('#codigo', codigo);
    await p.click('#entrar [data-accion="enviar"]'); await p.waitForSelector('[data-vista="confirmar"]:not([hidden])');
    await p.click('[data-ir-vista="instrucciones"]'); await p.waitForSelector('[data-vista="instrucciones"]:not([hidden])');
    await p.click('[data-empezar]'); await p.waitForSelector('[data-vista="pregunta"]:not([hidden])');
    // contesta la primera y marca la segunda para revisar, para ver los estados del mapa
    const op = p.locator('[data-vista="pregunta"] input[type="radio"]').first(); await op.check({ force: true });
    await p.waitForTimeout(400);
    const mapa = p.locator('.examen-mapa-titulo'); if (await mapa.count()) { await mapa.click(); await p.waitForTimeout(200); }
  }],
  ['material-personal', 'material-personal.html', null]
].filter(Boolean);

// ---------- Medición dentro de la página ----------
function medirEnPagina() {
  const HOJAS_PROYECTO = ['/app/apd.css', '/app/examen.css'];
  const parse = (s) => {
    const m = s && s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  };
  const mezcla = (arriba, abajo, a) => [0, 1, 2].map((i) => arriba[i] * a + abajo[i] * (1 - a));
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const visible = (el) => {
    if (!el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: false, visibilityProperty: true })) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  // Fondo compuesto detrás de un elemento (incluye su propio fondo si incluyePropio)
  const fondoDe = (el, incluyePropio = true) => {
    const cadena = [];
    for (let x = incluyePropio ? el : el.parentElement; x; x = x.parentElement) cadena.unshift(x);
    let c = [255, 255, 255]; let imagen = false; let opac = null;
    for (const x of cadena) {
      const cs = getComputedStyle(x);
      const op = parseFloat(cs.opacity);
      if (op < 1 && !opac) opac = { op, detras: c.slice() };
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) c = mezcla(bg, c, bg[3]);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/^url\(/.test(cs.backgroundImage)) imagen = true;
      // Un diálogo abierto está en la capa superior: lo de abajo es su fondo, no el de la página
      if (x.tagName === 'DIALOG' && x.open && bg && bg[3] === 1) { /* ya opaco */ }
    }
    return { c, imagen, opac };
  };
  const opacidadAcum = (el) => { let o = 1; for (let x = el; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
  const inactivo = (el) => Boolean(el.closest(':disabled, [aria-disabled="true"], fieldset:disabled')) || opacidadAcum(el) < 0.99;
  const nombre = (el) => {
    const cl = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : (el.className && el.className.baseVal ? el.className.baseVal.split(/\s+/) : []);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cl.length ? '.' + cl.join('.') : ''}`;
  };
  const textoDe = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const hojasProyecto = [...document.styleSheets].filter((s) => s.href && HOJAS_PROYECTO.some((h) => s.href.includes(h)));

  const todos = [...document.querySelectorAll('body *')].filter((el) => !el.closest('svg') || el.tagName === 'svg');
  const vis = todos.filter(visible);

  // Lectura de colores de cada elemento (para comparar con y sin las hojas del proyecto)
  const lee = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo || null);
    return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor, cs.outlineColor, cs.fill, cs.stroke, cs.fontSize, cs.fontWeight, cs.paddingTop, cs.paddingLeft, cs.marginTop, cs.marginBottom, cs.rowGap, cs.columnGap, cs.borderRadius, cs.height].join('|');
  };

  const textos = []; const lineas = []; const iconos = []; const graficos = [];
  const registro = new Map();
  let idx = 0;
  const marca = (el) => { if (!registro.has(el)) registro.set(el, { id: idx++, antes: lee(el), antesB: lee(el, '::before') }); return registro.get(el).id; };

  for (const el of vis) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const tag = el.tagName.toLowerCase();
    const n = nombre(el);
    const fs = parseFloat(cs.fontSize); const fw = parseInt(cs.fontWeight, 10);
    const grande = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const f = fondoDe(el);
    const enLector = !el.closest('.solo-lector');
    // ---- Texto propio ----
    let t = textoDe(el);
    let pseudoTxt = null;
    if (['input', 'textarea', 'select'].includes(tag)) {
      const ty = (el.type || '').toLowerCase();
      if (tag === 'select') t = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
      else if (!['checkbox', 'radio', 'file', 'hidden', 'range', 'color', 'submit', 'button', 'image'].includes(ty)) {
        if (el.value) t = el.value;
        else if (el.placeholder) { const ph = getComputedStyle(el, '::placeholder'); pseudoTxt = { t: el.placeholder, color: ph.color, pseudo: '::placeholder' }; t = ''; }
      }
    }
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps); const ct = p.content;
      if (ct && ct !== 'none' && ct !== 'normal' && /^"(.+)"$/.test(ct) && ct.length > 3 && p.display !== 'none') {
        textos.push({ id: marca(el), el: n, pseudo: ps, texto: ct.slice(1, -1).slice(0, 50), ...mideTexto(p.color, f, el, parseFloat(p.fontSize), parseInt(p.fontWeight, 10)) });
      }
    }
    if (pseudoTxt) textos.push({ id: marca(el), el: n, pseudo: pseudoTxt.pseudo, texto: pseudoTxt.t.slice(0, 50), ...mideTexto(pseudoTxt.color, f, el, fs, fw) });
    if (t && enLector && !(cs.color === 'rgba(0, 0, 0, 0)')) textos.push({ id: marca(el), el: n, texto: t.slice(0, 50), ...mideTexto(cs.color, f, el, fs, fw, grande) });
    else if (t && !enLector) { /* texto sólo para lector: no se mide */ }

    // ---- Bordes ----
    const fuera = fondoDe(el, false).c;
    const lados = ['Top', 'Right', 'Bottom', 'Left'].map((l) => ({ l, w: parseFloat(cs[`border${l}Width`]), s: cs[`border${l}Style`], c: parse(cs[`border${l}Color`]) }))
      .filter((x) => x.w >= 1 && x.s !== 'none' && x.s !== 'hidden' && x.c && x.c[3] > 0);
    const propio = parse(cs.backgroundColor);
    const fondoPropio = f.c;
    if (lados.length) {
      // el lado más visible
      const peores = lados.map((x) => ({ ...x, cc: mezcla(x.c, fuera, x.c[3]) }));
      const unico = [...new Map(peores.map((x) => [hex(x.cc) + x.w + x.s, x])).values()];
      for (const x of unico) {
        lineas.push({ id: marca(el), el: n, tipo: 'borde', lado: x.l, ancho: x.w, estilo: x.s, color: hex(x.cc), fuera: hex(fuera), propio: hex(fondoPropio), rFuera: +razon(x.cc, fuera).toFixed(2), rPropio: +razon(x.cc, fondoPropio).toFixed(2),
          rFondoVsFuera: +razon(fondoPropio, fuera).toFixed(2), control: esControl(el), conTexto: Boolean((el.innerText || el.value || '').trim()), inactivo: inactivo(el), opacidad: +opacidadAcum(el).toFixed(2), texto: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
      }
    } else if (esControl(el)) {
      // control sin borde: su límite es su fondo
      lineas.push({ id: marca(el), el: n, tipo: 'sin-borde', color: hex(fondoPropio), fuera: hex(fuera), rFuera: +razon(fondoPropio, fuera).toFixed(2), rFondoVsFuera: +razon(fondoPropio, fuera).toFixed(2), control: esControl(el), conTexto: Boolean((el.innerText || el.value || '').trim()), inactivo: inactivo(el), opacidad: +opacidadAcum(el).toFixed(2), texto: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
    }
    // Sombra interior usada como filete (falta-marcar, plan-grupo, examen-numero actual)
    if (cs.boxShadow && cs.boxShadow !== 'none' && /inset/.test(cs.boxShadow)) {
      const m = parse(cs.boxShadow);
      if (m) lineas.push({ id: marca(el), el: n, tipo: 'sombra-interior', color: hex(mezcla(m, fondoPropio, m[3])), fuera: hex(fondoPropio), propio: hex(fondoPropio), rFuera: +razon(mezcla(m, fondoPropio, m[3]), fondoPropio).toFixed(2), control: esControl(el), conTexto: true, inactivo: inactivo(el), texto: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
    }
    // Contorno permanente (no de foco): recien-cambiado, plan-cupo-lugar mínimo
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1 && document.activeElement !== el) {
      const m = parse(cs.outlineColor);
      if (m && m[3] > 0) lineas.push({ id: marca(el), el: n, tipo: 'contorno', color: hex(m), fuera: hex(fuera), rFuera: +razon(m, fuera).toFixed(2), control: esControl(el), conTexto: false, inactivo: inactivo(el), texto: '' });
    }
    // Gráfico sin texto que se distingue por su fondo (barras de cupo, lugares, muestras de leyenda, puntos)
    if (propio && propio[3] > 0 && !t && !el.children.length && tag !== 'svg' && !['input', 'select', 'textarea', 'img', 'canvas', 'br'].includes(tag)) {
      graficos.push({ id: marca(el), el: n, color: hex(fondoPropio), fuera: hex(fuera), r: +razon(fondoPropio, fuera).toFixed(2), dato: el.getAttribute('data-lugar') || el.getAttribute('data-muestra') || '', tam: `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}` });
    }
    // Íconos
    if (tag === 'svg') {
      const col = parse(cs.color); const fill = cs.fill; const usa = el.querySelector('use');
      const c = col ? mezcla(col, fondoPropio, col[3]) : null;
      const fondoIcono = fondoDe(el, false).c;
      if (c) iconos.push({ id: marca(el), el: n, icono: usa ? (usa.getAttribute('href') || '').replace('#i-', '') : '', color: hex(c), fondo: hex(fondoIcono), r: +razon(c, fondoIcono).toFixed(2), decorativo: el.getAttribute('aria-hidden') === 'true', conTexto: Boolean((el.parentElement.innerText || '').trim()), inactivo: inactivo(el), padre: nombre(el.parentElement) });
    }
  }
  function esControl(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select' || tag === 'textarea') return 'campo';
    if (tag === 'input') { const ty = (el.type || 'text').toLowerCase(); if (['hidden'].includes(ty)) return false; if (['checkbox', 'radio'].includes(ty)) return 'casilla'; if (['submit', 'button'].includes(ty)) return 'boton'; return 'campo'; }
    if (tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'a' && /\bbtn\b/.test(el.className))) return 'boton';
    if (tag === 'summary') return 'boton';
    if (el.matches && el.matches('.chip, .chip-fijo, .asis-opcion, .opcion-fila, .opcion-tarjeta, label.casilla')) return 'boton';
    return false;
  }
  function mideTexto(color, f, el, fs, fw, grande) {
    const tc = parse(color) || [0, 0, 0, 1];
    if (grande === undefined) grande = fs >= 24 || (fs >= 18.66 && fw >= 700);
    let txt = mezcla(tc, f.c, tc[3]); let bg = f.c;
    if (f.opac) { txt = mezcla(txt, f.opac.detras, f.opac.op); bg = mezcla(bg, f.opac.detras, f.opac.op); }
    const r = razon(txt, bg);
    return { color: hex(txt), fondo: hex(bg), r: +r.toFixed(2), minimo: grande ? 3 : 4.5, tam: fs, peso: fw, grande, inactivo: inactivo(el), imagen: f.imagen, opacidad: f.opac ? f.opac.op : 1 };
  }

  // ---------- Inventario C6 ----------
  const botones = []; const estados = []; const avisos = []; const letras = {}; const espacios = {};
  const pareceBoton = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'summary' || el.getAttribute('role') === 'button') return true;
    if (tag === 'input' && ['submit', 'button'].includes(el.type)) return true;
    if (tag === 'a') { const cs = getComputedStyle(el); const bg = parse(cs.backgroundColor); return /\bbtn\b/.test(el.className) || (bg && bg[3] > 0) || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 1; }
    if (tag === 'label' && el.matches('.asis-opcion')) return true;
    return false;
  };
  for (const el of vis) {
    const cs = getComputedStyle(el);
    if (pareceBoton(el) && !el.closest('.solo-lector')) {
      const b = el.getBoundingClientRect();
      const bg = parse(cs.backgroundColor);
      botones.push({ id: marca(el), el: el.tagName.toLowerCase(), clases: (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter((c) => c && !/^icono/.test(c)).sort().join(' '),
        texto: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40), fondo: bg && bg[3] > 0 ? hex(mezcla(bg, fondoDe(el, false).c, bg[3])) : 'transparente', color: hex(parse(cs.color)),
        borde: parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && parse(cs.borderTopColor)[3] > 0 ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${hex(parse(cs.borderTopColor))}` : (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none' && parse(cs.borderLeftColor)[3] > 0 ? `izq ${cs.borderLeftWidth} ${cs.borderLeftStyle} ${hex(parse(cs.borderLeftColor))}` : 'sin borde'),
        radio: cs.borderTopLeftRadius, alto: Math.round(b.height), ancho: Math.round(b.width), peso: cs.fontWeight, tam: cs.fontSize, familia: cs.fontFamily.split(',')[0].replace(/["']/g, ''), subrayado: cs.textDecorationLine.includes('underline'),
        presionado: el.getAttribute('aria-pressed') || el.getAttribute('aria-current') || (el.querySelector && el.querySelector('input:checked') ? 'checked' : ''), inactivo: inactivo(el) });
    }
    if (el.classList.contains('estado')) {
      const usa = el.querySelector('use');
      estados.push({ id: marca(el), texto: (el.innerText || '').replace(/\s+/g, ' ').trim(), familia: [...el.classList].filter((c) => c.startsWith('estado-')).join(' ') || 'estado (terminado)', icono: usa ? (usa.getAttribute('href') || '').replace('#i-', '') : '', donde: nombre(el.parentElement), tam: cs.fontSize });
    }
    if (el.classList.contains('aviso') || el.classList.contains('resultado') || el.classList.contains('verificacion') || el.classList.contains('resumen-errores') || el.classList.contains('nota-prueba')) {
      const tit = el.querySelector('.aviso-titulo, .resultado-titulo, h2, h3, strong');
      const usa = el.querySelector('use');
      avisos.push({ id: marca(el), clase: [...el.classList].sort().join(' '), tono: el.getAttribute('data-tono') || '', icono: usa ? (usa.getAttribute('href') || '').replace('#i-', '') : '', titulo: tit ? tit.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : '', texto: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 110) });
    }
    if (textoDe(el)) { const k = `${cs.fontSize} ${cs.fontWeight} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`; letras[k] = (letras[k] || 0) + 1; }
    for (const p of ['marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'rowGap', 'columnGap']) {
      const v = parseFloat(cs[p]);
      if (v && isFinite(v)) { const k = `${Math.round(v * 10) / 10}`; (espacios[k] ||= { n: 0, ej: [] }).n++; if (espacios[k].ej.length < 4) espacios[k].ej.push(`${nombre(el)} ${p}`); }
    }
  }

  // ---------- Origen: se apagan las hojas del proyecto y se vuelve a leer ----------
  for (const s of hojasProyecto) s.disabled = true;
  const cambia = new Map();
  for (const [el, r] of registro) cambia.set(r.id, lee(el) !== r.antes || lee(el, '::before') !== r.antesB);
  for (const s of hojasProyecto) s.disabled = false;
  const origen = (o) => ({ ...o, origen: cambia.get(o.id) ? 'proyecto' : 'estándar' });
  return { url: location.pathname + location.search, ancho: innerWidth, hojasProyecto: hojasProyecto.length,
    textos: textos.map(origen), lineas: lineas.map(origen), iconos: iconos.map(origen), graficos: graficos.map(origen),
    botones: botones.map(origen), estados: estados.map(origen), avisos, letras, espacios };
}

// Foco: Tab por toda la página; del elemento enfocado (o del ancestro que pinta el anillo) se lee el contorno
async function focoActual() {
  // con movimiento reducido el estándar deja transiciones de 0.01 ms en todo: se espera a que terminen antes de leer
  await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {})));
  const parse = (s) => { const m = s && s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const mezcla = (a, b, x) => [0, 1, 2].map((i) => a[i] * x + b[i] * (1 - x));
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fondo = (el, propio) => { const ch = []; for (let x = propio ? el : el.parentElement; x; x = x.parentElement) ch.unshift(x); let c = [255, 255, 255]; for (const x of ch) { const b = parse(getComputedStyle(x).backgroundColor); if (b && b[3] > 0) c = mezcla(b, c, b[3]); } return c; };
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  let pinta = null; let sombra = null;
  for (let x = a, k = 0; x && k < 4; x = x.parentElement, k++) {
    const cs = getComputedStyle(x);
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) { pinta = x; break; }
    if (cs.boxShadow && cs.boxShadow !== 'none' && k === 0) sombra = cs.boxShadow;
  }
  const b = a.getBoundingClientRect();
  const visibleA = b.width > 0 && b.height > 0;
  if (!pinta) return { el: nombre(a), texto: (a.innerText || a.value || a.getAttribute('aria-label') || '').trim().slice(0, 40), sinContorno: true, sombra, visible: visibleA, propio: hex(fondo(a, true)) };
  const cs = getComputedStyle(pinta);
  const col = parse(cs.outlineColor); const fuera = fondo(pinta, false); const propio = fondo(pinta, true);
  return { el: nombre(a), pinta: pinta === a ? 'el mismo' : nombre(pinta), texto: (a.innerText || a.value || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), estilo: cs.outlineStyle, ancho: cs.outlineWidth, sep: cs.outlineOffset,
    color: hex(col), fuera: hex(fuera), propio: hex(propio), rFuera: +razon(col, fuera).toFixed(2), rPropio: +razon(col, propio).toFixed(2), visible: visibleA };
}

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const resultado = [];
for (const [vista, ancho, alto] of [['telefono', 390, 844], ['escritorio', 1440, 900]]) {
  for (const [clave, ruta, sesion, accion, volumen] of ESTADOS) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, timezoneId: 'America/Mexico_City', locale: 'es-MX', reducedMotion: 'reduce', hasTouch: vista === 'telefono', isMobile: vista === 'telefono' });
    if (volumen) await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: VOLUMEN, contentType: 'application/json' }));
    if (sesion) await ctx.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e.message || e)));
    const fila = { clave, ruta, vista, ancho };
    try {
      await p.goto(BASE + ruta, { waitUntil: 'networkidle' });
      await p.waitForTimeout(500);
      if (accion) await accion(p);
      await p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
      Object.assign(fila, await p.evaluate(medirEnPagina));
      // Foco: hasta 160 tabulaciones o hasta que se repita el primero
      const focos = []; let primero = null;
      await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
      for (let i = 0; i < 160; i++) {
        await p.keyboard.press('Tab');
        const f = await p.evaluate(focoActual);
        if (!f) continue;
        const k = f.el + '|' + f.texto;
        if (k === primero) break;
        if (!primero) primero = k;
        focos.push(f);
      }
      fila.focos = focos;
      if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, `${clave}-${ancho}.png`), fullPage: true });
    } catch (e) { fila.error = String(e.message || e).split('\n')[0]; }
    fila.erroresPagina = errores;
    resultado.push(fila);
    process.stdout.write(`${fila.error ? 'ERR ' : 'ok  '} ${vista} ${clave}${fila.error ? ' · ' + fila.error : ''}\n`);
    await ctx.close();
  }
}
await navegador.close();
writeFileSync(SALIDA, JSON.stringify(resultado));
console.log(`${resultado.length} estados medidos · ${SALIDA}`);
