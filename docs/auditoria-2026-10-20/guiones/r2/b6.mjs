// B6 · Teléfono y continuidad (auditoría 20/10/2026, r2). Cada escenario corre dos veces, cada vez en un contexto nuevo.
// Uso: [SOLO=regex de escenario] node b6.mjs     Salida: <evidencia>/b6/b6.json y capturas/b6/
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, navegador, contexto, vigila, carpeta, espera, COPIA, EVID } from './comun.mjs';

const SAL = carpeta('b6');
const CAP = carpeta('capturas', 'b6');
const DOCS = join(COPIA, 'sitio/datos/documentos');
const FOTO = join(EVID, 'archivos/foto-con-gps.jpg');
const est = JSON.parse(readFileSync(join(EVID, 'b1/estados-ficticios.json'), 'utf8'));
const sesionDe = (caso) => (est.find((s) => s.caso === caso) || {}).sesion;
const nav = await navegador();
const salida = {};

// Cuenta llamadas a cámara (getUserMedia) y ubicación (geolocation) en todo el recorrido
const espia = () => {
  window.__permisos = { camara: 0, ubicacion: 0 };
  try { const g = navigator.mediaDevices && navigator.mediaDevices.getUserMedia; if (g) navigator.mediaDevices.getUserMedia = function (...a) { window.__permisos.camara++; return g.apply(this, a); }; } catch (e) { /* */ }
  try { const geo = navigator.geolocation; for (const m of ['getCurrentPosition', 'watchPosition']) { const f = geo[m].bind(geo); geo[m] = (...a) => { window.__permisos.ubicacion++; return f(...a); }; } } catch (e) { /* */ }
};
async function nuevo(vista, opciones = {}) {
  const c = await contexto(nav, vista, opciones);
  await c.addInitScript(espia);
  const p = await c.newPage();
  p.on('dialog', (d) => { p.ultimoDialogo = `${d.type()}: ${d.message()}`; d.accept().catch(() => {}); });
  p.log = vigila(p);
  return { c, p };
}
const cap = (p, nombre, completa = false) => p.screenshot({ path: join(CAP, `${nombre}.png`), fullPage: completa });
const texto = (p, sel = 'main') => p.evaluate((s) => (document.querySelector(s) || document.body).innerText.replace(/\s+/g, ' ').trim(), sel);
// Ocupación de la ventana por elementos fijos o pegajosos en el punto medio de la página
const ocupacion = (p) => p.evaluate(() => {
  window.scrollTo(0, Math.max(0, (document.documentElement.scrollHeight - innerHeight) / 2));
  const fijos = [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); return (cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && cs.visibility !== 'hidden' && !el.closest('dialog'); });
  const fil = new Array(Math.ceil(innerHeight)).fill(false);
  const quien = [];
  for (const f of fijos) {
    const b = f.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= innerHeight || b.width < innerWidth * 0.5) { if (b.width && b.height && b.bottom > 0 && b.top < innerHeight) quien.push(`${f.className} (${Math.round(b.width)}×${Math.round(b.height)}, no ocupa el ancho)`); continue; }
    for (let y = Math.max(0, Math.floor(b.top)); y < Math.min(innerHeight, Math.ceil(b.bottom)); y++) fil[y] = true;
    quien.push(`${f.className} (${Math.round(b.top)}–${Math.round(b.bottom)})`);
  }
  const ocupado = fil.filter(Boolean).length;
  window.scrollTo(0, 0);
  return { alto: innerHeight, ocupado, libre: innerHeight - ocupado, quien, desborde: document.documentElement.scrollWidth - innerWidth };
});
const subir = async (p, campo, archivo) => {
  await p.locator(`[data-campo="${campo}"] input[type=file]:not([data-entrada-camara])`).setInputFiles(archivo);
  await p.waitForFunction((c) => { const l = document.querySelector(`[data-campo="${c}"] .lista-arch`); return l && /listo|Listo|KB|MB/.test(l.innerText); }, campo, { timeout: 10000 }).catch(() => {});
  await espera(400);
};
// Documentos del trámite elegido (también los de un paso oculto): los que tiene el formulario en memoria
const listos = (p) => p.evaluate(() => { const t = (document.getElementById('tramite') || {}).value || ''; return [...document.querySelectorAll(`[data-campo^="doc_${t}_"]`)].map((c) => [c.dataset.campo.replace(/^doc_[a-z]+_[a-z]+_/, ''), window.FormKit && FormKit.archivos ? FormKit.archivos.de(c).filter((a) => a.estado === 'listo').length : c.querySelectorAll('.lista-arch li').length]); });
const guardadosBorrador = (p) => p.evaluate(async () => { const s = APD.leeSesion(); const id = s && s.id; const l = await APD_ARCHIVOS_PRUEBA.documentos(`borrador:${id}:nueva`).catch(() => []); return l.map((d) => d.requisito); });
const estado = async (p) => ({ url: p.url().replace(BASE, ''), paso: await pasoActual(p), historial: await p.evaluate(() => history.length), tipo: await p.evaluate(() => (document.querySelector('input[name=tipo]:checked') || {}).value || null), nivel: await p.evaluate(() => (document.getElementById('nivel_estudios') || {}).value || null), franja: await p.locator('[data-franja-borrador]').isVisible().catch(() => null), docs: await listos(p).catch(() => null) });
const siguiente = async (p) => { await p.locator('[data-accion="siguiente"]:visible').first().click(); await espera(600); };
const pasoActual = (p) => p.evaluate(() => { const s = [...document.querySelectorAll('section[data-paso]')].find((x) => !x.hidden); return s ? s.dataset.titulo : (document.querySelector('[data-acuse]:not([hidden])') ? 'acuse' : '—'); });
async function solicitudHastaRevision(p, { docs = 4, nombre = '' } = {}) {
  await p.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
  await p.waitForSelector('input[name="tipo"][value="poda"]:visible:enabled', { timeout: 15000 }); await espera(300);
  await p.locator('input[name="tipo"][value="poda"]').check({ force: true });
  await espera(300);
  await p.selectOption('#nivel_estudios', 'licenciatura'); await espera(200);
  if (await p.locator('#carrera').isVisible()) await p.fill('#carrera', 'Biología');
  const tit = p.locator('input[name="estatus_estudios"][value="titulado"]');
  if (await tit.isVisible()) await tit.check({ force: true });
  if (await p.locator('#anios_experiencia').isVisible()) await p.fill('#anios_experiencia', '3');
  await p.keyboard.press('Tab'); await espera(300);
  await siguiente(p);
  if ((await pasoActual(p)) !== 'Documentos') throw new Error(`no avanzó a Documentos: ${(await texto(p, 'form')).slice(0, 200)}`);
  const req = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
  const tramite = await p.inputValue('#tramite');
  for (const r of req.slice(0, docs)) await subir(p, `doc_${tramite}_${r}`, join(DOCS, `${r}.pdf`));
  return tramite;
  if (nombre) await cap(p, nombre);
}
const marcaDeclaraciones = async (p) => {
  if ((await pasoActual(p)) !== 'Revisión') throw new Error(`no está en Revisión (${await pasoActual(p)}): ${(await texto(p, 'form')).slice(0, 300)}`); for (const n of ['protesta', 'aviso', 'humano']) await p.locator(`input[name="${n}"]`).check({ force: true }); };

