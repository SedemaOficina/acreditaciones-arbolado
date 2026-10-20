// C5 · Inventario de textos EN PANTALLA (con scripts), en todos los estados que permiten los casos del menú de pruebas
// y el escenario de volumen. Por cada estado guarda: texto visible (por renglón), texto de bloques ocultos ([hidden],
// diálogos cerrados, <template>) y atributos que se leen o se oyen (aria-label, placeholder, title, alt), más el título.
// Excluye el menú de pruebas y la franja de la versión de prueba (se guardan aparte como «prueba»).
//   node c5-recorrido.mjs  → c5-pantallas.json
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID, datos, sesionInit, volumen } from './comun.mjs';

const nav = await chromium.launch({ executablePath: CHROMIUM });
const estados = [];
const errores = [];

function extrae() {
  const limpio = (t) => String(t || '').replace(/[ \t ]+/g, ' ').trim();
  const lineas = (t) => String(t || '').split(/\n+/).map(limpio).filter(Boolean);
  const prueba = (el) => el.closest('.entorno-pruebas, .menu-pruebas, dialog.menu-pruebas, [class*="menu-pruebas"], .prueba-ubicacion, .prueba-aviso');
  const r = { titulo: document.title, visibles: [], ocultos: [], atributos: [], prueba: [] };
  // Visible: innerText del cuerpo sin lo de la prueba
  const c = document.body.cloneNode(true);
  // innerText necesita el árbol en la página: se calcula sobre el original y se restan las partes de prueba
  const partesPrueba = [...document.querySelectorAll('.entorno-pruebas, [class*="menu-pruebas"], .prueba-ubicacion, .prueba-aviso')];
  const txtPrueba = new Set(partesPrueba.flatMap((x) => lineas(x.innerText)));
  r.prueba = [...txtPrueba];
  r.visibles = [...new Set(lineas(document.body.innerText))].filter((l) => !txtPrueba.has(l));
  // Ocultos: [hidden], diálogos cerrados, template (texto que aparece en algún caso)
  const ocultos = new Set();
  for (const el of document.querySelectorAll('[hidden], dialog:not([open]), template')) {
    if (prueba(el) || el.closest('script,style')) continue;
    const src = el.tagName === 'TEMPLATE' ? el.content : el;
    for (const l of lineas(src.textContent)) if (!r.visibles.includes(l)) ocultos.add(l);
  }
  r.ocultos = [...ocultos];
  const atr = new Set();
  for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],img[alt],[aria-description],[aria-roledescription]')) {
    if (prueba(el)) continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt', 'aria-description', 'aria-roledescription']) {
      const v = el.getAttribute(a); if (v && v.trim()) atr.add(`${a}: ${limpio(v)}`);
    }
  }
  const md = document.querySelector('meta[name="description"]');
  if (md) atr.add(`meta description: ${md.content}`);
  r.atributos = [...atr];
  void c;
  return r;
}

