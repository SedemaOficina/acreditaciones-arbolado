// Revisor independiente (ri), auditoría 20/10/2026 · WCAG 2.2 AA 2.4.3 (orden y gestión del foco) y 4.1.3 (mensajes de estado).
// Cada escenario corre en un contexto nuevo del navegador, sólo con teclado (Tab, Enter, Espacio, Escape, flechas), y
// registra después de cada paso: a dónde fue el foco (y si quedó en <body>, oculto o fuera de la ventana) y qué cambió
// en las regiones vivas (aria-live, role status/alert/log, <output>), con el texto propio de cada región (sin el de las
// regiones anidadas). Un cambio a texto vacío no cuenta. Repite todo RONDAS veces (por omisión 2).
// Uso: node gestion-foco.mjs <BASE> <salida.json> [filtro de escenarios] ; RONDAS=2
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const COPIA = process.env.COPIA || '/home/claude/trabajo/aud20-ri';
const [, , BASE0 = 'http://localhost:8906/', SALIDA = 'gestion.json', FILTRO = ''] = process.argv;
const BASE = BASE0.replace(/\/?$/, '/');
const RONDAS = Number(process.env.RONDAS || 2);
const CAPTURAS = join(dirname(SALIDA), '..', 'capturas');
mkdirSync(CAPTURAS, { recursive: true });
const fict = readFileSync(join(COPIA, 'sitio/datos/ficticios.json'));
const salVol = join(mkdtempSync(join(tmpdir(), 'ri-vol-')), 'volumen.json');
execFileSync('node', [join(COPIA, 'herramientas/escenario-volumen.mjs'), join(COPIA, 'sitio/datos/ficticios.json'), salVol], { stdio: 'ignore' });
const vol = readFileSync(salVol);
const DF = JSON.parse(fict), DV = JSON.parse(vol);

// Observador de regiones vivas (se inyecta antes de que cargue la página; no toca el DOM)
function observador() {
  const SEL = '[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"],output,[role="alertdialog"]';
  const ev = (window.__riVivas = []);
  window.__riMarca = 0;
  const ult = new WeakMap();
  const propio = (r) => {
    let t = '';
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n !== r && n.nodeType === 1 && (n.matches(SEL) || n.hidden || n.getAttribute('aria-hidden') === 'true') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeType === 3) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  };
  const desc = (x) => `${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}${[...x.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => `[${a.name}]`).join('')}${x.getAttribute('role') ? `[role=${x.getAttribute('role')}]` : ''}${x.getAttribute('aria-live') ? `[aria-live=${x.getAttribute('aria-live')}]` : ''}`;
  const revisa = () => {
    for (const r of document.querySelectorAll(SEL)) {
      const vis = r.checkVisibility ? r.checkVisibility() || r.closest('.solo-lector') : true;
      const t = vis && !r.closest('[hidden],[aria-hidden="true"]') ? propio(r) : '';
      const antes = ult.get(r);
      ult.set(r, t);
      if (t && t !== antes) ev.push({ ms: Math.round(performance.now()), marca: window.__riMarca, region: desc(r), tipo: antes === undefined ? 'nueva' : 'cambio', texto: t.slice(0, 220) });
    }
  };
  let pend = false;
  const mo = new MutationObserver(() => { if (pend) return; pend = true; queueMicrotask(() => { pend = false; revisa(); }); });
  mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'role', 'aria-live', 'open', 'class'] });
}

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function nuevo({ w = 1280, h = 720, datos = 'f', sesion = null } = {}) {
  const movil = w < 600;
  const ctx = await navegador.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  if (datos === 'v') await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: vol, contentType: 'application/json' }));
  if (sesion) await ctx.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) {} }, sesion);
  await ctx.addInitScript(observador);
  const pg = await ctx.newPage();
  pg.on('dialog', (d) => d.accept());
  return { ctx, pg };
}
const ir = async (pg, url, sel) => { await pg.goto(BASE + url, { waitUntil: 'networkidle' }); if (sel) await pg.waitForSelector(sel, { state: 'attached' }); await pg.waitForTimeout(600); };