async function escenario(nombre, fn) {
  if (process.env.SOLO && !new RegExp(process.env.SOLO).test(nombre)) return;
  salida[nombre] = [];
  for (const ronda of [1, 2]) {
    let r;
    try { r = await fn(ronda); } catch (e) { r = { errorDeLaPrueba: e.message.split('\n')[0], donde: (e.stack.match(/b6\.mjs:\d+/g) || []).join(' ') }; }
    salida[nombre].push(r);
    console.log(`${nombre} r${ronda}:`, JSON.stringify(r).slice(0, 600));
  }
  writeFileSync(join(SAL, 'b6.json'), JSON.stringify(salida, null, 1));
}

// ---------- 0. Sin service worker ni manifiesto ----------
await escenario('0-sin-sw-ni-manifiesto', async () => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('cita') });
  const r = {};
  for (const u of ['index.html', 'tramites.html', 'solicitud.html', 'examen.html', 'revision.html']) {
    await p.goto(BASE + u, { waitUntil: 'networkidle' }); await espera(500);
    r[u] = await p.evaluate(async () => ({ sw: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 'sin API', manifiesto: Boolean(document.querySelector('link[rel="manifest"]')), caches: (await caches.keys()).length }));
  }
  // Sin conexión, recargar no sirve nada desde una caché propia
  await c.setOffline(true);
  const resp = await p.goto(BASE + 'tramites.html').then(() => 'cargó', (e) => e.message.split('\n')[0]);
  await espera(1500);
  const sinRedSeVe = resp === 'cargó' ? (await texto(p)).slice(0, 300) : null;
  await cap(p, '0-tramites-recargado-sin-red');
  // Una pantalla que este navegador no había abierto antes
  const nunca = await p.goto(BASE + 'verificar.html').then(() => 'cargó', (e) => e.message.split('\n')[0]);
  await c.setOffline(false);
  await c.close();
  return { porPagina: r, recargaSinRed: resp, sinRedSeVe, paginaNuncaAbiertaSinRed: nunca };
});