async function visita(nombre, pantalla, publico, url, { sesion, vol, antes, ancho = publico === 'persona' ? 390 : 1280 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  if (sesion) await ctx.addInitScript(sesionInit, sesion);
  if (vol) await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: volumen().cuerpo, contentType: 'application/json' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  try {
    await page.goto(BASE + url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    if (antes) await antes(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(extrae);
    estados.push({ estado: nombre, pantalla, publico, url: page.url().replace(BASE, ''), vol: Boolean(vol), ...r });
  } catch (e) { errores.push(`${nombre}: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close();
}

// ── Casos del menú de pruebas (persona) ──
const ctx0 = await nav.newContext();
const p0 = await ctx0.newPage();
await p0.goto(BASE + 'index.html'); await p0.waitForLoadState('networkidle');
const grupos = await p0.evaluate(() => APD.cargar().then((d) => APD_CASOS_PRUEBA.lista(d).map((g) => ({ perfil: g.perfil, grupo: g.grupo, casos: g.casos.map((c) => ({ clave: c.clave, texto: c.texto, persona: c.persona ? c.persona.id : null, migrada: Boolean(c.migrada), pantalla: c.pantalla || null })) }))));
await ctx0.close();
const casos = grupos.flatMap((g) => g.casos.map((c) => ({ ...c, perfil: g.perfil })));
const solDe = (id) => datos.solicitud.filter((s) => s.solicitante_id === id).sort((a, b) => String(b.creada_en || '').localeCompare(String(a.creada_en || '')))[0];
for (const c of casos) {
  if (c.pantalla) continue;
  if (c.migrada) { await visita(`caso ${c.clave}`, 'cuenta', 'persona', `cuenta.html?migrada=${encodeURIComponent(c.persona)}`, { antes: (p) => p.waitForTimeout(800) }); continue; }
  if (!c.persona) continue;
  await visita(`caso ${c.clave}`, 'tramites', 'persona', 'tramites.html', { sesion: c.persona });
  const s = solDe(c.persona);
  if (s && ['borrador', 'con_observaciones'].includes(s.estado)) await visita(`caso ${c.clave} · solicitud`, 'solicitud', 'persona', `solicitud.html?folio=${s.folio}`, { sesion: c.persona });
  if (/^cita|pausa/.test(c.clave)) await visita(`caso ${c.clave} · corregir`, 'corregir', 'persona', 'corregir.html', { sesion: c.persona });
}
const persUna = casos.find((c) => c.clave === 'acreditada');
if (persUna) await visita('mi perfil (acreditada)', 'datos', 'persona', 'datos.html', { sesion: persUna.persona });
const persFoto = casos.find((c) => c.clave === 'enviada');
if (persFoto) await visita('mi perfil (foto sin confirmar)', 'datos', 'persona', 'datos.html', { sesion: persFoto.persona });
const sinTramite = datos.solicitante.find((p) => p.estado === 'activa' && !datos.solicitud.some((s) => s.solicitante_id === p.id));
await visita('solicitud nueva', 'solicitud', 'persona', 'solicitud.html', { sesion: sinTramite.id });
await visita('solicitud nueva · continuar sin elegir', 'solicitud', 'persona', 'solicitud.html', { sesion: sinTramite.id, antes: (p) => p.click('[data-accion="siguiente"] >> nth=0').catch(() => {}) });
await visita('tramites sin sesión → entrar', 'entrar', 'persona', 'tramites.html');

// ── Públicas y formularios con error ──
await visita('inicio', 'index', 'persona', 'index.html');
await visita('crear cuenta', 'cuenta', 'persona', 'cuenta.html');
await visita('crear cuenta · enviar vacío', 'cuenta', 'persona', 'cuenta.html', { antes: (p) => p.click('[data-accion="enviar"]') });
await visita('entrar', 'entrar', 'persona', 'entrar.html');
await visita('entrar · enviar vacío', 'entrar', 'persona', 'entrar.html', { antes: (p) => p.click('[data-accion="enviar"]') });
const unaPersona = datos.solicitante.find((p) => p.estado === 'activa');
await visita('entrar · contraseña equivocada', 'entrar', 'persona', 'entrar.html', { antes: async (p) => { await p.fill('#curp', unaPersona.curp); await p.fill('#contrasena', 'Equivocada123!'); await p.click('[data-accion="enviar"]'); await p.waitForTimeout(800); } });
await visita('verificar', 'verificar', 'persona', 'verificar.html');
await visita('verificar · vacío', 'verificar', 'persona', 'verificar.html', { antes: (p) => p.click('[data-accion="enviar"]') });
for (const sit of ['vigente', 'vencida', 'otra']) {
  const a = sit === 'otra' ? null : datos.acreditacion.find((x) => (sit === 'vigente' ? x.vence_en > datos.fecha_corte : x.vence_en < datos.fecha_corte) && x.numero);
  const num = a ? a.numero : 'PD-2026-9999';
  await visita(`verificar · ${sit} (${num})`, 'verificar', 'persona', 'verificar.html', { antes: async (p) => { await p.fill('#numero', num); await p.click('[data-accion="enviar"]'); await p.waitForTimeout(900); } });
}
await visita('material de estudio', 'material', 'persona', 'material.html');

// ── Personal con datos ficticios ──
await visita('bandeja de revisión', 'revision', 'personal', 'revision.html');
for (const s of datos.solicitud.filter((x) => x.estado === 'enviada').slice(0, 12)) await visita(`revisar ${s.folio} (${s.tipo_acreditacion}, ${s.modalidad}${s.perfil_academico === 'no_cumple' ? ', perfil no cumple' : ''})`, 'revisar', 'personal', `revisar.html?folio=${s.folio}`);
await visita('revisar · folio inexistente', 'revisar', 'personal', 'revisar.html?folio=APD-S-2026-99999');
await visita('revisar · sin folio', 'revisar', 'personal', 'revisar.html');
await visita('citas de cotejo', 'citas', 'personal', 'citas.html');
for (const s of datos.solicitud.filter((x) => x.estado === 'validada_en_linea')) await visita(`cotejo ${s.folio}${s.cotejo_pausa ? ' (pausa)' : ''}${s.cita_motivo ? ` (${s.cita_motivo})` : ''}`, 'cotejo', 'personal', `cotejo.html?folio=${s.folio}`);
await visita('cotejo · sin folio', 'cotejo', 'personal', 'cotejo.html');
for (const curso of ['poda-nueva', 'poda-renovacion', 'dictaminador-nueva', 'dictaminador-renovacion']) {
  await visita(`grupos ${curso}`, 'grupos', 'personal', `grupos.html?curso=${curso}`);
  await visita(`programar ${curso}`, 'programar', 'personal', `programar.html?curso=${curso}`);
}
await visita('grupos sin curso', 'grupos', 'personal', 'grupos.html');
await visita('programar sin curso', 'programar', 'personal', 'programar.html');
await visita('espera (redirige)', 'espera', 'personal', 'espera.html');
for (const g of datos.grupo) await visita(`grupo ${g.folio} (${g.estado})`, 'grupo', 'personal', `grupo.html?folio=${g.folio}`);
await visita('asistencia sin grupo', 'asistencia', 'personal', 'asistencia.html');
for (const g of datos.grupo.filter((x) => ['en_curso', 'concluido', 'confirmado'].includes(x.estado))) await visita(`asistencia ${g.folio} (${g.estado})`, 'asistencia', 'personal', `asistencia.html?folio=${g.folio}`);
await visita('aplicar · mis grupos de hoy', 'aplicar', 'personal', 'aplicar.html');
for (const g of datos.grupo.filter((x) => ['en_curso', 'concluido'].includes(x.estado))) await visita(`aplicar ${g.folio} (${g.estado})`, 'aplicar', 'personal', `aplicar.html?folio=${g.folio}`);
await visita('material del personal', 'material-personal', 'personal', 'material-personal.html');

// ── Examen: código equivocado, inexistente y el recorrido completo hasta el resultado ──
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Mexico_City' });
  const ap = await ctx.newPage();
  ap.on('dialog', (d) => d.dismiss().catch(() => {}));
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`); await ap.waitForSelector('[data-filas] tr');
  const boton = ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
  const ins = await boton.getAttribute('data-ins'); await boton.click();
  await ap.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
  const codigo = (await ap.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
  estados.push({ estado: 'aplicar · tras pasar lista', pantalla: 'aplicar', publico: 'personal', url: ap.url().replace(BASE, ''), ...(await ap.evaluate(extrae)) });
  const ex = await ctx.newPage();
  ex.on('pageerror', (e) => errores.push(`examen: ${e.message}`));
  await ex.goto(`${BASE}examen.html`); await ex.waitForLoadState('networkidle');
  estados.push({ estado: 'examen · entrar', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.fill('#codigo', 'ABC'); await ex.click('#entrar [data-accion="enviar"]'); await ex.waitForTimeout(400);
  estados.push({ estado: 'examen · código mal escrito', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.fill('#codigo', 'AAAA-AAAA'); await ex.click('#entrar [data-accion="enviar"]'); await ex.waitForTimeout(900);
  estados.push({ estado: 'examen · código inexistente', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.fill('#codigo', codigo); await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  estados.push({ estado: 'examen · ¿eres tú?', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.click('[data-ir-vista="instrucciones"]'); await ex.waitForTimeout(300);
  estados.push({ estado: 'examen · instrucciones', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.click('[data-empezar]'); await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await ex.locator('[data-opciones] input').first().check(); await ex.waitForTimeout(500);
  estados.push({ estado: 'examen · pregunta', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.click('[data-siguiente]'); await ex.waitForTimeout(300);
  for (let i = 0; i < 12; i++) { if (await ex.locator('[data-vista="revision"]:not([hidden])').count()) break; await ex.click('[data-siguiente]').catch(() => {}); await ex.waitForTimeout(200); }
  estados.push({ estado: 'examen · revisión antes de enviar', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.click('[data-enviar]').catch(() => {}); await ex.waitForTimeout(300);
  estados.push({ estado: 'examen · confirmar envío', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ex.click('.dialogo-confirma [data-r="si"]').catch(() => {}); await ex.waitForTimeout(900);
  estados.push({ estado: 'examen · resultado', pantalla: 'examen', publico: 'persona (examen)', url: 'examen.html', ...(await ex.evaluate(extrae)) });
  await ap.reload(); await ap.waitForSelector('[data-filas] tr'); await ap.waitForTimeout(500);
  estados.push({ estado: 'aplicar · tras un examen', pantalla: 'aplicar', publico: 'personal', url: ap.url().replace(BASE, ''), ...(await ap.evaluate(extrae)) });
  await ctx.close();
}

// ── Personal con el escenario de volumen ──
const v = volumen().d;
await visita('VOLUMEN bandeja de revisión', 'revision', 'personal', 'revision.html', { vol: true });
await visita('VOLUMEN citas de cotejo', 'citas', 'personal', 'citas.html', { vol: true });
for (const curso of ['poda-nueva', 'poda-renovacion', 'dictaminador-nueva', 'dictaminador-renovacion']) {
  await visita(`VOLUMEN grupos ${curso}`, 'grupos', 'personal', `grupos.html?curso=${curso}`, { vol: true });
  await visita(`VOLUMEN programar ${curso}`, 'programar', 'personal', `programar.html?curso=${curso}`, { vol: true });
}
await visita('VOLUMEN aplicar · mis grupos de hoy', 'aplicar', 'personal', 'aplicar.html', { vol: true });
for (const f of ['APD-G-2026-020', 'APD-G-2026-024']) {
  await visita(`VOLUMEN aplicar ${f}`, 'aplicar', 'personal', `aplicar.html?folio=${f}`, { vol: true });
  await visita(`VOLUMEN asistencia ${f}`, 'asistencia', 'personal', `asistencia.html?folio=${f}`, { vol: true });
  await visita(`VOLUMEN grupo ${f}`, 'grupo', 'personal', `grupo.html?folio=${f}`, { vol: true });
}
const pausaV = v.solicitud.find((s) => s.cotejo_pausa && s.cita_en && s.cita_en.slice(0, 10) < v.fecha_corte);
if (pausaV) await visita(`VOLUMEN cotejo pausa vencida ${pausaV.folio}`, 'cotejo', 'personal', `cotejo.html?folio=${pausaV.folio}`, { vol: true });

await nav.close();
writeFileSync(`${EVID}/c5-pantallas.json`, JSON.stringify({ casos, estados, errores }, null, 1));
const porPantalla = {};
for (const e of estados) porPantalla[e.pantalla] = (porPantalla[e.pantalla] || 0) + 1;
console.log(`${estados.length} estados; ${casos.length} casos del menú; por pantalla: ${JSON.stringify(porPantalla)}; errores de página: ${errores.length}`);
for (const e of errores) console.log('  ERROR', e);
