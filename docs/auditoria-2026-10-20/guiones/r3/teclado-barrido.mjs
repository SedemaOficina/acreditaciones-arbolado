// B4 · Barrido de teclado: en cada pantalla y estado, Tab de principio a fin (hasta volver al inicio o 600 Tabs), y
// por cada foco: indicador visible, contraste del anillo, si lo tapa algo fijo (2.4.11), si está fuera de la ventana
// o en algo invisible, y trampas (el mismo elemento muchas veces seguidas). Después, Mayús+Tab de regreso 40 veces.
// Uso: node teclado-barrido.mjs [390|1440] [corrida] → ../teclado-barrido-<ancho>-<corrida>.json
import { navegador, contexto, guarda, datos, BASE } from './lib.mjs';
import { registroDeFoco, activo, focos } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 1440);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const p0 = await nav.newPage(); await p0.goto(BASE + 'index.html');
const casos = await p0.evaluate(async () => { const d = await APD.cargar(); return Object.fromEntries(APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.filter((c) => c.persona).map((c) => [c.clave, c.persona.id]))); });
await p0.close();
const enviada = (f) => datos.solicitud.find((s) => s.estado === 'enviada' && f(s)).folio;
const ESTADOS = [
  ['index', 'index.html'], ['cuenta', 'cuenta.html'], ['entrar', 'entrar.html'], ['verificar', 'verificar.html'], ['material', 'material.html'], ['examen', 'examen.html'],
  ['tramites cita', 'tramites.html', casos.cita], ['tramites por-vencer', 'tramites.html', casos['por-vencer']], ['tramites obs', 'tramites.html', casos['obs-poda']],
  ['datos', 'datos.html', casos.cita], ['solicitud', 'solicitud.html?tipo=poda', casos['no-renovable']], ['solicitud obs', `solicitud.html?folio=${datos.solicitud.find((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda').folio}`, casos['obs-poda']],
  ['corregir', 'corregir.html?folio=APD-S-2026-00052', datos.solicitud.find((s) => s.folio === 'APD-S-2026-00052').solicitante_id],
  ['revision', 'revision.html'], ['revisar poda', `revisar.html?folio=${enviada((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva')}`], ['revisar dictaminador', `revisar.html?folio=${enviada((s) => s.perfil_academico === 'por_clasificar')}`],
  ['citas', 'citas.html'], ['cotejo', 'cotejo.html?folio=APD-S-2026-00042'], ['grupos', 'grupos.html?curso=poda-nueva'], ['programar', 'programar.html?curso=poda-nueva'],
  ['grupo', 'grupo.html?folio=APD-G-2026-005'], ['grupo en curso', 'grupo.html?folio=APD-G-2026-003'], ['asistencia', 'asistencia.html?folio=APD-G-2026-003'], ['aplicar', 'aplicar.html?folio=APD-G-2026-006'],
  ['material-personal', 'material-personal.html'],
  ['VOL revision', 'revision.html', null, true], ['VOL citas', 'citas.html', null, true], ['VOL grupos', 'grupos.html?curso=poda-nueva', null, true], ['VOL programar', 'programar.html?curso=poda-nueva', null, true],
  ['VOL aplicar', 'aplicar.html?folio=APD-G-2026-020', null, true], ['VOL asistencia', 'asistencia.html?folio=APD-G-2026-024', null, true], ['VOL grupo', 'grupo.html?folio=APD-G-2026-020', null, true]
];

const salida = [];
for (const [nombre, url, sesion, vol] of ESTADOS) {
  const { c, errores } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion, vol });
  await c.addInitScript(registroDeFoco);
  const p = await c.newPage();
  await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const orden = []; let trampa = null; let repetido = 0; let previo = '';
  for (let i = 0; i < 600; i++) {
    await p.keyboard.press('Tab');
    const a = await activo(p);
    orden.push(a.desc);
    if (a.desc === previo) { repetido++; if (repetido >= 4 && !trampa) trampa = a.desc; } else repetido = 0;
    previo = a.desc;
    if (i > 2 && /a\.salto/.test(a.desc)) break; // volvió al principio
  }
  await p.waitForTimeout(150);
  const ida = await focos(p);
  // De regreso
  for (let i = 0; i < 40; i++) await p.keyboard.press('Shift+Tab');
  await p.waitForTimeout(150);
  const vuelta = await focos(p);
  const todos = [...ida, ...vuelta];
  const problema = (f) => f.indicador === 'NINGUNO' || f.tapado === 'TOTAL' || f.tapado === 'parcial' || (f.contrasteAnillo && f.contrasteAnillo < 3) || !f.dentro;
  const malos = todos.filter(problema);
  salida.push({ nombre, url, ancho, tabs: orden.length, cuerpo: orden.filter((o) => /^body/.test(o)).length, trampa, malos, orden, errores });
  process.stdout.write(malos.length ? 'X' : '.');
  await c.close();
}
await nav.close();
guarda(`teclado-barrido-${ancho}-${corrida}.json`, { fecha: new Date().toISOString(), salida });
console.log();
for (const s of salida) {
  const agrupa = {};
  for (const m of s.malos) { const k = `${m.indicador === 'NINGUNO' ? 'SIN INDICADOR ' : ''}${m.tapado !== 'no' ? 'tapado ' + m.tapado + ' por ' + (m.tapadoPor || '') : ''}${m.contrasteAnillo < 3 ? ' contraste ' + m.contrasteAnillo : ''}${!m.dentro ? ' FUERA DE VENTANA' : ''}`; (agrupa[k] = agrupa[k] || new Set()).add(m.el.slice(0, 70)); }
  console.log(`${s.ancho} ${s.nombre}: ${s.tabs} Tabs; body ${s.cuerpo}; trampa ${s.trampa || 'no'}`);
  for (const [k, v] of Object.entries(agrupa)) console.log(`    ${k} ×${v.size}: ${[...v].slice(0, 4).join(' | ')}`);
}
