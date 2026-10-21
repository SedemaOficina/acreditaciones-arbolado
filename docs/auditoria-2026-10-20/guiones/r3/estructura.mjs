// B4 · Estructura y nombres, con el árbol de accesibilidad de Chromium (CDP Accessibility.getFullAXTree, el que usa un
// lector de pantalla): idioma, título, encabezados en orden, botones y enlaces con el mismo nombre que hacen cosas
// distintas, enlaces genéricos, controles sin nombre, tablas sin encabezados, regiones vivas, letra mínima,
// cuerpo a 16 px en teléfono, reflow a 320 px (1.4.10), espaciado de texto (1.4.12) y contraseñas que se pueden pegar.
// Uso: node estructura.mjs → ../estructura.json
import { navegador, contexto, guarda, datos, BASE } from './lib.mjs';

const nav = await navegador();
const p0 = await nav.newPage();
await p0.goto(BASE + 'index.html');
const casos = await p0.evaluate(async () => { const d = await APD.cargar(); return Object.fromEntries(APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.filter((c) => c.persona).map((c) => [c.clave, c.persona.id]))); });
await p0.close();
const enviada = (f) => datos.solicitud.find((s) => s.estado === 'enviada' && f(s)).folio;
const ESTADOS = [
  ['index', 'index.html'], ['cuenta', 'cuenta.html'], ['entrar', 'entrar.html'], ['verificar', 'verificar.html'], ['material', 'material.html'], ['examen', 'examen.html'],
  ['tramites cita', 'tramites.html', casos.cita], ['tramites acreditada', 'tramites.html', casos.acreditada], ['tramites por-vencer', 'tramites.html', casos['por-vencer']], ['tramites obs', 'tramites.html', casos['obs-poda']],
  ['datos', 'datos.html', casos.cita], ['solicitud', 'solicitud.html?tipo=poda', casos['no-renovable']], ['corregir', 'corregir.html?folio=APD-S-2026-00052', datos.solicitud.find((s) => s.folio === 'APD-S-2026-00052').solicitante_id],
  ['revision', 'revision.html'], ['revisar poda', `revisar.html?folio=${enviada((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva')}`], ['revisar dictaminador', `revisar.html?folio=${enviada((s) => s.perfil_academico === 'por_clasificar')}`],
  ['citas', 'citas.html'], ['cotejo', 'cotejo.html?folio=APD-S-2026-00042'], ['grupos', 'grupos.html?curso=poda-nueva'], ['programar', 'programar.html?curso=poda-nueva'],
  ['grupo', 'grupo.html?folio=APD-G-2026-005'], ['grupo en curso', 'grupo.html?folio=APD-G-2026-003'], ['asistencia', 'asistencia.html?folio=APD-G-2026-003'], ['aplicar', 'aplicar.html?folio=APD-G-2026-006'],
  ['material-personal', 'material-personal.html'],
  ['VOL revision', 'revision.html', null, true], ['VOL citas', 'citas.html', null, true], ['VOL grupos', 'grupos.html?curso=poda-nueva', null, true], ['VOL aplicar', 'aplicar.html?folio=APD-G-2026-020', null, true], ['VOL asistencia', 'asistencia.html?folio=APD-G-2026-024', null, true]
];

