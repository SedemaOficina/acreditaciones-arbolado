// B1 · Paso 1: descubre todas las pantallas y estados a recorrer, y revisa cada enlace interno (también los que llevan
// ?folio= y #ancla). Parte de los casos del menú de pruebas (sitio/app/casos-prueba.js) y sigue los enlaces de cada
// pantalla con la misma sesión, hasta 3 saltos. Con DATOS=volumen sirve el escenario de herramientas/escenario-volumen.mjs.
// Uso: BASE=http://localhost:8902/ [DATOS=volumen] node b1-descubrir.mjs
// Salida: <evidencia>/b1/estados-<datos>.json y enlaces-<datos>.json
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, navegador, contexto, vigila, carpeta, espera } from './comun.mjs';

const DATOS = process.env.DATOS || 'ficticios';
const SAL = carpeta('b1');
const nav = await navegador();

// Casos del menú de pruebas, calculados por el propio sitio
const c0 = await contexto(nav, 'escritorio', { datos: DATOS });
const p0 = await c0.newPage();
await p0.goto(BASE + 'index.html');
const info = await p0.evaluate(() => APD.cargar().then((d) => ({
  casos: APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.map((c) => ({ perfil: g.perfil, clave: c.clave, persona: c.persona && c.persona.id, pantalla: c.pantalla, migrada: c.migrada }))),
  libre: (d.solicitante.find((p) => p.estado === 'activa' && !d.solicitud.some((s) => s.solicitante_id === p.id)) || {}).id,
  folios: [
    ...d.solicitud.filter((s) => s.estado === 'validada_en_linea').slice(0, 8).map((s) => `cotejo.html?folio=${s.folio}`),
    ...d.solicitud.filter((s) => s.estado === 'enviada').slice(0, 8).map((s) => `revisar.html?folio=${s.folio}`),
    ...d.grupo.slice(0, 12).map((g) => `grupo.html?folio=${g.folio}`)
  ]
})));
await c0.close();

const PERSONA = ['tramites.html', 'datos.html', 'solicitud.html', 'corregir.html'];
const PERSONAL = ['revision.html', 'revisar.html', 'citas.html', 'cotejo.html', 'grupos.html', 'espera.html', 'programar.html', 'grupo.html', 'asistencia.html', 'aplicar.html', 'material-personal.html'];
const CURSOS = ['poda-nueva', 'poda-renovacion', 'dictaminador-nueva', 'dictaminador-renovacion'];
const semillas = [];
const agrega = (url, sesion, perfil, caso, origen = 'semilla') => semillas.push({ url, sesion, perfil, caso, origen });
if (DATOS === 'ficticios') {
  for (const u of ['index.html', 'cuenta.html', 'entrar.html', 'verificar.html', 'material.html', 'examen.html']) agrega(u, null, 'publico', '-');
  for (const c of info.casos) {
    if (c.migrada) agrega(`cuenta.html?migrada=${encodeURIComponent(c.persona)}`, null, 'kobo', c.clave);
    else if (c.persona) { agrega('tramites.html', c.persona, c.perfil, c.clave); agrega('datos.html', c.persona, c.perfil, c.clave); }
  }
  if (info.libre) { agrega('tramites.html', info.libre, 'nueva', 'nueva'); agrega('solicitud.html', info.libre, 'nueva', 'nueva'); agrega('datos.html', info.libre, 'nueva', 'nueva'); agrega('corregir.html', info.libre, 'nueva', 'nueva'); }
}
for (const u of ['revision.html', 'citas.html', 'programar.html', 'asistencia.html', 'aplicar.html', 'material-personal.html', 'espera.html', ...CURSOS.flatMap((k) => [`grupos.html?curso=${k}`, `programar.html?curso=${k}`])]) agrega(u, null, 'personal', '-');
// Cada cita, cada solicitud por revisar y cada grupo, aunque ninguna pantalla los enlace hoy (otro día de la agenda)
for (const f of info.folios) agrega(f, null, 'personal', '-');

const clave = (s) => {
  const ruta = s.url.split('#')[0];
  const pag = ruta.split('?')[0];
  const quien = PERSONA.includes(pag) ? `p:${s.sesion}` : PERSONAL.includes(pag) ? 'personal' : s.sesion ? 'con-sesion' : 'sin-sesion';
  return `${quien}|${ruta}`;
};
const ERROR = /No se encontró|No encontramos|no está pendiente|No se pudo cargar|ya no existe|Ese código no existe|Intent[ae] de nuevo más tarde|Página no encontrada|undefined|NaN\b/;
// En volumen hay 65 solicitudes por revisar y 40 citas: de cada pantalla con ?folio= se recorren como mucho 4
const TOPE = DATOS === 'volumen' ? 4 : 1000;
const porPagina = {};
const estados = new Map();
const enlaces = [];
const cola = semillas.map((s) => ({ ...s, salto: 0 }));
const otrosRecursos = new Map();

