// C3 · Carga de la interfaz por tarea en 390x844 (teléfono). Por cada estado de pantalla que la persona tiene que leer o
// usar: palabras visibles, controles (campos, botones, enlaces) y alto del documento entre alto de la ventana. Cuenta
// también las acciones que hizo el guion (escribir, elegir, tocar) para completar la tarea.
// Uso: node guiones/c3-carga.mjs [rep]   (rep: 1 o 2; cada corrida en contextos nuevos)
import { contexto, ir, mide, captura, guarda, cierra, TEL, volumen, ficticios, RAIZ } from './comun.mjs';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const REP = process.argv[2] || '1';
const VP = process.env.ANCHO === 'esc' ? { width: 1440, height: 900 } : TEL;
const SUF = process.env.ANCHO === 'esc' ? 'esc' : 'tel';
const d = ficticios();
const vol = JSON.parse(volumen());
await import(RAIZ + '/sitio/formkit/js/validaciones.config.js');
const ALF = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALF.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const NUEVA = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', nacimiento: '1999-12-30' };
NUEVA.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: NUEVA.nombre, primer: NUEVA.primer_apellido, segundo: NUEVA.segundo_apellido }, NUEVA.nacimiento, 'M', 'NE') + '0');
const PDF = { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% documento ficticio de prueba\n%%EOF\n') };
function png(w = 400, h = 500) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const bl = (t, x) => { const tt = Buffer.from(t); const l = Buffer.alloc(4); l.writeUInt32BE(x.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([tt, x]))); return Buffer.concat([l, tt, x, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  const f = Buffer.alloc((w + 1) * h, 0x9a); for (let y = 0; y < h; y++) f[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bl('IHDR', ih), bl('IDAT', deflateSync(f)), bl('IEND', Buffer.alloc(0))]);
}
const FOTO = { name: 'foto.png', mimeType: 'image/png', buffer: png() };
const pasoVisible = 'section[data-paso]:not([hidden])';

const tareas = {};
function nueva(nombre) {
  const t = { pasos: [], acciones: 0, falla: null };
  tareas[nombre] = t;
  return {
    t,
    a: (n = 1) => { t.acciones += n; },
    async m(pg, estado) {
      const r = await mide(pg);
      const url = pg.url().replace(/^.*\//, '');
      t.pasos.push({ estado, url, ...r });
      await captura(pg, `c3-${nombre}-${t.pasos.length}-${SUF}-r${REP}`, true);
    }
  };
}
async function corre(nombre, opciones, fn) {
  const T = nueva(nombre);
  const ctx = await contexto({ vp: VP, ...opciones });
  const pg = await ctx.newPage();
  try { await fn(pg, T); } catch (e) { T.t.falla = String(e.message || e).split('\n')[0]; await captura(pg, `c3-${nombre}-FALLA-${SUF}-r${REP}`, true).catch(() => {}); }
  T.t.errores = ctx.errores.slice(0, 3);
  await ctx.close();
}

// T1 Crear cuenta
let curpNueva = NUEVA.curp;
await corre('crear-cuenta', {}, async (pg, T) => {
  await ir(pg, 'index.html', 'main', 600); await T.m(pg, 'inicio');
  await pg.click('a[href="cuenta.html"]'); T.a(); await pg.waitForSelector('#nombre'); await pg.waitForTimeout(400);
  await T.m(pg, 'formulario vacío');
  await pg.fill('#nombre', NUEVA.nombre); await pg.fill('#primer_apellido', NUEVA.primer_apellido); await pg.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await pg.fill('#fecha_nacimiento', NUEVA.nacimiento.split('-').reverse().join('/')); await pg.fill('#curp', curpNueva);
  await pg.fill('#correo', `${curpNueva.toLowerCase()}@ejemplo.local`); await pg.fill('#correo2', `${curpNueva.toLowerCase()}@ejemplo.local`);
  await pg.fill('#telefono', '0000000077'); await pg.fill('#contrasena', 'una frase larga de prueba'); await pg.fill('#contrasena2', 'una frase larga de prueba');
  T.a(10);
  await pg.check('input[name="adscrito"][value="no"]', { force: true }); T.a();
  await pg.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', FOTO); T.a();
  await pg.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
  for (const n of ['protesta', 'aviso', 'humano']) if (await pg.$(`input[name="${n}"]`)) { await pg.check(`input[name="${n}"]`, { force: true }); T.a(); }
  await T.m(pg, 'formulario lleno');
  await pg.click('[data-accion="enviar"]'); T.a();
  await pg.waitForSelector('[data-acuse]:not([hidden])'); await pg.waitForTimeout(300);
  await T.m(pg, 'acuse');
  // T2 Solicitud nueva de poda (misma persona, sigue la sesión)
  const S = nueva('solicitud-poda');
  await pg.click('[data-acuse] a[href="tramites.html"]'); S.a();
  await pg.waitForSelector('[data-solicitudes] .vacio, [data-solicitudes] .ficha'); await pg.waitForTimeout(400);
  await S.m(pg, 'mis trámites (sin solicitudes)');
  await pg.click('[data-nueva] a'); S.a();
  await pg.waitForFunction(() => document.querySelector('input[name="tipo"][value="poda"]') && document.querySelector('input[name="tipo"][value="poda"]').checked);
  await pg.waitForTimeout(400);
  await S.m(pg, 'paso 1 vacío');
  await pg.selectOption('#nivel_estudios', 'preparatoria'); S.a();
  await S.m(pg, 'paso 1 lleno');
  await pg.click(`${pasoVisible} [data-accion="siguiente"]`); S.a(); await pg.waitForTimeout(400);
  await S.m(pg, 'paso 2 documentos');
  const req = await pg.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of req) { await pg.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF); await pg.waitForSelector(`[data-campo="${n}"] .lista-arch li`); S.a(); }
  await S.m(pg, `paso 2 con ${req.length} documentos`);
  await pg.click(`${pasoVisible} [data-accion="siguiente"]`); S.a(); await pg.waitForTimeout(400);
  await S.m(pg, 'paso 3 revisión');
  for (const n of ['protesta', 'aviso', 'humano']) if (await pg.$(`input[name="${n}"]`)) { await pg.check(`input[name="${n}"]`, { force: true }); S.a(); }
  await pg.click('[data-accion="enviar"]'); S.a();
  await pg.waitForSelector('[data-acuse]:not([hidden])'); await pg.waitForTimeout(300);
  await S.m(pg, 'acuse');
});