// ---------- 1. Teléfono horizontal (844 × 390) ----------
await escenario('1a-horizontal-crear-cuenta', async (ronda) => {
  const { c, p } = await nuevo('telH');
  await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' }); await espera(500);
  const ocu = await ocupacion(p);
  const camaraVisible = await p.locator('[data-campo="foto"] [data-camara]').isVisible();
  await p.click('.menu-pruebas-boton'); await p.locator('dialog[open] button', { hasText: 'Llenar con datos ficticios' }).click(); await espera(300); await p.keyboard.press('Escape');
  // La foto de la persona: una real, con ubicación en sus metadatos, en lugar de la ficticia del menú
  await p.locator('[data-campo="foto"] [data-archivos] > input[type=file]:not([data-entrada-camara])').setInputFiles(FOTO);
  await p.waitForFunction(() => /listo|KB/i.test(document.querySelector('[data-campo="foto"] .lista-arch').innerText), null, { timeout: 15000 }).catch(() => {});
  await espera(800);
  await cap(p, `1a-cuenta-llena-r${ronda}`);
  const curp = await p.inputValue('#curp');
  await p.locator('form [data-accion="enviar"]').click();
  await p.waitForSelector('[data-acuse]:not([hidden])', { timeout: 15000 }).catch(() => {});
  await espera(500);
  const acuse = await p.locator('[data-acuse]:not([hidden])').count();
  await cap(p, `1a-cuenta-acuse-r${ronda}`);
  const ocuAcuse = await ocupacion(p);
  // ¿La foto guardada lleva la ubicación?
  const foto = await p.evaluate(async (k) => { const f = await APD_ARCHIVOS_PRUEBA.foto(k); if (!f) return null; const b = f.blob || f.archivo || f; const buf = new Uint8Array(await b.arrayBuffer()); const s = new TextDecoder('latin1').decode(buf); return { bytes: buf.length, exif: s.includes('Exif'), gps: s.includes('GPS') || s.includes('Telefono de prueba') }; }, curp);
  const permisos = await p.evaluate(() => window.__permisos);
  await c.close();
  return { ocupacionFormulario: ocu, camaraVisible, acuse: acuse === 1, ocupacionAcuse: ocuAcuse, foto, permisos, consola: p.log };
});

await escenario('1b-horizontal-solicitud-completa', async (ronda) => {
  const { c, p } = await nuevo('telH', { sesion: sesionDe('nueva') });
  await solicitudHastaRevision(p, { nombre: `1b-documentos-r${ronda}` });
  const ocuDocs = await ocupacion(p);
  const docs = await listos(p);
  await siguiente(p);
  const paso = await pasoActual(p);
  await marcaDeclaraciones(p);
  const ocuRev = await ocupacion(p);
  await cap(p, `1b-revision-r${ronda}`);
  await p.locator('[data-accion="enviar"]:visible').click();
  await p.waitForSelector('[data-acuse]:not([hidden])', { timeout: 15000 }).catch(() => {});
  const folio = (await p.textContent('[data-acuse-folio]').catch(() => '')).trim();
  const fecha = (await p.textContent('[data-acuse-fecha]').catch(() => '')).trim();
  await cap(p, `1b-acuse-r${ronda}`);
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' }); await espera(500);
  const enTramites = (await texto(p)).includes(folio);
  await cap(p, `1b-tramites-r${ronda}`);
  const ocuTram = await ocupacion(p);
  await c.close();
  return { docs, pasoAlSeguir: paso, folio, fecha, enTramites, ocupacion: { documentos: ocuDocs, revision: ocuRev, tramites: ocuTram }, permisos: await Promise.resolve(null), consola: p.log };
});

