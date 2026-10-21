// Resume medicion-N.json (de medir.mjs) en tablas para el informe y compara dos corridas.
// Uso: node analizar.mjs medicion-1.json [medicion-2.json] > resumen.md
import { readFileSync } from 'node:fs';
const [, , a, b] = process.argv;
const R = JSON.parse(readFileSync(a, 'utf8'));
const R2 = b ? JSON.parse(readFileSync(b, 'utf8')) : null;
const pant = (s) => s.ruta.split('?')[0].replace('.html', '');
const out = [];
const p = (x = '') => out.push(x);

// ---------- Texto ----------
function clasTexto(x) {
  if (x.r >= x.minimo) return 'Cumple';
  if (x.inactivo) return 'Informativo (inactivo, WCAG lo exceptúa)';
  return 'Pendiente de decisión';
}
function pares(R) {
  const m = new Map();
  for (const s of R) for (const x of s.textos || []) {
    const k = `${x.color}|${x.fondo}|${x.minimo}|${x.inactivo ? 1 : 0}|${x.origen}|${x.pseudo || ''}`;
    const v = m.get(k) || { ...x, n: 0, pant: new Set(), el: new Map(), anchos: new Set() };
    v.n++; v.pant.add(pant(s)); v.anchos.add(s.ancho);
    const e = x.el.replace(/#[\w-]+/, '').split('.').slice(0, 3).join('.');
    v.el.set(e, (v.el.get(e) || 0) + 1);
    m.set(k, v);
  }
  return m;
}
const P1 = pares(R);
let tot = 0; for (const s of R) tot += (s.textos || []).length;
p(`## Texto: ${tot} mediciones, ${P1.size} pares distintos (color, fondo compuesto, mínimo, origen)`);
p('');
p('| Resultado | Origen | Color | Fondo compuesto | Razón | Mínimo | Mediciones | Pantallas | Elementos (más frecuentes) |');
p('|---|---|---|---|---|---|---|---|---|');
const orden = [...P1.values()].sort((x, y) => (clasTexto(x) === 'Cumple') - (clasTexto(y) === 'Cumple') || x.r - y.r);
for (const v of orden) {
  const els = [...v.el].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([e, n]) => `${e}${v.pseudo ? ' ' + v.pseudo : ''} (${n})`).join('; ');
  p(`| ${clasTexto(v)} | ${v.origen} | ${v.color} | ${v.fondo} | ${v.r.toFixed(2)} | ${v.minimo} | ${v.n} | ${v.pant.size}${v.pant.size <= 3 ? ': ' + [...v.pant].join(', ') : ''} | ${els} |`);
}
p('');

// ---------- Líneas ----------
function clasLinea(x) {
  if (x.tipo === 'sin-borde') {
    if (x.control === 'casilla') return 'Informativo (casilla nativa: la pinta el navegador)';
    if (x.conTexto) return 'Informativo (lo identifica su texto)';
    if (/btn-icono/.test(x.el)) return 'Informativo (lo identifica su ícono, 7.17:1)';
    return x.rFuera >= 3 ? 'Cumple' : 'Pendiente de decisión';
  }
  const mejor = Math.max(x.rFuera, x.rFondoVsFuera || 0);
  if (x.control && x.control !== 'boton') return mejor >= 3 ? 'Cumple' : (x.inactivo ? 'Informativo (inactivo)' : 'Pendiente de decisión');
  if (x.control === 'boton') return mejor >= 3 ? 'Cumple' : x.inactivo ? 'Informativo (inactivo)' : x.conTexto ? 'Informativo (lo identifica su texto)' : 'Pendiente de decisión';
  return mejor >= 3 ? 'Cumple' : 'Informativo (separa o decora; no delimita un control)';
}
const L = new Map();
for (const s of R) for (const x of s.lineas || []) {
  const k = `${x.el.replace(/#[\w-]+/, '').split('.').slice(0, 3).join('.')}|${x.tipo}|${x.color}|${x.fuera}|${x.estilo || ''}|${x.origen}|${x.inactivo ? 1 : 0}`;
  const v = L.get(k) || { ...x, n: 0, pant: new Set() };
  v.n++; v.pant.add(pant(s)); L.set(k, v);
}
const Lc = [...L.values()].map((v) => ({ ...v, clas: clasLinea(v) }));
const cuenta = (arr, f) => arr.filter(f).length;
p(`## Líneas, bordes y límites de controles: ${[...L.values()].reduce((t, v) => t + v.n, 0)} mediciones, ${L.size} pares distintos`);
p('');
p(`Cumple: ${cuenta(Lc, (v) => v.clas === 'Cumple')} · Informativo: ${cuenta(Lc, (v) => v.clas.startsWith('Informativo'))} · Pendiente de decisión: ${cuenta(Lc, (v) => v.clas.startsWith('Pendiente'))}`);
p('');
p('| Resultado | Origen | Elemento | Tipo | Color | Fondo de afuera | Razón | Fondo propio vs. afuera | Mediciones | Pantallas |');
p('|---|---|---|---|---|---|---|---|---|---|');
for (const v of Lc.filter((v) => v.clas !== 'Cumple' && !(v.clas.startsWith('Informativo (lo identifica') || v.clas.startsWith('Informativo (casilla'))).sort((x, y) => x.clas.localeCompare(y.clas) || y.n - x.n)) {
  p(`| ${v.clas} | ${v.origen} | ${v.el.replace(/#[\w-]+/, '').split('.').slice(0, 3).join('.')} | ${v.tipo}${v.estilo ? ' ' + v.estilo : ''} | ${v.color} | ${v.fuera} | ${v.rFuera.toFixed(2)} | ${(v.rFondoVsFuera || 0).toFixed(2)} | ${v.n} | ${[...v.pant].slice(0, 4).join(', ')} |`);
}
p('');
p('Sin borde y sin fondo distinto, identificados por su texto (enlaces, «Atrás», títulos plegables) o casillas nativas: ' +
  `${Lc.filter((v) => /lo identifica|casilla/.test(v.clas)).reduce((t, v) => t + v.n, 0)} mediciones (Informativo).`);