// T3 Solicitud de dictaminador (persona con poda vigente y sin dictaminador)
const ultima = (p, tipo) => d.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === tipo).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en))[0];
const FIN = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'];
const paraDict = d.solicitante.find((p) => { const poda = ultima(p, 'poda'); return p.estado === 'activa' && poda && d.estado_acreditacion[poda.numero] === 'vigente' && !ultima(p, 'dictaminador') && !d.solicitud.some((s) => s.solicitante_id === p.id && s.tipo_acreditacion === 'dictaminador' && !FIN.includes(s.estado)); });
await corre('solicitud-dictaminador', { sesion: paraDict.id }, async (pg, T) => {
  await ir(pg, 'tramites.html', '[data-solicitudes]', 900); await T.m(pg, 'mis trámites');
  const enlace = await pg.$('[data-nueva] a');
  await enlace.click(); T.a(); await pg.waitForSelector('input[name="tipo"][value="dictaminador"]'); await pg.waitForTimeout(400);
  await pg.check('input[name="tipo"][value="dictaminador"]', { force: true }); T.a();
  await pg.waitForFunction(() => document.getElementById('tramite').value === 'dictaminador_nueva'); await pg.waitForTimeout(300);
  await T.m(pg, 'paso 1 vacío (dictaminador)');
  await pg.selectOption('#nivel_estudios', 'licenciatura'); await pg.fill('#carrera', 'Biología'); await pg.keyboard.press('Escape').catch(() => {});
  await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true }); await pg.fill('#anios_experiencia', '3'); T.a(4);
  await T.m(pg, 'paso 1 lleno');
  await pg.click(`${pasoVisible} [data-accion="siguiente"]`); T.a(); await pg.waitForTimeout(400);
  await T.m(pg, 'paso 2 documentos');
  const req = await pg.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of req) { await pg.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF); await pg.waitForSelector(`[data-campo="${n}"] .lista-arch li`); T.a(); }
  await T.m(pg, `paso 2 con ${req.length} documentos`);
  await pg.click(`${pasoVisible} [data-accion="siguiente"]`); T.a(); await pg.waitForTimeout(400);
  await T.m(pg, 'paso 3 revisión');
  for (const n of ['protesta', 'aviso', 'humano']) if (await pg.$(`input[name="${n}"]`)) { await pg.check(`input[name="${n}"]`, { force: true }); T.a(); }
  await pg.click('[data-accion="enviar"]'); T.a();
  await pg.waitForSelector('[data-acuse]:not([hidden])'); await pg.waitForTimeout(300);
  await T.m(pg, 'acuse');
});

