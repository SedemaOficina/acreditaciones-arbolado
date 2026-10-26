// AUDITORÍA DEL SITIO · recorre todas las pantallas en teléfono y escritorio, con cada caso de prueba, y busca:
//   · errores de consola y de la página, y recursos que no cargan (404, fallos de red);
//   · enlaces internos rotos y anclas (#id) que no existen; ids repetidos; referencias ARIA a ids que no existen;
//   · desborde horizontal de la página y textos recortados; elementos con hidden que se ven;
//   · elementos encimados (cajas de texto o controles que se tapan entre sí);
//   · objetivos táctiles menores de 24 × 24 px (WCAG 2.2, 2.5.8);
//   · botones que no hacen nada: cada botón visible se presiona en una página recién cargada y se comprueba que algo
//     cambie (la página, la dirección, el foco, un diálogo o un atributo aria).
// Toma una captura de página completa de cada estado. Complementa a probar-sitio.mjs (recorridos con resultado esperado).
//
// Uso: node herramientas/auditar-sitio.mjs http://localhost:8765/ verificacion/auditoria
//   CHROMIUM=<ruta> para usar un Chromium instalado; SIN_CLICS=1 omite la prueba de botones.
import { chromium } from 'playwright';
import { navegadorSinGoogle } from './sin-google.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const SALIDA = resolve(raiz, process.argv[3] || 'verificacion/auditoria');
mkdirSync(join(SALIDA, 'capturas'), { recursive: true });
const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));

const VISTAS = { telefono: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, escritorio: { viewport: { width: 1366, height: 900 } } };
// Tamaños que sólo se revisan en los estados que los piden (cuarto elemento del estado): el teléfono chico de 360 px
// (auditoría 2026-10-20, B1-05: la fila de asistencia se encimaba ahí)
const VISTAS_EXTRA = { telefono360: { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true } };

// Estados a recorrer: [nombre, página, sesión (id de solicitante) o null]
const sol = (estado, f = () => true) => datos.solicitud.find((s) => s.estado === estado && f(s));
const activa = (s) => s && datos.solicitante.find((p) => p.id === s.solicitante_id && p.estado === 'activa');
// «Consultar un trámite» (sin registro asistido, decisión del 26/10/2026): la ficha de una persona con observaciones
const conObsConsulta = datos.solicitud.find((s) => s.estado === 'con_observaciones' && activa(s));
const conPersona = (estado, f) => { const s = datos.solicitud.find((x) => x.estado === estado && (!f || f(x)) && activa(x)); return s ? [s, s.solicitante_id] : [null, null]; };
const [borr, pBorr] = conPersona('borrador');
const [obs, pObs] = conPersona('con_observaciones');
const [cita, pCita] = conPersona('validada_en_linea');
const [insc, pInsc] = conPersona('inscrita');
const [acred, pAcred] = conPersona('acreditada');
const [, pRech] = conPersona('rechazada');
const enviadaDict = sol('enviada', (s) => s.tipo_acreditacion === 'dictaminador') || sol('enviada');
const enviadaPoda = sol('enviada', (s) => s.tipo_acreditacion === 'poda');
// Una persona sin trámite que puede iniciar una solicitud: sin la poda vigente por más de un mes (desde la sesión del
// 23/10 hay personas con la poda vigente que todavía no pueden pedir nada: dos años de poda para la de dictaminador)
const unMes = new Date(`${datos.fecha_corte}T12:00:00Z`); unMes.setUTCMonth(unMes.getUTCMonth() + 1);
const sinTramite = datos.solicitante.find((p) => p.estado === 'activa' && !datos.solicitud.some((s) => s.solicitante_id === p.id)
  && !datos.acreditacion.some((a) => a.solicitante_id === p.id && a.tipo_acreditacion === 'poda' && a.vence_en > unMes.toISOString().slice(0, 10)));
