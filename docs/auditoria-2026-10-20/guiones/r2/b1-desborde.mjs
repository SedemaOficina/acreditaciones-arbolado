// B1 · Desborde horizontal medido contra el ancho del documento (clientWidth), no contra innerWidth.
// En la emulación de teléfono (isMobile), cuando el contenido es más ancho, el navegador agranda la ventana de diseño:
// innerWidth crece con él y la comparación scrollWidth > innerWidth no lo ve (así lo miden auditar-sitio.mjs,
// probar-sitio.mjs y probar-volumen.mjs). Aquí se compara scrollWidth con clientWidth.
// Uso: VISTAS=tel360,tel390 node b1-desborde.mjs     Salida: b1/desborde-<vista>.json y capturas/b1/desborde/
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, navegador, contexto, carpeta, espera } from './comun.mjs';

const SAL = carpeta('b1');
const CAP = carpeta('capturas', 'b1', 'desborde');
const fic = JSON.parse(readFileSync(join(SAL, 'estados-ficticios.json'), 'utf8'));
const vol = existsSync(join(SAL, 'estados-volumen.json')) ? JSON.parse(readFileSync(join(SAL, 'estados-volumen.json'), 'utf8')) : [];
const PERSONAL = /^(revision|revisar|citas|cotejo|grupos|espera|programar|grupo|asistencia|aplicar|material-personal)\.html/;
let enDatos = 0;
const semanas = {};
const ESTADOS = [
  ...fic.filter((s) => !(s.url === 'datos.html' && ++enDatos > 6)).map((s) => ({ ...s, datos: 'ficticios', nombre: `${s.url}${s.sesion ? ` [${s.caso}]` : ''}` })),
  ...vol.filter((s) => PERSONAL.test(s.url)).map((s) => ({ ...s, id: `V${s.id}`, datos: 'volumen', nombre: `${s.url} [volumen]` }))
].filter((s) => !(/semana=/.test(s.url) && (semanas[s.datos] = (semanas[s.datos] || 0) + 1) > 3));
const VISTAS = (process.env.VISTAS || 'tel360,tel390,tel430,telH,tableta,escritorio,zoom200').split(',');
const nav = await navegador();
for (const v of VISTAS) {
  const out = [];
  for (const s of ESTADOS) {
    const c = await contexto(nav, v, { sesion: s.sesion, datos: s.datos });
    const p = await c.newPage();
    await p.goto(BASE + s.url, { waitUntil: 'networkidle' }).catch(() => {});
    await espera(500);
    const r = await p.evaluate(() => {
      const de = document.documentElement;
      const ancho = de.clientWidth;
      if (de.scrollWidth <= ancho + 1) return null;
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const fuera = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > ancho + 1 && !e.closest('.solo-lector'))
        .filter((e, _, l) => !l.some((o) => o !== e && e.contains(o)));
      const nombre = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} «${(e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)}» hasta ${Math.round(e.getBoundingClientRect().right)}px`;
      const contenedor = (e) => { for (let x = e; x; x = x.parentElement) if (x.matches && x.matches('table,.tabla,.tabla-marco,section,article,.tarjeta')) return `${x.tagName.toLowerCase()}.${(x.className || '').toString().trim().split(/\s+/).join('.')}`; return '—'; };
      return { ancho, documento: de.scrollWidth, innerWidth, sobra: de.scrollWidth - ancho, culpables: fuera.slice(0, 5).map(nombre), contenedores: [...new Set(fuera.map(contenedor))].slice(0, 4) };
    });
    if (r) {
      r.estado = s.nombre; r.id = s.id; r.perfil = s.perfil;
      r.captura = `capturas/b1/desborde/${v}-${String(s.id)}.png`;
      await p.screenshot({ path: join(CAP, `${v}-${String(s.id)}.png`), fullPage: false });
      out.push(r);
    }
    await c.close();
  }
  writeFileSync(join(SAL, `desborde-${v}.json`), JSON.stringify({ vista: v, estados: ESTADOS.length, conDesborde: out.length, resultados: out }, null, 1));
  console.log(`${v}: ${out.length} de ${ESTADOS.length} estados con desborde`);
  for (const r of out) console.log(`  ${r.estado}: ${r.documento} en ${r.ancho} (${r.contenedores.join(', ')}) ${r.culpables[0] || ''}`);
}
await nav.close();
