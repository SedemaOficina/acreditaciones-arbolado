// B1 · Junta los avances de los 7 tamaños, separa lo que es artefacto de la prueba (con su motivo) y escribe:
//   b1/tabla-b1.json (todo) y b1/tabla-b1.md (tabla por pantalla, estado, ancho y perfil, con captura)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const DIR = '/home/claude/trabajo/evidencia-2026-10-20/r2/b1/';
const VISTAS = ['tel360', 'tel390', 'tel430', 'telH', 'tableta', 'escritorio', 'zoom200'];
// Artefactos de la prueba: el motivo se anota en el informe
function artefacto(h, f) {
  if (h.tipo === 'botón que no se puede presionar' && /cal-dia/.test(h.detalle)) return 'día del calendario con aria-disabled (explica por qué no se puede elegir; programar.js:148)';
  if (h.tipo === 'error de la prueba al presionar') return 'la prueba se interrumpió (se repitió el estado)';
  if (h.tipo === 'texto fuera de su caja' && /arch-nombre|examen-repaso-texto/.test(h.detalle)) return 'recorte con puntos suspensivos a propósito (text-overflow: ellipsis)';
  if (h.tipo === 'texto fuera de su caja' && /^button[^ ]*menu-pruebas-boton/.test(h.detalle)) return 'el botón del menú es fijo (position: fixed): no está «dentro» del pie aunque esté en su código; lo cubre B1-03';
  if (h.tipo === 'encimado' && /menú de pruebas abierto/.test(f.nombre)) return 'diálogo modal sobre la página (lo de abajo está inerte)';
  if (h.tipo === 'botón sin efecto visible' && /enviado vacío/.test(f.nombre)) return 'el formulario ya muestra los mismos errores: volver a presionar no cambia nada (con la página recién cargada sí responde)';
  return null;
}
const filas = [];
const resumen = {};
for (const v of VISTAS) {
  const f = join(DIR, `avance-${v}.jsonl`);
  if (!existsSync(f)) continue;
  const l = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x));
  resumen[v] = { estados: l.length, botones: l.reduce((n, r) => n + (r.clics || []).length, 0), ariaDeshabilitados: l.reduce((n, r) => n + (r.ariaDeshabilitados || 0), 0), tabs: l.reduce((n, r) => n + (r.tabs || 0), 0), avisos44: l.reduce((n, r) => n + (r.avisos44 || 0), 0), reales: {}, artefactos: {} };
  for (const r of l) for (const h of r.hallazgos) {
    const a = artefacto(h, r);
    const t = a ? resumen[v].artefactos : resumen[v].reales;
    t[h.tipo] = (t[h.tipo] || 0) + 1;
    if (!a) filas.push({ vista: v, pantalla: r.url.split('?')[0], estado: r.nombre, perfil: r.perfil, caso: r.caso, tipo: h.tipo, detalle: h.detalle, captura: r.captura || null });
  }
}
writeFileSync(join(DIR, 'tabla-b1.json'), JSON.stringify({ resumen, filas }, null, 1));
const md = ['# B1 · Tabla del barrido (generada por guiones/b1-tabla.mjs)', '', '## Por tamaño', '', '| Tamaño | Estados | Botones presionados | Días aria-disabled saltados | Paradas de Tab | Controles de menos de 44 px de alto (aviso) | Hallazgos reales (por tipo) | Artefactos descartados |', '|---|---|---|---|---|---|---|---|'];
for (const [v, r] of Object.entries(resumen)) md.push(`| ${v} | ${r.estados} | ${r.botones} | ${r.ariaDeshabilitados} | ${r.tabs} | ${r.avisos44} | ${Object.entries(r.reales).map(([k, n]) => `${k}: ${n}`).join('; ') || '0'} | ${Object.entries(r.artefactos).map(([k, n]) => `${k}: ${n}`).join('; ') || '0'} |`);
md.push('', '## Hallazgos reales por pantalla, estado, ancho y perfil', '', '| Pantalla | Estado | Perfil | Ancho | Tipo | Detalle | Captura |', '|---|---|---|---|---|---|---|');
const agrupa = new Map();
for (const f of filas) { const k = `${f.pantalla}|${f.estado}|${f.perfil}|${f.tipo}|${f.detalle.replace(/\d+ %.*$/, '').replace(/\(\d+×\d+ px\)/, '')}`; const e = agrupa.get(k) || { ...f, vistas: [] }; e.vistas.push(f.vista); agrupa.set(k, e); }
for (const e of [...agrupa.values()].sort((a, b) => a.pantalla.localeCompare(b.pantalla))) md.push(`| ${e.pantalla} | ${e.estado.replace(/\|/g, '/')} | ${e.perfil} | ${[...new Set(e.vistas)].join(', ')} | ${e.tipo} | ${e.detalle.replace(/\|/g, '/').slice(0, 160)} | ${e.captura || '—'} |`);
writeFileSync(join(DIR, 'tabla-b1.md'), md.join('\n') + '\n');
console.log(JSON.stringify(resumen, null, 1));