// Lo que se mide en la página
function enPagina() {
  const r = { lang: document.documentElement.lang, titulo: document.title, h: [], letra: { min: 99, bajo12: [], cuerpo: null }, tablas: [], pegar: [], desborde: null, recortes: [], vivas: [] };
  const vis = (el) => el.checkVisibility && el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !el.closest('[hidden],[aria-hidden="true"]');
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')) if (vis(h)) r.h.push([Number(h.getAttribute('aria-level') || h.tagName[1]), h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)]);
  // Letra: cada nodo de texto visible
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || vistos.has(el) || !vis(el) || el.closest('.solo-lector,svg,script,style,template')) continue;
    vistos.add(el);
    const cs = getComputedStyle(el); const f = parseFloat(cs.fontSize);
    if (cs.position === 'absolute' && el.getBoundingClientRect().width <= 1) continue;
    r.letra.min = Math.min(r.letra.min, f);
    if (f < 12) r.letra.bajo12.push(`${f}px ${el.tagName.toLowerCase()}.${el.className} «${n.textContent.trim().slice(0, 40)}»`);
  }
  const pcuerpo = [...document.querySelectorAll('main p')].find(vis);
  r.letra.cuerpo = pcuerpo ? parseFloat(getComputedStyle(pcuerpo).fontSize) : null;
  r.letra.body = parseFloat(getComputedStyle(document.body).fontSize);
  r.letra.controles = [...new Set([...document.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=hidden]),select,textarea')].filter(vis).map((e) => parseFloat(getComputedStyle(e).fontSize)))];
  for (const t of document.querySelectorAll('table')) if (vis(t)) r.tablas.push({ th: t.querySelectorAll('th').length, thead: Boolean(t.tHead), caption: Boolean(t.caption) || t.hasAttribute('aria-label') || t.hasAttribute('aria-labelledby'), filas: t.rows.length, scopeFila: t.querySelectorAll('tbody th').length });
  for (const i of document.querySelectorAll('input[type=password]')) r.pegar.push({ id: i.id, autocomplete: i.getAttribute('autocomplete'), onpaste: i.getAttribute('onpaste') });
  for (const v of document.querySelectorAll('[aria-live],[role=status],[role=alert],[role=log],[role=timer],output')) r.vivas.push(`${v.tagName.toLowerCase()}${v.getAttribute('role') ? '[role=' + v.getAttribute('role') + ']' : ''}${v.getAttribute('aria-live') ? '[aria-live=' + v.getAttribute('aria-live') + ']' : ''}.${v.className}`);
  if (document.documentElement.scrollWidth > window.innerWidth + 1) r.desborde = `${document.documentElement.scrollWidth} en ${window.innerWidth}`;
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('.solo-lector,svg,.visor-hojas,[data-visor-hojas]')) continue;
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && el.textContent.trim() && !el.matches('textarea,input,select,img,canvas') && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && cs.textOverflow !== 'ellipsis') r.recortes.push(`${el.tagName.toLowerCase()}.${el.className} «${el.textContent.trim().slice(0, 40)}» ${el.scrollWidth}×${el.scrollHeight} en ${el.clientWidth}×${el.clientHeight}`);
    // Texto que se sale de su caja de borde (botones, etiquetas): ancho del contenido mayor que la caja sin recorte
    if (el.matches('button,.btn,.estado,.chip,.etiqueta-estado,a.btn') && el.scrollWidth > el.clientWidth + 2) r.recortes.push(`desborda su caja: ${el.tagName.toLowerCase()}.${el.className} «${el.textContent.trim().slice(0, 40)}» ${el.scrollWidth} en ${el.clientWidth}`);
  }
  return r;
}

// Árbol de accesibilidad: nombres repetidos, controles sin nombre, enlaces genéricos
async function arbol(page) {
  const s = await page.context().newCDPSession(page);
  const { nodes } = await s.send('Accessibility.getFullAXTree');
  await s.detach();
  const vivos = nodes.filter((n) => !n.ignored);
  const rol = (n) => n.role && n.role.value;
  const nom = (n) => (n.name && n.name.value || '').trim();
  const interactivos = vivos.filter((n) => ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'menuitem', 'tab', 'switch', 'spinbutton', 'slider', 'listbox'].includes(rol(n)));
  const sinNombre = interactivos.filter((n) => !nom(n)).map((n) => `${rol(n)} (backend ${n.backendDOMNodeId})`);
  const cuenta = {};
  for (const n of interactivos.filter((x) => ['button', 'link'].includes(rol(x)))) { const k = `${rol(n)}: ${nom(n)}`; cuenta[k] = (cuenta[k] || 0) + 1; }
  const repetidos = Object.entries(cuenta).filter(([, c]) => c > 1).map(([k, c]) => `${k} ×${c}`);
  const genericos = interactivos.filter((n) => rol(n) === 'link' && /^(aquí|aqui|clic aquí|haz clic aquí|ver|más|ver más|leer más|este enlace|enlace)$/i.test(nom(n))).map(nom);
  const roles = {}; for (const n of vivos) roles[rol(n)] = (roles[rol(n)] || 0) + 1;
  const marcas = vivos.filter((n) => ['banner', 'main', 'contentinfo', 'navigation', 'region', 'complementary', 'form', 'search'].includes(rol(n))).map((n) => `${rol(n)}${nom(n) ? ' «' + nom(n).slice(0, 40) + '»' : ''}`);
  return { interactivos: interactivos.length, sinNombre, repetidos, genericos, marcas, roles };
}