// Estado del foco ahora
const foco = (pg) => pg.evaluate(() => {
  const a = document.activeElement;
  window.__riY = Math.round(scrollY);
  if (!a || a === document.body) return { en: 'body', body: true };
  const r = a.getBoundingClientRect();
  const t = (a.getAttribute('aria-label') || a.textContent || a.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const dentroVentana = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const dlg = a.closest('dialog');
  return { scrollY: Math.round(scrollY), en: `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.className && typeof a.className === 'string' ? '.' + a.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} «${t}»`, dentroVentana, top: Math.round(r.top), enDialogo: dlg ? (dlg.id || dlg.className) : null, visible: a.checkVisibility() && r.width > 0 };
});
const marca = (pg, n) => pg.evaluate((k) => { window.__riMarca = k; }, n);
const vivas = (pg, n) => pg.evaluate((k) => window.__riVivas.filter((e) => e.marca === k), n);

// Un paso: marca, hace la acción, espera y registra foco y anuncios
async function paso(reg, pg, nombre, accion, espera = 1500) {
  const k = reg.pasos.length + 1;
  let error = null;
  try { await marca(pg, k); await accion(); await pg.waitForTimeout(espera); } catch (e) { error = String(e.message || e).split('\n')[0]; }
  let f = null, v = [];
  try { f = await foco(pg); v = await vivas(pg, k); } catch (e) { error = error || String(e.message || e).split('\n')[0]; }
  // Después de navegar, el observador de la página nueva tiene marca 0: lo de la carga cuenta para este paso
  let navego = false;
  try { navego = (await pg.evaluate(() => window.__riMarca)) === 0; } catch (e) { /* */ }
  if (navego) { try { v = (await pg.evaluate(() => window.__riVivas.filter((e) => e.marca === 0))).map((e) => ({ ...e, alCargar: true })); } catch (e) { /* */ } }
  const p = { k, nombre, foco: f, anuncios: v, error, navego };
  reg.pasos.push(p);
  return p;
}
const tecla = (pg, t) => pg.keyboard.press(t);
const enfoca = async (pg, sel) => { await pg.locator(sel).first().focus(); await pg.keyboard.press('Shift'); };

// ---------- Datos para los escenarios ----------
const act = (d, estado, f = () => true) => { const s = d.solicitud.find((x) => x.estado === estado && f(x) && d.solicitante.find((p) => p.id === x.solicitante_id && p.estado === 'activa')); return s; };
const sinTramite = DF.solicitante.find((p) => p.estado === 'activa' && !DF.solicitud.some((s) => s.solicitante_id === p.id));
const gIntF = DF.grupo.find((g) => g.estado === 'en_integracion');
const enviadaPodaF = DF.solicitud.find((s) => s.estado === 'enviada' && s.tipo_acreditacion === 'poda');
const verif = DF.verificacion_publica[0];

const ESCENARIOS = {
  async 'menu-pruebas'(reg, pg) {
    await ir(pg, 'revision.html', '[data-filas] tr');
    await paso(reg, pg, 'Enfocar «Menú de pruebas» y Enter (abrir)', async () => { await enfoca(pg, '.menu-pruebas-boton'); await tecla(pg, 'Enter'); }, 600);
    await paso(reg, pg, 'Escape (cerrar)', () => tecla(pg, 'Escape'), 600);
    await paso(reg, pg, 'Enter otra vez y Shift+Tab hasta «Cerrar»… (se usa el botón Cerrar con Enter)', async () => { await tecla(pg, 'Enter'); await pg.waitForTimeout(300); await pg.locator('dialog.menu-pruebas[open] button', { hasText: 'Cerrar' }).first().focus(); await tecla(pg, 'Enter'); }, 600);
  },
  async 'grupo-cancelar'(reg, pg) {
    await ir(pg, `grupo.html?folio=${gIntF.folio}`, '[data-acciones] button, [data-acciones] a');
    await paso(reg, pg, 'Enfocar «Cancelar el grupo» y Enter (abre el diálogo)', async () => { await enfoca(pg, '[data-acciones] .btn-peligro-contorno'); await tecla(pg, 'Enter'); }, 600);
    await paso(reg, pg, 'Escape (cierra sin cambios)', () => tecla(pg, 'Escape'), 600);
    await paso(reg, pg, 'Enter (reabre) y enviar «Sí, cancelar el grupo» sin motivo', async () => { await tecla(pg, 'Enter'); await pg.waitForTimeout(300); await enfoca(pg, '#dlg-cancelar [data-accion="enviar"]'); await tecla(pg, 'Enter'); }, 1200);
    await paso(reg, pg, 'Escribir el motivo y enviar (resultado)', async () => { await enfoca(pg, '#dlg-cancelar textarea, #dlg-cancelar input[type=text]'); await pg.keyboard.type('El curso se reprograma por falta de sede.'); await enfoca(pg, '#dlg-cancelar [data-accion="enviar"]'); await tecla(pg, 'Enter'); await pg.waitForURL(/hecho=|hecho/, { timeout: 8000 }).catch(() => {}); await pg.waitForLoadState('networkidle'); }, 1500);
  },
  async 'grupo-baja'(reg, pg) {
    await ir(pg, `grupo.html?folio=${gIntF.folio}`, '[data-filas] tr');
    reg.nota = `filas antes: ${await pg.locator('[data-filas] tr').count()}`;
    await paso(reg, pg, 'Enfocar el primer «Dar de baja» y Enter (abre el diálogo)', async () => { await enfoca(pg, '[data-filas] button'); await tecla(pg, 'Enter'); }, 600);
    await paso(reg, pg, 'Escape (cierra sin cambios)', () => tecla(pg, 'Escape'), 600);
    await paso(reg, pg, 'Enter (reabre), escribir el motivo y «Sí, dar de baja» (quita a la persona)', async () => { await tecla(pg, 'Enter'); await pg.waitForTimeout(300); await enfoca(pg, '#dlg-baja textarea, #dlg-baja input[type=text]'); await pg.keyboard.type('No puede asistir en esas fechas.'); await enfoca(pg, '#dlg-baja [data-accion="enviar"]'); await tecla(pg, 'Enter'); await pg.waitForURL(/hecho=|hecho/, { timeout: 8000 }).catch(() => {}); await pg.waitForLoadState('networkidle'); }, 1500);
  },
  async 'borrador-recuperar'(reg, pg) {
    await ir(pg, 'solicitud.html', '#formulario');
    await paso(reg, pg, 'Elegir el nivel de estudios con flecha abajo (se guarda el borrador)', async () => { await enfoca(pg, '#nivel_estudios'); await tecla(pg, 'ArrowDown'); }, 2000);
    await paso(reg, pg, 'Recargar la página (aparece la franja del borrador)', async () => { await pg.reload({ waitUntil: 'networkidle' }); }, 1200);
    await paso(reg, pg, 'Enfocar «Recuperar borrador» y Enter', async () => { await enfoca(pg, '[data-borrador="recuperar"]'); await tecla(pg, 'Enter'); }, 2000);
    await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 400);
  },
  async 'borrador-descartar'(reg, pg) {
    await ir(pg, 'solicitud.html', '#formulario');
    await paso(reg, pg, 'Elegir el nivel de estudios con flecha abajo (se guarda el borrador)', async () => { await enfoca(pg, '#nivel_estudios'); await tecla(pg, 'ArrowDown'); }, 2000);
    await paso(reg, pg, 'Recargar la página', async () => { await pg.reload({ waitUntil: 'networkidle' }); }, 1200);
    await paso(reg, pg, 'Enfocar «Empezar de nuevo» y Enter (pide confirmar)', async () => { await enfoca(pg, '[data-borrador="descartar"]'); await tecla(pg, 'Enter'); }, 800);
    await paso(reg, pg, 'Enfocar «Descartar borrador» y Enter', async () => { await enfoca(pg, '[data-borrador="descartar-si"]'); await tecla(pg, 'Enter'); }, 2000);
    await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 400);
  },
  async 'entrar-errores'(reg, pg) {
    await ir(pg, 'entrar.html', '#formulario');
    await paso(reg, pg, 'Enfocar «Entrar» y Enter con todo vacío', async () => { await enfoca(pg, '#formulario [data-accion="enviar"]'); await tecla(pg, 'Enter'); }, 1500);
    await paso(reg, pg, 'Escribir CURP y contraseña que no coinciden y Enter', async () => {
      await enfoca(pg, '#formulario input:not([type=hidden])'); await pg.keyboard.press('Control+A'); await pg.keyboard.type('EIMA800101HDFJRN09');
      await enfoca(pg, '#contrasena'); await pg.keyboard.type('NoEsLaClave123'); await tecla(pg, 'Enter');
    }, 2500);
  },
  async 'solicitud-continuar-vacio'(reg, pg) {
    await ir(pg, 'solicitud.html', '#formulario');
    await paso(reg, pg, 'Enfocar «Continuar» del paso 1 y Enter sin responder', async () => { await enfoca(pg, '#formulario [data-accion="siguiente"]:visible'); await tecla(pg, 'Enter'); }, 1500);
  },
  async 'verificar-resultado'(reg, pg) {
    await ir(pg, 'verificar.html', '#formulario');
    await paso(reg, pg, `Escribir el número ${verif.numero} y Enter (resultado)`, async () => { await enfoca(pg, '#formulario input:not([type=hidden])'); await pg.keyboard.type(verif.numero); await tecla(pg, 'Enter'); }, 2500);
    await paso(reg, pg, 'Escribir un número que no existe y Enter', async () => { await enfoca(pg, '#formulario input:not([type=hidden])'); await pg.keyboard.press('Control+A'); await pg.keyboard.type('DT-2025-Z999'); await tecla(pg, 'Enter'); }, 2500);
  },
  async 'revisar-avance'(reg, pg) {
    await ir(pg, `revisar.html?folio=${enviadaPodaF.folio}`, '#formulario');
    await paso(reg, pg, 'Enfocar la primera decisión «aceptado» y Espacio (la página avanza al siguiente documento)', async () => { await enfoca(pg, '#formulario input[name^="decision_"][value="aceptado"]'); await tecla(pg, 'Space'); }, 2000);
    await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 500);
  },
  async 'revisar-enviar-vacio'(reg, pg) {
    await ir(pg, `revisar.html?folio=${enviadaPodaF.folio}`, '#formulario');
    await paso(reg, pg, 'Enfocar el envío de la revisión y Enter sin decidir', async () => { await enfoca(pg, '#formulario [type=submit]:visible'); await tecla(pg, 'Enter'); }, 1500);
  },
  async 'grupos-agregar'(reg, pg) {
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona input');
    await paso(reg, pg, 'Sin elegir a nadie, Enter en el primer destino «Al grupo…»', async () => { await enfoca(pg, '[data-destinos] button'); await tecla(pg, 'Enter'); }, 1200);
    await paso(reg, pg, 'Elegir a la primera persona con Espacio', async () => { await enfoca(pg, '.plan-persona input'); await tecla(pg, 'Space'); }, 1200);
    await paso(reg, pg, 'Enter en el primer destino (agrega a la persona)', async () => { await enfoca(pg, '[data-destinos] button'); await tecla(pg, 'Enter'); await pg.waitForLoadState('networkidle'); }, 2000);
  },
  async 'citas-dias'(reg, pg) {
    await ir(pg, 'citas.html', '[data-filas] tr');
    for (let i = 1; i <= 8; i++) {
      const p = await paso(reg, pg, `«Día siguiente» con Enter (${i})`, async () => { if (i === 1) await enfoca(pg, '[data-ir="1"]'); else await tecla(pg, 'Enter'); }, i === 1 ? 50 : 900);
      if (i === 1) { reg.pasos.pop(); await paso(reg, pg, '«Día siguiente» con Enter (1)', () => tecla(pg, 'Enter'), 900); }
      if (p.foco && p.foco.body) break;
      if (await pg.locator('[data-ir="1"]').isDisabled()) { await paso(reg, pg, 'El botón quedó deshabilitado: Tab', () => tecla(pg, 'Tab'), 300); break; }
    }
    await paso(reg, pg, 'Escribir «ana» en «Buscar una cita» (3 teclas)', async () => { await enfoca(pg, '#buscar'); await pg.keyboard.type('ana', { delay: 120 }); }, 1500);
  },
  async 'citas-dias-volumen'(reg, pg) { return ESCENARIOS['citas-dias'](reg, pg); },
  async 'revision-buscar-volumen'(reg, pg) {
    await ir(pg, 'revision.html', '[data-filas] tr');
    await paso(reg, pg, 'Escribir «ejemplo» en la búsqueda (7 teclas, 120 ms entre teclas)', async () => { await enfoca(pg, '#buscar'); await pg.keyboard.type('ejemplo', { delay: 120 }); }, 1500);
  },
  async 'programar-mes'(reg, pg) {
    await ir(pg, 'programar.html?curso=poda-nueva', '.cal-dia');
    await paso(reg, pg, '«Mes siguiente» con Enter', async () => { await enfoca(pg, '[data-mes="1"]'); await tecla(pg, 'Enter'); }, 1200);
    await paso(reg, pg, '«Mes anterior» con Enter', async () => { await enfoca(pg, '[data-mes="-1"]'); await tecla(pg, 'Enter'); }, 1200);
    await paso(reg, pg, 'Enfocar un día del calendario y flecha derecha', async () => { await enfoca(pg, '.cal-dia:not([disabled]):not([aria-disabled="true"])'); await tecla(pg, 'ArrowRight'); }, 1200);
    await paso(reg, pg, 'Enter en ese día (elegir la semana)', () => tecla(pg, 'Enter'), 1500);
  },
  async 'datos-guardar'(reg, pg) {
    await ir(pg, 'datos.html', '[data-editar="contacto"]');
    await paso(reg, pg, '«Editar contacto» con Enter (abre el formulario)', async () => { await enfoca(pg, '[data-editar="contacto"]'); await tecla(pg, 'Enter'); }, 800);
    await paso(reg, pg, 'Enfocar «Guardar cambios» y Enter (guarda sin cambios)', async () => { await enfoca(pg, '#form-contacto [data-accion="enviar"]'); await tecla(pg, 'Enter'); }, 2000);
    await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 400);
  },
  async 'revisar-completo'(reg, pg) {
    await ir(pg, `revisar.html?folio=${enviadaPodaF.folio}`, '#formulario');
    const nombres = await pg.$$eval('#formulario input[name^="decision_"][value="aceptado"]', (l) => [...new Set(l.filter((x) => !x.disabled && x.closest('[data-doc]') && !x.closest('[hidden]')).map((x) => x.name))]);
    for (const n of nombres) await paso(reg, pg, `Aceptar ${n} con Espacio`, async () => { await enfoca(pg, `#formulario input[name="${n}"][value="aceptado"]`); await tecla(pg, 'Space'); }, 1500);
    if (process.env.TAB_TRAS_ULTIMO) { await paso(reg, pg, 'Tab después de aceptar el último documento', () => tecla(pg, 'Tab'), 800); await paso(reg, pg, 'Tab otra vez', () => tecla(pg, 'Tab'), 800); return; }
    await paso(reg, pg, 'Escribir la fecha de la cita 16/10/2026 y elegir la hora con flecha abajo', async () => { await enfoca(pg, '#cita_fecha'); await pg.keyboard.type('16102026'); await enfoca(pg, '#cita_hora'); await tecla(pg, 'ArrowDown'); }, 1200);
    await paso(reg, pg, 'Enfocar el envío y Enter (resultado)', async () => { await enfoca(pg, '#formulario [type=submit]:visible'); await tecla(pg, 'Enter'); }, 3000);
  },
  async 'asistencia-25'(reg, pg) {
    await ir(pg, 'asistencia.html?folio=APD-G-2026-020', '.asistencia-fila');
    reg.nota = `filas: ${await pg.locator('.asistencia-fila').count()}`;
    await paso(reg, pg, 'Marcar «Asistió» en la primera fila con Espacio', async () => { await enfoca(pg, '.asistencia-fila .asis-opcion-input:not([disabled])'); await tecla(pg, 'Space'); }, 1200);
    await paso(reg, pg, 'Flecha derecha en la misma fila (cambia a «Faltó»)', () => tecla(pg, 'ArrowRight'), 1200);
  },
  async 'programar-limites'(reg, pg) {
    await ir(pg, 'programar.html?curso=poda-nueva', '.cal-dia');
    for (let i = 1; i <= 3; i++) {
      const p = await paso(reg, pg, `«Mes anterior» con Enter (${i})`, async () => { if (i === 1) await enfoca(pg, '[data-mes="-1"]'); await tecla(pg, 'Enter'); }, 800);
      if (p.foco && p.foco.body) { await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 300); break; }
      if (await pg.locator('[data-mes="-1"]').isDisabled()) break;
    }
    for (let i = 1; i <= 15; i++) {
      const p = await paso(reg, pg, `«Mes siguiente» con Enter (${i})`, async () => { if (i === 1) await enfoca(pg, '[data-mes="1"]'); await tecla(pg, 'Enter'); }, 500);
      if (p.foco && p.foco.body) { await paso(reg, pg, 'Tab (a dónde sigue el teclado)', () => tecla(pg, 'Tab'), 300); break; }
    }
  },
  async 'visor-telefono'(reg, pg) {
    await ir(pg, `revisar.html?folio=${enviadaPodaF.folio}`, '#formulario');
    await paso(reg, pg, 'Enter en el primer «Ver documento» (abre el visor)', async () => { await enfoca(pg, '#formulario [data-ver]'); await tecla(pg, 'Enter'); }, 1500);
    await paso(reg, pg, 'Escape (cierra el visor)', () => tecla(pg, 'Escape'), 800);
  },
  async 'asistencia-volumen'(reg, pg) {
    await ir(pg, 'asistencia.html?folio=APD-G-2026-024', '.asistencia-fila');
    await paso(reg, pg, 'Marcar «Asistió» en la primera fila con Espacio', async () => { await enfoca(pg, '.asistencia-fila .asis-opcion-input'); await tecla(pg, 'Space'); }, 1200);
    await paso(reg, pg, '«Marcar a todas Asistió» con Enter', async () => { await enfoca(pg, '[data-todas]'); await tecla(pg, 'Enter'); }, 1500);
    await paso(reg, pg, '«Guardar la asistencia» con Enter', async () => { await enfoca(pg, '[data-guardar]'); await tecla(pg, 'Enter'); await pg.waitForLoadState('networkidle'); }, 2000);
    await paso(reg, pg, 'Abrir «Corregir otro día» y Enter en el primer día', async () => { await enfoca(pg, '[data-otro-dia] > summary'); await tecla(pg, 'Enter'); await pg.waitForTimeout(200); await enfoca(pg, '[data-dias] a, [data-dias] button'); await tecla(pg, 'Enter'); await pg.waitForLoadState('networkidle'); }, 1500);
  }
};