const canc = datos.acreditacion.find((a) => a.cancelada_en);
// Oportunidades para corregir (ajustes del equipo, 25/10/2026): revisiones en línea con observaciones de cada solicitud
const obsDe = (s) => datos.revision.filter((r) => r.solicitud_id === s.id && r.resultado === 'con_observaciones').length;
const segundaCorreccion = datos.solicitud.find((s) => s.estado === 'enviada' && obsDe(s) === 2);
const ultimaOportunidad = datos.solicitud.find((s) => s.estado === 'con_observaciones' && obsDe(s) === 2);
const sinOportunidades = datos.solicitud.find((s) => s.estado === 'concluida_sin_atender' && /^Se agotaron las oportunidades de corrección/.test(s.motivo_cierre || ''));
const enPaso = (e) => { const r = (datos.reposicion || []).find((x) => x.estado === e); return r ? datos.acreditacion.find((a) => a.id === r.acreditacion_id) : null; };
const ESTADOS = [
  ['inicio', 'index.html', null],
  ['crear-cuenta', 'cuenta.html', null],
  ['entrar', 'entrar.html', null],
  ['verificar', 'verificar.html', null],
  ['examen-entrar', 'examen.html', null],
  ['aplicar-examen', 'aplicar.html', null],
  ['bandeja-revision', 'revision.html', null],
  ['agenda-citas', 'citas.html', null],
  // «Grupos» paso a paso (decisión del 24/10/2026): cada paso, el curso de un día y un grupo que ya existe. Lo que eran
  // «programar» y «programar-sin-curso» son el paso 2 y el paso 1: programar.html sólo lleva a «Grupos» (como
  // espera.html, no se recorre aquí: lo prueba probar-sitio)
  ['grupos', 'grupos.html', null],
  ['grupos-semana', 'grupos.html?curso=poda-nueva&paso=2', null],
  ['grupos-renovacion', 'grupos.html?curso=poda-renovacion&paso=2', null],
  ['grupos-paso-3', 'grupos.html?curso=poda-nueva&paso=3', null],
  ['grupos-paso-4', 'grupos.html?curso=poda-nueva&paso=4', null],
  ['grupos-grupo-existente', 'grupos.html?grupo=APD-G-2026-004&paso=3', null],
  ['grupo-integracion', `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_integracion').folio}`, null],
  ['grupo-en-curso', `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}`, null],
  ['asistencia', 'asistencia.html', null],
  // Un grupo cancelado (B1-02: su barra de cupo, marcada hidden, se veía) y la asistencia de un grupo en curso, también a
  // 360 px (B1-04: «Corregir otro día» de 40.8 px; B1-05: encimado de la fila) (auditoría 2026-10-20)
  ['grupo-cancelado', `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'cancelado').folio}`, null],
  ['asistencia-grupo', `asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio <= datos.fecha_corte).folio}`, null, ['telefono360']],
  // Material de estudio, público y del personal (auditoría 2026-10-18, A 8.4)
  ['material', 'material.html', null],
  ['material-personal', 'material-personal.html', null],
  enviadaDict && ['revisar-dictaminador', `revisar.html?folio=${enviadaDict.folio}`, null],
  enviadaPoda && ['revisar-poda', `revisar.html?folio=${enviadaPoda.folio}`, null],
  cita && ['cotejo', `cotejo.html?folio=${cita.folio}`, null],
  pCita && ['tramites-cita', 'tramites.html', pCita],
  pObs && ['tramites-observaciones', 'tramites.html', pObs],
  pObs && ['corregir-observaciones', `solicitud.html?folio=${obs.folio}`, pObs],
  pInsc && ['tramites-grupo', 'tramites.html', pInsc],
  pAcred && ['tramites-acreditada', 'tramites.html', pAcred],
  pRech && ['tramites-rechazada', 'tramites.html', pRech],
  pBorr && ['solicitud-borrador', `solicitud.html?folio=${borr.folio}`, pBorr],
  sinTramite && ['solicitud-nueva', 'solicitud.html', sinTramite.id],
  (sinTramite || { id: pCita }) && ['mi-perfil', 'datos.html', (sinTramite || { id: pCita }).id],
  pCita && ['corregir-sin-pausa', 'corregir.html', pCita],
  // Cancelación (P120) y reposición de la credencial (P140), sesión de trabajo del 23/10/2026
  ['acreditaciones', 'acreditaciones.html', null],
  ['acreditacion-vigente-instructor', 'acreditacion.html?numero=PD-2025-K100&perfil=instructor', null],
  canc && ['acreditacion-cancelada', `acreditacion.html?numero=${canc.numero}`, null],
  enPaso('solicitada') && ['acreditacion-acta-por-revisar', `acreditacion.html?numero=${enPaso('solicitada').numero}`, null],
  enPaso('acta_aceptada') && ['acreditacion-por-entregar', `acreditacion.html?numero=${enPaso('acta_aceptada').numero}`, null],
  canc && ['tramites-cancelada', 'tramites.html', canc.solicitante_id],
  enPaso('con_observaciones') && ['tramites-reposicion-observada', 'tramites.html', enPaso('con_observaciones').solicitante_id],
  enPaso('acta_aceptada') && ['tramites-reposicion-aceptada', 'tramites.html', enPaso('acta_aceptada').solicitante_id],
  enPaso('repuesta') && ['reposicion-pedir', `reposicion.html?numero=${enPaso('repuesta').numero}`, enPaso('repuesta').solicitante_id],
  enPaso('con_observaciones') && ['reposicion-corregir', `reposicion.html?numero=${enPaso('con_observaciones').numero}`, enPaso('con_observaciones').solicitante_id],
  // Ajustes del equipo, 25/10/2026: el inicio y la ficha del grupo del perfil «capacitación», la revisión de la segunda
  // corrección y la persona en su última oportunidad o con la solicitud cerrada al agotarlas. Al corregir en su última
  // oportunidad (solicitud.html?folio=) es la misma pantalla que «corregir-observaciones»: no se repite aquí (repetía su
  // aviso conocido, «a.salto»); la línea de las oportunidades la prueba probar-sitio (SOLO=ajustes25), con axe
  ['capacitacion', 'capacitacion.html', null],
  ['grupo-capacitacion', `grupo.html?folio=${(datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio) || {}).folio}&perfil=capacitacion`, null],
  ['grupo-en-curso-capacitacion', `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}&perfil=capacitacion`, null],
  segundaCorreccion && ['revisar-ultima-oportunidad', `revisar.html?folio=${segundaCorreccion.folio}`, null],
  ultimaOportunidad && ['tramites-ultima-oportunidad', 'tramites.html', ultimaOportunidad.solicitante_id],
  sinOportunidades && ['tramites-sin-oportunidades', 'tramites.html', sinOportunidades.solicitante_id],
  // «Consultar un trámite» (sin registro asistido, decisión de Liber del 26/10/2026): la búsqueda y la ficha de una persona.
  // Ya no están «Registrar a una persona», la solicitud capturada por el personal ni la etiqueta de «Revisar»
  ['ventanilla', 'ventanilla.html', null],
  conObsConsulta && ['ventanilla-ficha', `ventanilla.html?persona=${encodeURIComponent(conObsConsulta.solicitante_id)}`, null]
].filter(Boolean);