await escenario('1c-horizontal-corregir-y-reenviar', async (ronda) => {
  const { c, p } = await nuevo('telH', { sesion: sesionDe('obs-poda') });
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' }); await espera(500);
  const enlace = await p.locator('a', { hasText: /Corregir/ }).first().getAttribute('href');
  await p.goto(BASE + enlace, { waitUntil: 'networkidle' }); await espera(900);
  const paso = await pasoActual(p);
  const obs = await p.evaluate(() => [...document.querySelectorAll('[data-campo^="doc_"]')].filter((c) => c.offsetParent && /observ|corrig/i.test(c.innerText)).map((c) => c.dataset.campo));
  await cap(p, `1c-corregir-r${ronda}`);
  const ocu = await ocupacion(p);
  for (const campo of obs) {
    // «Cargar otro» o la zona de carga del documento observado
    const req = campo.replace(/^doc_[a-z]+_[a-z]+_/, '');
    const nombre = join(DOCS, `${req}.pdf`);
    await subir(p, campo, nombre).catch(() => {});
  }
  await siguiente(p);
  await marcaDeclaraciones(p);
  await p.locator('[data-accion="enviar"]:visible').click();
  await p.waitForSelector('[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 15000 }).catch(() => {});
  const resultado = (await texto(p, '[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])').catch(() => '')).slice(0, 200);
  await cap(p, `1c-resultado-r${ronda}`);
  await c.close();
  return { enlace, pasoAlAbrir: paso, observados: obs, ocupacion: ocu, resultado, consola: p.log };
});

await escenario('1d-horizontal-cargar-documento-correcto', async (ronda) => {
  const { c, p } = await nuevo('telH', { sesion: sesionDe('cita-pausa') });
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' }); await espera(500);
  const enlace = await p.locator('a[href*="corregir.html"]').first().getAttribute('href');
  await p.goto(BASE + enlace, { waitUntil: 'networkidle' }); await espera(700);
  const campos = await p.evaluate(() => [...document.querySelectorAll('[data-campo]')].filter((x) => x.querySelector('input[type=file]')).map((x) => x.dataset.campo));
  for (const campo of campos) await subir(p, campo, join(DOCS, 'identificacion_oficial.pdf'));
  const ocu = await ocupacion(p);
  await cap(p, `1d-corregir-r${ronda}`);
  await p.locator('form [data-accion="enviar"]').click();
  await espera(1500);
  const res = (await texto(p)).match(/Listo[^.]*\.|No se cargó[^.]*\./);
  await cap(p, `1d-resultado-r${ronda}`);
  await c.close();
  return { enlace, campos, ocupacion: ocu, resultado: res && res[0], consola: p.log };
});

await escenario('1e-horizontal-examen', async (ronda) => {
  const { c, p } = await nuevo('telH');
  await p.goto(BASE + 'aplicar.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' });
  const boton = p.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).nth(ronda - 1);
  const ins = await boton.getAttribute('data-ins');
  await boton.click();
  await p.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
  const codigo = (await p.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
  const ocuAplicar = await ocupacion(p);
  await p.goto(BASE + 'examen.html', { waitUntil: 'networkidle' });
  await p.fill('#codigo', codigo);
  await p.click('#entrar [data-accion="enviar"]');
  await p.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await p.click('[data-ir-vista="instrucciones"]');
  await p.click('[data-empezar]');
  await p.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  const ocuPregunta = await ocupacion(p);
  // ¿Se ven juntas la pregunta, sus opciones y «Siguiente» sin desplazar?
  const vista = await p.evaluate(() => {
    const v = document.querySelector('[data-vista="pregunta"]:not([hidden])');
    const ops = [...v.querySelectorAll('label')];
    const sig = document.querySelector('[data-siguiente]');
    const b = (el) => el.getBoundingClientRect();
    return { opciones: ops.length, ultimaOpcionAbajo: Math.round(b(ops[ops.length - 1]).bottom), siguienteAbajo: Math.round(b(sig).bottom), alto: innerHeight, barra: Math.round(b(document.querySelector('.examen-barra')).height) };
  });
  await cap(p, `1e-pregunta-r${ronda}`);
  for (let i = 0; i < 12; i++) {
    if (await p.locator('[data-vista="revision"]:not([hidden])').count()) break;
    await p.locator('[data-vista="pregunta"]:not([hidden]) input[type=radio]').first().check({ force: true });
    await p.click('[data-siguiente]'); await espera(200);
  }
  await cap(p, `1e-revision-r${ronda}`);
  await p.click('[data-enviar]');
  await p.click('.dialogo-confirma [data-r="si"]');
  await p.waitForSelector('[data-vista="resultado"]:not([hidden])');
  await cap(p, `1e-resultado-r${ronda}`, true);
  const res = (await texto(p, '[data-vista="resultado"]')).slice(0, 160);
  await c.close();
  return { codigo, ocupacion: { aplicar: ocuAplicar, pregunta: ocuPregunta }, vista, resultado: res, consola: p.log };
});