// T4 Corregir observaciones (caso «obs-poda» del menú)
const casosLista = JSON.parse(readFileSync('/home/claude/trabajo/evidencia-2026-10-20/r4/salidas/casos.json', 'utf8'));
const caso = (k) => casosLista.find((c) => c.clave === k);
await corre('corregir-observaciones', { sesion: caso('obs-poda').persona }, async (pg, T) => {
  await ir(pg, 'tramites.html', '[data-solicitudes] .ficha', 900); await T.m(pg, 'mis trámites con observaciones');
  const a = pg.locator('[data-solicitudes] .ficha a', { hasText: /Corrige|corregir|Corregir/ }).first();
  await a.click(); T.a(); await pg.waitForSelector(pasoVisible); await pg.waitForTimeout(600);
  await T.m(pg, 'corrección, primer paso');
  for (let i = 0; i < 4; i++) {
    const req = await pg.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null && !e.querySelector('.lista-arch li')).map((e) => e.dataset.campo));
    for (const n of req) { await pg.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF); await pg.waitForSelector(`[data-campo="${n}"] .lista-arch li`); T.a(); }
    if (req.length) await T.m(pg, `con ${req.length} documento(s) corregido(s)`);
    const sig = await pg.$(`${pasoVisible} [data-accion="siguiente"]`);
    if (!sig || !(await sig.isVisible())) break;
    await sig.click(); T.a(); await pg.waitForTimeout(400);
    await T.m(pg, `paso ${i + 2}`);
  }
  for (const n of ['protesta', 'aviso', 'humano']) if (await pg.$(`input[name="${n}"]`) && await pg.isVisible(`input[name="${n}"]`).catch(() => false)) { await pg.check(`input[name="${n}"]`, { force: true }); T.a(); }
  await pg.click('[data-accion="enviar"]'); T.a();
  await pg.waitForSelector('[data-acuse]:not([hidden])'); await pg.waitForTimeout(300);
  await T.m(pg, 'acuse del reenvío');
});

// T5 Consultar «Mis trámites»: ¿cuándo y dónde es mi cita?, ¿cuándo es mi curso?
for (const k of ['cita', 'grupo', 'por-vencer']) {
  await corre(`mis-tramites-${k}`, { sesion: caso(k).persona }, async (pg, T) => {
    await ir(pg, 'tramites.html', '[data-solicitudes]', 900);
    await T.m(pg, `mis trámites (${caso(k).texto})`);
    T.t.posicion = await pg.evaluate(() => {
      const busca = (re) => { const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (re.test(n.textContent)) return Math.round(n.parentElement.getBoundingClientRect().top + scrollY); return null; };
      return { citaY: busca(/Tu cita|cita de cotejo|Acude a tu cita/), fechaY: busca(/\d{2}\/\d{2}\/\d{4}/), presentateY: busca(/Preséntate|Tu curso/), ventana: innerHeight };
    });
  });
}

// T6 Verificar una acreditación
const vig = d.verificacion_publica.find((v) => v.situacion === 'Vigente');
await corre('verificar', {}, async (pg, T) => {
  await ir(pg, 'index.html', 'main', 500); await T.m(pg, 'inicio');
  const a = await pg.$('a[href="verificar.html"]'); if (a) { await a.click(); T.a(); } else await ir(pg, 'verificar.html');
  await pg.waitForSelector('form'); await pg.waitForTimeout(300); await T.m(pg, 'verificar vacío');
  const campo = await pg.$('main input[type="text"], main input[type="search"], main input:not([type])');
  await campo.fill(vig.numero); T.a();
  await pg.click('[data-accion="enviar"]'); T.a(); await pg.waitForTimeout(700);
  await T.m(pg, 'resultado');
});