// Por partes (25/10/2026): AUDITAR_PARTE=k/n recorre sólo la parte k de n de los estados (uno de cada n), para que cada
// corrida quepa en el tiempo de una sola orden; las salidas de las n partes se suman a mano (paginas, presionados, hallazgos)
const enParte = (process.env.AUDITAR_PARTE || '').match(/^(\d+)\/(\d+)$/);
const ESTADOS_AQUI = enParte ? ESTADOS.filter((_, i) => i % Number(enParte[2]) === Number(enParte[1]) - 1) : ESTADOS;

const hallazgos = [];
const agrega = (estado, vista, tipo, detalle) => hallazgos.push({ estado, vista, tipo, detalle });

// Revisión en la página: anclas, ids, ARIA, desborde, recortes, encimados, objetivos chicos
function revisaEnPagina() {
  const r = { ids: [], aria: [], anclas: [], desborde: null, recortes: [], encimados: [], chicos: [], bajos: [], ocultos: [], enlaces: [], botones: [] };
  const visible = (el) => {
    if (!el.isConnected) return false;
    // checkVisibility también descarta el contenido de un <details> cerrado (content-visibility)
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
    else if (!/^(https?:|mailto:|tel:|#|blob:|data:)/.test(h)) r.enlaces.push(h);
  }
  // Lo marcado con hidden no debe verse (una clase con display le gana al atributo)
  for (const el of document.querySelectorAll('[hidden]')) {
    const b = el.getBoundingClientRect();
    if (getComputedStyle(el).display !== 'none' && b.width > 0 && b.height > 0) r.ocultos.push(nombre(el));
  }
  const de = document.documentElement;
  if (de.scrollWidth > window.innerWidth + 1) r.desborde = `${de.scrollWidth}px de ancho en una ventana de ${window.innerWidth}px`;
  // Texto recortado: contenedor con overflow oculto cuyo contenido es más ancho o alto que la caja
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.solo-lector,svg,[data-visor-hojas],.tabla-marco,.visor-hojas')) continue;
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && el.textContent.trim() && !el.matches('textarea,input,select,img,canvas')
      && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && cs.textOverflow !== 'ellipsis') {
      r.recortes.push(`${nombre(el)} (${el.scrollWidth}×${el.scrollHeight} en ${el.clientWidth}×${el.clientHeight})`);
    }
  }
  // Hojas: elementos con texto propio o controles; se comparan entre sí los que no son ancestro uno del otro
  // La parte visible de una caja: recortada por los ancestros con overflow distinto de visible (acordeones cerrados,
  // listas desplegables, tablas que en teléfono ocultan su encabezado)
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
  // Un mismo control compuesto (contraseña con «Mostrar» dentro) no se cuenta como encimado
  const compuesto = (a, b) => { const c = a.closest('.contrasena-caja,.control-grupo,.fecha-grupo,.combo'); return c && c.contains(b); };
  for (let i = 0; i < hojas.length; i++) {
    for (let j = i + 1; j < hojas.length; j++) {
      const A = hojas[i], B = hojas[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el) || A.fijo !== B.fijo || compuesto(A.el, B.el)) continue;
      const w = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left);
      const h = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top);
      if (w > 3 && h > 3) {
        // Texto en línea seguido de otro dentro del mismo renglón (p. ej., un enlace dentro de un párrafo) no cuenta
        const comun = A.el.parentElement === B.el.parentElement && getComputedStyle(A.el).display.startsWith('inline') && getComputedStyle(B.el).display.startsWith('inline') && h < 6;
        if (comun) continue;
        const k = `${nombre(A.el)} × ${nombre(B.el)}`;
        if (!yaVisto.has(k)) { yaVisto.add(k); r.encimados.push(`${k} (${Math.round(w)}×${Math.round(h)} px)`); }
      }
    }
  }
  // Objetivos táctiles: controles y enlaces fuera de un párrafo (los enlaces en texto corrido están exentos en WCAG 2.5.8)
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex="0"]')) {
    if (!visible(el)) continue;
    if (el.matches('a') && el.closest('p,li,td,dd,figcaption,.ayuda,.bajada') && getComputedStyle(el).display === 'inline') continue;
    let b = el.getBoundingClientRect();
    if (el.matches('input[type=radio],input[type=checkbox]')) { const l = el.closest('label') || document.querySelector(`label[for="${el.id}"]`); if (l) b = l.getBoundingClientRect(); }
    if (b.width < 24 || b.height < 24) r.chicos.push(`${nombre(el)} (${Math.round(b.width)}×${Math.round(b.height)} px)`);
    // El estándar pide 44 px de alto (--objetivo-min) en los controles: se anota aparte, como aviso
    else if (el.matches('button,input:not([type=radio]):not([type=checkbox]),select,summary') && b.height < 43.5) r.bajos.push(`${nombre(el)} (${Math.round(b.width)}×${Math.round(b.height)} px)`);
  }
  // Botones visibles para la prueba de clics, con un selector estable. Los inactivos con aria-disabled (conservan el foco,
  // RI-02) tampoco se presionan: Playwright no los presiona y lo que hacen al tocarlos lo prueba probar-sitio (desde la
  // sesión del 23/10 «Programar» abría en octubre con casi todos sus días inactivos; desde el 24/10, los días del curso de
  // un día que no se pueden, en el paso 2 de «Grupos»)
  const botones = [...document.querySelectorAll('button,summary,[role=button],a[href^="#"]:not([href="#"])')].filter((el) => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  r.botones = botones.map((el, i) => { el.dataset.auditoria = String(i); return { i, nombre: nombre(el) }; });
  return r;
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

// El mapa de Google de «Mis trámites» (P68) se contesta con una página mínima: herramientas/sin-google.mjs
const navegador = navegadorSinGoogle(await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}));
const recursosRevisados = new Map();
let paginas = 0;
let presionados = 0;
for (const [vistaNombre, vista] of Object.entries({ ...VISTAS, ...VISTAS_EXTRA })) {
  for (const [nombre, ruta, sesion, extra] of ESTADOS_AQUI) {
    if (VISTAS_EXTRA[vistaNombre] && !(extra || []).includes(vistaNombre)) continue;
    const contexto = await navegador.newContext(vista);
    if (sesion) await contexto.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await contexto.newPage();
    // Una pantalla con cambios sin guardar pregunta antes de salir («Grupos», antes «Programar un curso», B5-02): al volver a cargarla
    // para el botón siguiente se sale (sin esto, el diálogo se descartaba, la carga se cancelaba con ERR_ABORTED y la
    // auditoría se detenía desde la 0.59)
    let huboDialogo = false;
    page.on('dialog', (d) => { if (d.type() === 'beforeunload') { d.accept().catch(() => {}); return; } huboDialogo = true; d.dismiss().catch(() => {}); });
    const consola = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => consola.push(`excepción: ${e.message}`));
    page.on('requestfailed', (q) => consola.push(`no cargó: ${q.url().replace(BASE, '')} (${q.failure() && q.failure().errorText})`));
    page.on('response', (q) => { if (q.status() >= 400) consola.push(`HTTP ${q.status()}: ${q.url().replace(BASE, '')}`); });
    await page.goto(BASE + ruta, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    paginas++;
    const destino = page.url().replace(BASE, '');
    if (destino.split('?')[0] !== ruta.split('?')[0]) agrega(nombre, vistaNombre, 'redirección', `${ruta} llevó a ${destino}`);
    const r = await page.evaluate(revisaEnPagina);
    await page.screenshot({ path: join(SALIDA, 'capturas', `${nombre}-${vistaNombre}.png`), fullPage: true });
    for (const c of consola) agrega(nombre, vistaNombre, 'consola', c);
    for (const x of r.ids) agrega(nombre, vistaNombre, 'id repetido', x);
    for (const x of r.aria) agrega(nombre, vistaNombre, 'referencia a id inexistente', x);
    for (const x of r.anclas) agrega(nombre, vistaNombre, 'ancla rota', x);
    if (r.desborde) agrega(nombre, vistaNombre, 'desborde horizontal', r.desborde);
    for (const x of r.recortes) agrega(nombre, vistaNombre, 'texto recortado', x);
    for (const x of r.encimados) agrega(nombre, vistaNombre, 'encimado', x);
    for (const x of r.chicos) agrega(nombre, vistaNombre, 'objetivo chico', x);
    for (const x of r.ocultos) agrega(nombre, vistaNombre, 'marcado hidden pero visible', x);
    for (const x of r.bajos) agrega(nombre, vistaNombre, 'control de menos de 44 px de alto', x);
    for (const h of r.enlaces) {
      const url = new URL(h, page.url()).href.split('#')[0];
      if (!url.startsWith(BASE)) continue;
      if (!recursosRevisados.has(url)) recursosRevisados.set(url, (await page.request.get(url)).status());
      if (recursosRevisados.get(url) >= 400) agrega(nombre, vistaNombre, 'enlace roto', `${h} (HTTP ${recursosRevisados.get(url)})`);
    }
    // Botones: sólo en escritorio (en teléfono son los mismos), uno por uno sobre la página recién cargada
    if (vistaNombre === 'escritorio' && !process.env.SIN_CLICS) {
      for (const b of r.botones) {
        await page.goto(BASE + ruta, { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);
        const listo = await page.evaluate(revisaEnPagina);
        const mismo = listo.botones.find((x) => x.nombre === b.nombre) || listo.botones[b.i];
        if (!mismo) continue;
        const loc = page.locator(`[data-auditoria="${mismo.i}"]`);
        const antes = await page.evaluate(huella);
        huboDialogo = false;
        const paginasAntes = contexto.pages().length;
        presionados++;
        // El enlace «Ir al contenido» sólo aparece con el teclado: se prueba con Tab y Enter
        if (await loc.evaluate((el) => el.matches('.salto'))) {
          await page.keyboard.press('Tab');
          const enfocado = await loc.evaluate((el) => document.activeElement === el);
          await page.keyboard.press('Enter'); await page.waitForTimeout(200);
          // El navegador mueve el punto de partida del teclado al contenido: el siguiente Tab debe caer dentro de él
          await page.keyboard.press('Tab');
          const dentro = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('#contenido')));
          if (!enfocado || !dentro) agrega(nombre, vistaNombre, 'botón sin efecto visible', `${b.nombre}: con el teclado no lleva al contenido`);
          continue;
        }
        try { await loc.click({ timeout: 2000 }); } catch (e) { agrega(nombre, vistaNombre, 'botón que no se puede presionar', `${b.nombre}: ${e.message.split('\n')[0]}`); continue; }
        await page.waitForTimeout(500);
        const despues = await page.evaluate(huella).catch(() => 'navegó');
        const nueva = contexto.pages().length > paginasAntes;
        if (antes === despues && !huboDialogo && !nueva) agrega(nombre, vistaNombre, 'botón sin efecto visible', b.nombre);
        for (const p of contexto.pages().slice(1)) await p.close();
      }
    }
    await contexto.close();
    process.stdout.write('.');
  }
}
await navegador.close();
const porTipo = {};
for (const h of hallazgos) porTipo[h.tipo] = (porTipo[h.tipo] || 0) + 1;
writeFileSync(join(SALIDA, 'hallazgos.json'), JSON.stringify({ base: BASE, estados: ESTADOS_AQUI.map(([n, r]) => [n, r]), paginas, presionados, porTipo, hallazgos }, null, 2));
console.log(`\n${paginas} pantallas revisadas (${ESTADOS_AQUI.length} estados × 2 tamaños, y algunos a 360 px${enParte ? `; parte ${enParte[1]} de ${enParte[2]}` : ''}); ${presionados} botones presionados`);
for (const [t, n] of Object.entries(porTipo)) console.log(`  ${t}: ${n}`);
if (!hallazgos.length) console.log('Sin hallazgos.');