p('');

// ---------- Foco ----------
const F = new Map(); let nf = 0;
for (const s of R) for (const f of s.focos || []) {
  nf++;
  const k = f.sinContorno ? `SIN|${f.el.replace(/#[\w-]+/, '')}` : `${f.color}|${f.fuera}|${f.ancho}|${f.estilo}`;
  const v = F.get(k) || { ...f, n: 0, pant: new Set(), els: new Set() };
  v.n++; v.pant.add(pant(s)); v.els.add(f.el.replace(/#[\w-]+/, '').split('.').slice(0, 2).join('.')); F.set(k, v);
}
p(`## Anillo de foco: ${nf} paradas de tabulador en ${R.length} estados`);
p('');
p('| Resultado | Color del anillo | Fondo de afuera | Razón | Ancho | Paradas | Pantallas | Elementos |');
p('|---|---|---|---|---|---|---|---|');
for (const v of [...F.values()].sort((x, y) => (x.rFuera || 0) - (y.rFuera || 0))) {
  if (v.sinContorno) { p(`| Pendiente de decisión (sin anillo) | — | — | — | — | ${v.n} | ${[...v.pant].slice(0, 4).join(', ')} | ${[...v.els].slice(0, 4).join('; ')} |`); continue; }
  const ok = v.rFuera >= 3 && parseFloat(v.ancho) >= 2;
  p(`| ${ok ? 'Cumple' : 'Pendiente de decisión'} | ${v.color} | ${v.fuera} | ${v.rFuera.toFixed(2)} | ${v.ancho} ${v.estilo} | ${v.n} | ${v.pant.size} | ${[...v.els].slice(0, 5).join('; ')} |`);
}
p('');

// ---------- Íconos y gráficos ----------
const I = new Map(); let ni = 0;
for (const s of R) for (const x of s.iconos || []) { ni++; const k = `${x.color}|${x.fondo}|${x.inactivo ? 1 : 0}`; const v = I.get(k) || { ...x, n: 0, iconos: new Set(), pant: new Set() }; v.n++; v.iconos.add(x.icono); v.pant.add(pant(s)); I.set(k, v); }
p(`## Íconos SVG: ${ni} mediciones, ${I.size} pares`);
p('');
p('| Resultado | Color | Fondo | Razón | Mediciones | Íconos |');
p('|---|---|---|---|---|---|');
for (const v of [...I.values()].sort((x, y) => x.r - y.r)) p(`| ${v.r >= 3 ? 'Cumple' : v.inactivo ? 'Informativo (inactivo)' : v.decorativo && v.conTexto ? 'Informativo (decorativo, con texto)' : 'Pendiente de decisión'} | ${v.color} | ${v.fondo} | ${v.r.toFixed(2)} | ${v.n} | ${[...v.iconos].filter(Boolean).slice(0, 8).join(', ')} |`);
p('');
const G = new Map();
for (const s of R) for (const x of s.graficos || []) { const k = `${x.el.split('.').slice(0, 2).join('.')}|${x.dato}|${x.color}|${x.fuera}`; const v = G.get(k) || { ...x, n: 0, pant: new Set() }; v.n++; v.pant.add(pant(s)); G.set(k, v); }
p('## Gráficos sin texto (barras, lugares, muestras)');
p('');
p('| Elemento | Dato | Color | Fondo de afuera | Razón | Mediciones | Pantallas |');
p('|---|---|---|---|---|---|---|');
for (const v of [...G.values()].sort((x, y) => x.el.localeCompare(y.el))) p(`| ${v.el.split('.').slice(0, 2).join('.')} | ${v.dato} | ${v.color} | ${v.fuera} | ${v.r.toFixed(2)} | ${v.n} | ${[...v.pant].join(', ')} |`);
p('');

// ---------- C6: botones ----------
const forma = (b) => {
  const relleno = b.fondo === 'transparente' ? 'sin fondo' : b.fondo === '#FFFFFF' || b.fondo === '#FCFCFD' ? 'blanco' : `relleno ${b.fondo}`;
  const borde = b.borde === 'sin borde' ? 'sin borde' : b.borde.replace(/^1px /, '').replace(/^izq /, 'izq ');
  return `${relleno} · ${borde} · radio ${b.radio} · texto ${b.color} ${b.peso} ${b.tam} ${b.familia}${b.subrayado ? ' subrayado' : ''}`;
};
const B = new Map();
for (const s of R) for (const x of s.botones || []) {
  if (/\bsalto\b/.test(x.clases)) continue;
  const k = forma(x);
  const v = B.get(k) || { n: 0, clases: new Map(), pant: new Set(), altos: new Set(), ej: new Set(), origen: new Set(), estado: new Set() };
  v.n++; v.clases.set(x.clases || `(${x.el})`, (v.clases.get(x.clases || `(${x.el})`) || 0) + 1); v.pant.add(pant(s)); v.altos.add(x.alto); v.ej.add(x.texto.slice(0, 26)); v.origen.add(x.origen); if (x.presionado) v.estado.add(x.presionado); if (x.inactivo) v.estado.add('inactivo');
  B.set(k, v);
}
p(`## C6 · Botones y lo que parece botón: ${[...B.values()].reduce((t, v) => t + v.n, 0)} apariciones, ${B.size} aspectos distintos`);
p('');
p('| # | Aspecto (fondo · borde · radio · letra) | Clases | Estado | Alto (px) | Origen | Apariciones | Pantallas | Ejemplos |');
p('|---|---|---|---|---|---|---|---|---|');
let i = 0;
for (const [k, v] of [...B].sort((x, y) => y[1].n - x[1].n)) {
  i++;
  p(`| ${i} | ${k} | ${[...v.clases].map(([c, n]) => `${c} (${n})`).join('; ')} | ${[...v.estado].join(', ')} | ${[...v.altos].sort((x, y) => x - y).join('/')} | ${[...v.origen].join('+')} | ${v.n} | ${v.pant.size}: ${[...v.pant].slice(0, 5).join(', ')} | ${[...v.ej].slice(0, 3).join(' · ')} |`);
}
p('');
// Rellenos guinda por pantalla (el estándar: un botón principal por pantalla)
p('### Controles con relleno guinda visibles a la vez (sin contar «Ir al contenido»)');
p('');
p('| Estado | Ancho | Cuántos | Cuáles |');
p('|---|---|---|---|');
for (const s of R) {
  const g = (s.botones || []).filter((b) => b.fondo === '#9D2148' && !/salto/.test(b.clases));
  if (g.length > 1) p(`| ${s.clave} | ${s.ancho} | ${g.length} | ${g.map((b) => `${b.clases.split(' ').filter((c) => c !== 'btn').join('.') || b.el} «${b.texto.slice(0, 24)}»${b.presionado ? ` [${b.presionado}]` : ''}`).join('; ')} |`);
}
p('');

// ---------- C6: etiquetas de estado ----------
const E = new Map(); const porTexto = new Map();
for (const s of R) for (const e of s.estados || []) {
  const t = e.texto.replace(/\d+/g, 'N');
  const k = `${e.familia}|${e.icono}|${t}`;
  const v = E.get(k) || { ...e, t, n: 0, pant: new Set(), tam: new Set(), origen: new Set() }; v.n++; v.pant.add(pant(s)); v.tam.add(e.tam); v.origen.add(e.origen); E.set(k, v);
  (porTexto.get(t) || porTexto.set(t, new Set()).get(t)).add(`${e.familia} (${e.icono})`);
}
p(`## C6 · Etiquetas de estado: ${[...E.values()].reduce((t, v) => t + v.n, 0)} apariciones, ${E.size} textos (números como N)`);
p('');
p('| Familia | Ícono | Texto | Tamaño | Apariciones | Pantallas |');
p('|---|---|---|---|---|---|');
for (const v of [...E.values()].sort((x, y) => x.familia.localeCompare(y.familia) || x.t.localeCompare(y.t))) p(`| ${v.familia} | ${v.icono} | ${v.t} | ${[...v.tam].join('/')} | ${v.n} | ${[...v.pant].join(', ')} |`);
p('');
p('Mismo texto con familias distintas: ' + ([...porTexto].filter(([, f]) => f.size > 1).map(([t, f]) => `«${t}» → ${[...f].join(' / ')}`).join('; ') || 'ninguno'));
p('');

// ---------- C6: avisos ----------
const A = new Map();
for (const s of R) for (const x of s.avisos || []) {
  const tono = x.clase.split(' ').filter((c) => /^aviso-(advertencia|bloqueo|ok)$/.test(c))[0] || (x.tono ? `data-tono=${x.tono}` : x.clase.includes('aviso') ? 'neutro' : '');
  const k = `${x.clase}|${tono}|${x.icono}|${x.titulo.slice(0, 50)}`;
  const v = A.get(k) || { ...x, tono, n: 0, pant: new Set() }; v.n++; v.pant.add(pant(s)); A.set(k, v);
}
p(`## C6 · Avisos y desenlaces: ${A.size} distintos`);
p('');
p('| Componente | Tono | Ícono | Título o inicio | Pantallas |');
p('|---|---|---|---|---|');
for (const v of [...A.values()].sort((x, y) => x.tono.localeCompare(y.tono))) p(`| ${v.clase} | ${v.tono || '—'} | ${v.icono || '**sin ícono**'} | ${(v.titulo || v.texto).slice(0, 70)} | ${[...v.pant].join(', ')} |`);
p('');

// ---------- C6: letra y espacios ----------
const T = {}; const S = {};
for (const s of R) { for (const [k, n] of Object.entries(s.letras || {})) T[k] = (T[k] || 0) + n; for (const [k, v] of Object.entries(s.espacios || {})) { (S[k] ||= { n: 0, ej: new Set() }).n += v.n; v.ej.forEach((e) => S[k].ej.add(e)); } }
p(`## C6 · Tamaño, peso y familia de letra: ${Object.keys(T).length} combinaciones`);
p('');
p('| Tamaño · peso · familia | Elementos con texto |');
p('|---|---|');
for (const [k, n] of Object.entries(T).sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]) || y[1] - x[1])) p(`| ${k} | ${n} |`);
p('');
const ESCALA = [1, 2, 3, 4, 8, 12, 16, 20, 24, 32, 40, 48, 96];
p('## C6 · Espacios (márgenes, rellenos y huecos) fuera de la escala 4·8·12·16·20·24·32·40·48·96 y de los trazos 1–4 px');
p('');
p('| Valor (px) | Apariciones | Ejemplos |');
p('|---|---|---|');
for (const [k, v] of Object.entries(S).sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))) {
  const n = parseFloat(k);
  if (ESCALA.includes(n)) continue;
  p(`| ${k} | ${v.n} | ${[...v.ej].slice(0, 4).join('; ')} |`);
}
p('');