while (cola.length) {
  const s = cola.shift();
  const k = clave(s);
  if (estados.has(k)) continue;
  const pag = s.url.split('?')[0].split('#')[0];
  if (/\?folio=/.test(s.url)) { porPagina[pag] = (porPagina[pag] || 0) + 1; if (porPagina[pag] > TOPE) continue; }
  const ctx = await contexto(nav, 'escritorio', { sesion: s.sesion, datos: DATOS });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const log = vigila(page);
  const resp = await page.goto(BASE + s.url, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => `error ${e.message.split('\n')[0]}` }));
  await espera(500);
  const final = page.url().replace(BASE, '');
  const r = await page.evaluate(() => {
    const vis = (el) => el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.offsetParent !== null;
    const texto = document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText;
    const ls = [...document.querySelectorAll('a[href]')].filter(vis).map((a) => ({ href: a.getAttribute('href'), texto: (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 70), dialogo: Boolean(a.closest('dialog')) }));
    const anclaFalta = location.hash && !document.getElementById(decodeURIComponent(location.hash.slice(1)));
    return { titulo: document.title, h1: (document.querySelector('h1') || {}).textContent, texto: texto.slice(0, 6000), enlaces: ls, anclaFalta };
  });
  const err = (r.texto.match(ERROR) || [])[0] || null;
  estados.set(k, { id: estados.size, url: s.url.split('#')[0], sesion: s.sesion, perfil: s.perfil, caso: s.caso, origen: s.origen, final, status: resp && resp.status(), titulo: r.titulo, h1: (r.h1 || '').trim(), error: err, consola: log });
  if (s.origenEnlace) s.origenEnlace.destino = { final, status: resp && resp.status(), error: err, anclaFalta: r.anclaFalta, consola: log.length };
  for (const l of r.enlaces) {
    const u = new URL(l.href, page.url());
    if (u.origin !== new URL(BASE).origin) { enlaces.push({ desde: k, href: l.href, texto: l.texto, externo: true }); continue; }
    const rel = u.pathname.replace(new URL(BASE).pathname, '') + u.search + u.hash;
    if (!/\.html$/.test(u.pathname) && u.pathname !== new URL(BASE).pathname) {
      if (!otrosRecursos.has(u.href)) otrosRecursos.set(u.href, (await page.request.get(u.href)).status());
      enlaces.push({ desde: k, href: l.href, texto: l.texto, recurso: true, status: otrosRecursos.get(u.href) });
      continue;
    }
    if (l.href.startsWith('#')) continue; // anclas de la misma página: las revisa b1-revisar
    const e = { desde: k, href: l.href, texto: l.texto, enDialogo: l.dialogo };
    enlaces.push(e);
    if (s.salto < 3) cola.push({ url: rel || 'index.html', sesion: s.sesion, perfil: s.perfil, caso: s.caso, origen: k, salto: s.salto + 1, origenEnlace: e });
    else e.sinVisitar = true;
  }
  // Un enlace que lleva a un estado ya visitado: copia su resultado (y si lleva #ancla, la revisa en su destino)
  await ctx.close();
  process.stdout.write('.');
}
// Enlaces a estados ya visitados (la cola los saltó): resultado del estado y anclas
const porClave = Object.fromEntries([...estados].map(([k, v]) => [k, v]));
const ctx = await contexto(nav, 'escritorio', { datos: DATOS });
for (const e of enlaces) {
  if (e.externo || e.recurso || e.destino || e.sinVisitar) continue;
  const de = porClave[e.desde];
  const u = new URL(e.href, BASE + de.url);
  const rel = u.pathname.replace(new URL(BASE).pathname, '') + u.search;
  const k = clave({ url: rel, sesion: de.sesion });
  const est = porClave[k];
  e.destino = est ? { final: est.final, status: est.status, error: est.error, consola: est.consola.length } : { noVisitado: true };
  if (u.hash && est) {
    const page = await (await contexto(nav, 'escritorio', { sesion: de.sesion, datos: DATOS })).newPage();
    await page.goto(u.href, { waitUntil: 'networkidle' }); await espera(400);
    e.destino.anclaFalta = await page.evaluate(() => !document.getElementById(decodeURIComponent(location.hash.slice(1))));
    await page.context().close();
  }
}
await ctx.close();
await nav.close();
const lista = [...estados.values()];
writeFileSync(join(SAL, `estados-${DATOS}.json`), JSON.stringify(lista, null, 1));
writeFileSync(join(SAL, `enlaces-${DATOS}.json`), JSON.stringify(enlaces, null, 1));
const rotos = enlaces.filter((e) => (e.recurso && e.status >= 400) || (e.destino && (e.destino.error || e.destino.anclaFalta || (typeof e.destino.status === 'number' && e.destino.status >= 400))));
console.log(`\n${lista.length} estados; ${enlaces.length} enlaces (${new Set(enlaces.map((e) => e.href)).size} distintos); ${rotos.length} con problema`);
for (const e of rotos.slice(0, 40)) console.log(' ', e.desde, '→', e.href, JSON.stringify(e.destino || e.status));
const conError = lista.filter((s) => s.error || s.consola.length);
console.log(`${conError.length} estados con texto de error o consola`);
for (const s of conError) console.log(' ', s.url, s.sesion || '', s.error || '', s.consola.join(' | ').slice(0, 200));
