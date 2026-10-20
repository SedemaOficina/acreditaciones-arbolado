// B4 · axe al cargar, en estados que probar-sitio no cubre: cada pantalla sin sesión, «Mis trámites» y «Mi perfil»
// de cada caso del menú de pruebas, la solicitud de cada caso, revisar/cotejo/grupo/asistencia/aplicar de cada
// variante de los datos, y las pantallas del personal con el escenario de volumen. A 390 y 1440 px.
// Uso: node axe-estados.mjs   → ../axe-estados.json
import { navegador, contexto, axe, guarda, datos, BASE, quieto } from './lib.mjs';

const nav = await navegador();
const pagina = await nav.newPage();
await pagina.goto(BASE + 'index.html');
const casos = await pagina.evaluate(async () => { const d = await APD.cargar(); return APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.map((c) => ({ perfil: g.perfil, clave: c.clave, id: c.persona && c.persona.id, migrada: Boolean(c.migrada) }))); });
await pagina.close();

const E = [];
const add = (nombre, url, extra = {}) => E.push({ nombre, url, ...extra });
for (const p of ['index', 'cuenta', 'entrar', 'verificar', 'material', 'examen', 'espera', 'tramites', 'datos', 'solicitud', 'corregir',
  'revision', 'revisar', 'citas', 'cotejo', 'grupos', 'programar', 'grupo', 'asistencia', 'aplicar', 'material-personal']) add(`${p} sin sesión ni parámetros`, `${p}.html`);
for (const k of casos.filter((x) => x.id && !x.migrada)) {
  add(`tramites · caso ${k.clave}`, 'tramites.html', { sesion: k.id });
  add(`datos · caso ${k.clave}`, 'datos.html', { sesion: k.id });
}
// Solicitud de cada situación
const conPersona = (f) => datos.solicitud.find((s) => f(s) && datos.solicitante.some((p) => p.id === s.solicitante_id && p.estado === 'activa'));
for (const [nombre, s] of [['borrador', conPersona((s) => s.estado === 'borrador')], ['observaciones poda', conPersona((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda')],
  ['observaciones dictaminador', conPersona((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'dictaminador')]]) if (s) add(`solicitud · ${nombre}`, `solicitud.html?folio=${s.folio}`, { sesion: s.solicitante_id });
const porVencer = casos.find((k) => k.clave === 'por-vencer');
add('solicitud · renovación (por vencer)', 'solicitud.html?tipo=poda', { sesion: porVencer.id });
add('solicitud · nueva poda', 'solicitud.html?tipo=poda', { sesion: casos.find((k) => k.clave === 'no-renovable').id });
for (const k of ['cita', 'cita-sin-pago', 'cita-inasistencia', 'pausa-vencida']) add(`corregir · caso ${k}`, 'corregir.html', { sesion: casos.find((x) => x.clave === k).id });
for (const s of datos.solicitud.filter((x) => x.estado === 'enviada')) add(`revisar · ${s.folio} ${s.tipo_acreditacion} ${s.modalidad} ${s.perfil_academico || ''}`, `revisar.html?folio=${s.folio}`);
for (const s of datos.solicitud.filter((x) => ['validada_en_linea'].includes(x.estado))) add(`cotejo · ${s.folio}${s.cita_motivo ? ' ' + s.cita_motivo : ''}${s.cotejo_pausa ? ' pausa' : ''}`, `cotejo.html?folio=${s.folio}`);
for (const g of datos.grupo) {
  add(`grupo · ${g.folio} ${g.estado}`, `grupo.html?folio=${g.folio}`);
  if (['en_curso', 'concluido'].includes(g.estado)) { add(`asistencia · ${g.folio} ${g.estado}`, `asistencia.html?folio=${g.folio}`); add(`aplicar · ${g.folio} ${g.estado}`, `aplicar.html?folio=${g.folio}`); }
}
for (const c of ['poda-nueva', 'poda-renovacion', 'dictaminador-nueva', 'dictaminador-renovacion']) add(`grupos · ${c}`, `grupos.html?curso=${c}`);
add('verificar · ?numero inexistente', 'verificar.html?numero=PD-2026-9999');
// Con volumen
for (const u of ['revision.html', 'citas.html', 'grupos.html?curso=poda-nueva', 'grupos.html?curso=poda-renovacion', 'programar.html?curso=poda-nueva', 'asistencia.html', 'aplicar.html',
  'aplicar.html?folio=APD-G-2026-020', 'grupo.html?folio=APD-G-2026-020', 'asistencia.html?folio=APD-G-2026-024']) add(`VOLUMEN · ${u}`, u, { vol: true });

const resultados = [];
for (const ancho of [390, 1440]) {
  for (const e of E) {
    const { c, errores } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, vol: e.vol, sesion: e.sesion });
    const p = await c.newPage();
    let v;
    try {
      await p.goto(BASE + e.url, { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      v = await axe(p);
    } catch (err) { v = [{ id: 'ERROR-DEL-GUION', n: 1, nodos: [{ html: String(err).slice(0, 200) }] }]; }
    resultados.push({ ancho, ...e, destino: p.url().replace(BASE, ''), titulo: await p.title().catch(() => ''), violaciones: v, errores: [...errores] });
    process.stdout.write(v.length ? 'X' : '.');
    await c.close();
  }
}
await nav.close();
const con = resultados.filter((r) => r.violaciones.length);
guarda('axe-estados.json', { fecha: new Date().toISOString(), total: resultados.length, conViolaciones: con.length, resultados });
console.log(`\n${resultados.length} estados; con violaciones: ${con.length}`);
for (const r of con) console.log(`${r.ancho} ${r.nombre} → ${r.violaciones.map((v) => `${v.id}(${v.n})`).join(', ')}`);
