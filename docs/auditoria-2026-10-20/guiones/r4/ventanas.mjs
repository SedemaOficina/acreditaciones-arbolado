// Capturas de la primera ventana (lo que se ve sin desplazarse) de cada pantalla, para las fichas de C1 y C2.
// Uso: node guiones/ventanas.mjs
import { contexto, ir, captura, cierra, TEL, ESC, volumen } from './comun.mjs';
const vol = JSON.parse(volumen());
const enviada = vol.solicitud.find((s) => s.estado === 'enviada' && s.folio >= 'APD-S-2026-00500');
const citaHoy = vol.cita.find((c) => c.resultado === 'pendiente' && c.programada_en.startsWith(vol.fecha_corte));
const folioCita = vol.solicitud.find((s) => s.id === citaHoy.solicitud_id).folio;
const L = [
  ['revision', 'revision.html', '[data-filas] tr'], ['revisar', `revisar.html?folio=${enviada.folio}`, 'form'], ['citas', 'citas.html', '[data-filas] tr'],
  ['cotejo', `cotejo.html?folio=${folioCita}`, 'form'], ['grupos', 'grupos.html?curso=poda-nueva', '.plan-grupo'], ['programar', 'programar.html?curso=poda-nueva', '.cal-dia'],
  ['grupo-023', 'grupo.html?folio=APD-G-2026-023', '[data-filas] tr'], ['grupo-020', 'grupo.html?folio=APD-G-2026-020', '[data-filas] tr'], ['asistencia-024', 'asistencia.html?folio=APD-G-2026-024', '.asistencia-fila'],
  ['asistencia', 'asistencia.html', 'main'], ['aplicar', 'aplicar.html', 'main'], ['aplicar-020', 'aplicar.html?folio=APD-G-2026-020', '[data-grupo]'], ['material-personal', 'material-personal.html', 'main']
];
for (const [tam, vp] of [['esc', ESC], ['tel', TEL]]) {
  for (const [k, url, sel] of L) {
    const ctx = await contexto({ vp, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, url, sel, 900);
    await captura(pg, `ventana-${k}-${tam}`, false);
    await ctx.close();
  }
}
await cierra();