// ---------- 2. Cámara y ubicación negadas ----------
await escenario('2-camara-y-ubicacion-negadas', async (ronda) => {
  const { c, p } = await nuevo('tel390');
  await c.clearPermissions();
  await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' }); await espera(500);
  const btn = p.locator('[data-campo="foto"] [data-camara]');
  const visible = await btn.isVisible();
  const entrada = await p.evaluate(() => { const i = document.querySelector('[data-campo="foto"] [data-entrada-camara]'); return i && { accept: i.accept, capture: i.getAttribute('capture') }; });
  let selector = null;
  if (visible) {
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), btn.click()]);
    selector = fc ? { abre: true, multiple: fc.isMultiple() } : { abre: false };
    // La persona cancela (cámara negada o se arrepiente): no se elige nada
    await espera(300);
  }
  const despues = await p.evaluate(() => ({ lista: document.querySelector('[data-campo="foto"] .lista-arch').children.length, rechazos: document.querySelector('[data-campo="foto"] [data-rechazos]').innerText, foco: document.activeElement && document.activeElement.className }));
  const permisos = await p.evaluate(() => window.__permisos);
  // En escritorio (puntero fino) no se ofrece la cámara
  const { c: c2, p: p2 } = await nuevo('escritorio');
  await p2.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' }); await espera(300);
  const enEscritorio = await p2.locator('[data-campo="foto"] [data-camara]').isVisible();
  await c2.close();
  await cap(p, `2-cuenta-camara-r${ronda}`);
  await c.close();
  return { botonCamaraEnTelefono: visible, entrada, selector, despuesDeCancelar: despues, permisosPedidos: permisos, botonCamaraEnEscritorio: enEscritorio };
});

// ---------- 3. Carga de documento interrumpida (red caída a la mitad) ----------
await escenario('3a-sin-red-al-cargar-y-enviar-la-solicitud', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('nueva') });
  const tr = await solicitudHastaRevision(p, { docs: 2 });
  await c.setOffline(true);
  await subir(p, `doc_${tr}_comprobante_domicilio`, join(DOCS, 'comprobante_domicilio.pdf'));
  await subir(p, `doc_${tr}_constancia_situacion_fiscal`, join(DOCS, 'constancia_situacion_fiscal.pdf'));
  const docs = await listos(p);
  await siguiente(p); await marcaDeclaraciones(p);
  await p.locator('[data-accion="enviar"]:visible').click();
  await p.waitForSelector('[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 15000 }).catch(() => {});
  const resultado = (await texto(p, '[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])').catch(() => '')).slice(0, 160);
  await cap(p, `3a-envio-sin-red-r${ronda}`);
  // «Ir a mis trámites» sin red
  const ir = await p.goto(BASE + 'tramites.html').then(() => 'cargó', (e) => e.message.split('\n')[0]);
  await cap(p, `3a-tramites-sin-red-r${ronda}`);
  await c.setOffline(false);
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' }); await espera(500);
  const folio = resultado.match(/APD-S-\d{4}-\d+/);
  const despues = folio ? (await texto(p)).includes(folio[0]) : null;
  await c.close();
  return { docsCargadosSinRed: docs, resultadoEnvio: resultado, irATramitesSinRed: ir, alVolverLaRedApareceEnTramites: despues, consola: p.log.filter((x) => !/ERR_INTERNET_DISCONNECTED/.test(x)) };
});

await escenario('3b-red-cae-durante-el-envio-lento', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('nueva') });
  await solicitudHastaRevision(p);
  // El modo «Lento» del menú de pruebas (?simular=lento) deja el envío en curso unos segundos
  await p.evaluate(() => { const u = new URL(location.href); u.searchParams.set('simular', 'lento'); history.replaceState(history.state, '', u); });
  await siguiente(p); await marcaDeclaraciones(p);
  await p.locator('[data-accion="enviar"]:visible').click();
  await espera(300);
  const durante = await p.evaluate(() => { const b = document.querySelector('[data-accion="enviar"]'); return { boton: b && b.innerText.trim(), deshabilitado: b && (b.disabled || b.getAttribute('aria-disabled')), estado: (document.querySelector('[data-estado-envio]:not([hidden])') || {}).innerText || '' }; });
  await c.setOffline(true);
  await p.waitForSelector('[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 30000 }).catch(() => {});
  const resultado = (await texto(p, '[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])').catch(() => '')).slice(0, 200);
  await cap(p, `3b-envio-lento-red-caida-r${ronda}`);
  await c.setOffline(false);
  await c.close();
  return { durante, resultado };
});

await escenario('3c-material-del-personal-sin-red', async (ronda) => {
  const { c, p } = await nuevo('escritorio');
  await p.goto(BASE + 'material-personal.html', { waitUntil: 'networkidle' }); await espera(600);
  const abrir = p.locator('button, a', { hasText: /Agregar un documento/ }).first();
  await abrir.click(); await espera(500);
  await c.setOffline(true);
  const entrada = p.locator('form input[type=file]:not([data-entrada-camara])').first();
  await entrada.setInputFiles(join(COPIA, 'sitio/material/NADF-001-RNAT-2015.pdf'));
  await espera(4000);
  const estado = await p.evaluate(() => ({ lista: (document.querySelector('form .lista-arch') || {}).innerText || '', rechazos: [...document.querySelectorAll('form [data-rechazos]')].map((x) => x.innerText).join(' '), alertas: [...document.querySelectorAll('[role=alert]:not([hidden]), .aviso:not([hidden])')].map((x) => x.innerText.trim()).filter(Boolean).slice(0, 4) }));
  await cap(p, `3c-material-sin-red-r${ronda}`, true);
  await c.setOffline(false);
  await c.close();
  return { estado, consola: p.log.filter((x) => !/ERR_INTERNET_DISCONNECTED/.test(x)).slice(0, 6) };
});