// T7 Revisar una solicitud (personal, escenario de volumen)
await corre('revisar-solicitud', { vol: true }, async (pg, T) => {
  await ir(pg, 'revision.html', '[data-filas] tr', 900); await T.m(pg, 'bandeja');
  await pg.click('[data-filas] tr:first-child a'); T.a(); await pg.waitForSelector('#formulario:not([hidden])'); await pg.waitForTimeout(800);
  await T.m(pg, 'revisar, al abrir');
  const docs = await pg.$$eval('input[name^="decision_"][value="aceptado"]', (l) => l.filter((x) => x.offsetParent !== null || x.closest('.campo')).map((x) => x.name));
  for (const n of [...new Set(docs)]) {
    for (let i = 1; i <= 5; i++) { try { await pg.check(`input[name="${n}"][value="aceptado"]`, { force: true, timeout: 3000 }); } catch (e) { /* se reintenta */ } if (await pg.isChecked(`input[name="${n}"][value="aceptado"]`)) break; await pg.waitForTimeout(300 * i); }
    T.a(); await pg.waitForTimeout(400);
  }
  await pg.waitForTimeout(400);
  await T.m(pg, `revisar, ${docs.length} documentos aceptados`);
  const man = new Date(`${vol.fecha_corte}T12:00:00-06:00`); man.setDate(man.getDate() + 2);
  await pg.fill('#cita_fecha', man.toISOString().slice(0, 10).split('-').reverse().join('/')); await pg.press('#cita_fecha', 'Tab'); await pg.selectOption('#cita_hora', '10:00'); T.a(2);
  await T.m(pg, 'revisar, cita elegida');
  await pg.focus('[data-accion="enviar"]'); await pg.click('[data-accion="enviar"]'); T.a();
  await pg.waitForSelector('[data-hecho]:not([hidden])'); await pg.waitForTimeout(300);
  await T.m(pg, 'resultado');
});

// T8 Registrar un cotejo (personal, escenario de volumen)
await corre('registrar-cotejo', { vol: true }, async (pg, T) => {
  await ir(pg, 'citas.html', '[data-filas] tr', 900); await T.m(pg, 'agenda del día');
  await pg.locator('[data-filas] tr:not([hidden]) a', { hasText: 'Atender' }).first().click(); T.a(); await pg.waitForSelector('#formulario:not([hidden]), [data-futura]:not([hidden])');
  if (await pg.isVisible('[data-atender-simulada]')) { await pg.click('[data-atender-simulada]'); T.a(); }
  await pg.waitForTimeout(800); await T.m(pg, 'cotejo, al abrir');
  await pg.check('input[name="se_presento"][value="si"]', { force: true }); T.a();
  await pg.check('input[name="identidad"][value="misma"]', { force: true }); T.a(); await pg.waitForTimeout(300);
  await T.m(pg, 'cotejo, identidad confirmada');
  for (const k of await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) { await pg.check(`input[name="coincide_${k}"][value="si"]`, { force: true }); T.a(); }
  await pg.check('input[name="pago"][value="si"]', { force: true }); T.a(); await pg.waitForTimeout(300);
  await T.m(pg, 'cotejo, documentos y pago');
  await pg.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', PDF); T.a();
  await pg.fill('#factura_rfc', 'XAXX010101000'); await pg.fill('#factura_razon_social', 'Persona Ejemplo'); await pg.fill('#factura_folio_fiscal', '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f'); T.a(3);
  await T.m(pg, 'cotejo, factura capturada');
  await pg.focus('[data-accion="enviar"]'); await pg.click('[data-accion="enviar"]'); T.a();
  await pg.waitForSelector('[data-hecho]:not([hidden])'); await pg.waitForTimeout(300);
  await T.m(pg, 'resultado');
});