const PLAN = [
  ['menu-pruebas', { w: 1280, h: 720 }], ['menu-pruebas', { w: 390, h: 844 }],
  ['grupo-cancelar', { w: 1280, h: 720 }], ['grupo-baja', { w: 1280, h: 720 }], ['grupo-baja', { w: 390, h: 844 }],
  ['borrador-recuperar', { w: 390, h: 844, sesion: sinTramite.id }], ['borrador-recuperar', { w: 1280, h: 720, sesion: sinTramite.id }],
  ['borrador-descartar', { w: 390, h: 844, sesion: sinTramite.id }],
  ['entrar-errores', { w: 390, h: 844 }], ['solicitud-continuar-vacio', { w: 390, h: 844, sesion: sinTramite.id }],
  ['verificar-resultado', { w: 390, h: 844 }],
  ['revisar-avance', { w: 1280, h: 720 }], ['revisar-avance', { w: 1440, h: 900 }], ['revisar-enviar-vacio', { w: 1280, h: 720 }],
  ['grupos-agregar', { w: 1280, h: 720 }],
  ['citas-dias', { w: 1280, h: 720 }], ['citas-dias-volumen', { w: 1280, h: 720, datos: 'v' }],
  ['revision-buscar-volumen', { w: 1280, h: 720, datos: 'v' }],
  ['programar-mes', { w: 1280, h: 720 }],
  ['asistencia-volumen', { w: 1280, h: 720, datos: 'v' }],
  ['datos-guardar', { w: 390, h: 844, sesion: sinTramite.id }], ['revisar-completo', { w: 1280, h: 720 }], ['revisar-completo', { w: 1440, h: 900 }], ['revisar-completo', { w: 390, h: 844 }], ['asistencia-25', { w: 1280, h: 720, datos: 'v' }], ['programar-limites', { w: 1280, h: 720 }], ['visor-telefono', { w: 390, h: 844 }], ['visor-telefono', { w: 1280, h: 720 }]
].filter(([n]) => !FILTRO || new RegExp(FILTRO).test(n));

