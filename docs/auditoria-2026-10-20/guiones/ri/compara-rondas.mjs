// ri · Compara las rondas de gestion-foco.mjs: por escenario, tamaño y paso, a dónde fue el foco y cuántos anuncios hubo.
// Marca «DIFIERE» si las rondas no coinciden. Uso: node compara-rondas.mjs salidas/gestion-*.json
import { readFileSync } from 'node:fs';
const todo = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const grupos = new Map();
for (const r of todo) { const k = `${r.escenario} · ${r.tam} · ${r.datos}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); }
const norm = (f) => (!f ? '¿?' : f.body ? 'BODY' : f.en.replace(/«.*»/, '').trim() + (f.dentroVentana === false ? ' [fuera de la ventana]' : ''));
for (const [k, rs] of grupos) {
  console.log(`\n${k} (${rs.length} rondas)`);
  const n = Math.max(...rs.map((r) => r.pasos.length));
  for (let i = 0; i < n; i++) {
    const vals = rs.map((r) => r.pasos[i]);
    const focos = vals.map((p) => (p ? norm(p.foco) : '—'));
    const anun = vals.map((p) => (p ? p.anuncios.length : '—'));
    const igual = new Set(focos).size === 1 && new Set(anun).size === 1;
    console.log(`  ${i + 1}. ${(vals[0] || {}).nombre || ''}\n     foco: ${focos.join(' | ')} · anuncios: ${anun.join(' | ')}${igual ? '' : '  ← DIFIERE'}`);
  }
}
