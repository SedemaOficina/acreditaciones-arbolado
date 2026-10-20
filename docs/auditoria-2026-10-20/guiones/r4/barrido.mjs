// Barrido de r4: cada pantalla del personal (escenario de volumen) y de la persona (casos del menú), en 390x844 y 1440x900.
// Guarda captura completa, texto visible y medición de carga en salidas/barrido.json.
// Uso: node guiones/barrido.mjs
import { contexto, ir, mide, captura, guarda, texto, casos, cierra, TEL, ESC, volumen } from './comun.mjs';

const vol = JSON.parse(volumen());
const enviada = vol.solicitud.find((s) => s.estado === 'enviada' && s.folio >= 'APD-S-2026-00500');
const hoy = vol.fecha_corte;
const citaHoy = vol.cita.find((c) => c.resultado === 'pendiente' && c.programada_en.startsWith(hoy));
const folioCita = vol.solicitud.find((s) => s.id === citaHoy.solicitud_id).folio;

const PERSONAL = [
  ['revision', 'revision.html', '[data-filas] tr'],
  ['revisar', `revisar.html?folio=${enviada.folio}`, '#formulario, form'],
  ['citas', 'citas.html', '[data-filas] tr'],
  ['cotejo', `cotejo.html?folio=${folioCita}`, 'form'],
  ['grupos', 'grupos.html?curso=poda-nueva', '.plan-grupo'],
  ['grupos-sin-curso', 'grupos.html', 'main'],
  ['programar', 'programar.html?curso=poda-nueva', '.cal-dia'],
  ['grupo-020-encurso', 'grupo.html?folio=APD-G-2026-020', '[data-filas] tr'],
  ['grupo-023-confirmado', 'grupo.html?folio=APD-G-2026-023', '[data-filas] tr'],
  ['grupo-022-integracion', 'grupo.html?folio=APD-G-2026-022', '[data-filas] tr'],
  ['asistencia-sin-folio', 'asistencia.html', 'main'],
  ['asistencia-024', 'asistencia.html?folio=APD-G-2026-024', '.asistencia-fila'],
  ['aplicar-sin-folio', 'aplicar.html', 'main'],
  ['aplicar-020', 'aplicar.html?folio=APD-G-2026-020', '[data-grupo] .datos-valor'],
  ['material-personal', 'material-personal.html', 'main'],
  ['espera', 'espera.html?curso=poda-nueva', 'main']
];

const resultado = { personal: {}, persona: {} };
for (const [tam, vp] of [['tel', TEL], ['esc', ESC]]) {
  for (const [clave, url, sel] of PERSONAL) {
    const ctx = await contexto({ vp, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, url, sel, 700);
    const m = await mide(pg);
    await captura(pg, `barrido-personal-${clave}-${tam}`);
    guarda(`texto-personal-${clave}-${tam}.txt`, await texto(pg, 'body'));
    resultado.personal[`${clave}-${tam}`] = { url, ...m, errores: ctx.errores.slice(0, 3) };
    await ctx.close();
  }
}

// Persona: pantallas públicas y casos con sesión (datos ficticios normales)
const ctx0 = await contexto({ vp: TEL });
const pg0 = await ctx0.newPage();
await ir(pg0, 'index.html', 'main', 800);
const lista = await casos(pg0);
guarda('casos.json', lista);
await ctx0.close();

const PUBLICAS = [['index', 'index.html'], ['cuenta', 'cuenta.html'], ['entrar', 'entrar.html'], ['verificar', 'verificar.html'], ['material', 'material.html']];
const CON_SESION = ['enviada', 'obs-poda', 'cita', 'cita-pausa', 'espera', 'grupo', 'por-vencer', 'acreditada', 'obs-dict', 'dict-poda-vencida'];
for (const [tam, vp] of [['tel', TEL], ['esc', ESC]]) {
  for (const [clave, url] of PUBLICAS) {
    const ctx = await contexto({ vp });
    const pg = await ctx.newPage();
    await ir(pg, url, 'main', 800);
    resultado.persona[`${clave}-${tam}`] = { url, ...(await mide(pg)), errores: ctx.errores.slice(0, 3) };
    await captura(pg, `barrido-persona-${clave}-${tam}`);
    guarda(`texto-persona-${clave}-${tam}.txt`, await texto(pg, 'body'));
    await ctx.close();
  }
  for (const k of CON_SESION) {
    const c = lista.find((x) => x.clave === k);
    if (!c) { resultado.persona[`tramites-${k}-${tam}`] = { falta: true }; continue; }
    for (const [pant, url] of [['tramites', 'tramites.html'], ['datos', 'datos.html'], ['solicitud', 'solicitud.html'], ...(k.startsWith('obs') ? [['solicitud-corregir', 'solicitud.html']] : []), ...(k === 'cita-pausa' ? [['corregir', 'corregir.html']] : [])]) {
      if (pant !== 'tramites' && !['enviada', 'obs-poda', 'cita-pausa', 'por-vencer'].includes(k)) continue;
      const ctx = await contexto({ vp, sesion: c.persona });
      const pg = await ctx.newPage();
      await ir(pg, url, 'main', 900);
      resultado.persona[`${pant}-${k}-${tam}`] = { url, ...(await mide(pg)), errores: ctx.errores.slice(0, 3) };
      await captura(pg, `barrido-persona-${pant}-${k}-${tam}`);
      guarda(`texto-persona-${pant}-${k}-${tam}.txt`, await texto(pg, 'body'));
      await ctx.close();
    }
  }
}
guarda('barrido.json', resultado);
await cierra();
console.log(Object.entries({ ...resultado.personal, ...resultado.persona }).map(([k, v]) => `${k}\t${v.palabras}\tctl ${v.controles}\t${v.pantallas}p\t${v.anchoDoc}/${v.ancho}\t${(v.errores || []).length}err`).join('\n'));