const out = [];
for (let ronda = 1; ronda <= RONDAS; ronda++) {
  for (const [nombre, op] of PLAN) {
    const { ctx, pg } = await nuevo(op);
    const errores = [];
    pg.on('pageerror', (e) => errores.push(String(e)));
    const reg = { escenario: nombre, ronda, tam: `${op.w}x${op.h}`, datos: op.datos === 'v' ? 'volumen' : 'ficticios', pasos: [], errores };
    try { await ESCENARIOS[nombre](reg, pg); } catch (e) { reg.error = String(e.message || e).split('\n')[0]; }
    if (ronda === 1) { try { await pg.screenshot({ path: join(CAPTURAS, `gestion-${nombre}-${op.w}x${op.h}.png`) }); } catch (e) { /* */ } }
    out.push(reg);
    console.log(`\n=== ${nombre} · ronda ${ronda} · ${reg.tam} · ${reg.datos}${reg.error ? ' · ERROR ' + reg.error : ''}`);
    for (const p of reg.pasos) {
      console.log(`  ${p.k}. ${p.nombre}${p.error ? ' [error: ' + p.error + ']' : ''}`);
      console.log(`     foco → ${p.foco ? (p.foco.body ? 'BODY (se perdió)' : `${p.foco.en}${p.foco.enDialogo ? ' [en diálogo ' + p.foco.enDialogo + ']' : ''}${p.foco.dentroVentana === false ? ' [FUERA DE LA VENTANA, top ' + p.foco.top + ']' : ''}`) : '¿?'}`);
      for (const a of p.anuncios) console.log(`     anuncio ${a.alCargar ? '(al cargar) ' : ''}${a.tipo} ${a.region}: «${a.texto.slice(0, 140)}»`);
    }
    await ctx.close();
  }
}
await navegador.close();
writeFileSync(SALIDA, JSON.stringify(out, null, 1));