// ---------- 4. La sesión caduca a la mitad ----------
await escenario('4a-sesion-caduca-en-la-solicitud', async (ronda) => {
  const sesion = sesionDe('nueva');
  const { c, p } = await nuevo('tel390', { sesion, sesionUnaVez: true });
  await solicitudHastaRevision(p);
  await siguiente(p); await marcaDeclaraciones(p);
  await espera(800);
  await p.evaluate(() => localStorage.removeItem('apd.sesion'));
  await p.locator('[data-accion="enviar"]:visible').click();
  await p.waitForSelector('[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 15000 }).catch(() => {});
  const mensaje = (await texto(p, '[data-estado-envio]:not([hidden]), [data-acuse]:not([hidden])').catch(() => '')).slice(0, 250);
  await cap(p, `4a-sesion-caducada-r${ronda}`);
  const enlace = await p.locator('[data-estado-envio] a').first().getAttribute('href').catch(() => null);
  // Sigue el enlace, vuelve a entrar (la misma persona) y regresa
  if (enlace) await p.goto(BASE + enlace, { waitUntil: 'networkidle' });
  const enEntrar = p.url().replace(BASE, '');
  await p.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sesion);
  const volver = new URL(p.url()).searchParams.get('volver') || 'solicitud.html';
  await p.goto(BASE + volver, { waitUntil: 'networkidle' }); await espera(900);
  const franja = await p.locator('[data-franja-borrador]').isVisible().catch(() => false);
  let recuperado = null;
  if (franja) {
    await p.click('[data-borrador="recuperar"]'); await espera(1500);
    recuperado = await estado(p);
    recuperado.enElAlmacen = await guardadosBorrador(p);
  }
  await cap(p, `4a-tras-volver-a-entrar-r${ronda}`);
  await c.close();
  return { mensaje, enlace, enEntrar, franjaBorrador: franja, recuperado };
});

await escenario('4b-sesion-caduca-en-mi-perfil', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('cita'), sesionUnaVez: true });
  await p.goto(BASE + 'datos.html', { waitUntil: 'networkidle' }); await espera(500);
  await p.locator('button', { hasText: /^Editar/ }).first().click(); await espera(400);
  await p.locator('input[name="telefono"], #telefono').first().fill('5512345678');
  await p.evaluate(() => localStorage.removeItem('apd.sesion'));
  await p.locator('form:visible [data-accion="enviar"]').first().click(); await espera(1200);
  const mensaje = (await texto(p, '[data-estado-envio]:not([hidden])').catch(() => '')).slice(0, 250);
  await cap(p, `4b-perfil-sesion-caducada-r${ronda}`);
  await c.close();
  return { mensaje };
});

await escenario('4c-sesion-caduca-al-cargar-documento-correcto', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('cita-pausa'), sesionUnaVez: true });
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' }); await espera(500);
  const enlace = await p.locator('a[href*="corregir.html"]').first().getAttribute('href');
  await p.goto(BASE + enlace, { waitUntil: 'networkidle' }); await espera(700);
  const campos = await p.evaluate(() => [...document.querySelectorAll('[data-campo]')].filter((x) => x.querySelector('input[type=file]')).map((x) => x.dataset.campo));
  for (const campo of campos) await subir(p, campo, join(DOCS, 'identificacion_oficial.pdf'));
  await p.evaluate(() => localStorage.removeItem('apd.sesion'));
  await p.locator('form [data-accion="enviar"]').click(); await espera(1500);
  const mensaje = (await texto(p, '[data-estado-envio]:not([hidden])').catch(() => '')).slice(0, 250);
  await cap(p, `4c-corregir-sesion-caducada-r${ronda}`);
  await c.close();
  return { mensaje };
});