const salida = [];
for (const [nombre, url, sesion, vol] of ESTADOS) {
  for (const ancho of [390, 1440, 320]) {
    const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion, vol });
    const p = await c.newPage();
    await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    const r = await p.evaluate(enPagina);
    const a = ancho === 1440 || ancho === 390 ? await arbol(p) : null;
    let espaciado = null;
    if (ancho === 390 || ancho === 320) {
      // 1.4.12: espaciado de texto aplicado con CSSOM (la política de contenido no deja estilos en línea, pero sí la hoja creada por el guion con adoptedStyleSheets)
      await p.evaluate(() => { const h = new CSSStyleSheet(); h.replaceSync('*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, h]; });
      await p.waitForTimeout(300);
      const e = await p.evaluate(enPagina);
      espaciado = { aplicado: await p.evaluate(() => getComputedStyle(document.querySelector('main') || document.body).letterSpacing), desborde: e.desborde, recortes: e.recortes };
      if (e.recortes.length || e.desborde) await p.screenshot({ path: `../capturas/espaciado-${nombre.replace(/\W+/g, '-')}-${ancho}.png`, fullPage: true });
    }
    salida.push({ nombre, url, ancho, ...r, arbol: a, espaciado });
    process.stdout.write('.');
    await c.close();
  }
}
await nav.close();
guarda('estructura.json', { fecha: new Date().toISOString(), salida });
// Resumen
for (const r of salida) {
  const malos = [];
  if (r.lang !== 'es-MX' && r.lang !== 'es') malos.push(`lang=${r.lang}`);
  const h1 = r.h.filter((h) => h[0] === 1).length; if (h1 !== 1) malos.push(`h1×${h1}`);
  for (let i = 1; i < r.h.length; i++) if (r.h[i][0] > r.h[i - 1][0] + 1) malos.push(`salto h${r.h[i - 1][0]}→h${r.h[i][0]} «${r.h[i][1]}»`);
  if (r.letra.bajo12.length) malos.push(`letra<12: ${r.letra.bajo12.length} (${r.letra.bajo12.slice(0, 2).join('; ')})`);
  if (r.ancho === 390 && r.letra.cuerpo && r.letra.cuerpo < 16) malos.push(`cuerpo ${r.letra.cuerpo}px`);
  if (r.desborde) malos.push(`desborde ${r.desborde}`);
  if (r.recortes.length) malos.push(`recortes ${r.recortes.length}: ${r.recortes.slice(0, 2).join('; ')}`);
  if (r.espaciado && (r.espaciado.desborde || r.espaciado.recortes.length)) malos.push(`ESPACIADO: ${r.espaciado.desborde || ''} ${r.espaciado.recortes.slice(0, 3).join('; ')}`);
  if (r.arbol && r.arbol.sinNombre.length) malos.push(`sin nombre: ${r.arbol.sinNombre.join(', ')}`);
  if (r.arbol && r.arbol.repetidos.length) malos.push(`repetidos: ${r.arbol.repetidos.slice(0, 8).join('; ')}`);
  if (r.arbol && r.arbol.genericos.length) malos.push(`genéricos: ${r.arbol.genericos.join(', ')}`);
  if (r.tablas.some((t) => !t.th)) malos.push('tabla sin th');
  console.log(`${r.ancho} ${r.nombre}: ${malos.join(' | ') || 'bien'}`);
}