// T9 Programar un grupo (personal, escenario de volumen)
await corre('programar-grupo', { vol: true }, async (pg, T) => {
  await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-grupo', 900); await T.m(pg, 'planeador');
  await pg.click('a:has-text("Programar un curso")'); T.a(); await pg.waitForSelector('.cal-dia'); await pg.waitForTimeout(800);
  await T.m(pg, 'programar, al abrir');
  const dia = await pg.$$eval('.cal-dia[data-fecha]:not([disabled]):not([aria-disabled="true"])', (l) => l.map((x) => x.dataset.fecha).filter((f) => f >= '2026-11-02')[0]);
  await pg.click(`.cal-dia[data-fecha="${dia}"]`, { force: true }); T.a(); await pg.waitForTimeout(300);
  await pg.selectOption('#instructor', { index: 1 }); await pg.selectOption('#hora_entrada', { index: 1 }); T.a(2); await pg.waitForTimeout(300);
  await T.m(pg, `programar, ${dia}, instructor y hora`);
  await pg.click('[data-programar="confirmar"]'); T.a();
  await pg.waitForSelector('dialog[open], [data-hecho]:not([hidden]), .resultado', { timeout: 8000 }).catch(() => {});
  if (await pg.isVisible('dialog[open] [data-r="si"]').catch(() => false)) { await pg.click('dialog[open] [data-r="si"]'); T.a(); }
  await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);
  await T.m(pg, 'resultado');
});

// T10 Capturar asistencia (instructor, escenario de volumen)
await corre('capturar-asistencia', { vol: true }, async (pg, T) => {
  await ir(pg, 'asistencia.html', 'main', 900); await T.m(pg, 'mis grupos de hoy');
  const a = pg.locator('.hoy-grupo', { hasText: 'APD-G-2026-024' }).locator('a.btn');
  await a.click(); T.a(); await pg.waitForSelector('.asistencia-fila'); await pg.waitForTimeout(600);
  await T.m(pg, 'asistencia del día');
  const n = await pg.$$eval('.asistencia-fila', (l) => l.length);
  if (await pg.$('[data-todas]')) { await pg.click('[data-todas]'); T.a(); } else { for (let i = 0; i < n; i++) { await pg.check(`.asistencia-fila:nth-of-type(${i + 1}) input[value="si"]`, { force: true }); T.a(); } }
  await T.m(pg, `${n} marcadas`);
  const llega = pg.waitForURL(/hecho=asistencia/).catch(() => {});
  await pg.click('[data-guardar]'); T.a(); await llega; await pg.waitForSelector('.asistencia-fila').catch(() => {}); await pg.waitForTimeout(500);
  await T.m(pg, 'guardada');
});

// T11 Aplicar el examen (instructor, escenario de volumen; grupo de 25 con examen hoy)
await corre('aplicar-examen', { vol: true }, async (pg, T) => {
  await ir(pg, 'aplicar.html', 'main', 900); await T.m(pg, 'mis grupos de hoy');
  await pg.click('.hoy-grupo:has-text("APD-G-2026-020") a.btn'); T.a();
  await pg.waitForSelector('[data-grupo] .datos-valor'); await pg.waitForTimeout(800);
  await T.m(pg, 'pase de lista, al abrir');
  const presentes = await pg.$$('[data-accion="presente"]');
  T.t.presentesPosibles = presentes.length;
  for (let i = 0; i < 40; i++) { const b = pg.locator('button[data-accion="presente"]').first(); if (!(await b.count())) break; await b.click(); T.a(); await pg.waitForTimeout(150); }
  await pg.waitForTimeout(600);
  await T.m(pg, 'lista pasada (todas presentes, una por una)');
});

guarda(`c3-carga-${SUF}-r${REP}.json`, tareas);
const resumen = Object.entries(tareas).map(([k, t]) => {
  const s = (f) => t.pasos.reduce((a, p) => a + (p[f] || 0), 0);
  return `${k}\tpantallas ${new Set(t.pasos.map((p) => p.url.split('?')[0])).size}\testados ${t.pasos.length}\tpalabras ${s('palabras')}\tcontroles ${s('controles')}\tdespl ${s('pantallas').toFixed(1)}\tacciones ${t.acciones}${t.falla ? '\tFALLA: ' + t.falla : ''}${t.errores && t.errores.length ? '\tERR ' + t.errores.join('|') : ''}`;
});
console.log(resumen.join('\n'));
await cierra();