// ---------- 5. Recargar y «Atrás» a la mitad ----------
await escenario('5a-recargar-y-atras-en-la-solicitud', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('nueva') });
  await p.goto(BASE + 'tramites.html', { waitUntil: 'networkidle' });
  await solicitudHastaRevision(p, { docs: 2 });
  await espera(1200);
  const pasos = [['lleno, en Documentos', await estado(p)]];
  await p.goBack(); await espera(900); pasos.push(['Atrás', await estado(p)]);
  await p.goForward(); await espera(900); pasos.push(['Adelante', await estado(p)]);
  await p.reload({ waitUntil: 'networkidle' }); await espera(1200); pasos.push(['Recargar', await estado(p)]);
  await cap(p, `5a-tras-recargar-r${ronda}`);
  await p.click('[data-borrador="recuperar"]'); await espera(1800); pasos.push(['Recuperar borrador', await estado(p)]);
  await cap(p, `5a-tras-recuperar-r${ronda}`);
  for (let k = 1; k <= 3; k++) { await p.goBack(); await espera(1000); pasos.push([`Atrás ${k} (tras recuperar)`, await estado(p)]); }
  await p.goForward(); await espera(1200); pasos.push(['Adelante', await estado(p)]);
  await cap(p, `5a-tras-adelante-r${ronda}`);
  await c.close();
  return { pasos, dialogo: p.ultimoDialogo || null };
});

await escenario('5b-recargar-y-atras-en-crear-cuenta', async (ronda) => {
  const { c, p } = await nuevo('tel390');
  await p.goto(BASE + 'index.html', { waitUntil: 'networkidle' });
  await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' }); await espera(500);
  await p.click('.menu-pruebas-boton'); await p.locator('dialog[open] button', { hasText: 'Llenar con datos ficticios' }).click(); await espera(1200); await p.keyboard.press('Escape');
  const lleno = await p.evaluate(() => ({ curp: document.getElementById('curp').value, foto: document.querySelector('[data-campo="foto"] .lista-arch').children.length }));
  p.ultimoDialogo = null;
  await p.reload({ waitUntil: 'networkidle' }); await espera(700);
  const trasRecargar = await p.evaluate(() => ({ curp: document.getElementById('curp').value, nombre: document.getElementById('nombre').value, foto: document.querySelector('[data-campo="foto"] .lista-arch').children.length, franja: Boolean(document.querySelector('[data-franja-borrador]:not([hidden])')) }));
  const avisoAlRecargar = p.ultimoDialogo;
  await p.click('.menu-pruebas-boton'); await p.locator('dialog[open] button', { hasText: 'Llenar con datos ficticios' }).click(); await espera(1200); await p.keyboard.press('Escape');
  p.ultimoDialogo = null;
  await p.goBack(); await espera(700);
  const trasAtras = p.url().replace(BASE, '');
  const avisoAlSalir = p.ultimoDialogo;
  await p.goForward(); await espera(700);
  const trasAdelante = await p.evaluate(() => ({ curp: document.getElementById('curp').value, foto: document.querySelector('[data-campo="foto"] .lista-arch').children.length }));
  await cap(p, `5b-cuenta-tras-adelante-r${ronda}`);
  await c.close();
  return { lleno, trasRecargar, avisoAlRecargar, trasAtras, avisoAlSalir, trasAdelante };
});

// ---------- 6. Dos pestañas con la misma solicitud nueva (borrador) ----------
async function llenaPaso1(p, nivel, anios) {
  await p.waitForSelector('input[name="tipo"][value="poda"]:visible:enabled', { timeout: 15000 });
  await p.locator('input[name="tipo"][value="poda"]').check({ force: true }); await espera(300);
  await p.selectOption('#nivel_estudios', nivel); await espera(200);
  if (await p.locator('#carrera').isVisible()) await p.fill('#carrera', 'Biología');
  const tit = p.locator('input[name="estatus_estudios"][value="titulado"]');
  if (await tit.isVisible()) await tit.check({ force: true });
  if (await p.locator('#anios_experiencia').isVisible()) await p.fill('#anios_experiencia', anios);
  await p.keyboard.press('Tab'); await espera(900);
}
await escenario('6a-dos-pestanas-mismo-borrador', async (ronda) => {
  const { c, p: a } = await nuevo('escritorio', { sesion: sesionDe('nueva') });
  const b = await c.newPage(); b.log = vigila(b);
  await a.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
  await b.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
  // A: licenciatura, pasa a Documentos y carga dos
  await llenaPaso1(a, 'licenciatura', '3'); await siguiente(a);
  const tr = await a.inputValue('#tramite');
  await subir(a, `doc_${tr}_identificacion_oficial`, join(DOCS, 'identificacion_oficial.pdf'));
  await subir(a, `doc_${tr}_curp`, join(DOCS, 'curp.pdf'));
  await espera(1200);
  const aAntes = await estado(a);
  // B, abierta desde antes, escribe otra cosa en el paso 1
  await llenaPaso1(b, 'maestria', '7');
  await espera(1200);
  const bEscribio = await estado(b);
  // A vuelve después (recarga) y recupera
  await a.reload({ waitUntil: 'networkidle' }); await espera(1200);
  const franja = await a.locator('[data-franja-borrador]').isVisible();
  if (franja) { await a.click('[data-borrador="recuperar"]'); await espera(1800); }
  const recuperadoA = await estado(a);
  recuperadoA.enElAlmacen = await guardadosBorrador(a);
  await cap(a, `6a-pestana-a-tras-recuperar-r${ronda}`);
  const avisoOtra = /otra pestaña/i.test(await texto(a, 'body')) || /otra pestaña/i.test(await texto(b, 'body'));
  await c.close();
  return { aAntes, bEscribio, franjaEnA: franja, recuperadoA, avisoDeOtraPestana: avisoOtra };
});