// ---------- Repetición ----------
if (R2) {
  const llaves = (R) => {
    const s = new Set();
    for (const e of R) {
      for (const x of e.textos || []) if (x.r < x.minimo) s.add(`T ${e.clave}@${e.ancho} ${x.el} ${x.pseudo || ''} ${x.color}/${x.fondo}`);
      for (const f of e.focos || []) if (f.sinContorno || f.rFuera < 3) s.add(`F ${e.clave}@${e.ancho} ${f.el}`);
      for (const x of e.lineas || []) if (clasLinea(x).startsWith('Pendiente')) s.add(`L ${e.clave}@${e.ancho} ${x.el} ${x.color}`);
    }
    return s;
  };
  const k1 = llaves(R), k2 = llaves(R2);
  const solo1 = [...k1].filter((k) => !k2.has(k)); const solo2 = [...k2].filter((k) => !k1.has(k));
  p('## Repetición (dos corridas desde contextos limpios)');
  p('');
  p(`Corrida 1: ${R.length} estados, ${k1.size} mediciones bajo el mínimo · Corrida 2: ${R2.length} estados, ${k2.size} · sólo en la 1: ${solo1.length} · sólo en la 2: ${solo2.length}`);
  for (const k of [...solo1.slice(0, 10)]) p(`- sólo 1: ${k}`);
  for (const k of [...solo2.slice(0, 10)]) p(`- sólo 2: ${k}`);
  p('');
}
const errs = R.filter((s) => s.error || (s.erroresPagina || []).length);
p(`Estados con error de la prueba o de la página: ${errs.length ? errs.map((s) => `${s.clave}@${s.ancho}: ${s.error || s.erroresPagina.join(' | ')}`).join('; ') : 'ninguno'}`);
console.log(out.join('\n'));