await escenario('6b-pestana-vieja-tras-enviar', async (ronda) => {
  const { c, p: a } = await nuevo('escritorio', { sesion: sesionDe('nueva') });
  const b = await c.newPage(); b.log = vigila(b);
  await b.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' });
  await solicitudHastaRevision(a);
  await siguiente(a); await marcaDeclaraciones(a);
  await a.locator('[data-accion="enviar"]:visible').click();
  await a.waitForSelector('[data-acuse]:not([hidden])', { timeout: 15000 });
  const folio = (await a.textContent('[data-acuse-folio]')).trim();
  // B sigue abierta: la persona escribe algo en ella
  await llenaPaso1(b, 'maestria', '7'); await espera(1200);
  const borrador = await b.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('apd.borrador')));
  await siguiente(b);
  const bPaso = await estado(b);
  // Días después abre otra vez «Solicitud»
  const n = await c.newPage();
  await n.goto(BASE + 'solicitud.html', { waitUntil: 'networkidle' }); await espera(1200);
  const nueva = { franja: await n.locator('[data-franja-borrador]').isVisible(), texto: (await texto(n)).slice(0, 300) };
  await cap(n, `6b-solicitud-despues-r${ronda}`);
  await c.close();
  return { folio, borradorTrasEnviar: borrador, bTrasSeguir: bPaso, despues: nueva };
});

// ---------- 7. Versión nueva del sitio con la pestaña abierta ----------
await escenario('7-version-nueva-con-pestana-abierta', async (ronda) => {
  const { c, p } = await nuevo('tel390', { sesion: sesionDe('nueva') });
  await solicitudHastaRevision(p, { docs: 2 });
  await espera(1200);
  const v0 = await p.textContent('#version-sia');
  // Se publica la 0.62: VERSION nuevo y los HTML con ?v=0.62 (como lo haría herramientas/nueva-version.mjs)
  let pedidosNuevos = 0;
  await c.route('**/VERSION*', (r) => r.fulfill({ body: '0.62\n', contentType: 'text/plain' }));
  await c.route(/\.html(\?.*)?$/, async (r) => { const resp = await r.fetch(); const t = (await resp.text()).replaceAll('?v=0.61', '?v=0.62'); r.fulfill({ response: resp, body: t }); });
  await c.route(/\?v=0\.62/, (r) => { pedidosNuevos++; r.continue({ url: r.request().url().replace('?v=0.62', '?v=0.61') }); });
  await espera(3000);
  const sinRecargar = { distintivo: await p.textContent('#version-sia'), avisoNuevaVersion: /versi[oó]n nueva|nueva versi[oó]n|recarga la p[aá]gina/i.test(await texto(p, 'body')) };
  await p.reload({ waitUntil: 'networkidle' }); await espera(1200);
  const trasRecargar = { distintivo: await p.textContent('#version-sia'), franja: await p.locator('[data-franja-borrador]').isVisible(), pedidosConVersionNueva: pedidosNuevos };
  if (trasRecargar.franja) { await p.click('[data-borrador="recuperar"]'); await espera(1500); trasRecargar.recuperado = { paso: await pasoActual(p), docs: await listos(p) }; }
  // Caché del navegador: HTML viejo (en caché) con VERSION nuevo
  const { c: c2, p: p2 } = await nuevo('tel390');
  await c2.route('**/VERSION*', (r) => r.fulfill({ body: '0.62\n', contentType: 'text/plain' }));
  await p2.goto(BASE + 'index.html', { waitUntil: 'networkidle' }); await espera(600);
  const htmlViejoConVersionNueva = { distintivo: await p2.textContent('#version-sia'), scripts: await p2.evaluate(() => [...document.scripts].map((s) => s.src).filter((s) => /\?v=0\.61/.test(s)).length) };
  await c2.close();
  await cap(p, `7-tras-recargar-version-nueva-r${ronda}`);
  await c.close();
  return { antes: v0, sinRecargar, trasRecargar, htmlViejoConVersionNueva };
});

await nav.close();
writeFileSync(join(SAL, 'b6.json'), JSON.stringify(salida, null, 1));
console.log('listo');
