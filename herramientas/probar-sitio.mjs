// PRUEBAS DEL SITIO (etapa 1, pantallas de la persona solicitante) con Playwright, en teléfono (390 px) y
// escritorio (1280 px). Recorre los caminos principales sobre los datos ficticios y falla si:
//   · hay errores en la consola o excepciones en la página;
//   · la página se desborda a lo ancho;
//   · una pantalla no muestra lo que debe (acuse, estados, observaciones, resultado de verificación).
//
// Uso:  node herramientas/probar-sitio.mjs <url-base> [carpeta-de-capturas]
//   p. ej. con `npm run probar-sitio`, que sirve sitio/ mientras dura (herramientas/con-servidor.sh)
//          node herramientas/probar-sitio.mjs http://localhost:8765/ verificacion/capturas
// Requiere `npm install` (Playwright como dependencia de desarrollo) y un Chromium de Playwright.

import { chromium } from 'playwright';
import { navegadorSinGoogle, GOOGLE_BLOQUEO } from './sin-google.mjs';
import { readFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Zona horaria del navegador fija, la de la Ciudad de México (auditoría 2026-10-19, B8-03): las pruebas no dependen de
// la zona de la máquina. La pasada «fechas» repite «Mis trámites» y «Verificar» en UTC.
const ZONA = 'America/Mexico_City';
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] ? resolve(raiz, process.argv[3]) : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
await import('../sitio/formkit/js/validaciones.config.js'); // la misma regla nombre ↔ CURP del formulario (prefijoCurp)
await import('../sitio/app/casos-prueba.js'); // los casos de prueba del menú (se comprueba que todos encuentran persona)
const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
// Persona nueva ficticia, con CURP coherente con su nombre y su fecha de nacimiento
const NUEVA = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', nacimiento: '1999-12-30' };
NUEVA.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: NUEVA.nombre, primer: NUEVA.primer_apellido, segundo: NUEVA.segundo_apellido }, NUEVA.nacimiento, 'M', 'NE') + '0');
const otroDigito = (c) => c.slice(0, 17) + String((Number(c[17]) + 1) % 10);
// Fecha de nacimiento de una persona ficticia: está en su CURP (homoclave 0 = nacida antes de 2000)
const dma = (iso) => iso.split('-').reverse().join('/'); // la fecha se escribe día/mes/año (decisión 2026-10-16)
const nacimientoDe = (p) => `19${p.curp.slice(4, 6)}-${p.curp.slice(6, 8)}-${p.curp.slice(8, 10)}`;
const CONTRASENA = 'Prueba-ficticia-2026';
const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'];

// ── Personas para cada camino, elegidas de los datos (no fijadas a mano) ──
const persona = (id) => datos.solicitante.find((p) => p.id === id);
// Persona con cuenta activa y adscrita a una empresa: para «Mi perfil»
const CON_ORG = datos.solicitante.find((p) => p.estado === 'activa' && p.adscripcion === 'privada');
const conObs = datos.solicitud.find((s) => s.estado === 'con_observaciones');
const ultimaDe = (p, tipo) => datos.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === tipo).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en))[0];
const tieneActiva = (p, tipo) => datos.solicitud.some((s) => s.solicitante_id === p.id && s.tipo_acreditacion === tipo && !FINALES.includes(s.estado));
// Del padrón migrado, sin cuenta, con su poda en periodo de renovación: activa su cuenta y renueva
const renovable = datos.solicitante.find((p) => {
  const poda = ultimaDe(p, 'poda');
  return p.estado === 'sin_activar' && poda && ['por_vencer', 'vencida_renovable'].includes(datos.estado_acreditacion[poda.numero]) && !tieneActiva(p, 'poda');
});
// Con poda vigente y sin dictaminador: puede pedir dictaminador nueva. Desde la sesión de trabajo del 23/10/2026, con la
// poda al menos 2 años consecutivos: la cadena sin cortes (cada renovación a más tardar 12 meses después del vencimiento
// de la anterior, como apd.poda_continua_desde) empieza hace 2 años o más
const masMeses = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const t = a * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
function podaDesde(p) {
  const podas = datos.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === 'poda' && a.emitida_en <= datos.fecha_corte).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en));
  if (!podas.length || podas[0].vence_en < datos.fecha_corte) return null;
  let desde = podas[0].emitida_en;
  for (const a of podas.slice(1)) { if (desde <= masMeses(a.vence_en, 12)) desde = a.emitida_en < desde ? a.emitida_en : desde; else break; }
  return desde;
}
// Una persona activa, sin trámite, que puede iniciar una solicitud: sin la poda vigente por más de un mes (antes de los
// 30 días previos al vencimiento no se renueva). Desde la
// sesión del 23/10 hay personas con la poda vigente que no pueden pedir nada todavía (dos años de poda): la primera por
// CURP (poda-con-corte) sólo ve por qué
const SIN_TRAMITE = datos.solicitante.find((p) => p.estado === 'activa' && !datos.solicitud.some((s) => s.solicitante_id === p.id)
  && !datos.acreditacion.some((a) => a.solicitante_id === p.id && a.tipo_acreditacion === 'poda' && a.vence_en > masMeses(datos.fecha_corte, 1)));
const paraDictaminador = datos.solicitante.find((p) => {
  const poda = ultimaDe(p, 'poda');
  const desde = podaDesde(p);
  // Sin ninguna solicitud de dictaminador (también cerrada: la rechazada es la del caso «Rechazado por perfil»)
  return p.estado === 'activa' && poda && datos.estado_acreditacion[poda.numero] === 'vigente' && desde && desde <= masMeses(datos.fecha_corte, -24)
    && !ultimaDe(p, 'dictaminador') && !datos.solicitud.some((s) => s.solicitante_id === p.id && s.tipo_acreditacion === 'dictaminador');
});
const inscrita = datos.solicitud.find((s) => s.estado === 'inscrita');
// Una cita de cotejo sencilla: una sola cita, pendiente (los casos del menú traen citas nuevas y pausas)
const citaSencilla = (s) => datos.cita.filter((c) => c.solicitud_id === s.id).length === 1 && datos.cita.some((c) => c.solicitud_id === s.id && c.resultado === 'pendiente');
const conCita = datos.solicitud.find((s) => s.estado === 'validada_en_linea' && s.cita_en && citaSencilla(s));
const vigente = datos.verificacion_publica.find((v) => v.situacion === 'Vigente');
const noVigente = datos.verificacion_publica.find((v) => v.situacion !== 'Vigente');

const PDF = { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% documento ficticio de prueba\n%%EOF\n') };
// Fotografía ficticia: un PNG gris de 400 × 500 px (el estándar pide al menos 320 × 240), hecho aquí mismo
function pngFicticio(ancho = 400, alto = 500) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const bloque = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii'); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 0;
  const filas = Buffer.alloc((ancho + 1) * alto, 0x9a); for (let y = 0; y < alto; y++) filas[y * (ancho + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas)), bloque('IEND', Buffer.alloc(0))]);
}
const FOTO = { name: 'foto-ficticia.png', mimeType: 'image/png', buffer: pngFicticio() };
async function cargaFoto(page) {
  await page.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', FOTO);
  await page.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
}

let fallas = 0;
let total = 0;
const bien = (m) => { total++; console.log(`BIEN  ${m}`); };
const mal = (m) => { total++; fallas++; console.log(`MAL   ${m}`); };
const comprueba = (cond, m) => (cond ? bien(m) : mal(m));

// Marca una casilla u opción y comprueba que quedó marcada; si el clic llegó antes de que la pregunta estuviera lista (una
// condición que todavía se está mostrando, en una máquina lenta como la de GitHub), espera y lo intenta otra vez
async function marcar(page, sel, intentos = 4) {
  for (let i = 1; ; i++) {
    try { await page.check(sel, { force: true }); if (await page.isChecked(sel)) return; } catch (e) { if (i >= intentos) throw e; }
    if (i >= intentos) throw new Error(`no quedó marcada: ${sel}`);
    await page.waitForTimeout(250 * i);
  }
}
async function captura(page, nombre) {
  if (CAPTURAS) await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
  await conAire(page, nombre);
}
async function sinDesborde(page, donde) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  comprueba(ok, `${donde}: sin desborde horizontal`);
  await conAire(page, donde);
}
/* Ningún botón visible pegado al borde de la caja que lo contiene (tarjeta, diálogo, ficha…): al menos 8 px de aire
   (caso que reportó Liber: «Ir a mis trámites» pegado a la orilla del acuse). La caja es el ancestro más cercano con
   borde o sombra. Se excluyen el botón fijo del menú de pruebas y el distintivo de versión. */
async function conAire(page, donde) {
  const pegados = await page.evaluate(() => {
    const MIN = 8;
    const caja = (e) => {
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (parseFloat(c.borderTopWidth) > 0 && parseFloat(c.borderRightWidth) > 0 && parseFloat(c.borderBottomWidth) > 0 && parseFloat(c.borderLeftWidth) > 0) return a;
        if (c.boxShadow && c.boxShadow !== 'none' && a.tagName !== 'INPUT') return a;
        if (a.tagName === 'DIALOG') return a;
      }
      return null;
    };
    const fuera = [];
    for (const b of document.querySelectorAll('.btn, button')) {
      if (b.closest('.menu-pruebas-boton, #version-sia, .solo-lector') || b.matches('.menu-pruebas-boton')) continue;
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(b).visibility === 'hidden') continue;
      const k = caja(b);
      if (!k) continue;
      const q = k.getBoundingClientRect();
      const c = getComputedStyle(k);
      const izq = r.left - q.left - parseFloat(c.borderLeftWidth), der = q.right - parseFloat(c.borderRightWidth) - r.right;
      const arr = r.top - q.top - parseFloat(c.borderTopWidth), aba = q.bottom - parseFloat(c.borderBottomWidth) - r.bottom;
      // En una caja con desplazamiento propio (el menú de pruebas) lo de arriba y abajo depende del desplazamiento
      const m = k.scrollHeight > k.clientHeight + 1 ? Math.min(izq, der) : Math.min(izq, der, arr, aba);
      if (m < MIN) fuera.push(`«${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30)}» (${Math.round(m)} px de ${k.className || k.tagName.toLowerCase()})`);
    }
    return [...new Set(fuera)];
  });
  comprueba(pegados.length === 0, `${donde}: botones con aire dentro de su caja${pegados.length ? ': ' + pegados.join('; ') : ''}`);
}
async function entra(page, curp) {
  await page.goto(BASE + 'entrar.html');
  await page.fill('#curp', curp);
  await page.fill('#contrasena', CONTRASENA);
  await page.click('[data-accion="enviar"]');
  await page.waitForURL(/tramites\.html/);
  await page.waitForSelector('[data-solicitudes] .ficha, [data-solicitudes] .vacio');
}
/* Abre el cotejo de una cita. Una cita de un día que todavía no llega se atiende ese día (auditoría «intentar romperlo»,
   F2 A6): en la prueba, como la fecha simulada no avanza, se atiende «como si fuera su día» */
async function abreCotejo(page, folio) {
  await page.goto(BASE + `cotejo.html?folio=${folio}`);
  await page.waitForSelector('#formulario:not([hidden]), [data-futura]:not([hidden])');
  if (await page.isVisible('[data-atender-simulada]')) await page.click('[data-atender-simulada]');
  await page.waitForSelector('#formulario:not([hidden])');
}
const pasoVisible = 'section[data-paso]:not([hidden])';
async function siguiente(page) {
  // La adscripción es obligatoria en el primer paso; donde la prueba no la revisa, se responde «No»
  const sinAdscripcion = await page.$(`${pasoVisible} [data-campo="adscrito"]:not(:has(input:checked))`);
  if (sinAdscripcion) await page.check('input[name="adscrito"][value="no"]', { force: true });
  // Los estudios se preguntan en poda y en dictaminador; donde la prueba no los revisa, preparatoria
  if (await page.isVisible(`${pasoVisible} #nivel_estudios`) && !(await page.inputValue('#nivel_estudios'))) await page.selectOption('#nivel_estudios', 'preparatoria');
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
}
async function cargaObligatorios(page) {
  const nombres = await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of nombres) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF);
    await page.waitForSelector(`[data-campo="${n}"] .lista-arch li`);
  }
  return nombres.length;
}
// «Crea tu cuenta» va por pasos (decisión de Liber del 24/10/2026): se llena paso por paso con los datos correctos y, si se
// pide otra CURP, se regresa al primer paso a escribirla (regresar no valida); el envío (pulsaEnviar) la revisa. La fecha
// de nacimiento ya no se escribe: se toma de la CURP.
async function llenaCuenta(page, p, curp = p.curp) {
  await page.fill('#nombre', p.nombre);
  await page.fill('#primer_apellido', p.primer_apellido);
  await page.fill('#segundo_apellido', p.segundo_apellido || '');
  await page.fill('#curp', p.curp);
  await sigPaso(page);
  // Un correo, una cuenta: cada persona de la prueba, el suyo
  await page.fill('#correo', `${curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#correo2', `${curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#telefono', '0000000077');
  await page.check('input[name="adscrito"][value="no"]', { force: true });
  await sigPaso(page);
  await cargaFoto(page);
  await sigPaso(page);
  await page.fill('#contrasena', 'una frase larga de prueba');
  await page.fill('#contrasena2', 'una frase larga de prueba');
  await marcaCasillas(page);
  await sigPaso(page);
  if (curp !== p.curp) { await alPaso(page, 'Quién eres'); await page.fill('#curp', curp); }
}
// Con marcar(), que vuelve a intentar: en «regresos» la casilla se marcaba mientras la página aún recuperaba el borrador y
// a veces no quedaba («Clicking the checkbox did not change its state», 2 de 10 corridas el 23/10/2026; con la ruta de
// herramientas/sin-google.mjs, Playwright no usa la caché HTTP y las cargas tardan un poco más)
async function marcaCasillas(page) {
  for (const n of ['protesta', 'aviso', 'humano']) if (await page.$(`input[name="${n}"]`)) await marcar(page, `input[name="${n}"]`);
}

async function recorrido(navegador, ancho, alto, sufijo) {
  const contexto = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const page = await contexto.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${page.url()} · ${m.text()}`); });
  page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`));
  const t = (m) => `[${sufijo}] ${m}`;

  // Inicio
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('[data-requisitos] details');
  comprueba(await page.locator('[data-requisitos] details').count() === 4, t('inicio: requisitos de los 4 cursos, desde el catálogo'));
  comprueba(/Versión de prueba 0\.\d+/.test(await page.textContent('#version-sia')), t('inicio: versión de prueba visible'));
  await sinDesborde(page, t('inicio'));
  await captura(page, `01-inicio-${sufijo}`);
  // Alta 1 de la auditoría integral: no se indexa y lo guardado caduca a los 7 días sin uso
  comprueba((await page.getAttribute('meta[name="robots"]', 'content')) === 'noindex, nofollow', t('inicio: los buscadores no indexan la prueba'));
  await page.evaluate(() => { localStorage.setItem('apd.perfiles', '{"x":{"telefono":"5500000000"}}'); localStorage.setItem('apd.prueba.ultimo_uso', String(Date.now() - 8 * 864e5)); });
  await page.reload();
  await page.waitForSelector('[data-requisitos] details');
  await page.waitForFunction(() => Number(localStorage.getItem('apd.prueba.ultimo_uso')) > Date.now() - 6e4);
  comprueba(await page.evaluate(() => localStorage.getItem('apd.perfiles') === null), t('lo guardado en el navegador se borra solo a los 7 días sin usar la prueba'));

  // Cuenta nueva, por pasos (decisión de Liber del 24/10/2026): «¿Quién eres?», «¿Cómo te avisamos?», «Tu fotografía»,
  // «Tu contraseña» y «Revisa y crea». Lo que antes se comprobaba al enviar la página entera se comprueba al pasar de paso.
  await page.goto(BASE + 'cuenta.html');
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(await page.locator('.resumen-errores, [aria-invalid="true"]').count() > 0 && await tituloPaso(page) === 'Quién eres', t('cuenta: «Siguiente» con el paso vacío muestra los errores y no avanza'));
  comprueba(await page.getAttribute('[data-campo="foto"] [data-entrada-camara]', 'capture') === 'user', t('cuenta: en el teléfono la cámara que se abre es la frontal'));
  await page.fill('#nombre', ''); await page.type('#nombre', 'maría josé');
  await page.fill('#primer_apellido', 'peña'); await page.fill('#curp', 'xaxx');
  comprueba(await page.inputValue('#nombre') === 'MARÍA JOSÉ' && await page.inputValue('#primer_apellido') === 'PEÑA' && await page.inputValue('#curp') === 'XAXX',
    t('cuenta: nombre, apellidos y CURP se escriben en mayúsculas al momento'));
  await page.fill('#nombre', NUEVA.nombre); await page.fill('#primer_apellido', NUEVA.primer_apellido); await page.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await page.fill('#curp', NUEVA.curp); await page.press('#curp', 'Tab');
  // El sexo se toma de la CURP y se ve como un dato más, sin el recuadro de dato interno (decisión 2026-10-18)
  comprueba(['Mujer', 'Hombre'].includes(await page.inputValue('#sexo')) && await page.isVisible('#sexo')
    && await page.locator('[data-campo="sexo"] .nota-interna').count() === 0 && !(await page.$eval('[data-campo="sexo"]', (c) => c.hasAttribute('data-interno'))),
    t(`cuenta: el sexo se toma de la CURP y se ve como dato normal, sin recuadro de dato interno (${await page.inputValue('#sexo')})`));
  // La fecha de nacimiento también se toma de la CURP (decisión de Liber del 24/10/2026): de sólo lectura, en día/mes/año
  comprueba(await page.inputValue('#fecha_nacimiento') === dma(NUEVA.nacimiento) && await page.getAttribute('#fecha_nacimiento', 'readonly') !== null,
    t(`cuenta: la fecha de nacimiento se toma de la CURP, de sólo lectura (${await page.inputValue('#fecha_nacimiento')})`));
  await sigPaso(page);
  comprueba(await tituloPaso(page) === 'Cómo te avisamos', t('cuenta: con nombre y CURP correctos pasa a «¿Cómo te avisamos?»'));
  await page.fill('#correo', 'Nadia@Ejemplo.local');
  comprueba(await page.inputValue('#correo') === 'Nadia@Ejemplo.local', t('cuenta: el correo no se pasa a mayúsculas'));
  // Adscripción: cada respuesta abre sólo su pregunta, y al cambiarla se oculta lo que dependía de ella
  comprueba(!(await page.isVisible('[data-campo="tipo_adscripcion"]')), t('adscripción: el tipo no se pregunta hasta responder «Sí»'));
  comprueba(/independiente/.test(await page.textContent('[data-campo="adscrito"]')), t('adscripción: «No, soy independiente» es una respuesta explícita'));
  await page.check('input[name="adscrito"][value="si"]', { force: true });
  await page.check('input[name="tipo_adscripcion"][value="dependencia_cdmx"]', { force: true });
  await page.check('input[name="dependencia_cdmx"][value="sedema"]', { force: true });
  comprueba(await page.isVisible('[data-campo="direccion_sedema"]') && !(await page.isVisible('[data-campo="alcaldia"]')),
    t('adscripción: SEDEMA pregunta su Dirección General y nada más'));
  comprueba(await page.locator('input[name="direccion_sedema"][value="otro"]').count() === 0, t('adscripción: la Dirección General es una lista cerrada (sin «otra área»)'));
  await page.check('input[name="tipo_adscripcion"][value="educativa"]', { force: true });
  await page.check('input[name="institucion_educativa"][value="otro"]', { force: true });
  comprueba(await page.isVisible('[data-campo="institucion_educativa_otra"]') && await page.locator('input[name="institucion_educativa"][value="unam"]').count() === 1,
    t('adscripción: institución educativa ofrece la UNAM y, si es otra, pide su nombre'));
  await page.check('input[name="tipo_adscripcion"][value="privada"]', { force: true });
  await page.fill('#empresa_nombre', 'jard');
  await page.waitForTimeout(300);
  const sugeridas = await page.locator('[data-campo="empresa_nombre"] .combo-lista li').count();
  comprueba(sugeridas > 0, t(`adscripción: el nombre de la empresa sugiere las ya registradas (${sugeridas})`));
  await page.check('input[name="tipo_adscripcion"][value="dependencia_cdmx"]', { force: true });
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(await page.locator('[data-campo="direccion_sedema"] .err:not(:empty)').count() > 0, t('adscripción: sin Dirección General no se pasa del paso (no se crea la cuenta)'));
  await page.check('input[name="tipo_adscripcion"][value="alcaldia"]', { force: true });
  comprueba(await page.isVisible('[data-campo="alcaldia"]') && !(await page.isVisible('[data-campo="direccion_sedema"]')),
    t('adscripción: al cambiar a alcaldía se oculta la Dirección General y aparece la lista de alcaldías'));
  await page.check('input[name="adscrito"][value="no"]', { force: true });
  comprueba(!(await page.isVisible('[data-campo="alcaldia"]')) && !(await page.isVisible('[data-campo="tipo_adscripcion"]')),
    t('adscripción: con «No» se oculta todo lo que dependía de ella'));
  await page.fill('#correo', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#correo2', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#telefono', '0000000077');
  await sigPaso(page);
  // Sin fotografía no se pasa a la contraseña (antes: no se creaba la cuenta)
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(((await page.textContent('[data-campo="foto"] .err')) || '').length > 0 && await tituloPaso(page) === 'Tu fotografía', t('cuenta: sin fotografía de frente no se avanza (no se crea la cuenta)'));
  await page.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', PDF);
  comprueba(await page.locator('[data-campo="foto"] [data-rechazos] *').count() > 0, t('cuenta: una fotografía en PDF se rechaza con su motivo'));
  await cargaFoto(page);
  await sigPaso(page);
  comprueba(/^Escribe otra vez tu contraseña/.test(await page.textContent('label[for="contrasena2"]')), t('cuenta: la segunda contraseña dice «Escribe otra vez tu contraseña»'));
  // «Mostrar» deja ver la contraseña y «Ocultar» la vuelve a tapar (2026-10-17)
  await page.fill('#contrasena', 'una frase larga de prueba');
  await page.click('[data-ver-contrasena][aria-controls="contrasena"]');
  const visible = await page.getAttribute('#contrasena', 'type');
  await page.click('[data-ver-contrasena][aria-controls="contrasena"]');
  comprueba(visible === 'text' && await page.getAttribute('#contrasena', 'type') === 'password' && await page.inputValue('#contrasena') === 'una frase larga de prueba',
    t('cuenta: «Mostrar» deja ver la contraseña y «Ocultar» la tapa'));
  if (ancho >= 760) comprueba(await page.evaluate(() => Math.abs(document.getElementById('contrasena').getBoundingClientRect().top - document.getElementById('contrasena2').getBoundingClientRect().top) < 2),
    t('cuenta: la contraseña y la que se escribe otra vez quedan a la misma altura'));
  await page.goto(BASE + 'cuenta.html');
  // CURP con dígito incorrecto: el formulario la rechaza, igual que la base
  await llenaCuenta(page, NUEVA, otroDigito(NUEVA.curp));
  await pulsaEnviar(page);
  comprueba(await page.getAttribute('#curp', 'aria-invalid') === 'true', t('cuenta: CURP con dígito verificador incorrecto se rechaza'));
  // CURP ajena (de otra persona ficticia) con el nombre propio: no corresponde
  const ajena = datos.solicitante.find((p) => p.estado === 'activa');
  await page.fill('#curp', ajena.curp);
  await pulsaEnviar(page);
  comprueba(await page.getAttribute('#curp', 'aria-invalid') === 'true' && /no corresponde|no coincide/.test(await page.textContent('[data-campo="curp"] .err')),
    t('cuenta: una CURP ajena no corresponde con el nombre y se rechaza'));
  // Segundo apellido vacío con una CURP que sí lo tiene: se le dice que lo escriba (sin preguntarlo)
  await page.fill('#curp', NUEVA.curp);
  await page.fill('#segundo_apellido', '');
  await page.press('#segundo_apellido', 'Tab');
  await pulsaEnviar(page);
  comprueba(/segundo apellido/.test(await page.textContent('[data-campo="curp"] .err')), t('cuenta: segundo apellido vacío con una CURP que sí lo tiene se rechaza con su motivo'));
  await page.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await page.fill('#curp', NUEVA.curp);
  // Un correo, una cuenta (decisión 2026-10-17): el de otra cuenta activa se marca en el campo de correo
  const ajeno = datos.solicitante.find((p) => p.estado === 'activa').correo;
  await alPasoDe(page, '#correo');
  await page.fill('#correo', ajeno);
  await page.fill('#correo2', ajeno);
  await pulsaEnviar(page);
  await page.waitForFunction(() => /ya está registrado/.test(document.querySelector('[data-campo="correo"] .err').textContent));
  comprueba(await page.getAttribute('#correo', 'aria-invalid') === 'true' && /ya está registrado/.test(await page.textContent('[data-estado-envio]')) && await tituloPaso(page) === 'Cómo te avisamos',
    t('cuenta: un correo de otra cuenta se marca en su campo y en el aviso del envío, y se abre su paso'));
  await page.fill('#correo', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#correo2', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await alPaso(page, 'Revisa y crea');
  // Resumen antes de crear: lo que escribió, sin la contraseña
  const resumenCuenta = await page.textContent('[data-resumen-cuenta]');
  comprueba(resumenCuenta.includes(NUEVA.curp) && resumenCuenta.includes(dma(NUEVA.nacimiento)) && !resumenCuenta.includes('una frase larga de prueba') && /no se muestra/.test(resumenCuenta),
    t('cuenta: «Revisa y crea» resume lo escrito y no muestra la contraseña'));
  await captura(page, `02-cuenta-${sufijo}`);
  await pulsaEnviar(page);
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('cuenta nueva: acuse visible'));
  comprueba(await page.isHidden('[data-con-formulario]'), t('cuenta nueva: con el acuse, la barra de pasos ya no se ve'));
  await sinDesborde(page, t('cuenta acuse'));
  await page.click('[data-acuse] a[href="tramites.html"]');
  await page.waitForSelector('[data-solicitudes] .vacio');
  comprueba(await page.isVisible('[data-nueva] a'), t('cuenta nueva: «Iniciar una solicitud» disponible'));
  comprueba(/Solicitudes en curso/.test(await page.textContent('#t-solicitudes')) && await page.isHidden('[data-anteriores-seccion]'),
    t('mis trámites: «Solicitudes en curso»; «Solicitudes anteriores» no aparece si no hay'));

  // Persona nueva: sólo puede pedir poda nueva; dictaminador deshabilitado con su motivo
  await page.click('[data-nueva] a');
  await page.waitForFunction(() => document.querySelector('input[name="tipo"][value="poda"]').checked);
  comprueba(await page.isDisabled('input[name="tipo"][value="dictaminador"]'), t('solicitud: dictaminador deshabilitado sin poda vigente, con su motivo'));
  comprueba(/solicitud nueva/.test(await page.textContent('[data-modalidad-texto]')), t('solicitud: informa que le corresponde una solicitud nueva (no lo pregunta)'));
  // El dato calculado «tramite» (data-auxiliar) se ve en la versión de prueba como dato interno, con su valor
  comprueba(await page.waitForFunction(() => { const o = document.querySelector('#tramite').closest('[data-interno]').querySelector('[data-interno-valor]'); return o && o.textContent === 'poda_nueva'; }, null, { timeout: 3000 }).then(() => true, () => false),
    t('datos internos: el curso calculado (poda_nueva) se ve en la versión de prueba'));
  comprueba(/Independiente/.test(await page.textContent('[data-adscripcion-texto]')),
    t('solicitud: muestra la adscripción de la persona con la que se enviará (se cambia en «Mi perfil»)'));
  comprueba(await page.$eval('#nivel_estudios', (e) => e.tagName === 'SELECT' && e.options.length === 10), t('estudios: el nivel es una lista desplegable con 9 niveles'));
  await page.selectOption('#nivel_estudios', 'tecnica');
  comprueba(!(await page.isVisible('[data-campo="carrera"]')) && !(await page.isVisible('[data-campo="estatus_estudios"]')),
    t('estudios: con carrera técnica no se preguntan carrera ni situación'));
  await page.selectOption('#nivel_estudios', 'licenciatura');
  // En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026)
  comprueba(await page.isVisible('[data-campo="carrera"]') && !(await page.isVisible('[data-campo="estatus_estudios"]')) && !(await page.isVisible('[data-campo="anios_experiencia"]')),
    t('poda: con licenciatura pregunta la carrera, sin su situación ni experiencia'));
  await page.fill('#carrera', 'Arquitectura de Paisaje');
  await siguiente(page);
  comprueba(await page.getAttribute('[data-campo="doc_poda_nueva_curp"] .ayuda a', 'href') === 'https://www.gob.mx/curp/',
    t('documentos: la CURP trae el enlace oficial para obtenerla'));
  comprueba(await page.getAttribute('[data-campo="doc_poda_nueva_curp"]', 'data-extensiones') === 'pdf', t('documentos: sólo se aceptan en PDF'));
  await page.setInputFiles('[data-campo="doc_poda_nueva_curp"] [data-archivos] > input[type="file"]', FOTO);
  comprueba(await page.locator('[data-campo="doc_poda_nueva_curp"] [data-rechazos] *').count() > 0, t('documentos: una imagen se rechaza con su motivo'));
  const n = await cargaObligatorios(page);
  comprueba(!/Se guardará como|renombrar/.test(await page.textContent(pasoVisible)), t('documentos: no avisa del renombrado al cargar (lo hace el sistema)'));
  comprueba(n === 4, t(`solicitud poda nueva: ${n} documentos obligatorios`));
  // Con el archivo cargado, «Elegir archivo» se oculta; al quitarlo vuelve (caso que reportó Liber, P71)
  const zonaCurp = '[data-campo="doc_poda_nueva_curp"] .zona-carga';
  comprueba(await page.isHidden(zonaCurp) && await page.isVisible('[data-campo="doc_poda_nueva_curp"] .lista-arch li'),
    t('documentos: con el archivo cargado ya no se ofrece «Elegir archivo»'));
  await page.click('[data-campo="doc_poda_nueva_curp"] .arch-quitar');
  // El formato y el tamaño los dice una vez la bajada del paso, no cada zona (auditoría 2026-10-20, C3-02)
  comprueba(await page.isVisible(zonaCurp) && !(await page.$(`${zonaCurp} [data-limite-texto]`)) && /sólo en PDF, de hasta 5 MB/.test(await page.textContent('[data-paso]:not([hidden]) .bajada')),
    t('documentos: al quitarlo vuelve «Elegir archivo»; «sólo en PDF, de hasta 5 MB» lo dice una vez la bajada del paso'));
  await page.setInputFiles('[data-campo="doc_poda_nueva_curp"] [data-archivos] > input[type="file"]', PDF);
  await page.waitForSelector('[data-campo="doc_poda_nueva_curp"] .lista-arch li[data-estado="listo"]');
  await captura(page, `03-solicitud-documentos-${sufijo}`);
  await siguiente(page);
  await marcaCasillas(page);
  await captura(page, `04-solicitud-revision-${sufijo}`);
  // «Editar» siempre a la altura del primer renglón del valor, aunque el nombre del archivo sea largo
  const desparejos = await page.$$eval('.rev-dato-valor', (dds) => dds.filter((dd) => {
    const v = dd.firstElementChild, b = dd.querySelector('.btn-enlace');
    return v && b && b.getBoundingClientRect().top - v.getBoundingClientRect().top > 12;
  }).length);
  comprueba(desparejos === 0, t('revisión: «Editar» queda parejo, arriba a la derecha de cada dato'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  const folio = await page.textContent('[data-acuse-folio]');
  comprueba(/^APD-S-\d{4}-\d{5}$/.test(folio), t(`solicitud: acuse con folio ${folio}`));
  // El acuse dice el día simulado de la prueba y la hora en 24 horas (auditoría «intentar romperlo», F4 M7)
  const recibido = (await page.textContent('[data-acuse-fecha]')) || '';
  const [ac, mc, dc] = datos.fecha_corte.split('-').map(Number);
  comprueba(recibido.includes(`${dc} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mc - 1]} de ${ac}`) && /\b([01]\d|2[0-3]):[0-5]\d\b/.test(recibido) && !/[ap]\.\s?m\./.test(recibido),
    t(`F4 M7: el acuse dice el día simulado y la hora en 24 horas («${recibido.trim()}»)`));
  await captura(page, `05-solicitud-acuse-${sufijo}`);
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  comprueba((await page.textContent('[data-solicitudes]')).includes(folio), t('mis trámites: aparece la solicitud enviada, «En revisión documental»'));
  await page.click('[data-sesion] button');
  await page.waitForURL(/index\.html/);

  // Persona sin segundo apellido: crea su cuenta sin quedar atrapada
  const SIN = { nombre: 'Uriel', primer_apellido: 'Ejemplo', segundo_apellido: '', nacimiento: '1988-04-09' };
  SIN.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: SIN.nombre, primer: SIN.primer_apellido, segundo: '' }, SIN.nacimiento, 'H', 'NE') + '0');
  await page.goto(BASE + 'cuenta.html');
  await llenaCuenta(page, SIN);
  await pulsaEnviar(page);
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t(`cuenta: persona sin segundo apellido (${SIN.curp}) crea su cuenta`));
  comprueba(await page.locator('[data-acuse] .acuse-acciones .btn-primario').count() === 1, t('cuenta: «Ir a mis trámites» va en las acciones del acuse, con aire'));
  // Mi perfil: la fotografía que cargó al crear la cuenta se ve (versión de prueba, guardada en este navegador)
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('.perfil-imagen');
  comprueba(await page.evaluate(() => { const i = document.querySelector('.perfil-imagen'); return i.complete && i.naturalWidth > 0; }),
    t('mi perfil: muestra la fotografía que cargó al crear la cuenta'));
  comprueba((await page.$$eval('[data-vista="adscripcion"] .datos-valor', (l) => l.map((x) => x.textContent))).join('|') === 'Independiente', t('mi perfil: la adscripción independiente se ve como «Tipo: Independiente», con rótulo y valor'));
  await page.click('[data-editar="foto"]');
  await page.setInputFiles('#form-foto [data-archivos] > input[type="file"]:not([data-entrada-camara])', FOTO);
  await page.waitForSelector('#form-foto .lista-arch li[data-estado="listo"]');
  comprueba(await page.isHidden('#form-foto .zona-carga'), t('mi perfil: con la fotografía elegida ya no se ofrece elegir otra'));
  await page.click('#form-foto [data-accion="enviar"]');
  await page.waitForSelector('[data-guardado="foto"]:not([hidden])');
  comprueba(await page.isHidden('#form-foto') && await page.isVisible('.perfil-imagen'), t('mi perfil: cambia la fotografía y la muestra'));
  await captura(page, `16-mi-perfil-foto-${sufijo}`);
  await page.click('[data-sesion] button').catch(() => {});
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => localStorage.clear());

    // Padrón migrado: crea su cuenta con su CURP, ve su historial y renueva
  await page.goto(BASE + 'cuenta.html');
  // P14 (decisión 2026-10-18): el nombre se compara con el registro sin acentos y con una letra de tolerancia
  // Cambia la última letra (y con n = 2 agrega otra): no toca las letras que usa la CURP, que se comprueban antes
  const cambia = (t, n) => t.slice(0, -1) + (t.endsWith('E') ? 'A' : 'E').repeat(n);
  await llenaCuenta(page, Object.assign({}, renovable, { nombre: cambia(renovable.nombre, 2) }), renovable.curp);
  await pulsaEnviar(page);
  await page.waitForFunction(() => /no coincide con el que tiene la Secretaría/.test(document.body.textContent));
  comprueba(await page.isHidden('[data-acuse]') && (await page.getAttribute('#nombre', 'aria-invalid')) === 'true', t('cuenta del padrón migrado: con dos letras distintas en el nombre no se activa y lo marca junto al nombre'));
  await page.fill('#nombre', cambia(renovable.nombre, 1));
  await pulsaEnviar(page);
  // La espera es la prueba: si no llega, se anota la falla con su nombre en vez de detener el guion (A 7.4)
  comprueba(await page.waitForSelector('[data-acuse]:not([hidden])').then(() => true, () => false), t('cuenta del padrón migrado: con una letra distinta en el nombre sí se activa (P14)'));
  comprueba(await page.isVisible('[data-cuenta-historial]'), t('cuenta del padrón migrado: avisa que encontró acreditaciones anteriores'));
  await page.click('[data-acuse] a[href="tramites.html"]');
  await page.waitForSelector('[data-acreditaciones] .ficha');
  await captura(page, `06-tramites-renovacion-${sufijo}`);
  await sinDesborde(page, t('mis trámites'));
  // Rótulo según el caso (auditoría 2026-10-18, D10): «Vence en N días» o «Vencida hace N días», nunca «Para vencer: Venció…»
  comprueba(await page.locator('[data-acreditaciones] .ficha').evaluateAll((fs) => fs.every((f) => /Vence en\s*[\d,]+ días?|Vence el\s*\d{2}\/\d{2}\/\d{4} \(hoy\)|Vencida hace\s*[\d,]+ días?/.test(f.textContent) && !/Para vencer/.test(f.textContent))),
    t('mis trámites: cada acreditación dice cuántos días faltan para vencer (o hace cuántos venció), con el rótulo que corresponde'));
  comprueba(await page.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).count() >= 1, t('mis trámites: botón «Renovar» en la acreditación renovable'));
  await page.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).first().click();
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_renovacion');
  comprueba(/^PD-/.test(await page.inputValue('#anterior')), t('solicitud renovación: acreditación anterior en sólo lectura'));
  comprueba(/renovación de tu acreditación PD-/.test(await page.textContent('[data-modalidad-texto]')), t('solicitud renovación: informa qué acreditación renueva'));
  await siguiente(page);
  // Decisión 2026-10-18: en su primera renovación, quien viene de Kobo (sin archivos) carga todos los documentos
  comprueba(await page.isVisible('[data-kobo-docs]') && await page.locator('[data-si="tramite=poda_renovacion"] [data-campo^="doc_"][data-requerido]').count() === 4
    && !/si aplica/.test(await page.textContent('[data-campo="doc_poda_renovacion_identificacion_oficial"] .etiqueta')),
    t('primera renovación de quien viene del registro anterior: pide todos los documentos, como una nueva'));
  await cargaObligatorios(page);
  await siguiente(page);
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('solicitud renovación: enviada'));
  await page.click('[data-sesion] button');

  // Dictaminador nueva: perfil y sus documentos
  await entra(page, paraDictaminador.curp);
  await page.goto(BASE + 'solicitud.html?tipo=dictaminador');
  await page.waitForFunction(() => document.getElementById('tramite').value === 'dictaminador_nueva');
  // La barra de pasos 1-2-3 del estándar queda en un renglón (en 0.38 un estilo del proyecto con el mismo nombre la rompió)
  comprueba(await page.evaluate(() => { const l = [...document.querySelectorAll('.pasos .pasos-item')]; return l.length === 3 && new Set(l.map((x) => Math.round(x.getBoundingClientRect().top))).size === 1; }),
    t('solicitud: la barra de pasos 1-2-3 queda en un renglón'));
  await siguiente(page);
  comprueba(await page.isVisible('[data-campo="anios_experiencia"]'), t('dictaminador: sin perfil no avanza'));
  comprueba(!(await page.isVisible('[data-campo="carrera"]')), t('perfil: la carrera no se pregunta antes del nivel de estudios'));
  await page.selectOption('#nivel_estudios', 'preparatoria');
  comprueba(!(await page.isVisible('[data-campo="carrera"]')) && await page.isVisible('[data-perfil-no-cumple]'),
    t('perfil: con preparatoria no se pregunta carrera y avisa que no cumple el perfil'));
  await page.selectOption('#nivel_estudios', 'tecnica');
  comprueba(/cinco años/.test(await page.textContent('[data-experiencia-minima]')), t('dictaminador: con carrera técnica se piden cinco años'));
  await page.selectOption('#nivel_estudios', 'licenciatura');
  comprueba(await page.isVisible('[data-campo="carrera"]') && await page.isVisible('[data-campo="estatus_estudios"]') && !(await page.isVisible('[data-perfil-no-cumple]')),
    t('perfil: con licenciatura pregunta la carrera y luego su situación'));
  await page.selectOption('#nivel_estudios', 'maestria');
  comprueba(await page.isVisible('[data-campo="carrera"]') && !(await page.isVisible('[data-campo="estatus_estudios"]')),
    t('perfil: con posgrado no se pregunta la situación del grado (se asume la licenciatura titulada)'));
  await page.selectOption('#nivel_estudios', 'licenciatura');
  await page.fill('#carrera', 'Biología');
  await page.check('input[name="estatus_estudios"][value="concluido"]', { force: true });
  comprueba(/cinco años/.test(await page.textContent('[data-experiencia-minima]')), t('perfil: con carta de pasante se piden cinco años'));
  await page.fill('#anios_experiencia', '3');
  await siguiente(page);
  comprueba(await page.locator('[data-campo="anios_experiencia"] .err:not(:empty)').count() > 0, t('perfil: con menos experiencia de la que pide el perfil no avanza'));
  await page.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
  comprueba(/dos años/.test(await page.textContent('[data-experiencia-minima]')), t('perfil: titulado en Biología, dos años'));
  comprueba(!(await page.isVisible('[data-ayuda-posgrado]')), t('carrera: con licenciatura no muestra la indicación del posgrado'));
  await page.selectOption('#nivel_estudios', 'maestria');
  comprueba(await page.isVisible('[data-ayuda-posgrado]'), t('carrera: con maestría pide escribir la carrera del posgrado'));
  await page.fill('#carrera', 'Ciencias Forestales');
  comprueba(/dos años/.test(await page.textContent('[data-experiencia-minima]')), t('perfil: posgrado en un área afín, dos años'));
  await page.selectOption('#nivel_estudios', 'licenciatura');
  await page.fill('#carrera', 'Biología');
  const calculado = await page.waitForFunction(() => /licenciatura_afin/.test(document.querySelector('[data-interno-texto] [data-interno-valor]').textContent), null, { timeout: 3000 }).then(() => true, () => false);
  comprueba(calculado, t('perfil: en pruebas, el perfil calculado se ve en amarillo'));
  await captura(page, `10-dictaminador-perfil-${sufijo}`);
  await siguiente(page);
  const nd = await cargaObligatorios(page);
  const esperados = datos.requisito_curso.filter((rc) => rc.tipo_acreditacion === 'dictaminador' && rc.modalidad === 'nueva' && rc.obligatorio
    && datos.requisito.find((r) => r.clave === rc.requisito).forma === 'documento' && datos.requisito.find((r) => r.clave === rc.requisito).momento === 'en_linea').length;
  comprueba(nd === esperados, t(`dictaminador nueva: ${nd} documentos obligatorios (catálogo: ${esperados})`));
  await siguiente(page);
  const rev = await page.textContent('[data-revision-lista]');
  comprueba(/CURP_[A-ZÑ ]+\.pdf/.test(rev) && /Archivo que subiste:/.test(rev), t('revisión: muestra el nombre con que se guarda cada documento y, debajo, el archivo que subió'));
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('dictaminador nueva: enviada'));
  await page.click('[data-sesion] button');

  // Con observaciones: lo que hay que corregir y sólo lo observado es obligatorio
  await entra(page, persona(conObs.solicitante_id).curp);
  comprueba(await page.locator('[data-solicitudes] .aviso').count() > 0, t('mis trámites: observaciones visibles'));
  await page.click(`a[href="solicitud.html?folio=${conObs.folio}"]`);
  await page.waitForFunction(() => document.querySelector('input[name="tipo"]:checked'));
  // D2 (auditoría 2026-10-18): «Corregir y reenviar» abre en «Documentos», con lo observado primero y su observación junto
  // al campo; lo aceptado, plegado y marcado como aceptado. D1: cada documento ya cargado muestra su archivo y «Ver».
  comprueba(await page.waitForFunction(() => { const p = document.querySelector('section[data-paso]:not([hidden])'); return p && /Carga tus documentos/.test(p.textContent); }, null, { timeout: 3000 }).then(() => true, () => false),
    t('corregir: «Corregir y reenviar» abre en el paso de documentos'));
  const orden = await page.$$eval(`${pasoVisible} [data-campo^="doc_"]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => ({
    observado: e.classList.contains('doc-observado'), junto: Boolean(e.querySelector('.doc-observacion')),
    aceptado: e.classList.contains('doc-aceptado'), plegado: Boolean(e.querySelector('details.doc-reemplazo:not([open]) [data-archivos]')),
    etiqueta: /Aceptado/.test((e.querySelector('.doc-aceptado-estado') || {}).textContent || ''), archivo: Boolean(e.querySelector('.arch-previo .arch-nombre, .doc-observacion a')),
    ver: Boolean(e.querySelector('.arch-previo a[href], .doc-observacion a[href]')) })));
  const nObs = orden.filter((x) => x.observado).length;
  comprueba(nObs > 0 && orden.slice(0, nObs).every((x) => x.observado && x.junto) && orden.slice(nObs).every((x) => x.aceptado ? x.plegado && x.etiqueta : true),
    t('corregir: lo observado va primero, con su observación junto al campo; lo aceptado, plegado y con la etiqueta «Aceptado»'));
  comprueba(orden.every((x) => x.archivo && x.ver), t('corregir: cada documento ya cargado muestra su archivo y «Ver»'));
  comprueba(await page.isVisible('[data-observaciones]'), t('corregir: observaciones arriba de los documentos'));
  const obligatorios = await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).length);
  const observados = datos.documento.filter((d) => d.solicitud_id === conObs.id && d.vigente && d.estado === 'con_observacion').length;
  comprueba(obligatorios === observados, t(`corregir: sólo ${observados} documento(s) observado(s) obligatorio(s)`));
  await captura(page, `07-corregir-${sufijo}`);
  await page.click('[data-sesion] button');

  // Inscrita: grupo visible
  await entra(page, persona(inscrita.solicitante_id).curp);
  comprueba((await page.textContent('[data-solicitudes]')).includes('APD-G-'), t('mis trámites: grupo asignado visible'));
  await page.click('[data-sesion] button');

  // Entrar con contraseña equivocada
  await page.goto(BASE + 'entrar.html');
  await page.fill('#curp', paraDictaminador.curp);
  await page.fill('#contrasena', 'otra contraseña');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-estado-envio]:not([hidden])');
  comprueba((await page.textContent('[data-estado-envio]')).includes('no coinciden'), t('entrar: error sin decir cuál dato falló'));
  // Versión de prueba: una CURP sin cuenta en este navegador se dice tal cual (las cuentas no se comparten entre navegadores)
  await page.fill('#curp', conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: 'Ximena', primer: 'Ejemplo', segundo: 'Simulado' }, '1990-05-05', 'M', 'NE') + '0'));
  await page.click('[data-accion="enviar"]');
  await page.waitForFunction(() => /en este navegador/.test(document.querySelector('[data-estado-envio]').textContent));
  bien(t('entrar: en la prueba, una CURP sin cuenta en este navegador lo dice'));
  await captura(page, `08-entrar-${sufijo}`);

  // Verificación pública, dos consultas seguidas
  await page.goto(BASE + 'verificar.html');
  await page.fill('#numero', vigente.numero);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-verificacion]:not([hidden])');
  comprueba((await page.getAttribute('[data-verificacion]', 'data-tono')) === 'ok', t(`verificar: ${vigente.numero} vigente`));
  // Días para vencer, contados desde hoy (en la prueba, la fecha simulada) (decisión 2026-10-17)
  const faltan = Math.round((new Date(`${vigente.vence_en}T12:00:00-06:00`) - new Date(`${datos.fecha_corte}T12:00:00-06:00`)) / 86400000);
  const esperado = faltan > 1 ? `Vence en${faltan.toLocaleString('es-MX')} días` : faltan === 1 ? 'Vence en1 día' : faltan === 0 ? '(hoy)' : `Vencida hace${-faltan}`;
  comprueba((await page.textContent('[data-verificacion]')).includes(esperado), t(`verificar: dice cuánto falta para vencer (${esperado})`));
  await page.fill('#numero', noVigente.numero);
  await page.click('[data-accion="enviar"]');
  // «Vencida», con la familia gris de «Mis trámites» (decisión de Liber del 21/10, C6-05 a; antes, data-tono «error»)
  await page.waitForFunction(() => document.querySelector('[data-verificacion]').dataset.tono === 'terminado');
  comprueba(/^Vencida$/.test((await page.textContent('.verificacion-situacion')).trim()), t(`verificar: ${noVigente.numero} vencida (segunda consulta sin recargar)`));
  await captura(page, `09-verificar-${sufijo}`);
  await sinDesborde(page, t('verificar'));

  // Mi perfil: lo registrado se ve escrito; «Editar» abre las preguntas de esa parte; guarda y se conserva
  await page.evaluate(() => localStorage.clear());
  await entra(page, CON_ORG.curp);
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(/Mi perfil/.test(await page.textContent('h2')) && /CURP/.test(await page.textContent('[data-identidad]')) && /Sexo/.test(await page.textContent('[data-identidad] .datos')) && await page.locator('[data-identidad] [data-interno]').count() === 0 && await page.$('#curp') === null,
    t('mi perfil: muestra CURP y sexo sin dejarlos cambiar, el sexo como dato normal'));
  comprueba(!/expediente/i.test(await page.textContent('[data-identidad]')), t('mi perfil: no muestra el número de expediente (decisión 2026-10-18)'));
  comprueba(await page.locator('form.perfil-form:not([hidden])').count() === 0 && /@/.test(await page.textContent('[data-vista="contacto"]'))
    && (await page.$$eval('[data-vista="adscripcion"] .datos-par', (l) => l.map((x) => x.querySelector('dt').textContent))).join('|') === 'Tipo|Nombre o razón social',
    t('mi perfil: se ve lo registrado, escrito, sin preguntas a la vista'));
  comprueba(/^[A-ZÁÉÍÓÚÑ]{2}$/.test((await page.textContent('[data-perfil-iniciales]')).trim()), t('mi perfil: sin imagen, la persona ficticia se ve con sus iniciales'));
  await page.click('[data-editar="contacto"]');
  comprueba(await page.isVisible('#form-contacto') && await page.inputValue('#correo') !== '', t('mi perfil: «Editar» abre el contacto con lo vigente'));
  // Un correo, una cuenta: el de otra cuenta activa no se guarda
  const deOtra = datos.solicitante.find((p) => p.estado === 'activa' && p.id !== CON_ORG.id).correo;
  await page.fill('#correo', deOtra);
  await page.fill('#correo2', deOtra);
  await page.click('#form-contacto [data-accion="enviar"]');
  await page.waitForFunction(() => /ya está registrado/.test(document.querySelector('#form-contacto [data-campo="correo"] .err').textContent));
  bien(t('mi perfil: el correo de otra cuenta no se guarda y se marca en su campo'));
  await page.click('#form-contacto [data-cancelar]');
  comprueba(await page.isHidden('#form-contacto') && await page.evaluate(() => document.activeElement.dataset.editar === 'contacto'), t('mi perfil: «Cancelar» cierra sin guardar y regresa a «Editar»'));
  await page.click('[data-editar="adscripcion"]');
  comprueba(await page.isChecked('input[name="adscrito"][value="si"]') && await page.isChecked('input[name="tipo_adscripcion"][value="privada"]'),
    t('mi perfil: trae la adscripción vigente de la persona'));
  await page.check('input[name="tipo_adscripcion"][value="dependencia_cdmx"]', { force: true });
  await page.check('input[name="dependencia_cdmx"][value="sedema"]', { force: true });
  const direcciones = await page.$$eval('input[name="direccion_sedema"]', (rs) => rs.map((r) => r.value).join(' '));
  comprueba(direcciones === 'dgsanpava dgcorenadr dgeira dgiva dgcpca dgzcfs', t('mi perfil: Direcciones Generales en el orden que fijó Liber'));
  await page.check('input[name="tipo_adscripcion"][value="alcaldia"]', { force: true });
  const alcaldias = await page.$$eval('#alcaldia option[value]:not([value=""])', (os) => os.map((o) => o.textContent));
  comprueba(alcaldias.length === 16 && alcaldias.join('|') === [...alcaldias].sort((x, y) => x.localeCompare(y, 'es')).join('|'),
    t('mi perfil: las 16 alcaldías a la vista, en orden alfabético'));
  await page.selectOption('#alcaldia', 'tlalpan');
  await captura(page, `14-mi-perfil-${sufijo}`);
  await sinDesborde(page, t('mi perfil'));
  await page.click('#form-adscripcion [data-accion="enviar"]');
  await page.waitForSelector('[data-guardado="adscripcion"]:not([hidden])');
  comprueba(/Tlalpan/.test(await page.textContent('[data-vista="adscripcion"]')) && await page.isHidden('#form-adscripcion'),
    t('mi perfil: guarda la nueva adscripción y la muestra escrita (Alcaldía · Tlalpan)'));
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(/Tlalpan/.test(await page.textContent('[data-vista="adscripcion"]')), t('mi perfil: al volver, la adscripción es la nueva'));
  await captura(page, `15-mi-perfil-vista-${sufijo}`);
  await page.evaluate(() => localStorage.clear());

  // Fallo de envío simulado
  await page.goto(BASE + 'cuenta.html?simular=error');
  await llenaCuenta(page, NUEVA);
  await pulsaEnviar(page);
  await page.waitForSelector('[data-estado-envio]:not([hidden])');
  bien(t('cuenta: el fallo de envío se avisa y la captura se conserva'));

  // Menú de pruebas: cinco bloques; sin obligatorias se avanza vacío hasta la revisión; se vuelve a activar
  await page.goto(BASE + 'solicitud.html');
  await page.click('.menu-pruebas-boton');
  comprueba(await page.isVisible('dialog.menu-pruebas'), t('menú de pruebas: se abre'));
  comprueba(/Pantalla: [^·]+ · Fase [1-7] de 7: /.test(await page.textContent('.ubicacion-prueba')) && await page.locator('.ubicacion-prueba a[target="_blank"]').count() === 1,
    t('siempre a la vista: la pantalla, la fase del trámite y el enlace al mapa del trámite'));
  comprueba(await page.locator('dialog.menu-pruebas h3').allTextContents().then((l) => l.join('|')) === 'En esta pantalla|Entrar como|Ir a otra pantalla|Ajustes de la prueba',
    t('menú de pruebas: bloques en orden (en esta pantalla, entrar como, ir a otra pantalla, ajustes)'));
  // En dos pasos (decisión 2026-10-18): «¿Quién?» y luego «¿En qué momento?»; cada caso encuentra su persona
  const perfilesMenu = await page.locator('#menu-pruebas-perfil option').evaluateAll((o) => o.map((x) => x.value));
  // Los casos, en un navegador sin lo que esta prueba ya guardó: la solicitud de dictaminador de arriba se queda en
  // IndexedDB y usó a la única persona con dos años de poda que todavía no la pedía (caso «dict-puede», sesión del 23/10)
  const opcionesCasos = [];
  {
    const cm = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    const pm = await cm.newPage();
    await pm.goto(BASE + 'solicitud.html');
    await pm.click('.menu-pruebas-boton');
    for (const perfil of perfilesMenu) {
      await pm.selectOption('#menu-pruebas-perfil', perfil);
      opcionesCasos.push(...await pm.locator('#menu-pruebas-persona option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean)));
    }
    await cm.close();
  }
  const casosSinPersona = APD_CASOS_PRUEBA.claves().filter((k) => !opcionesCasos.includes(k));
  comprueba(perfilesMenu.join('|') === 'nueva|poda|dictaminador|kobo|personal' && !casosSinPersona.length,
    t(`menú de pruebas: cinco perfiles y los ${APD_CASOS_PRUEBA.claves().length} casos encuentran persona en los ficticios${casosSinPersona.length ? ` (faltan: ${casosSinPersona.join(', ')})` : ''}`));
  await page.selectOption('#menu-pruebas-perfil', 'nueva');
  await page.selectOption('#menu-pruebas-persona', 'nueva');
  await page.click('dialog.menu-pruebas >> button:text-is("Entrar")');
  await page.waitForURL(/tramites\.html/);
  await page.goto(BASE + 'solicitud.html');
  await page.click('.menu-pruebas-boton');
  comprueba(/cuenta creada en la prueba/.test(await page.textContent('.menu-pruebas-ahora')), t('menú de pruebas: dice con quién estás (la persona nueva queda como cuenta de la prueba)'));
  await page.click('dialog.menu-pruebas >> text=Desactivar las preguntas obligatorias');
  await page.waitForLoadState('load');
  await page.waitForSelector('.menu-pruebas-boton');
  comprueba(await page.locator('form [data-requerido]').count() === 0, t('menú de pruebas: preguntas obligatorias desactivadas'));
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=3. Revisión');
  await page.waitForSelector('section[data-paso][data-revision]:not([hidden])');
  bien(t('menú de pruebas: salta al paso de revisión sin llenar'));
  await page.click('.menu-pruebas-boton');
  await captura(page, `11-menu-pruebas-${sufijo}`);
  await page.click('dialog.menu-pruebas >> text=Activar las preguntas obligatorias');
  await page.waitForLoadState('load');
  await page.waitForSelector('.menu-pruebas-boton');
  comprueba(await page.locator('form [data-requerido]').count() > 0, t('menú de pruebas: preguntas obligatorias activadas de nuevo'));
  // Entrar: la caja de personas de ejemplo ya no está; el menú llena CURP y contraseña con un caso
  await page.goto(BASE + 'entrar.html');
  comprueba(await page.locator('[data-ejemplos], section.pruebas').count() === 0 && /Prueba-ficticia-2026/.test(await page.textContent('.nota-prueba')),
    t('entrar: sin caja de pruebas; sólo la contraseña de las personas de ejemplo'));
  await page.click('.menu-pruebas-boton');
  await page.selectOption('#menu-pruebas-llenar', 'obs-poda');
  await page.click('dialog.menu-pruebas >> text=Llenar CURP y contraseña');
  await page.click('dialog.menu-pruebas >> text=Cerrar');
  await page.click('[data-accion="enviar"]');
  await page.waitForURL(/tramites\.html/);
  await page.waitForSelector('[data-solicitudes] .ficha');
  comprueba(/Corrige y reenvía/.test(await page.textContent('[data-solicitudes]')), t('menú de pruebas: en «Entrar», un caso llena CURP y contraseña y entra'));
  // Personal: «Entrar como» lleva a la bandeja; ahí no hay «En esta pantalla» (los filtros no se llenan ni se envían)
  await page.click('.menu-pruebas-boton');
  await page.selectOption('#menu-pruebas-perfil', 'personal');
  await page.selectOption('#menu-pruebas-persona', 'personal');
  await page.click('dialog.menu-pruebas >> button:text-is("Entrar")');
  await page.waitForURL(/revision\.html/);
  await page.click('.menu-pruebas-boton');
  const bloquesPersonal = await page.locator('dialog.menu-pruebas h3').allTextContents();
  comprueba(!bloquesPersonal.includes('En esta pantalla') && /personal/.test(await page.textContent('.menu-pruebas-ahora')),
    t('menú de pruebas: en la bandeja del personal no ofrece llenar ni simular el envío'));
  await page.click('dialog.menu-pruebas >> text=Empezar de cero');
  await page.waitForURL(/index\.html|\/$/);
  comprueba(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('apd.') && k !== 'apd.prueba.ultimo_uso').length === 0
    && APD_ARCHIVOS_PRUEBA.guardado().then((g) => !g.cuentas && !g.envios && !g.fotos)), t('menú de pruebas: «Empezar de cero» limpia la sesión y lo guardado'));
  // Del registro anterior: el menú abre «Crea tu cuenta» llenada con su CURP
  await page.click('.menu-pruebas-boton');
  await page.selectOption('#menu-pruebas-perfil', 'kobo');
  await page.selectOption('#menu-pruebas-persona', 'kobo-vigente');
  await page.click('dialog.menu-pruebas >> button:text-is("Entrar")');
  comprueba(await page.waitForURL(/cuenta\.html\?migrada=/).then(() => page.waitForFunction(() => document.getElementById('curp').value.length === 18)).then(() => true, () => false),
    t('menú de pruebas: un caso del registro anterior abre «Crea tu cuenta» llenada con su CURP'));
  // Crear cuenta: «Llenar con su CURP» crea la cuenta de alguien del registro anterior
  await page.goto(BASE + 'cuenta.html');
  await page.click('.menu-pruebas-boton');
  const migrada = datos.solicitante.find((p) => p.estado === 'sin_activar' && p.id !== renovable.id);
  await page.selectOption('#menu-pruebas-migrada', migrada.id);
  await page.click('dialog.menu-pruebas >> text=Llenar con su CURP');
  await page.click('dialog.menu-pruebas >> text=Cerrar');
  // La fotografía está en su paso, todavía oculto («Crea tu cuenta» por pasos, 24/10/2026)
  await page.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]', { state: 'attached' });
  await pulsaEnviar(page);
  await page.waitForSelector('[data-acuse]:not([hidden])');
  comprueba(await page.isVisible('[data-cuenta-historial]'), t('menú de pruebas: crea la cuenta de alguien del registro anterior con su CURP'));
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + 'cuenta.html');
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=Llenar con datos ficticios');
  await page.click('dialog.menu-pruebas >> text=Cerrar');
  await page.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]', { state: 'attached' });
  await pulsaEnviar(page);
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('menú de pruebas: «Llenar con datos ficticios» crea una cuenta válida'));

  // Fichas de «Mis solicitudes»: cada estado muestra lo que le sirve a la persona
  const personaCon = (estado, cond = () => true) => {
    const sol = datos.solicitud.find((x) => x.estado === estado && cond(x));
    return sol && datos.solicitante.find((p) => p.id === sol.solicitante_id && p.estado === 'activa');
  };
  const fichaDe = (texto) => page.locator('[data-solicitudes] .ficha, [data-anteriores] .ficha', { hasText: texto }).first();
  const emitida = personaCon('acreditada', (x) => datos.acreditacion.some((a) => a.solicitud_id === x.id));
  if (emitida) {
    await entra(page, emitida.curp);
    const f = await fichaDe('Acreditación emitida').textContent();
    // Emisión y vencimiento van en su tarjeta de «Mis acreditaciones», con el mismo número rotulado (D25)
    const a = (await page.locator('[data-acreditaciones] .ficha').allTextContents()).join(' ');
    comprueba(/Número de acreditación/.test(f) && !/Emitida el|Vence el/.test(f) && !/Sede|Calificación|Asistencia|Duración/.test(f) && /Número de acreditación/.test(a) && /Emitida el/.test(a),
      t('mis solicitudes: la acreditación emitida muestra su número, sin repetir la vigencia ni los datos del curso'));
    await page.click('[data-sesion] button');
  }
  const conGrupo = personaCon('inscrita', (x) => datos.inscripcion.some((i) => i.solicitud_id === x.id && i.activa && ['confirmado', 'en_curso'].includes(datos.grupo.find((g) => g.id === i.grupo_id).estado)));
  if (conGrupo) {
    await entra(page, conGrupo.curp);
    const ficha = fichaDe('Con grupo asignado');
    const f = await ficha.textContent();
    // Si el curso ya empezó no dice «Preséntate el …» sino en qué día va (auditoría 2026-10-18, D13); siempre, la fecha del examen
    const g = datos.grupo.find((x) => datos.inscripcion.some((i) => i.grupo_id === x.id && i.activa && datos.solicitud.some((s) => s.id === i.solicitud_id && s.solicitante_id === conGrupo.id)));
    const empezo = g && g.fecha_inicio <= datos.fecha_corte;
    comprueba((empezo ? /Tu curso empezó el/.test(f) && /Hoy es el día\s*\d+ de \d+/.test(f) && !/Preséntate el/.test(f) : /Preséntate el/.test(f) && /El curso termina el/.test(f))
      // En el curso de primera vez el último día es «Día 5: repaso de conocimientos y examen final» (sesión del 23/10/2026)
      && /(Examen|examen final)\s*(lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} de [a-z]+ de \d{4}/.test(f) && /Lugar del curso/.test(f) && !/Duración|Inicia el/.test(f),
      t(`mis solicitudes: con grupo, dice ${empezo ? 'en qué día del curso va' : 'cuándo presentarse'}, la fecha del examen y dónde`));
    comprueba(/identificación oficial/.test(f) && /examen/.test(f) && /al menos \d\.\d/.test(f) && await ficha.locator('ol.secuencia > li').count() >= 4,
      t('mis solicitudes: con grupo, «Qué sigue» dice que lleve la identificación, cuándo es el examen y la calificación mínima'));
    comprueba(/a las \d{2}:\d{2}/.test(f) && await ficha.locator('.datos-por-confirmar', { hasText: 'hora de entrada' }).count() === 0, t('mis solicitudes: con grupo confirmado, dice la hora de entrada (apd.grupo.hora_entrada)'));
    await page.click('[data-sesion] button');
  }
  const conCita = personaCon('validada_en_linea', citaSencilla);
  if (conCita) {
    await entra(page, conCita.curp);
    // La dirección de la sede ya no va por confirmar: la confirmó Liber el 23/10/2026 (P68)
    comprueba(await page.locator('[data-solicitudes] .datos-por-confirmar').count() === 3,
      t('mis solicitudes: concepto, monto y referencia del pago se marcan en amarillo, por confirmar; la dirección de la sede ya no'));
    comprueba(/Lugar de la cita\s*Vivero Nezahualcóyotl, Canal de Chalco s\/n, colonia Ciénega Grande, Alcaldía Xochimilco/.test(await page.textContent('[data-solicitudes]')),
      t('mis solicitudes: la cita es en el Vivero Nezahualcóyotl, con su dirección'));
    // D4 (auditoría 2026-10-18): fecha, hora y lugar al principio de la ficha, antes de los datos de pago; el paso con su fecha
    const cita = await page.$eval('[data-solicitudes] .ficha', (fi) => {
      const c = fi.querySelector('.ficha-cita'); const pago = Array.from(fi.querySelectorAll('.aviso')).find((x) => /Datos para tu pago/.test(x.textContent));
      return { antes: Boolean(c && pago && (c.compareDocumentPosition(pago) & Node.DOCUMENT_POSITION_FOLLOWING)), paso: (fi.querySelector('ol.secuencia') || {}).textContent || '' };
    });
    // Con fecha larga: es lo que la persona tiene que recordar (decisión 16 b del 20/10; C5-01)
    comprueba(cita.antes && /Acude a tu cita el (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} de [a-z]+ de \d{4} a las \d{2}:\d{2}/.test(cita.paso), t('mis solicitudes: la cita va antes de los datos de pago y «Acude a tu cita» dice cuándo, con fecha larga'));
    await page.click('[data-sesion] button');
  }
  comprueba(Boolean(emitida && conGrupo && conCita), t('mis solicitudes: hay ficticios para revisar las tres fichas'));

  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();

}

// ── Solicitud de la persona: regresos, borrador y documentos ya cargados (auditoría 2026-10-18: B2, B6, B7, B12, B13, D1) ──
// Persona activa sin trámite en curso ni acreditaciones: puede iniciar una solicitud de poda nueva
const libre = datos.solicitante.find((p) => p.estado === 'activa' && !datos.acreditacion.some((a) => a.solicitante_id === p.id)
  && !datos.solicitud.some((s) => s.solicitante_id === p.id && !FINALES.includes(s.estado)));
async function solicitudRegresos(navegador, ancho, alto, sufijo) {
  const contexto = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const page = await contexto.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${page.url()} · ${m.text()}`); });
  page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`));
  const t = (m) => `[solicitud ${sufijo}] ${m}`;
  const llega = (re) => page.waitForURL(re, { timeout: 5000 }).then(() => true, () => false);
  const enPaso = (re) => page.waitForFunction((r) => { const p = document.querySelector('section[data-paso]:not([hidden]) .titulo-paso'); return p && new RegExp(r).test(p.textContent); }, re, { timeout: 4000 }).then(() => true, () => false);

  // B7: un enlace con ?folio= sin sesión pasa por «Entrar» y regresa a la misma solicitud, con su folio
  await page.goto(BASE + `solicitud.html?folio=${conObs.folio}`);
  await page.waitForURL(/entrar\.html/);
  comprueba(new URL(page.url()).searchParams.get('volver') === `solicitud.html?folio=${conObs.folio}`, t('B7: «Entrar» conserva la consulta de la pantalla pedida (?folio=)'));
  await page.fill('#curp', persona(conObs.solicitante_id).curp);
  await page.fill('#contrasena', CONTRASENA);
  await page.click('[data-accion="enviar"]');
  comprueba(await llega(new RegExp(`solicitud\\.html\\?folio=${conObs.folio}$`)) && await enPaso('Carga tus documentos'), t('B7: después de entrar llega a la corrección de su solicitud'));
  // B6: «Mi perfil» regresa a la misma solicitud, con su folio, y el enlace dice a dónde lleva
  const perfil = await page.getAttribute('[data-adscripcion-info] a[href^="datos.html"]', 'href');
  await page.goto(BASE + perfil);
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(/Volver a tu solicitud/.test(await page.textContent('[data-volver]')) && await page.getAttribute('[data-volver]', 'href') === `solicitud.html?folio=${conObs.folio}`,
    t('B6: en «Mi perfil», el regreso dice «Volver a tu solicitud» y lleva a la misma solicitud, con su folio'));
  await page.click('[data-volver]');
  comprueba(await llega(new RegExp(`solicitud\\.html\\?folio=${conObs.folio}$`)) && await enPaso('Carga tus documentos') && await page.isHidden('[data-sin-opciones]'),
    t('B6: de regreso, la solicitud sigue disponible donde iba'));
  // P148 (estándar 1.5.0): lo que la página precarga al continuar una solicitud no crea un borrador; sólo la persona
  await page.waitForTimeout(800);
  comprueba(await page.isHidden('[data-franja-borrador]') && await page.evaluate((f) => !Object.keys(localStorage).some((k) => k.startsWith('apd.borrador.') && k.endsWith(`.${f}`)), conObs.folio),
    t('P148: continuar una solicitud precargada, sin tocar nada, no crea un borrador'));
  // D1: en la revisión, lo ya cargado se dice «Ya cargado», no «No indicado»
  for (const n of await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo))) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF);
    await page.waitForSelector(`[data-campo="${n}"] [data-archivos] .lista-arch li[data-estado="listo"]`);
  }
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  await page.waitForSelector('section[data-revision]:not([hidden])');
  const docsRev = await page.$eval('[data-revision-lista] [data-editar^="doc_"]', (b) => b.closest('.rev-bloque').textContent);
  comprueba(!/No indicado/.test(docsRev) && /Ya cargado:/.test(docsRev), t('D1: en «Revisa antes de enviar», lo que ya estaba cargado dice «Ya cargado: …», no «No indicado»'));
  await page.click('[data-sesion] button');

  // B2: «Atrás» del navegador regresa al paso anterior; al recargar, la franja ofrece seguir con lo capturado y los documentos
  await entra(page, libre.curp);
  await page.goto(BASE + 'solicitud.html');
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_nueva');
  comprueba(await page.isHidden('[data-franja-borrador]'), t('B2: sin nada capturado no hay borrador que ofrecer'));
  await page.selectOption('#nivel_estudios', 'tecnica');
  await page.fill('#carrera_tecnica', 'Técnico en jardinería');
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  const campos = await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of campos.slice(0, 2)) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF);
    await page.waitForSelector(`[data-campo="${n}"] .lista-arch li[data-estado="listo"]`);
  }
  await page.waitForTimeout(1000);
  await page.goBack();
  comprueba(await enPaso('Qué acreditación') && /solicitud\.html/.test(page.url()), t('B2: «Atrás» del navegador regresa al paso anterior, sin salir de la solicitud'));
  await page.goForward();
  comprueba(await enPaso('Carga tus documentos'), t('B2: «Adelante» vuelve al paso de documentos'));
  await page.reload();
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_nueva');
  comprueba(await page.isVisible('[data-franja-borrador]'), t('B2: al recargar, la franja ofrece seguir donde iba'));
  // 1.5.1: un solo botón guinda por pantalla; «Recuperar borrador» es secundario
  const recuperar = await page.$eval('[data-borrador="recuperar"]', (b) => ({ texto: b.textContent.trim(), clase: b.className }));
  comprueba(recuperar.texto === 'Recuperar borrador' && /btn-secundario/.test(recuperar.clase) && !/btn-primario/.test(recuperar.clase),
    t(`1.5.1: «Recuperar borrador» es un botón secundario (${recuperar.texto} · ${recuperar.clase})`));
  await page.click('[data-borrador="recuperar"]');
  const recuperados = await page.waitForFunction(() => document.querySelectorAll('[data-archivos] .lista-arch li[data-estado="listo"]').length === 2, null, { timeout: 5000 }).then(() => true, () => false);
  comprueba(recuperados && await enPaso('Carga tus documentos') && await page.inputValue('#carrera_tecnica') === 'Técnico en jardinería',
    t('B2: «Recuperar borrador» recupera el paso, lo escrito y los 2 documentos cargados'));
  comprueba(/Borrador recuperado/.test(await page.textContent('[data-borrador-recuperado]')) && await page.isVisible('[data-borrador-recuperado]'),
    t('B2: la recuperación se dice también en pantalla'));
  for (const n of campos.slice(2)) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, PDF);
    await page.waitForSelector(`[data-campo="${n}"] .lista-arch li[data-estado="listo"]`);
  }
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  await page.waitForSelector('section[data-revision]:not([hidden])');
  // B13: después de «Editar», «Continuar» regresa directo a la revisión
  await page.click('[data-revision-lista] [data-editar="nivel_estudios"]');
  const boton = await page.textContent(`${pasoVisible} [data-accion="siguiente"]`);
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(/Volver a la revisión/.test(boton) && await enPaso('Revisa antes de enviar'), t('B13: después de «Editar», «Volver a la revisión» regresa directo, sin recorrer los pasos'));
  await marcaCasillas(page);
  // P148 · el borrador del núcleo recupera la revisión con todos los documentos (proveedor de archivos), pero no las
  // declaraciones: se vuelven a marcar cada vez
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForSelector('[data-franja-borrador]:not([hidden])');
  await page.click('[data-borrador="recuperar"]');
  const todos = await page.waitForFunction((n) => document.querySelectorAll('[data-archivos] .lista-arch li[data-estado="listo"]').length === n, campos.length, { timeout: 5000 }).then(() => true, () => false);
  const marcadas = await page.$$eval('input[name="protesta"], input[name="aviso"], input[name="humano"]', (l) => l.filter((c) => c.checked).length);
  comprueba(todos && await enPaso('Revisa antes de enviar') && marcadas === 0,
    t(`P148: el borrador recupera la revisión con los ${campos.length} documentos y sin las declaraciones (${marcadas} marcadas)`));
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  comprueba(await page.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith('apd.borrador.') && k.endsWith('.nueva'))), t('B2: al enviar, el borrador se borra'));
  await page.goBack();
  comprueba(await llega(/tramites\.html/), t('B2: «Atrás» desde el acuse lleva a «Mis trámites», no al formulario enviado'));

  // B12: con la sesión abierta, el inicio y «Crea tu cuenta» llevan a «Mis trámites»
  await page.goto(BASE + 'index.html');
  comprueba(await page.waitForSelector('.menu-inicio a[href="tramites.html"]', { timeout: 3000 }).then(() => true, () => false) && await page.locator('.menu-inicio a[href="entrar.html"]').count() === 0,
    t('B12: con sesión, el inicio ofrece «Mis trámites» en lugar de «Crea tu cuenta» y «Entra»'));
  await page.goto(BASE + 'cuenta.html');
  comprueba(await page.waitForSelector('[data-con-sesion]:not([hidden]) a[href="tramites.html"]', { timeout: 3000 }).then(() => true, () => false),
    t('B12: con sesión, «Crea tu cuenta» dice con quién entraste y lleva a «Mis trámites»'));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();
}

// ── Etapa 2 · pantallas del personal: bandeja y revisión documental (decisiones 2026-10-16) ──
const enviadas = datos.solicitud.filter((s) => s.estado === 'enviada');
const porClasificar = enviadas.find((s) => s.perfil_academico === 'por_clasificar');
const noCumple = enviadas.find((s) => s.perfil_academico === 'no_cumple');
const reenviada = enviadas.find((s) => datos.revision.some((r) => r.solicitud_id === s.id));
const rechazada = datos.solicitud.find((s) => s.estado === 'rechazada');
/* Recorrido completo de la prueba, guardado en el navegador (decisión 2026-10-17): crear una cuenta con fotografía,
   cerrar la pestaña, entrar con SU contraseña en otra, enviar una solicitud de poda nueva con documentos reales y verla
   en la bandeja y en la revisión del personal con todos sus documentos y su fotografía. */
async function recorridoGuardado(navegador) {
  const contexto = await navegador.newContext({ timezoneId: ZONA, viewport: { width: 1440, height: 900 } });
  const t = (m) => `[guardado] ${m}`;
  const errores = [];
  const vigila = (page) => {
    page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`));
    // Lo guardado en el navegador que no se pudo aplicar (archivos-prueba.js lo avisa en la consola)
    page.on('console', (m) => { if (m.type() === 'warning' && /no se pudo aplicar lo guardado/.test(m.text())) errores.push(`${page.url()} · ${m.text()}`); });
    return page;
  };
  const real = { name: 'escaneado.pdf', mimeType: 'application/pdf', buffer: readFileSync(new URL('../datos/documentos/identificacion_oficial.pdf', import.meta.url)) };
  const P = { nombre: 'Rocío', primer_apellido: 'Guardado', segundo_apellido: 'Ejemplo', nacimiento: '1987-03-15' };
  P.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: P.nombre, primer: P.primer_apellido, segundo: P.segundo_apellido }, P.nacimiento, 'M', 'NE') + '0');
  // 1 · Crea su cuenta y cierra la pestaña
  let page = vigila(await contexto.newPage());
  await page.goto(BASE + 'cuenta.html');
  await llenaCuenta(page, P);
  await pulsaEnviar(page);
  await page.waitForSelector('[data-acuse]:not([hidden])');
  await page.close();
  // 2 · Otra pestaña: la sesión sigue; sale y vuelve a entrar con su propia contraseña
  page = vigila(await contexto.newPage());
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .vacio, [data-solicitudes] .ficha');
  comprueba(/ROCÍO GUARDADO|Rocío Guardado/i.test(await page.textContent('[data-sesion]')), t('la sesión sigue abierta en otra pestaña'));
  await page.click('[data-sesion] button');
  await page.goto(BASE + 'entrar.html');
  await page.fill('#curp', P.curp);
  await page.fill('#contrasena', CONTRASENA);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-estado-envio]:not([hidden])');
  bien(t('con la contraseña común de prueba no entra: la cuenta tiene la suya'));
  await page.fill('#contrasena', 'una frase larga de prueba');
  await page.click('[data-accion="enviar"]');
  await page.waitForURL(/tramites\.html/);
  bien(t('vuelve a entrar con la contraseña que puso al crear la cuenta'));
  // 3 · Envía una solicitud de poda nueva con documentos reales
  await page.goto(BASE + 'solicitud.html?tipo=poda');
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_nueva');
  await page.selectOption('#nivel_estudios', 'tecnica');
  await page.fill('#carrera_tecnica', 'Técnico en jardinería');
  await siguiente(page);
  const campos = await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of campos) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, real);
    await page.waitForSelector(`[data-campo="${n}"] .lista-arch li[data-estado="listo"]`);
  }
  await siguiente(page);
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  const folio = (await page.textContent('[data-acuse-folio]')).trim();
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  comprueba((await page.textContent('[data-solicitudes]')).includes(folio), t('«Mis trámites» muestra la solicitud enviada'));
  await page.close();
  // 4 · El personal, en otra pestaña: la ve primero y con todos sus documentos y la fotografía
  page = vigila(await contexto.newPage());
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(await page.getAttribute('[data-filas] tr:first-child', 'data-folio') === folio, t('la solicitud llega primero a la bandeja del personal'));
  await page.goto(BASE + `revisar.html?folio=${folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  // Por pasos (decisión de Liber del 24/10/2026): un paso por cada documento que cargó, no cuatro fijos
  const docs = (await docsRevision(page)).length;
  comprueba(docs === campos.length, t(`la revisión tiene un paso por cada uno de los ${campos.length} documentos que se cargaron`));
  await page.waitForSelector('[data-persona] .perfil-imagen');
  comprueba(await page.evaluate(() => { const i = document.querySelector('[data-persona] .perfil-imagen'); return i.complete && i.naturalWidth > 0; }),
    t('la revisión muestra la fotografía que cargó la persona'));
  // 5 · El personal observa un documento y acepta los demás; la confirmación queda a la vista, sin el visor
  const [primero, ...resto] = campos.map((c) => c.replace(/^doc_poda_nueva_/, ''));
  await decideDoc(page, primero, 'con_observacion', 'No se lee completo: vuelve a escanearlo.');
  for (const k of resto) await decideDoc(page, k, 'aceptado');
  await pulsaEnviar(page);
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  comprueba(!(await page.evaluate(() => document.querySelector('[data-visor]').open)) && await page.evaluate(() => document.querySelector('[data-hecho]:not(.pasos-btn)').getBoundingClientRect().top < window.innerHeight),
    t('al registrar, el visor se cierra y la confirmación queda a la vista'));
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector('[data-revisadas]:not([hidden])');
  comprueba(await page.locator(`[data-filas] tr[data-folio="${folio}"]`).count() === 0 && (await page.textContent('[data-revisadas-lista]')).includes(folio),
    t('la revisada sale de la bandeja y aparece en «Revisadas en esta prueba»'));
  // 6 · La persona ve sus observaciones en «Mis trámites»
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  const ficha = await page.locator('[data-solicitudes] .ficha', { hasText: folio }).textContent();
  comprueba(/Corrige y reenvía/.test(ficha) && /Lo que debes corregir/.test(ficha) && /vuelve a escanearlo/.test(ficha), t('la persona ve «Corrige y reenvía» y, arriba, qué corregir'));
  // 7 · Corrige y reenvía; el personal la revisa otra vez y la valida con su cita
  await page.goto(BASE + `solicitud.html?folio=${folio}`);
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_nueva');
  await siguiente(page);
  await page.setInputFiles(`[data-campo="doc_poda_nueva_${primero}"] [data-archivos] > input[type="file"]`, real);
  await page.waitForSelector(`[data-campo="doc_poda_nueva_${primero}"] .lista-arch li[data-estado="listo"]`);
  await siguiente(page);
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(/2\.ª \(reenviada\)/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t('la reenviada vuelve a la bandeja como 2.ª vuelta'));
  await page.goto(BASE + `revisar.html?folio=${folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  // 2.ª vuelta (decisión 2026-10-18): sólo se decide lo corregido; lo aceptado antes se ve, sin pedir decisión
  // Cada documento en su paso: el corregido pide decisión; los aceptados antes lo dicen, sin pedirla
  // (sin pasar de paso: avanzar pediría decidir antes el corregido)
  const pide = (k) => page.evaluate((x) => document.getElementById(`decidir_${x}`).value === 'si' && document.querySelector(`[data-doc="${x}"] [data-doc-previo]`).hidden, k);
  const pidenResto = []; for (const k of resto) pidenResto.push(await pide(k));
  comprueba(await pide(primero) && resto.every(Boolean) && !pidenResto.some(Boolean),
    t('2.ª vuelta: sólo se decide el documento corregido; los aceptados antes no se vuelven a revisar'));
  await decideDoc(page, primero, 'aceptado');
  await alPaso(page, 'Fecha de la cita');
  // Fecha día/mes/año (formato «fecha-dma», D9): el mínimo va en data-min del campo, como AAAA-MM-DD
  const dia = await page.getAttribute('[data-campo="cita_fecha"]', 'data-min');
  // Calendario (Liber, 18/10/2026): el botón abre el calendario del navegador con el mismo mínimo; lo elegido se escribe
  // en dd/mm/aaaa. El calendario nativo no se puede pulsar en la prueba: se elige la fecha en su control.
  await page.click('[data-calendario="cita_fecha"]');
  const nat = page.locator('[data-campo="cita_fecha"] .control-calendario-nativo');
  comprueba(await nat.getAttribute('min') === dia, t('el calendario de la cita toma el mismo mínimo que el campo'));
  await page.keyboard.press('Escape');
  await nat.evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('change', { bubbles: true })); }, dia);
  comprueba(await page.inputValue('#cita_fecha') === dia.split('-').reverse().join('/'), t('la fecha elegida en el calendario queda en dd/mm/aaaa'));
  await page.selectOption('#cita_hora', '12:30');
  await pulsaEnviar(page);
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  bien(t('la segunda revisión la valida con su cita'));
  // 8 · Cita de cotejo: aparece en la agenda de su día; un documento no coincide y la cita queda en pausa
  await page.goto(BASE + `citas.html?dia=${dia}`);
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(/Por atender/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t('la cita aparece en la agenda de su día, por atender'));
  await page.fill('#buscar', P.curp);
  // Se filtra al dejar de teclear (D4-04): se espera a que la agenda muestre los resultados de todos los días
  await page.waitForFunction(() => /todos los días/.test(document.querySelector('[data-dia]').textContent));
  comprueba(await page.isVisible(`[data-filas] tr[data-folio="${folio}"]`) && /todos los días/.test(await page.textContent('[data-dia]')), t('la búsqueda por CURP la encuentra en todos los días'));
  await abreCotejo(page, folio);
  await page.check('input[name="se_presento"][value="si"]', { force: true });
  await page.check('input[name="identidad"][value="misma"]', { force: true });
  await sigPaso(page);
  const aCotejar = await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
  comprueba(aCotejar.length === campos.length, t(`el cotejo pide los ${campos.length} documentos`));
  const [distinto, ...iguales] = aCotejar;
  for (const k of iguales) await page.check(`input[name="coincide_${k}"][value="si"]`, { force: true });
  await page.check(`input[name="coincide_${distinto}"][value="no"]`, { force: true });
  await page.fill(`#diferencia_${distinto}`, 'Trae una versión distinta de la que cargó.');
  await page.check('input[name="hoy_documento"][value="si"]', { force: true });
  await sigPaso(page);
  comprueba(await tituloPaso(page) === 'Resultado' && !(await page.isVisible('[data-campo="pago"]')), t('con un documento que no coincide no se pregunta por el pago: de los documentos se pasa al resultado'));
  comprueba((await page.textContent('[data-accion="enviar"]')).trim() === 'Poner la cita en pausa', t('el botón dice «Poner la cita en pausa»'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])', { timeout: 8000 }).catch(async (e) => {
    if (process.env.CAPTURA_FALLA) await page.screenshot({ path: process.env.CAPTURA_FALLA, fullPage: true });
    throw e;
  });
  // 9 · La persona ve la pausa, carga el documento correcto y el personal lo ve para retomar
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  const enPausa = await page.locator('[data-solicitudes] .ficha', { hasText: folio }).textContent();
  comprueba(/Cita en pausa/.test(enPausa) && /versión distinta/.test(enPausa), t('la persona ve «Cita en pausa» y qué no coincidió'));
  // Alta 6 de la auditoría integral: al día siguiente, la persona ve que la pausa venció y ya no puede cargar
  const otroDia = (() => { const d = new Date(`${dia}T12:00:00-06:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  await page.route('**/datos/ficticios.json*', async (r) => { const res = await r.fetch(); const j = await res.json(); j.fecha_corte = otroDia; await r.fulfill({ response: res, json: j }); });
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  const vencida = page.locator('[data-solicitudes] .ficha', { hasText: folio });
  comprueba(/La pausa venció/.test(await vencida.textContent()) && await vencida.locator(`a[href^="corregir.html"]`).count() === 0, t('al día siguiente: «La pausa venció», sin «Cargar el documento»'));
  await page.goto(BASE + `corregir.html?folio=${folio}`);
  await page.waitForFunction(() => /venció/.test(document.querySelector('[data-cargando]').textContent));
  comprueba(await page.isHidden('#formulario'), t('al día siguiente, «Cargar el documento» dice que la pausa venció y no deja cargar'));
  await page.unroute('**/datos/ficticios.json*');
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  await page.click(`a[href="corregir.html?folio=${folio}"]`);
  await page.waitForSelector('#formulario:not([hidden])');
  comprueba(await page.$$eval('[data-campo^="doc_"]', (els) => els.filter((e) => e.offsetParent !== null).length) === 1, t('«Cargar el documento correcto» pide sólo el que no coincidió'));
  await page.setInputFiles(`[data-campo="doc_${distinto}"] [data-archivos] > input[type="file"]`, real);
  await page.waitForSelector(`[data-campo="doc_${distinto}"] .lista-arch li[data-estado="listo"]`);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  await page.goto(BASE + `citas.html?dia=${dia}`);
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(/Documento cargado/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t('la agenda dice «Documento cargado · retomar»'));
  // 10 · Retoma: sólo ese documento; con el pago y la factura, el cotejo termina y se abre el expediente
  await abreCotejo(page, folio);
  comprueba(await page.locator('[data-campo="se_presento"], [data-campo="identidad"]').count() === 0 && await tituloPaso(page) === 'Documentos originales'
    && await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).length) === 1, t('al retomar sólo se coteja el documento que no coincidió (sin el paso «¿Es la persona?»)'));
  await page.check(`input[name="coincide_${distinto}"][value="si"]`, { force: true });
  await sigPaso(page);
  await page.check('input[name="pago"][value="si"]', { force: true });
  await page.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', real);
  await page.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
  await page.fill('#factura_rfc', 'XAXX010101000');
  await page.fill('#factura_razon_social', 'Rocío Guardado Ejemplo');
  comprueba(/UUID/.test(await page.textContent('[data-campo="factura_folio_fiscal"] .ayuda')), t('cotejo: la ayuda del folio fiscal dice que también se llama UUID'));
  await page.fill('#factura_folio_fiscal', '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f');
  await sigPaso(page);
  // El número lo da el sistema al terminar, no se anticipa al abrir (auditoría «intentar romperlo», F2 A4)
  comprueba(/se abre su expediente físico/.test(await page.textContent('[data-resumen]')) && !(await page.textContent('[data-resumen]')).includes('EXP-'),
    t('el resultado anuncia que se abre el expediente, sin anticipar un número que puede tomar otra ventanilla'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  const exp = (await page.textContent('[data-hecho]:not(.pasos-btn)')).match(/EXP-\d{4}-\d{4}/);
  comprueba(Boolean(exp), t(`el cotejo terminado muestra el expediente${exp ? ' ' + exp[0] : ''}`));
  const pasos = await page.$$eval('[data-hecho]:not(.pasos-btn) ol.secuencia > li', (l) => l.map((x) => x.textContent));
  comprueba(pasos.length === 3 && /expediente físico/.test(pasos[0]) && /grupo/.test(pasos[1]) && /Qué sigue/.test(await page.textContent('[data-hecho]:not(.pasos-btn)')),
    t('el cotejo terminado dice qué sigue en pasos numerados, no en un párrafo'));
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  const lista = await page.locator('[data-solicitudes] .ficha', { hasText: folio }).textContent();
  comprueba(/En espera de curso/.test(lista) && exp && lista.includes(exp[0]), t('la persona ve «En espera de curso» y su número de expediente'));
  comprueba(await page.locator('[data-solicitudes] .ficha', { hasText: folio }).locator('ol.secuencia > li').count() === 3, t('«Mis trámites»: lo que sigue después del cotejo va en pasos numerados'));
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-foto-estado] .estado');
  comprueba(/confirmada/i.test(await page.textContent('[data-foto-estado]')), t('en «Mi perfil» su fotografía queda confirmada'));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();
}

/* Los otros caminos de la cita de cotejo (decisiones 2026-10-17), sobre las dos citas ficticias: cada uno en su propio
   navegador limpio */
async function caminosCotejo(navegador) {
  const t = (m) => `[cotejo] ${m}`;
  const citas = datos.solicitud.filter((x) => x.estado === 'validada_en_linea' && x.cita_en);
  const [s1] = citas;
  const p1 = persona(s1.solicitante_id);
  const nuevo = async (ancho = 1280) => {
    const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: 900 } });
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'warning' && /no se pudo aplicar lo guardado/.test(m.text())) errores.push(m.text()); });
    return { c, pg, errores };
  };
  const abre = (pg, folio) => abreCotejo(pg, folio);
  const registra = async (pg) => { await pulsaEnviar(pg); await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])'); };
  // Por pasos (decisión de Liber del 24/10/2026): «¿Es la persona?» y «Documentos originales» con todo igual
  const llegaYCoteja = async (pg) => {
    await pg.check('input[name="se_presento"][value="si"]', { force: true });
    await pg.check('input[name="identidad"][value="misma"]', { force: true });
    await sigPaso(pg);
    return pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
  };

  // B2-01 (decisión 7 de la auditoría del 2026-10-19): el encabezado de cada día de la agenda desglosa por resultado de la
  // cita (apd.cita.resultado), como lo contaría la base: «8 citas: 7 atendidas, 1 no se presentó»
  {
    const { c, pg } = await nuevo();
    const diaMX = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA });
    const porDia = {};
    for (const x of datos.cita) {
      const d = diaMX(x.programada_en);
      const abierta = ['pendiente', 'en_pausa'].includes(x.resultado);
      // La pausa del día va aparte de «por atender» (auditoría 2026-10-20, C4-08)
      const k = x.resultado === 'en_pausa' && d < datos.fecha_corte ? 'pausa_vencida' : x.resultado === 'en_pausa' ? 'en_pausa' : abierta ? 'pendiente' : x.resultado;
      (porDia[d] ||= {})[k] = (porDia[d][k] || 0) + 1;
    }
    const ORDEN = [['atendida', 'atendida', 'atendidas'], ['no_se_presento', 'no se presentó', 'no se presentaron'], ['sin_pago', 'sin pago', 'sin pago'],
      ['pausa_vencida', 'pausa vencida', 'pausas vencidas'], ['cancelada', 'cancelada', 'canceladas'], ['pendiente', 'por atender', 'por atender'], ['en_pausa', 'en pausa', 'en pausa']];
    let iguales = 0;
    const distintos = [];
    for (const [d, k] of Object.entries(porDia).sort()) {
      const n = Object.values(k).reduce((a, b) => a + b, 0);
      const esperado = `${n === 1 ? '1 cita' : `${n} citas`}: ${ORDEN.filter(([r]) => k[r]).map(([r, uno, varios]) => `${k[r]} ${k[r] === 1 ? uno : varios}`).join(', ')}.`;
      await pg.goto(BASE + `citas.html?dia=${d}`);
      await pg.waitForSelector('[data-filas] tr', { state: 'attached' });
      const leido = ((await pg.textContent('[data-cuenta]')) || '').trim();
      if (leido === esperado) iguales += 1; else distintos.push(`${d}: «${leido}» ≠ «${esperado}»`);
    }
    comprueba(!distintos.length && iguales > 10, t(`el encabezado de cada día (${iguales}) desglosa por resultado, como la base${distintos.length ? ': ' + distintos.join('; ') : ''}`));
    comprueba(/8 citas: 7 atendidas, 1 no se presentó\./.test(((await (async () => { await pg.goto(BASE + 'citas.html?dia=2026-10-06'); await pg.waitForSelector('[data-filas] tr', { state: 'attached' }); return pg.textContent('[data-cuenta]'); })()) || '')),
      t('el 06/10: «8 citas: 7 atendidas, 1 no se presentó» (no «8 atendidas»)'));
    await c.close();
  }
  // Día/mes/año: la fecha de la cita nueva usa el formato «fecha-dma» del estándar (D9)
  // La cita nueva no queda antes de la perdida (F2 A6): el día siguiente al de la cita (en la prueba se atiende «como si
  // fuera su día»)
  const manana = (() => { const d = new Date(`${s1.cita_en.slice(0, 10)}T12:00:00-06:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10).split('-').reverse().join('/'); })();

  // No se presenta dos veces: cita nueva, y a la segunda la solicitud se cierra (con confirmación)
  let { c, pg, errores } = await nuevo(390);
  await abre(pg, s1.folio);
  await sinDesborde(pg, t('cotejo en teléfono'));
  await pg.check('input[name="se_presento"][value="no"]', { force: true });
  comprueba(!(await pg.isVisible('[data-campo="identidad"]')), t('si no se presentó no se pregunta la identidad'));
  await sigPaso(pg);
  comprueba(await tituloPaso(pg) === 'Resultado' && await pg.isVisible('#cita_fecha'), t('si no se presentó, de «¿Es la persona?» se pasa al resultado, que sólo pide la cita nueva'));
  await pg.fill('#cita_fecha', manana);
  await pg.selectOption('#cita_hora', '09:30');
  await registra(pg);
  await entra(pg, p1.curp);
  const f1 = await pg.locator('[data-solicitudes] .ficha', { hasText: s1.folio }).textContent();
  comprueba(/No te presentaste/.test(f1) && /09:30/.test(f1) && f1.indexOf('No te presentaste') < f1.indexOf('Datos para tu pago') && /Acude a tu cita nueva/.test(f1) && !/\.\./.test(f1),
    t('la persona ve arriba de la ficha que no se presentó y su cita nueva, con la etiqueta «Acude a tu cita nueva» y sin «..»'));
  comprueba(/no pagues otra vez/.test(f1) && !/Paga los derechos e imprime/.test(f1), t('cita nueva: si ya pagó, se le dice que no pague otra vez (alta 3)'));
  await abre(pg, s1.folio);
  comprueba(/No se presentó a su cita/.test(await pg.textContent('[data-antecedente]')), t('la segunda cita avisa la inasistencia anterior'));
  await pg.check('input[name="se_presento"][value="no"]', { force: true });
  await sigPaso(pg);
  comprueba((await pg.textContent('[data-accion="enviar"]')).trim() === 'Cerrar la solicitud', t('a la segunda inasistencia el botón es «Cerrar la solicitud»'));
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('dialog[open] .btn-peligro, .modal [data-si], dialog[open]');
  await pg.click('dialog[open] .btn-peligro');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  await pg.goto(BASE + 'tramites.html');
  await pg.waitForSelector('[data-anteriores] .ficha');
  comprueba(/Cerrada: no te presentaste/.test(await pg.locator('[data-anteriores] .ficha', { hasText: s1.folio }).textContent())
    && await pg.isVisible('#t-anteriores') && await pg.locator('[data-solicitudes] .ficha', { hasText: s1.folio }).count() === 0,
    t('a la segunda inasistencia la persona ve «Cerrada: no te presentaste», en «Solicitudes anteriores»'));
  comprueba(errores.length === 0, t(`inasistencias sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // Sin comprobante de pago: otra cita, con el mismo monto
  ({ c, pg, errores } = await nuevo());
  await abre(pg, s1.folio);
  for (const k of await llegaYCoteja(pg)) await pg.check(`input[name="coincide_${k}"][value="si"]`, { force: true });
  await sigPaso(pg);
  await pg.check('input[name="pago"][value="no"]', { force: true });
  comprueba(!(await pg.isVisible('[data-campo="factura_rfc"]')), t('sin pago no se pide factura'));
  await sigPaso(pg);
  comprueba((await pg.textContent('[data-accion="enviar"]')).trim() === 'Darle otra cita', t('sin pago, el botón del resultado es «Darle otra cita»'));
  await pg.fill('#cita_fecha', manana);
  await pg.selectOption('#cita_hora', '11:00');
  await registra(pg);
  await pg.goto(BASE + `citas.html?dia=${s1.cita_en.slice(0, 10)}`);
  // La misma solicitud tiene dos filas: la cita atendida (ese día) y la nueva (otro día)
  await pg.waitForSelector(`[data-filas] tr[data-folio="${s1.folio}"]:not([hidden])`);
  comprueba(/Sin pago/.test(await pg.textContent(`[data-filas] tr[data-folio="${s1.folio}"]:not([hidden])`)), t('la agenda registra la cita como «Sin pago · cita nueva»'));
  await entra(pg, p1.curp);
  const f2 = await pg.locator('[data-solicitudes] .ficha', { hasText: s1.folio }).textContent();
  comprueba(/No presentaste tu comprobante/.test(f2) && /no pagues otra vez/.test(f2) && !/Paga los derechos con los mismos datos/.test(f2), t('sin comprobante: «Si ya pagaste… no pagues otra vez» (alta 3)'));
  await c.close();

  // Un documento no coincide y no lo puede traer hoy: regresa con observaciones
  ({ c, pg, errores } = await nuevo());
  await abre(pg, s1.folio);
  const ks = await llegaYCoteja(pg);
  await pg.check(`input[name="coincide_${ks[0]}"][value="no"]`, { force: true });
  await pg.fill(`#diferencia_${ks[0]}`, 'El original tiene otra fecha de expedición.');
  for (const k of ks.slice(1)) await pg.check(`input[name="coincide_${k}"][value="si"]`, { force: true });
  await pg.check('input[name="hoy_documento"][value="no"]', { force: true });
  await registra(pg);
  await entra(pg, p1.curp);
  const fPago = await pg.locator('[data-solicitudes] .ficha', { hasText: s1.folio }).textContent();
  comprueba(/Corrige y reenvía/.test(fPago) && /cita de cotejo/.test(fPago) && /otra fecha de expedición/.test(fPago), t('la persona ve que en su cotejo un documento no coincidió'));
  await c.close();

  // No es la persona: no se atiende, se confirma y la cuenta queda bloqueada
  ({ c, pg, errores } = await nuevo());
  await abre(pg, s1.folio);
  await pg.check('input[name="se_presento"][value="si"]', { force: true });
  await pg.check('input[name="identidad"][value="no_es"]', { force: true });
  await pg.fill('#nota_identidad', 'La identificación muestra a otra persona distinta de la fotografía.');
  await sigPaso(pg);
  comprueba(await tituloPaso(pg) === 'Resultado' && await pg.evaluate(() => document.getElementById('pedir_documentos').value === 'no'), t('si no es la persona no se cotejan documentos: se pasa al resultado'));
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('dialog[open] .btn-peligro');
  await pg.click('dialog[open] .btn-peligro');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  await pg.goto(BASE + 'entrar.html');
  await pg.fill('#curp', p1.curp);
  await pg.fill('#contrasena', CONTRASENA);
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-estado-envio]:not([hidden])');
  comprueba(/bloqueada/.test(await pg.textContent('[data-estado-envio]')), t('la cuenta queda bloqueada: al entrar se le dice'));
  comprueba(errores.length === 0, t(`caminos del cotejo sin errores${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();
}

async function personal(navegador, ancho, alto, sufijo) {
  const contexto = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const page = await contexto.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${page.url()} · ${m.text()}`); });
  page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`));
  const t = (m) => `[${sufijo}] personal: ${m}`;
  comprueba(Boolean(porClasificar && noCumple && reenviada && rechazada), t('hay ficticios de carrera por clasificar, perfil que no cumple, reenviada y rechazada'));
  const visibles = () => page.$$eval('[data-filas] tr:not([hidden])', (f) => f.map((x) => x.dataset.folio));

  // Bandeja
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector('[data-filas] tr');
  const folios = await visibles();
  comprueba(folios.length === enviadas.length, t(`la bandeja muestra las ${enviadas.length} solicitudes enviadas`));
  const orden = [...enviadas].sort((a, b) => a.estado_desde.localeCompare(b.estado_desde)).map((x) => x.folio);
  comprueba(folios.join() === orden.join(), t('la bandeja va de la que más espera a la más reciente'));
  comprueba(/Folio de la solicitud/.test(await page.textContent('thead')), t('la columna se llama «Folio de la solicitud»'));
  const fila = (f) => page.locator(`[data-filas] tr[data-folio="${f}"]`);
  comprueba(/Carrera por clasificar/.test(await fila(porClasificar.folio).textContent()), t('señala la carrera por clasificar'));
  comprueba(/Podría no cumplir el perfil/.test(await fila(noCumple.folio).textContent()), t('señala el perfil que podría no cumplir'));
  comprueba(/2\.ª \(reenviada\)/.test(await fila(reenviada.folio).textContent()) && /documento corregido/.test(await fila(reenviada.folio).textContent()), t('señala la reenviada y lo que corrigió'));
  const pB = datos.solicitante.find((x) => x.id === porClasificar.solicitante_id);
  for (const [q, nombre] of [[pB.curp.toLowerCase(), 'CURP'], [porClasificar.folio.slice(-5), 'folio'], [pB.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), 'nombre sin acentos']]) {
    await page.fill('#buscar', q);
    comprueba((await visibles()).includes(porClasificar.folio), t(`la búsqueda encuentra por ${nombre}`));
  }
  if (pB.numero_expediente) { await page.fill('#buscar', pB.numero_expediente); comprueba((await visibles()).join() === porClasificar.folio, t('la búsqueda encuentra por número de expediente')); }
  await page.fill('#buscar', 'zzzz');
  comprueba(await page.isVisible('[data-tabla-vacia]'), t('sin coincidencias lo dice'));
  await page.fill('#buscar', '');
  if (ancho < 760) {
    comprueba(!(await page.isVisible('#f_tipo')), t('en teléfono los filtros quedan plegados'));
    await page.click('[data-filtrar]');
  }
  await page.selectOption('#f_tipo', 'dictaminador');
  comprueba((await visibles()).every((f) => datos.solicitud.find((x) => x.folio === f).tipo_acreditacion === 'dictaminador'), t('filtra por acreditación'));
  if (ancho < 760) comprueba(/1 activo/.test(await page.textContent('[data-filtrar]')), t('«Filtrar» dice cuántos filtros están activos'));
  await page.selectOption('#f_tipo', '');
  await page.selectOption('#f_modalidad', 'renovacion');
  comprueba((await visibles()).every((f) => datos.solicitud.find((x) => x.folio === f).modalidad === 'renovacion'), t('filtra renovaciones'));
  await page.selectOption('#f_modalidad', '');
  await page.selectOption('#f_vuelta', 'reenviada');
  // Todas las enviadas con alguna revisión (desde los ajustes del equipo, 25/10/2026, también la de su segunda corrección)
  const reenviadas = enviadas.filter((s) => datos.revision.some((r) => r.solicitud_id === s.id)).map((s) => s.folio).sort();
  comprueba((await visibles()).slice().sort().join() === reenviadas.join() && reenviadas.includes(reenviada.folio), t('filtra las reenviadas'));
  await sinDesborde(page, t('bandeja'));
  await captura(page, `40-personal-bandeja-${sufijo}`);

  // Carrera por clasificar: afín → todo aceptado → validar con cita
  await page.goto(BASE + `revisar.html?folio=${porClasificar.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  // Visor (decisión 2026-10-16): todas las hojas; en computadora, fijo a la derecha y abierto de entrada con el comprobante
  // de estudios cuando hay que decidir el perfil (primer paso, «Perfil»); en pantalla chica, a pantalla completa al pedirlo
  const hojasDe = { comprobante_estudios: 2, comprobantes_experiencia: 5, curp: 1 };
  if (ancho >= 1024) {
    await page.waitForSelector('.visor-lienzo');
    comprueba(await page.isVisible('[data-visor]') && await page.textContent('[data-visor-titulo]') === 'Comprobante de estudios'
      && await page.locator('.visor-lienzo').count() === hojasDe.comprobante_estudios, t('el visor abre el comprobante de estudios con todas sus hojas'));
    comprueba(await page.evaluate(() => document.activeElement === document.body), t('abrir el visor no quita el foco'));
    comprueba(await page.textContent('[data-visor-pagina]') === `Hoja 1 de ${hojasDe.comprobante_estudios}`, t('el visor dice en qué hoja va'));
    // El visor del estándar (P67) vuelve a dibujar cada hoja al tamaño del acercamiento: el lienzo crece
    const anchoAntes = await page.evaluate(() => document.querySelector('.visor-lienzo').width);
    await page.click('[data-visor-accion="acercar"]');
    await page.waitForFunction(() => document.querySelector('[data-visor-zoom]').textContent === '125 %');
    await page.waitForFunction((a) => { const l = document.querySelector('.visor-lienzo'); return l && l.width > a * 1.2; }, anchoAntes, { timeout: 5000 }).catch(() => {});
    comprueba(await page.evaluate((a) => document.querySelector('.visor-lienzo').width > a * 1.2, anchoAntes), t('el visor acerca'));
    await captura(page, `43-personal-visor-${sufijo}`);
  } else {
    comprueba(!(await page.isVisible('[data-visor]')), t('en pantalla chica el visor no ocupa lugar hasta pedirlo'));
    await page.click('[data-ver="comprobante_estudios"]');
    await page.waitForSelector('.visor-lienzo');
    comprueba(await page.evaluate(() => document.querySelector('[data-visor]').matches(':modal')), t('en pantalla chica el visor se abre a pantalla completa'));
    await captura(page, `43-personal-visor-${sufijo}`);
    await page.keyboard.press('Escape');
    comprueba(await page.evaluate(() => document.activeElement.dataset.ver === 'comprobante_estudios'), t('al cerrar el visor, el foco vuelve a «Ver el comprobante de estudios»'));
  }
  // Por pasos (decisión de Liber del 24/10/2026): del perfil no se pasa sin decidirlo
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(await page.locator('[aria-invalid="true"]').count() > 0 && await tituloPaso(page) === 'Perfil', t('avanzar sin decidir el perfil muestra lo que falta'));
  await page.check('input[name="clasificacion"][value="afin"]', { force: true });
  comprueba(/2 años/.test(await page.textContent('[data-minimo]')), t('al clasificar como afín se piden 2 años'));
  await sigPaso(page);
  const primerDoc = (await docsRevision(page))[0];
  comprueba(await tituloPaso(page) !== 'Perfil' && await page.isVisible(`[data-doc="${primerDoc}"] input[name="decision_${primerDoc}"]`), t('«Revisar los documentos» lleva al paso del primer documento'));
  if (ancho >= 1024) {
    await page.waitForFunction((k) => document.querySelector(`[data-doc="${k}"]`).hasAttribute('data-viendo'), primerDoc);
    bien(t('en computadora, al llegar al paso de un documento el visor lo muestra al lado'));
  }
  // Al decir que tiene un problema: sin escribir qué corregir no se avanza (decisión 2026-10-17). Los anteriores se aceptan
  // en su orden: avanzar pide decidir cada paso
  for (const k of (await docsRevision(page)).slice(0, (await docsRevision(page)).indexOf('curriculum_vitae'))) await decideDoc(page, k, 'aceptado');
  await decideDoc(page, 'curriculum_vitae', 'con_observacion');
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  comprueba(await tituloPaso(page) === 'Currículum vitae' && await page.getAttribute('#observacion_curriculum_vitae', 'aria-invalid') === 'true', t('al decir que tiene un problema, sin escribir qué corregir no avanza'));
  await page.fill('#observacion_curriculum_vitae', 'Falta la última página del currículum.');
  await sigPaso(page);
  comprueba(await tituloPaso(page) !== 'Currículum vitae', t('con lo que se le dirá escrito, «Siguiente documento» pasa al siguiente'));
  for (const d of datos.documento.filter((x) => x.solicitud_id === porClasificar.id && x.vigente)) await decideDoc(page, d.requisito, 'aceptado');
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Validar y dar la cita', t('con todo aceptado, la acción es validar'));
  await alPaso(page, 'Fecha de la cita');
  await page.fill('#cita_fecha', '21/10/2026'); await page.selectOption('#cita_hora', '10:00');
  await captura(page, `41-personal-validar-${sufijo}`);
  // Tras una captura de página completa, Chromium sin ventana desplaza la página al enfocar: se enfoca antes de pulsar
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  comprueba(/Validada: cita el/.test(await page.textContent('[data-hecho]:not(.pasos-btn) .resultado-titulo')) && await page.$eval('[data-hecho]:not(.pasos-btn)', (x) => x.classList.contains('resultado-ok'))
    && /Quedó guardado a las \d{2}:\d{2} · /.test(await page.textContent('[data-hecho]:not(.pasos-btn) .resultado-meta')),
    t('valida y asigna la cita: resultado del estándar en verde, con «Quedó guardado a las HH:MM · quien»'));

  // Perfil que no cumple, opción C: el comprobante muestra otro grado → se observa el comprobante
  await page.goto(BASE + `revisar.html?folio=${noCumple.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  await page.check('input[name="comprobante_confirma"][value="no"]', { force: true });
  comprueba(await page.isChecked('input[name="decision_comprobante_estudios"][value="con_observacion"]') && (await page.inputValue('#observacion_comprobante_estudios')).length > 20,
    t('si el comprobante muestra otro grado, se observa el comprobante con un texto propuesto'));
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Enviar las observaciones a la persona', t('con una observación, la acción es enviar las observaciones'));
  // … o lo confirma → rechazo con motivo y confirmación: del perfil se pasa al resultado, sin los documentos
  await page.check('input[name="comprobante_confirma"][value="si"]', { force: true });
  await sigPaso(page);
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Rechazar la solicitud' && await tituloPaso(page) === 'Resultado' && !(await page.isVisible('input[name="decision_curp"]')),
    t('si el comprobante lo confirma, se rechaza sin revisar los documentos (del perfil al resultado)'));
  comprueba(/licenciatura trunca|preparatoria|secundaria|primaria/i.test(await page.inputValue('#motivo_rechazo')), t('el motivo del rechazo viene propuesto'));
  await captura(page, `42-personal-rechazo-${sufijo}`);
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('dialog[role="alertdialog"]');
  await page.click('dialog [data-r="no"]');
  comprueba(await page.isVisible('#formulario'), t('cancelar la confirmación no rechaza'));
  await page.click('[data-accion="enviar"]');
  await page.click('dialog [data-r="si"]');
  await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  comprueba(/Rechazada/.test(await page.textContent('[data-hecho]:not(.pasos-btn) .resultado-titulo')) && await page.$eval('[data-hecho]:not(.pasos-btn)', (x) => x.classList.contains('resultado-rechazo'))
    && (await page.locator('[data-hecho]:not(.pasos-btn) .resultado-motivo').count()) === 1, t('rechaza al confirmar: resultado en rojo con el motivo citado, distinto de la validación'));

  // Reenviada: vueltas anteriores y documento corregido
  await page.goto(BASE + `revisar.html?folio=${reenviada.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  comprueba(await page.isVisible('[data-anteriores]') && await page.locator('.doc-corregido').count() >= 1, t('la reenviada muestra la revisión anterior y lo corregido'));
  comprueba(await page.locator('[data-perfil]').count() === 0, t('en poda no hay paso de perfil'));
  // La CURP se aceptó en la 1.ª vuelta: su paso lo dice; para observarla hay que reabrirla
  await alPasoDe(page, '[data-doc="curp"]');
  comprueba(await page.isHidden('input[name="decision_curp"]') && await page.isVisible('[data-doc="curp"] [data-doc-previo]') && /Aceptado antes/.test(await page.textContent('[data-doc="curp"] .estado')), t('la reenviada no vuelve a pedir la CURP aceptada antes'));
  await page.click('[data-reabrir="curp"]');
  await page.check('input[name="decision_curp"][value="con_observacion"]', { force: true });
  await page.click('[data-campo="observacion_curp"] [data-chip-fijo]');
  comprueba(/\.$/.test(await page.inputValue('#observacion_curp')), t('un motivo frecuente se agrega a la observación'));
  await sinDesborde(page, t('revisión'));

  // La bandeja ya no muestra lo revisado en la prueba
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector('[data-revisadas]:not([hidden])');
  comprueba(!(await visibles()).includes(porClasificar.folio), t('lo revisado sale de la bandeja en esta pestaña'));

  // La persona ve el rechazo con su motivo
  const pR = datos.solicitante.find((x) => x.id === rechazada.solicitante_id);
  await entra(page, pR.curp);
  const f = await page.locator('[data-anteriores] .ficha', { hasText: 'Rechazada' }).textContent();
  comprueba(/Motivo del rechazo/.test(f) && /solicitud nueva/.test(f), t('«Mis trámites» muestra la solicitud rechazada con su motivo'));

  // Versión de prueba sin servidor: lo que la persona carga en este navegador se ve en la revisión (decisión 2026-10-16).
  // Se envía una solicitud de dictaminador con un PDF real de tres hojas y se revisa con ese mismo archivo.
  const real = { name: 'constancia-escaneada.pdf', mimeType: 'application/pdf', buffer: readFileSync(new URL('../datos/documentos/constancia_situacion_fiscal.pdf', import.meta.url)) };
  await entra(page, paraDictaminador.curp);
  await page.goto(BASE + 'solicitud.html?tipo=dictaminador');
  await page.waitForFunction(() => document.getElementById('tramite').value === 'dictaminador_nueva');
  await page.selectOption('#nivel_estudios', 'licenciatura');
  await page.fill('#carrera', 'Biología');
  await page.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
  await page.fill('#anios_experiencia', '3');
  await siguiente(page);
  const campos = await page.$$eval(`${pasoVisible} [data-campo^="doc_"][data-requerido]`, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.dataset.campo));
  for (const n of campos) {
    await page.setInputFiles(`[data-campo="${n}"] [data-archivos] > input[type="file"]`, real);
    await page.waitForSelector(`[data-campo="${n}"] .lista-arch li`);
  }
  await siguiente(page);
  await marcaCasillas(page);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  const folioReal = (await page.textContent('[data-acuse-folio]')).trim();
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector(`[data-filas] tr[data-folio="${folioReal}"]`);
  comprueba(/Archivos cargados en este navegador/.test(await page.textContent(`[data-filas] tr[data-folio="${folioReal}"]`)),
    t('la solicitud enviada en este navegador llega a la bandeja, señalada'));
  comprueba(await page.getAttribute('[data-filas] tr:first-child', 'data-folio') === folioReal && !/-\d+ día/.test(await page.textContent(`[data-filas] tr[data-folio="${folioReal}"]`)),
    t('lo enviado en este navegador va primero en la bandeja y su espera no sale negativa'));
  await page.goto(BASE + `revisar.html?folio=${folioReal}`);
  await page.waitForSelector('#formulario:not([hidden])');
  await decideDoc(page, 'identificacion_oficial', 'aceptado');
  await alPasoDe(page, '[data-ver="curp"]');
  await page.click('[data-ver="curp"]');
  await page.waitForFunction(() => document.querySelectorAll('.visor-lienzo').length === 3);
  const lineaDoc = await page.textContent('[data-doc="curp"] [data-doc-archivo]');
  comprueba(/se cargó en este navegador/.test(await page.textContent('[data-visor-nota]')) && /^CURP_/.test(lineaDoc.trim()) && !/constancia-escaneada/.test(lineaDoc),
    t('el visor muestra el archivo real que se cargó, con sus tres hojas; la revisión muestra el nombre nuevo, no el original (decisión 2026-10-17)'));
  await captura(page, `44-personal-archivo-real-${sufijo}`);

  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();
}

// CHROMIUM: ruta a un Chromium ya instalado, si no coincide con la versión que espera Playwright
// Accesibilidad con axe-core (el del Estándar: AXE=<ruta>/vendor/axe-core/axe.min.js). Sin AXE, se omite y se dice.
/* ── Etapa 2 · grupos y asistencia (bloque 53; planeador por curso desde el bloque 74, 2026-10-18) ──
   Planeador: los cuatro cursos con aria-pressed y el curso en la dirección, el nombre calculado de cada grupo, las
   semanas; agregar a un grupo desde la espera, «Completar con las N que más esperan» y confirmar ahí mismo. Desde la
   ficha del grupo (espera.html ahora lleva a Grupos con ?grupo=) se completa el grupo sin fecha, se confirma (fecha a 7
   días e instructor; la hora, la del curso) y se da de baja a una persona (regresa a integración con su fecha); un
   grupo de renovación programado sin confirmar se cancela; la persona ve su grupo en «Mis trámites». El instructor
   captura un día de asistencia. */
async function caminosGrupos(navegador, ancho, alto, sufijo) {
  const t = (m) => `[grupos ${sufijo}] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /no se pudo aplicar/.test(m.text()))) errores.push(m.text()); });
  const texto = async (sel) => (await pg.textContent(sel)) || '';
  const integracion = datos.grupo.find((g) => g.estado === 'en_integracion');
  const enCurso = datos.grupo.find((g) => g.estado === 'en_curso');

  // ── «Grupos» como paso a paso (opción B1, decisión de Liber del 24/10/2026; antes, el planeador por curso) ──
  const g005 = datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio);
  await pg.goto(BASE + 'grupos.html');
  await listoGrupos(pg);
  const radios = await pg.$$eval('input[name="curso"]', (l) => l.map((r) => r.checked));
  comprueba(radios.length === 4 && radios.every((x) => !x) && await pasoDe(pg) === 1 && await pg.isVisible('#paso-curso'), t('paso 1: los cuatro cursos como opciones del estándar; sin ?curso= ninguno está elegido'));
  comprueba(/3 personas en espera/.test(await texto('[data-espera-curso="poda-renovacion"]')) && /1 ya vencida/.test(await texto('[data-espera-curso="poda-renovacion"]')),
    t('el curso de renovación dice cuántas personas esperan y cuántas tienen la acreditación vencida'));
  await marcar(pg, 'input[name="curso"][value="poda-renovacion"]');
  await siguientePaso(pg);
  await siguientePaso(pg);
  comprueba(/curso=poda-renovacion/.test(pg.url()) && /paso=3/.test(pg.url()) && (await pg.$$('[data-personas] .plan-persona input')).length === 3,
    t('elegir un curso cambia la espera y queda en la dirección (?curso= y ?paso=)'));
  await pg.reload();
  await listoGrupos(pg);
  comprueba(await pg.isChecked('input[name="curso"][value="poda-renovacion"]') && await pasoDe(pg) === 3, t('al recargar se conservan el curso elegido y el paso'));
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
  await listoGrupos(pg);
  const fila003 = pg.locator('[data-programados] tr[data-grupo="APD-G-2026-003"]');
  comprueba(/Poda nueva · del 12 al 16 de octubre · Iztapalapa/.test(await fila003.locator('a').first().getAttribute('aria-label')) && (await fila003.locator('a').first().textContent()) === 'APD-G-2026-003'
    && (await fila003.locator('a').first().getAttribute('href')) === 'grupo.html?folio=APD-G-2026-003', t('«Grupos programados»: el folio lleva a su ficha y nombra al grupo por su nombre calculado («Poda nueva · del 12 al 16 de octubre · Iztapalapa»)'));
  comprueba(/En curso · día 3 de 5/.test(await fila003.textContent()), t('el grupo en curso dice «día X de Y»'));
  comprueba((await pg.$$('.arm-semana')).length >= 4 && /Sin semana/.test(await texto('[data-programados] tr[data-grupo="APD-G-2026-004"]')), t('el calendario muestra las semanas del mes y la tabla, el grupo «Sin semana»'));
  comprueba((await pg.getAttribute('.arm-semana[data-lunes="2026-10-19"] [data-motivo]', 'data-motivo')) === 'anticipacion' && /No disponible\s*Faltan menos de 7 días/.test(await texto('.arm-semana[data-lunes="2026-10-19"] .arm-semana-cabeza'))
    && await pg.locator('.arm-semana-elegir[data-lunes="2026-10-26"]').count() === 1, t('la semana que ya no se puede dice por qué («No disponible · Faltan menos de 7 días»); la libre lleva su botón'));
  await sinDesborde(pg, t('grupos, paso 2'));
  await captura(pg, `grupos-${sufijo}`);
  // Sin elegir a nadie (paso 3 de un grupo nuevo): el error junto a los botones, con el foco ahí, y se señalan las personas
  await siguientePaso(pg);
  const enEsperaPoda = (await pg.$$('[data-personas] .plan-persona input')).length;
  const primeraEspera = await pg.getAttribute('[data-personas] .plan-persona input', 'value');
  await soloA(pg, []);
  await pg.click('#paso-personas [data-accion="siguiente"]');
  await pg.waitForSelector('[data-error-personas] .aviso');
  comprueba(/Elija a quién va/.test(await texto('[data-error-personas]')) && await pg.evaluate(() => document.activeElement && document.activeElement.closest('[data-error-personas]') !== null)
    && (await pg.$$('.plan-persona.falta-marcar')).length > 0 && await pasoDe(pg) === 3, t('sin elegir a nadie: el error sale junto a los botones, con el foco ahí, se señalan las personas y no se avanza'));
  // «Agregar personas» de la fila del grupo del 26 al 30 de octubre: el paso 3 con ese grupo; se agrega a la que más espera
  await aProgramados(pg);
  await Promise.all([pg.waitForNavigation(), pg.click(`[data-programados] tr[data-grupo="${g005.folio}"] a:has-text("Agregar personas")`)]);
  await listoGrupos(pg);
  comprueba(/grupo=APD-G-2026-005/.test(pg.url()) && await pasoDe(pg) === 3 && /Completando «Poda nueva · del 26 al 30 de octubre» · APD-G-2026-005/.test(await texto('[data-modo-grupo]')),
    t('«Agregar personas» de la tabla abre el paso 3 con ese grupo'));
  await soloA(pg, [primeraEspera]);
  comprueba(/^2 de 25 lugares/.test(await texto('[data-cuenta-personas]')), t('la cuenta del paso 3 suma a las que ya están en el grupo («2 de 25 lugares»)'));
  await siguientePaso(pg);
  comprueba(/Sigue por confirmar/.test(await texto('[data-queda]')) && (await texto('[data-armar="crear"]')) === 'Guardar los cambios', t('paso 4 de un grupo que ya existe: dice que sigue por confirmar y el botón guarda los cambios'));
  await Promise.all([pg.waitForURL(/grupo\.html\?folio=APD-G-2026-005/), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Se agregó 1 persona al grupo/.test(await texto('[data-hecho]:not(.pasos-btn)')) && await pg.isVisible(`[data-filas] tr[data-folio="${primeraEspera}"]`), t('agregar a un grupo desde el paso a paso: aviso en su ficha y la persona ya está en el grupo'));
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
  await listoGrupos(pg);
  comprueba((await pg.$$('[data-personas] .plan-persona input')).length === enEsperaPoda - 1 && /2 de 25/.test(await texto(`[data-programados] tr[data-grupo="${g005.folio}"]`)), t('la persona sale de la espera y el grupo suma'));
  // Completar con las que más esperan y confirmar ahí mismo (ya tiene fecha, hora e instructor)
  await aProgramados(pg);
  const completar = pg.locator(`[data-programados] tr[data-grupo="${g005.folio}"] button:has-text("Completar con las 3 que más esperan")`);
  comprueba(await completar.count() === 1, t('«Completar con las 3 que más esperan» dice cuántas faltan para el mínimo'));
  await Promise.all([pg.waitForNavigation(), completar.click()]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Se agregaron 3 personas a «Poda nueva · del 26 al 30 de octubre»/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /5 de 25/.test(await texto(`[data-programados] tr[data-grupo="${g005.folio}"]`))
    && await pg.locator(`[data-programados] tr[data-grupo="${g005.folio}"][data-nuevo]`).count() === 1, t('completar llena el grupo hasta el mínimo con las que más esperan; el aviso lo dice y la fila queda resaltada'));
  // Quien arma los grupos ya no confirma (ajustes del equipo, 25/10/2026): la fila dice que lo confirma Capacitación
  comprueba(await pg.locator(`[data-programados] tr[data-grupo="${g005.folio}"] :is(button, a):has-text("Confirmar el grupo")`).count() === 0
    && /Que Capacitación lo confirme/.test(await texto(`[data-programados] tr[data-grupo="${g005.folio}"]`)), t('cotejo ya no confirma desde la tabla: la fila dice que falta que Capacitación lo confirme'));
  // Capacitación lo confirma en la ficha (ya tiene persona instructora: «Confirmar el grupo»)
  await pg.goto(BASE + `grupo.html?folio=${g005.folio}&perfil=capacitacion`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  const llegaC = pg.waitForURL(/hecho=confirmado/);
  await pg.click('#confirmar [data-accion="enviar"]');
  await llegaC;
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
  await listoGrupos(pg);
  comprueba(/Confirmado/.test(await texto(`[data-programados] tr[data-grupo="${g005.folio}"]`)), t('Capacitación lo confirma en su ficha y la tabla de «Grupos» lo dice confirmado'));
  // La persona ve su grupo por su nombre y su folio en «Mis trámites»
  const solA = datos.solicitud.find((x) => x.folio === primeraEspera);
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), solA.solicitante_id);
  await pg.goto(BASE + 'tramites.html');
  await pg.waitForSelector('[data-solicitudes] .ficha');
  const tramA = await texto('main');
  comprueba(/Poda nueva · del 26 al 30 de octubre/.test(tramA) && tramA.includes(g005.folio) && tramA.includes(fechaLarga('2026-10-26')), t('«Mis trámites»: el grupo confirmado por su nombre calculado, con su folio y su primer día'));
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));

  // ── Desde la ficha de un grupo: «Agregar personas de la espera», con el botón de la ficha (auditoría 2026-10-19,
  // R4-14: antes se entraba por espera.html y el enlace real no se recorría) ──
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}`);
  const agregar = pg.locator('[data-acciones] a', { hasText: /^Agregar personas de la espera \(\d+ en espera\)$/ });
  await agregar.waitFor();
  await Promise.all([pg.waitForURL(/grupos\.html/), agregar.click()]);
  await listoGrupos(pg);
  comprueba(new RegExp(`grupos\\.html\\?grupo=${integracion.folio}&`).test(pg.url()) && /paso=3/.test(pg.url()) && await pasoDe(pg) === 3 && /Completando «Poda nueva · sin fecha» · APD-G-2026-004/.test(await texto('[data-modo-grupo]'))
    && (await pg.$$('input[name="curso"]:disabled')).length === 3, t('R4-14: «Agregar personas de la espera» de la ficha abre el paso 3 de Grupos con ese grupo; su curso no cambia'));
  // La dirección vieja (espera.html) lleva a Grupos con el mismo grupo
  await pg.goto(BASE + `espera.html?curso=poda-nueva&grupo=${integracion.folio}`);
  await pg.waitForURL(/grupos\.html\?.*grupo=APD-G-2026-004/);
  await listoGrupos(pg);
  comprueba(/Completando «Poda nueva · sin fecha»/.test(await texto('[data-modo-grupo]')) && await pasoDe(pg) === 2, t('espera.html lleva a Grupos con el mismo grupo (paso 2: no tiene semana)'));
  // Sin semana todavía: se puede seguir sin elegirla y sólo agregar personas
  await siguientePaso(pg);
  const primero = await pg.getAttribute('[data-personas] .plan-persona input', 'value');
  await soloA(pg, [primero]);
  await siguientePaso(pg);
  await Promise.all([pg.waitForURL(/grupo\.html\?folio=APD-G-2026-004/), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-filas] tr');
  comprueba(await pg.isVisible(`[data-filas] tr[data-folio="${primero}"]`) && /Poda nueva · sin fecha/.test(await texto('#t-grupo .grupo-nombre')), t('sin elegir semana, la persona elegida queda en el grupo y el grupo sigue sin fecha'));
  comprueba((await texto('#t-grupo .grupo-folio')) === integracion.folio, t('la ficha del grupo se titula con su nombre calculado y su folio en chico'));

  // Confirmar (ajustes del equipo, 25/10/2026): la semana la elige quien arma el grupo, en «Grupos», y el grupo lo confirma
  // Capacitación en su ficha; la ficha ya no tiene el primer día. Quien arma los grupos ve lo que le falta, sin formulario.
  const fechaMas = (n) => { const d = new Date(`${datos.fecha_corte}T12:00:00-06:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10).split('-').reverse().join('/'); };
  const isoMas = (n) => fechaMas(n).split('/').reverse().join('-');
  comprueba(await pg.isVisible('[data-confirmar]') && await pg.isHidden('#confirmar') && /Le falta: la semana/.test(await texto('[data-falta]')) && /el grupo lo confirma el área de Instructores y Capacitación/.test(await texto('[data-confirmar]')),
    t('quien arma los grupos ve en la ficha lo que le falta (la semana) y quién lo confirma, sin formulario'));
  // Con menos de 7 días de anticipación (una semana propuesta a 5 días), Capacitación no lo puede confirmar: sólo asignar
  await pg.evaluate((x) => APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: x.id, fecha_inicio: x.inicio, hora_entrada: '09:00', por: 'revision.prueba', perfil: 'revision_cotejo' }), { id: integracion.id, inicio: isoMas(5) });
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}&perfil=capacitacion`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  comprueba(/otra semana/.test(await texto('[data-falta]')) && (await texto('#confirmar [data-accion="enviar"]')) === 'Asignar la persona instructora' && await pg.isHidden('[data-asignar="solo"]'),
    t('con menos de 7 días de anticipación, Capacitación no lo puede confirmar: le falta otra semana y sólo se ofrece asignar'));
  await captura(pg, `grupos-confirmar-error-${sufijo}`);
  // Quien arma el grupo le da su semana en «Grupos» (paso 2 con ese grupo) y Capacitación lo confirma en su ficha
  await pg.goto(BASE + `grupos.html?grupo=${integracion.folio}&paso=2`);
  await listoGrupos(pg);
  await pg.click('[data-mes="1"]');
  await pg.click(`.arm-semana-elegir[data-lunes="${isoMas(19)}"]`);
  await siguientePaso(pg);
  await siguientePaso(pg);
  await Promise.all([pg.waitForURL(/grupo\.html\?folio=APD-G-2026-004/), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Se guardaron los cambios del grupo/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /Instructores y Capacitación le asigna la persona instructora y lo confirma/.test(await texto('[data-hecho]:not(.pasos-btn)')),
    t('la semana elegida en «Grupos» queda como propuesta y el aviso dice que Capacitación le asigna la persona instructora y lo confirma'));
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}&perfil=capacitacion`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  await pg.selectOption('#instructor', 'instructor.ficticio');
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega1 = pg.waitForURL(/hecho=confirmado/);
  await pg.click('#confirmar [data-accion="enviar"]');
  await llega1;
  await pg.waitForSelector('[data-situacion] .estado');
  // La hora no se elige (decisión del 24/10/2026): el grupo, que no tenía, toma la del parámetro curso_hora_entrada
  const horaGuardada = await pg.evaluate(() => APD.cargar().then((d) => APD.hhmm(d.grupo.find((g) => g.folio === 'APD-G-2026-004').hora_entrada)));
  comprueba(/Confirmado/.test(await texto('[data-situacion]')) && /09:00/.test(await texto('[data-datos]')) && horaGuardada === '09:00', t(`el grupo queda confirmado con su hora de entrada, la del curso (${horaGuardada})`));
  await sinDesborde(pg, t('grupo confirmado'));
  await captura(pg, `grupos-confirmado-${sufijo}`);

  // La persona ve su grupo con fecha y hora en «Mis trámites»
  const sol = datos.solicitud.find((x) => x.folio === primero);
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sol.solicitante_id);
  await pg.goto(BASE + 'tramites.html');
  await pg.waitForSelector('[data-solicitudes] .ficha');
  const tram = await texto('main');
  comprueba(tram.includes(fechaLarga(fechaMas(19))) && /09:00/.test(tram), t('«Mis trámites»: la persona ve el primer día del curso y la hora de entrada'));
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));

  // Baja: el grupo queda por debajo del mínimo y regresa a integración
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}`);
  await pg.waitForSelector('[data-filas] tr button');
  await pg.click('[data-filas] tr:first-child button');
  await pg.click('#baja [data-accion="enviar"]');
  await pg.waitForTimeout(200);
  comprueba(await pg.isVisible('#dlg-baja[open]') && !/hecho=/.test(pg.url()), t('dar de baja sin motivo no se guarda'));
  await captura(pg, `grupos-baja-${sufijo}`);
  await pg.fill('#motivo-baja', 'Pidió cambiar de fecha por trabajo.');
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega2 = pg.waitForURL(/hecho=baja_integracion/);
  await pg.click('#baja [data-accion="enviar"]');
  await llega2.catch(async (e) => {
    console.log('DIAG baja:', pg.url(), '|', await pg.evaluate(() => [document.querySelector('#dlg-baja')?.open, document.querySelector('#baja [data-estado-envio]')?.textContent, document.querySelector('#baja .resumen-errores')?.textContent, document.querySelector('#motivo-baja')?.value].join(' | ')));
    throw e;
  });
  await pg.waitForSelector('[data-situacion] .estado');
  comprueba(/Por confirmar/.test(await texto('[data-situacion]')) && await pg.isVisible('[data-confirmar]'), t('la baja deja al grupo por debajo del mínimo: regresa a integración'));
  // Alta 2 de la auditoría integral: quien sigue en el grupo ya no ve la fecha como segura
  const queda = (await pg.textContent('[data-filas] tr:first-child .mono')).trim();
  const solQueda = datos.solicitud.find((x) => x.folio === queda);
  if (solQueda) {
    await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), solQueda.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-solicitudes] .ficha');
    const fq = await pg.locator('[data-solicitudes] .ficha', { hasText: queda }).textContent();
    comprueba(!/Preséntate el/.test(fq) && /todavía no está confirmado/.test(fq), t('«Mis trámites»: con el grupo de nuevo por confirmar, la persona ya no ve la fecha como segura'));
    await pg.evaluate(() => localStorage.removeItem('apd.sesion'));
  }

  // Armar un grupo de renovación con toda la espera (menos del mínimo: se crea por confirmar) y cancelarlo
  await pg.goto(BASE + 'grupos.html?curso=poda-renovacion&paso=3');
  await listoGrupos(pg);
  const enEspera = (await pg.$$('[data-personas] .plan-persona input:checked')).length;
  await siguientePaso(pg);
  comprueba(/Se crea por confirmar/.test(await texto('[data-queda]')) && /2 personas más/.test(await texto('[data-queda]')) && await pg.locator('[data-armar="sin-confirmar"]').count() === 0,
    t('paso 4 con 3 personas: dice antes de crearlo que queda por confirmar y qué le falta'));
  await Promise.all([pg.waitForNavigation(), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Grupo creado, por confirmar: Poda renovación · \d+ de [a-z]+/.test(await texto('[data-hecho]:not(.pasos-btn)')), t('«Crear el grupo» deja el grupo de renovación por confirmar, con su nombre calculado'));
  await pg.click('[data-hecho]:not(.pasos-btn) a:has-text("Ver la ficha del grupo")');
  await pg.waitForSelector('[data-filas] tr');
  comprueba((await pg.$$('[data-filas] tr')).length === enEspera && /Por confirmar/.test(await texto('[data-situacion]')), t('el grupo nuevo tiene a las personas elegidas'));
  await pg.click('[data-acciones] button:has-text("Cancelar el grupo")');
  const dlg = await texto('#dlg-cancelar');
  comprueba(/¿Cancelar el grupo APD-G-\d{4}-\d{3} \(Poda renovación · [^)]+\)\?/.test(dlg) && /No se puede deshacer/.test(dlg) && /Volver sin cambios/.test(dlg) && /Sí, cancelar el grupo/.test(dlg)
    && (await pg.$$eval('#dlg-cancelar .dialogo-consecuencias li', (l) => l.length)) > 0, t('cancelar: el diálogo nombra el grupo, lista las consecuencias y no repite «Cancelar» en sus dos botones'));
  await captura(pg, `grupos-dialogo-cancelar-${sufijo}`);
  await pg.fill('#motivo-cancelar', 'No se reunió el cupo mínimo en el plazo previsto.');
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega4 = pg.waitForURL(/hecho=cancelado/);
  await pg.click('#cancelar [data-accion="enviar"]');
  await llega4.catch(async (e) => {
    console.log('DIAG cancelar:', pg.url(), '|', await pg.evaluate(() => [document.querySelector('#dlg-cancelar')?.open, document.querySelector('#cancelar [data-estado-envio]')?.textContent, document.querySelector('#cancelar .resumen-errores')?.textContent, document.querySelector('#motivo-cancelar')?.value].join(' | ')));
    throw e;
  });
  await pg.goto(BASE + 'grupos.html?curso=poda-renovacion&paso=3');
  await listoGrupos(pg);
  comprueba((await pg.$$('[data-personas] .plan-persona input')).length === enEspera, t('al cancelar, las personas regresan a la espera'));

  // Asistencia del instructor: no guarda con alguien sin marcar; guarda el día y avisa a quien ya no tiene derecho
  // Hay dos grupos en curso (el del caso «aprobó hoy» termina en la fecha de corte): se abre el que sigue en clases
  const grupoClases = datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-12');
  // El último día (examen) no se captura aquí: pedirlo con ?dia=5 no abre su lista (auditoría A 7.1: la comprobación
  // anterior miraba «Corregir otro día», que nunca lo lista)
  await pg.goto(BASE + `asistencia.html?folio=${grupoClases.folio}&dia=5`);
  await pg.waitForSelector('.asistencia-fila');
  const tituloDia5 = await texto('[data-titulo-dia]');
  await pg.goto(BASE + `asistencia.html?folio=${grupoClases.folio}`);
  await pg.waitForSelector('.asistencia-fila');
  // Propuesta A (2026-10-18): la lista del día de hoy; el último día (examen) no se ofrece para capturar
  comprueba(/^Día 3 de 5/.test(await texto('[data-titulo-dia]')) && !/^Día 5\b/.test(tituloDia5) && (await pg.$$('[data-dias] a[href*="dia=5"]')).length === 0
    && (await pg.$$('.asis-marcas .asis-marca')).length > 0,
    t('la lista es la del día de hoy y el examen no se captura aquí (se registra al pasar lista)'));
  // Versión de prueba: el recorrido de todos los días, con el examen que lleva a «Aplicar el examen»
  comprueba(/aplicar\.html/.test(await pg.getAttribute('[data-recorrido-dias] a:last-child', 'href')) && (await pg.$$('[data-recorrido-dias] a, [data-recorrido-dias] strong')).length === 5,
    t('la versión de prueba permite recorrer los cinco días del curso'));
  comprueba((await pg.$$('.asis-marcas')).length === (await pg.$$('.asistencia-fila')).length, t('cada persona muestra su tira de días'));
  await pg.click('[data-guardar]');
  comprueba(await pg.isVisible('[data-falta-marcar]'), t('no se guarda la asistencia con personas sin marcar'));
  await captura(pg, `asistencia-${sufijo}`);
  await pg.click('[data-todas]');
  // Con los datos: una persona que ya faltó el día 1; faltar hoy la deja sin derecho a examen (A 7.2: antes, si no había,
  // la comprobación se saltaba en silencio)
  const insClases = datos.inscripcion.filter((i) => i.grupo_id === grupoClases.id).map((i) => i.id);
  const faltaDia1 = datos.asistencia.find((a) => insClases.includes(a.inscripcion_id) && a.dia === 1 && !a.asistio);
  comprueba(Boolean(faltaDia1), t('los ficticios traen a alguien del grupo en curso que faltó el día 1'));
  const falto = faltaDia1 ? await pg.$(`.asistencia-fila[data-ins="${faltaDia1.inscripcion_id}"]`) : null;
  if (falto) await (await falto.$('input[value="no"]')).check();
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega5 = pg.waitForURL(/hecho=asistencia/);
  await pg.click('[data-guardar]');
  await llega5;
  await pg.waitForSelector('.asistencia-fila');
  comprueba(/guardada/.test(await texto('[data-hecho]:not(.pasos-btn)')), t('la asistencia del día se guarda'));
  comprueba(/^Día 3 de 5/.test(await texto('[data-titulo-dia]')) && /Seguir con el día 4/.test(await texto('[data-hecho]:not(.pasos-btn)')), t('en la versión de prueba, guardar ofrece seguir con el día siguiente del curso (SOLO=asistencia5)'));
  comprueba(Boolean(falto) && /Sin derecho a examen/.test(await texto(`.asistencia-fila[data-ins="${faltaDia1.inscripcion_id}"]`)), t('quien faltó dos días se marca sin derecho a examen'));
  await sinDesborde(pg, t('asistencia'));
  await captura(pg, `asistencia-guardada-${sufijo}`);
  // La ficha de un grupo concluido conserva la asistencia de conjunto
  await pg.goto(BASE + `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'concluido').folio}`);
  await pg.waitForSelector('[data-conc-filas] tr', { state: 'attached' });
  // Acomodo de escritorio (25/10/2026): en computadora «Asistencia por día» es una pestaña; se abre para verla
  if (await pg.locator('#pt-asistencia').count()) await pg.click('#pt-asistencia');
  await pg.waitForSelector('[data-conc-filas] tr');
  comprueba(/Sin derecho/.test(await texto('[data-concentrado]')), t('la ficha de un grupo concluido muestra la asistencia por día y quién se quedó sin derecho'));
  await sinDesborde(pg, t('grupo concluido con su concentrado'));
  comprueba(enCurso && errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // R4-04 y RI-07 (auditoría 2026-10-19): una propuesta vencida (APD-G-2026-005 al 28/09) y un grupo confirmado cuya semana
  // pasó sin iniciar (APD-G-2026-004 al 05/10) no van como «Sin semana»: su situación lo dice, con «Elegir otra semana»
  const pasados = JSON.parse(JSON.stringify(datos));
  for (const g of pasados.grupo) {
    if (g.folio === 'APD-G-2026-005') g.fecha_inicio = '2026-09-28';
    if (g.folio === 'APD-G-2026-004') Object.assign(g, { estado: 'confirmado', fecha_inicio: '2026-10-05', hora_entrada: '09:00:00', instructor: 'instructor2.ficticio' });
  }
  const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  await c2.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(pasados), contentType: 'application/json' }));
  const p2 = await c2.newPage();
  await p2.goto(BASE + 'grupos.html?curso=poda-nueva');
  await listoGrupos(p2);
  const filaDe = async (f) => ((await p2.textContent(`[data-programados] tr[data-grupo="${f}"]`)) || '').replace(/\s+/g, ' ');
  const t005 = await filaDe('APD-G-2026-005');
  const t004 = await filaDe('APD-G-2026-004');
  comprueba(!/Sin semana/.test(t005 + t004) && /Otra semana/.test(t005) && /Otra semana/.test(t004), t('un grupo con fecha pasada no va como «Sin semana»: le falta otra semana'));
  comprueba(/Propuesta vencida/.test(t005) && !/Completar/.test(t005) && (await p2.getAttribute('[data-programados] tr[data-grupo="APD-G-2026-005"] a:has-text("Elegir otra semana")', 'href')) === 'grupos.html?grupo=APD-G-2026-005&paso=2'
    && /no inició/.test(t004), t('la propuesta vencida lo dice y lleva a «Elegir otra semana» (paso 2 con ese grupo); el confirmado dice que no inició'));
  await sinDesborde(p2, t('su fecha ya pasó'));
  // «Elegir otra semana»: el paso 2 con ese grupo, su semana vencida no queda elegida y se elige otra
  await aProgramados(p2);
  await Promise.all([p2.waitForNavigation(), p2.click('[data-programados] tr[data-grupo="APD-G-2026-005"] a:has-text("Elegir otra semana")')]);
  await listoGrupos(p2);
  comprueba(await pasoDe(p2) === 2 && (await p2.inputValue('#fecha_inicio')) === '' && (await p2.$$('.arm-semana[data-elegida]')).length === 0, t('«Elegir otra semana» abre el paso 2 sin la semana vencida elegida'));
  await c2.close();
}
const APDfecha = (iso) => iso.split('-').reverse().join('/');
/* «Grupos» paso a paso (opción B1, decisión de Liber del 24/10/2026): la página lista (formulario iniciado y tabla de
   grupos programados), el paso actual (1 a 4) y «Siguiente» como lo haría la persona, esperando el paso nuevo */
async function listoGrupos(pg) {
  await pg.waitForSelector('#armar[data-formkit="listo"]', { state: 'attached' });
  await pg.waitForFunction(() => window.FormKit && FormKit.pasos && !/Cargando/.test(document.querySelector('[data-bajada]').textContent));
}
const pasoDe = (pg) => pg.evaluate(() => FormKit.pasos.actual() + 1);
// Acomodo de escritorio, parte B (decisión de Liber del 25/10/2026): desde 1024 px los grupos programados van en su pestaña;
// para usarlos, se abre (en teléfono no hay pestañas: ya están a la vista)
async function aProgramados(pg) {
  await pg.waitForSelector('#pe-programados', { state: 'attached' });
  if (await pg.isVisible('#pe-programados') && (await pg.getAttribute('#pe-programados', 'aria-selected')) !== 'true') await pg.click('#pe-programados');
}
async function siguientePaso(pg) {
  const antes = await pasoDe(pg);
  await pg.click('[data-paso]:not([hidden]) [data-accion="siguiente"]');
  await pg.waitForFunction((a) => FormKit.pasos.actual() + 1 === a + 1, antes);
}
// Deja marcadas en el paso 3 sólo a esas personas (las demás, desmarcadas; también las plegadas)
async function soloA(pg, folios) {
  await pg.evaluate((fs) => { for (const k of document.querySelectorAll('[data-personas] input.plan-casilla[value]')) { const quiere = fs.includes(k.value); if (k.checked !== quiere) k.click(); } }, folios);
}
// Fecha larga, como «Mis trámites» escribe el curso (auditoría 2026-10-20, C2-02; decisión 16 b): «lunes 26 de octubre
// de 2026». Acepta AAAA-MM-DD o DD/MM/AAAA.
const fechaLarga = (f) => {
  const [a, m, d] = /\//.test(f) ? f.split('/').reverse() : f.split('-');
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(Date.UTC(+a, +m - 1, +d, 12)).getUTCDay()];
  return `${dia} ${+d} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+m - 1]} de ${a}`;
};

/* ── «Grupos» paso a paso (opción B1 de la maqueta «Grupos: propuestas de rediseño», decisión de Liber del 24/10/2026;
   SOLO=grupos) ──
   Los cuatro pasos sólo con el teclado (barra de pasos con aria-current, el foco al título de cada paso), las reglas del
   calendario en sus motivos (ya pasó, ya empezó, faltan menos de 7 días, ya hay 2 grupos, día inhábil; todas de
   APD_PERSONAL.razonNoInicio), crear un grupo (aviso y fila resaltada), completar uno que ya existe desde la tabla, la
   dirección (?curso=&mes=&semana=&paso=) con «Atrás» y recargar, sin desborde, objetivos de 44 px y axe en cada paso. */
async function grupoPasoAPaso(navegador, ancho, alto, sufijo) {
  const t = (m) => `[paso a paso ${sufijo}] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: ancho < 600, hasTouch: ancho < 600, reducedMotion: 'reduce' });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const texto = async (sel) => ((await pg.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  const revisaPaso = async (n) => {
    // Sin desborde, objetivos de 44 px (botones y enlaces del paso y de la tabla) y, con AXE, sin violaciones
    await sinDesborde(pg, t(`paso ${n}`));
    const chicos = await pg.evaluate(() => [...document.querySelectorAll('#armar [data-paso]:not([hidden]) button, #armar [data-paso]:not([hidden]) a, [data-barra] button, [data-programados] button, [data-programados] a, [data-mes]')]
      .filter((e) => e.checkVisibility()).map((e) => [e.textContent.trim().slice(0, 30) || e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]).filter(([, h, w]) => h < 44 || w < 44));
    comprueba(!chicos.length, t(`paso ${n}: botones y enlaces de 44 px o más${chicos.length ? ': ' + JSON.stringify(chicos.slice(0, 4)) : ''}`));
    if (axe) {
      // Por el protocolo del navegador: la política de contenido no deja scripts en línea; las mismas reglas que «accesibilidad»
      if (!(await pg.evaluate(() => Boolean(window.axe)))) await pg.evaluate(axe);
      const v = await pg.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
        .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((m) => m.html.slice(0, 120)).join(' || ')}`));
      comprueba(!v.length, t(`paso ${n}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
    } else console.log(`OMITIDO  [paso a paso ${sufijo}] axe: falta AXE=<ruta a axe.min.js del estándar>`);
  };
  const actual = () => pg.evaluate(() => [...document.querySelectorAll('[data-barra] .pasos-btn')].map((b) => b.getAttribute('aria-current')));
  const foco = () => pg.evaluate(() => { const a = document.activeElement; return a ? { titulo: a.matches('[data-paso]:not([hidden]) .titulo-paso'), texto: a.textContent.trim().slice(0, 40), lunes: a.dataset.lunes || '' } : {}; });
  // Tab hasta el primer elemento que cumple (con tope)
  const tabHasta = async (cumple, max = 60) => {
    for (let i = 0; i < max; i++) { await pg.keyboard.press('Tab'); if (await pg.evaluate(cumple)) return true; }
    return false;
  };

  // ── Paso 1, con el teclado: el curso (opción del estándar) e Intro avanza ──
  await pg.goto(BASE + 'grupos.html');
  await listoGrupos(pg);
  comprueba(JSON.stringify(await actual()) === JSON.stringify(['step', null, null, null]), t('paso 1: la barra de pasos del estándar marca el actual con aria-current="step"'));
  await revisaPaso(1);
  await pg.focus('input[name="curso"][value="poda-nueva"]');
  await pg.keyboard.press('Space');
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 1);
  const f2 = await foco();
  comprueba(f2.titulo && f2.texto === '¿Qué semana?' && JSON.stringify(await actual()) === JSON.stringify([null, 'step', null, null]) && /curso=poda-nueva/.test(pg.url()) && /paso=2/.test(pg.url()),
    t('paso 1 → 2 con el teclado: el foco va al título «¿Qué semana?», aria-current pasa al paso 2 y la dirección lo guarda'));

  // ── Paso 2: la semana. Cada semana dice «Libre» (con lugares) o «No disponible» y su motivo ──
  const semanas = await pg.$$eval('.arm-semana', (l) => l.map((x) => ({ lunes: x.dataset.lunes, libre: x.dataset.libre, motivo: (x.querySelector('[data-motivo]') || {}).dataset ? x.querySelector('[data-motivo]').dataset.motivo : '',
    texto: x.querySelector('.arm-semana-cabeza').textContent.replace(/\s+/g, ' ').trim(), nombre: (x.querySelector('.arm-semana-elegir') || {}).getAttribute ? x.querySelector('.arm-semana-elegir').getAttribute('aria-label') : '' })));
  const de = (l) => semanas.find((x) => x.lunes === l) || {};
  comprueba(de('2026-10-05').motivo === 'paso' && /No disponible\s*Ya pasó/.test(de('2026-10-05').texto) && de('2026-10-12').motivo === 'empezo' && /No disponible\s*Ya empezó/.test(de('2026-10-12').texto)
    && de('2026-10-19').motivo === 'anticipacion' && /No disponible\s*Faltan menos de 7 días/.test(de('2026-10-19').texto),
    t('paso 2: «No disponible» con su motivo: ya pasó, ya empezó y faltan menos de 7 días'));
  comprueba(/^Semana elegida del 26 al 30 de octubre de 2026: 1 lugar libre de 2$/.test(de('2026-10-26').nombre) && /Grupo: APD-G-2026-005 \(por confirmar\)/.test(de('2026-10-26').texto),
    t('paso 2: la semana con un grupo dice «1 lugar libre de 2» en el nombre de su botón y nombra a su grupo'));
  // Los grupos pintados en sus días: su folio el primer día y «Examen» el último; sábado y domingo sombreados; «Hoy»
  if (ancho >= 760) {
    const dias = await pg.evaluate(() => ({ folio: (document.querySelector('.arm-dia[data-fecha="2026-10-12"] .arm-marca[data-grupo="APD-G-2026-003"]') || {}).textContent,
      examen: (document.querySelector('.arm-dia[data-fecha="2026-10-16"] .arm-marca[data-grupo="APD-G-2026-003"]') || {}).textContent,
      situacion: (document.querySelector('.arm-marca[data-grupo="APD-G-2026-005"]') || { getAttribute: () => '' }).getAttribute('data-situacion'), hoy: (document.querySelector('.arm-dia[data-hoy] .arm-hoy') || {}).textContent,
      finde: getComputedStyle(document.querySelector('.arm-dia[data-finde]')).backgroundColor, laborable: getComputedStyle(document.querySelector('.arm-dia:not([data-finde])')).backgroundColor }));
    comprueba(dias.folio === 'G-2026-003' && dias.examen === 'Examen' && dias.situacion === 'en_integracion' && dias.hoy === 'Hoy' && dias.finde !== dias.laborable,
      t(`paso 2 en la rejilla: el grupo pintado con su folio el lunes y «Examen» el viernes, por su situación; «Hoy» marcado y el fin de semana sombreado (${JSON.stringify(dias)})`));
  } else {
    comprueba(await pg.evaluate(() => getComputedStyle(document.querySelector('.arm-semana-dias')).display === 'none' && document.querySelector('.arm-semana-fechas').checkVisibility()),
      t('paso 2 en teléfono: el calendario es una lista de semanas, cada una con sus fechas'));
  }
  await revisaPaso(2);
  // Con el teclado: «Mes siguiente» y luego, con Tab, la primera semana libre de noviembre; Intro la elige
  await pg.focus('[data-mes="1"]');
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => /Noviembre de 2026/.test(document.querySelector('[data-mes-nombre]').textContent));
  comprueba(/mes=2026-11/.test(pg.url()), t('paso 2: el mes queda en la dirección'));
  await tabHasta(() => document.activeElement.matches('.arm-semana-elegir[aria-pressed="false"]'));
  const libre = await foco();
  const nombreLibre = await pg.evaluate(() => document.activeElement.getAttribute('aria-label'));
  comprueba(/^Elegir la semana del \d+ (de \S+ )?al \d+ de \S+ de 2026: (2 lugares libres|1 lugar libre de 2)$/.test(nombreLibre), t(`paso 2: el botón de una semana libre dice su nombre completo («${nombreLibre}»)`));
  await pg.keyboard.press('Enter');
  await pg.waitForFunction((l) => document.querySelector(`.arm-semana-elegir[data-lunes="${l}"]`).getAttribute('aria-pressed') === 'true', libre.lunes);
  comprueba(new RegExp(`semana=${libre.lunes}`).test(pg.url()) && (await pg.inputValue('#fecha_inicio')) === APDfecha(libre.lunes) && (await foco()).lunes === libre.lunes,
    t('paso 2: Intro elige la semana, el foco se queda en ella y la dirección guarda la semana'));
  await tabHasta(() => document.activeElement.matches('#paso-semana [data-accion="siguiente"]'));
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 2);
  const f3 = await foco();
  comprueba(f3.titulo && f3.texto === '¿Quiénes van?' && JSON.stringify(await actual()) === JSON.stringify([null, null, 'step', null]), t('paso 2 → 3 con el teclado: el foco va al título «¿Quiénes van?» y aria-current al paso 3'));

  // ── «Atrás» del navegador y recargar ──
  await pg.goBack();
  await pg.waitForFunction(() => FormKit.pasos.actual() === 1);
  const atras = [/paso=2/.test(pg.url()), await pg.inputValue('#fecha_inicio')];
  await pg.goForward();
  await pg.waitForFunction(() => FormKit.pasos.actual() === 2);
  await pg.reload();
  await listoGrupos(pg);
  comprueba(atras[0] && atras[1] === APDfecha(libre.lunes) && await pasoDe(pg) === 3 && (await pg.inputValue('#fecha_inicio')) === APDfecha(libre.lunes) && await pg.isChecked('input[name="curso"][value="poda-nueva"]'),
    t('«Atrás» regresa al paso 2 con la semana elegida; «Adelante» y recargar conservan el paso 3, el curso y la semana'));

  // ── Paso 3: las que más esperan, marcadas hasta el cupo; con el teclado se quita a una ──
  const marcadas = await pg.$$eval('[data-personas] .plan-persona input:checked', (l) => l.length);
  comprueba(marcadas === 6 && /^6 de 25 lugares · se confirma con al menos 5 personas$/.test(await texto('[data-cuenta-personas]')), t('paso 3: se proponen las 6 que esperan, «6 de 25 lugares · se confirma con al menos 5 personas»'));
  await revisaPaso(3);
  await pg.focus('#paso-personas .titulo-paso');
  await tabHasta(() => document.activeElement.matches('.plan-casilla'));
  await pg.keyboard.press('Space');
  comprueba(/^5 de 25 lugares/.test(await texto('[data-cuenta-personas]')), t('paso 3: Espacio quita a una persona y la cuenta lo dice'));
  await tabHasta(() => document.activeElement.matches('#paso-personas [data-accion="siguiente"]'), 80);
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 3);
  const f4 = await foco();
  comprueba(f4.titulo && f4.texto === 'Revise y confirme' && JSON.stringify(await actual()) === JSON.stringify([null, null, null, 'step']) && /paso=4/.test(pg.url()), t('paso 3 → 4 con el teclado: el foco va a «Revise y confirme» y aria-current al paso 4'));

  // ── Paso 4: resumen y «Crear el grupo». Desde los ajustes del equipo (25/10/2026) quien arma el grupo no elige instructor
  // ni hay «Por asignar»: el grupo se crea por confirmar y la persona instructora la asigna, y lo confirma, el área de
  // Instructores y Capacitación ──
  const resumen = await texto('[data-resumen]');
  comprueba(/Curso\s*Poda y derribo · nueva/.test(resumen) && /Semana\s*Del lunes/.test(resumen) && /Horario\s*De 9:00 a 15:00, de lunes a viernes/.test(resumen) && await pg.locator('#hora_entrada').count() === 0 && /Examen final\s*El viernes/.test(resumen) && /Personas\s*5 de 25/.test(resumen)
    && /Persona instructora\s*La asigna el área de Instructores y Capacitación/.test(resumen) && await pg.locator('#instructor').count() === 0,
    t('paso 4: el resumen dice curso, semana, horario (fijo, sin menú de hora), examen y personas; sin elegir instructor ni «Por asignar»: la asigna el área de Instructores y Capacitación'));
  comprueba(/Se crea por confirmar/.test(await texto('[data-queda]')) && /Instructores y Capacitación le asigna la persona instructora y lo confirma/.test(await texto('[data-queda]'))
    && /La persona instructora la asigna el área de Instructores y Capacitación, que también confirma el grupo/.test(await texto('[data-quien-confirma]')),
    t('paso 4: el paso de confirmar dice que la persona instructora la asigna el área de Instructores y Capacitación, que también confirma el grupo; se crea por confirmar'));
  await revisaPaso(4);
  await pg.focus('[data-armar="crear"]');
  await Promise.all([pg.waitForNavigation(), pg.keyboard.press('Enter')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  const nuevo = await pg.evaluate(() => { const f = document.querySelector('[data-programados] tr[data-nuevo]'); return f ? { folio: f.dataset.grupo, texto: f.textContent } : null; });
  comprueba(nuevo && /Recién creado/.test(nuevo.texto) && /Por confirmar/.test(nuevo.texto) && /Persona instructora/.test(nuevo.texto) && /Grupo creado, por confirmar/.test(await texto('[data-hecho]:not(.pasos-btn)')) && await pg.evaluate(() => Boolean(document.activeElement.closest('[data-hecho]:not(.pasos-btn)'))) && await pasoDe(pg) === 1,
    t(`crear: avisa (con el foco ahí), regresa a «Grupos programados» con el grupo nuevo resaltado (${nuevo && nuevo.folio}) y el paso a paso empieza de nuevo`));
  await sinDesborde(pg, t('grupo creado'));

  // ── Completar uno que ya existe desde la tabla: «Completar con la que más espera» y, para darle semana, el paso 2 ──
  const fila4 = '[data-programados] tr[data-grupo="APD-G-2026-004"]';
  comprueba(/Sin semana/.test(await texto(fila4)) && /Semana, 1 persona y persona instructora/.test(await texto(fila4)) && !/hora/i.test(await texto(fila4)), t(`la tabla dice la situación («Sin semana») y lo que le falta al grupo («${await texto(fila4)}»)`));
  await Promise.all([pg.waitForNavigation(), pg.click(`${fila4} button:has-text("Completar con la que más espera")`)]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Se agregó 1 persona a «Poda nueva · sin fecha · APD-G-2026-004»/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /5 de 25/.test(await texto(fila4)) && /Semana y persona instructora/.test(await texto(fila4)),
    t(`«Completar con la que más espera» la agrega, lo dice y la fila queda con lo que le falta («${await texto('[data-hecho]:not(.pasos-btn)')}» · «${await texto(fila4)}»)`));
  await Promise.all([pg.waitForNavigation(), pg.click(`${fila4} a:has-text("Elegir semana")`)]);
  await listoGrupos(pg);
  comprueba(await pasoDe(pg) === 2 && /grupo=APD-G-2026-004/.test(pg.url()) && (await pg.$$('input[name="curso"]:disabled')).length === 3, t('«Elegir semana» abre el paso 2 con ese grupo y su curso fijo'));
  await pg.click('[data-mes="1"]');
  await pg.click('.arm-semana-elegir[data-lunes="2026-11-30"]');
  await siguientePaso(pg);
  await siguientePaso(pg);
  // Con semana y 5 personas, quien arma el grupo ya no lo confirma: lo guarda y lo confirma Capacitación (25/10/2026)
  comprueba(/Sigue por confirmar/.test(await texto('[data-queda]')) && /Ya tiene lo que le toca a usted/.test(await texto('[data-queda]')) && (await texto('[data-armar="crear"]')) === 'Guardar los cambios',
    t('paso 4 del grupo que ya existe: con semana y 5 personas, sigue por confirmar («Guardar los cambios»); lo confirma Capacitación'));
  await Promise.all([pg.waitForURL(/grupo\.html\?folio=APD-G-2026-004/), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  // Capacitación, en la ficha: asigna a la persona instructora (libre esas fechas) y confirma
  await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-004&perfil=capacitacion');
  await pg.waitForSelector('#confirmar:not([hidden])');
  await pg.selectOption('#instructor', 'instructor.ficticio');
  const llegaConf = pg.waitForURL(/hecho=confirmado/);
  await pg.click('#confirmar [data-accion="enviar"]');
  await llegaConf;
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  const hora004 = await pg.evaluate(() => APD.cargar().then((d) => APD.hhmm(d.grupo.find((g) => g.folio === 'APD-G-2026-004').hora_entrada)));
  comprueba(/Grupo confirmado/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /del 30 de noviembre al 4 de diciembre/.test(await texto('#t-grupo .grupo-nombre')) && hora004 === '09:00',
    t(`el grupo que ya existía (sin hora) queda en su semana y Capacitación lo confirma en su ficha, con la hora del curso (${hora004})`));
  comprueba(!errores.length, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // ── Las otras reglas del calendario, con datos propios: «Ya hay 2 grupos» (P149, de cualquier curso) y «Día inhábil»
  // (P150, parámetro dias_inhabiles) ──
  if (ancho >= 1280) {
    const otros = JSON.parse(JSON.stringify(datos));
    const base5 = otros.grupo.find((g) => g.folio === 'APD-G-2026-005');
    otros.grupo.push(Object.assign({}, base5, { id: 'g-prueba-1', folio: 'APD-G-2026-091', fecha_inicio: '2026-11-09', estado: 'confirmado' }),
      Object.assign({}, base5, { id: 'g-prueba-2', folio: 'APD-G-2026-092', tipo_acreditacion: 'dictaminador', fecha_inicio: '2026-11-09', estado: 'en_integracion' }));
    otros.parametro.push({ clave: 'dias_inhabiles', valor: '2026-11-18', descripcion: 'prueba' });
    const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    await c2.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(otros), contentType: 'application/json' }));
    const p2 = await c2.newPage();
    await p2.goto(BASE + 'grupos.html?curso=poda-nueva&mes=2026-11&paso=2');
    await listoGrupos(p2);
    const r = await p2.evaluate(() => Object.fromEntries([...document.querySelectorAll('.arm-semana')].map((x) => [x.dataset.lunes, [(x.querySelector('[data-motivo]') || { dataset: {} }).dataset.motivo || '', x.querySelector('.arm-semana-cabeza').textContent.replace(/\s+/g, ' ').trim()]])));
    const otro = await p2.evaluate(() => (document.querySelector('.arm-marca[data-grupo="APD-G-2026-092"]') || { dataset: {} }).dataset.situacion);
    comprueba(r['2026-11-09'][0] === 'simultaneos' && /No disponible\s*Ya hay 2 grupos/.test(r['2026-11-09'][1]) && /otro curso/.test(r['2026-11-09'][1]) && otro === 'otro',
      t(`P149: la semana con 2 grupos (uno de otro curso) dice «No disponible · Ya hay 2 grupos» y pinta al de otro curso aparte (${r['2026-11-09'][1]})`));
    comprueba(r['2026-11-16'][0] === 'inhabil' && /No disponible\s*Día inhábil/.test(r['2026-11-16'][1]) && await p2.locator('.arm-dia[data-fecha="2026-11-18"] .arm-inhabil').count() === 1,
      t('P150: la semana con un día inhábil dice «No disponible · Día inhábil» y marca el día'));
    await c2.close();
  }
}

/* ── Armar un grupo en «Grupos» (antes «Programar un curso», propuesta B; desde el 24/10/2026, el paso a paso de la
   opción B1) y «Mis grupos de hoy» (propuesta D), 2026-10-18 ──
   La dirección vieja de «Programar» con cinco personas lleva al paso 3 con ellas; con menos de 5 se crea por confirmar y se
   dice antes; el calendario no deja empezar con menos de 7 días ni con 2 grupos esas fechas, se maneja con el teclado y
   llena el primer día; crear y confirmar. Después, darle semana a un grupo sin fecha que ya existe («Elegir semana»). El
   instructor ve «Mis grupos de hoy» en «Asistencia» y en «Aplicar el examen». */
async function caminosProgramar(navegador, ancho, alto, sufijo) {
  const t = (m) => `[programar ${sufijo}] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const texto = async (sel) => (await pg.textContent(sel)) || '';
  const sinFecha = datos.grupo.find((g) => g.estado === 'en_integracion' && !g.fecha_inicio);

  // E1-02 (auditoría 2026-10-19): ?grupo= con texto libre no se repite en pantalla; un folio con forma de folio, sí. Desde
  // el 24/10 programar.html lleva a Grupos con el mismo ?grupo=
  await pg.goto(BASE + `programar.html?grupo=${encodeURIComponent('APD-G-2026-999. Llame al 0000000000 para confirmar')}`);
  await pg.waitForURL(/grupos\.html/);
  await listoGrupos(pg);
  const reflejo = await pg.evaluate(() => document.body.innerText);
  await pg.goto(BASE + 'programar.html?grupo=APD-G-2026-999');
  await pg.waitForURL(/grupos\.html/);
  await listoGrupos(pg);
  comprueba(!/Llame al|0000000000/.test(reflejo) && /No se encontró ese grupo/.test(reflejo) && /No se encontró el grupo APD-G-2026-999/.test(await texto('[data-modo-grupo]')),
    t('E1-02: el texto libre de ?grupo= no se repite en pantalla; un folio válido que no existe, sí'));

  // B5-02 (auditoría 2026-10-19): salir con cambios lo advierte el navegador; recargar, «Atrás» y «Adelante» conservan la
  // semana elegida y el paso (van en la dirección)
  {
    const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    const p2 = await c2.newPage();
    const dialogos = [];
    p2.on('dialog', (d) => { dialogos.push(d.type()); d.accept(); });
    await p2.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
    await listoGrupos(p2);
    const sinCambios = await p2.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
    await p2.click('[data-mes="1"]');
    await p2.click('.arm-semana-elegir[data-lunes="2026-11-16"]');
    await p2.reload();
    await listoGrupos(p2);
    comprueba(!sinCambios && dialogos.includes('beforeunload') && (await p2.inputValue('#fecha_inicio')) === '16/11/2026' && /semana=2026-11-16/.test(p2.url()) && /mes=2026-11/.test(p2.url()),
      t('B5-02: recargar con cambios lo advierte y conserva la semana elegida y su mes; sin cambios no advierte'));
    await p2.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
    await listoGrupos(p2);
    await p2.click('[data-mes="1"]');
    await p2.click('.arm-semana-elegir[data-lunes="2026-11-23"]');
    await siguientePaso(p2);
    await p2.goBack();
    await p2.waitForFunction(() => FormKit.pasos.actual() === 1);
    const atras = [await pasoDe(p2), await p2.inputValue('#fecha_inicio'), p2.url()];
    await p2.goForward();
    await p2.waitForFunction(() => FormKit.pasos.actual() === 2);
    comprueba(atras[0] === 2 && atras[1] === '23/11/2026' && /paso=2/.test(atras[2]) && /paso=3/.test(p2.url()) && (await p2.inputValue('#fecha_inicio')) === '23/11/2026',
      t('B5-02: «Atrás» regresa al paso anterior con la semana elegida y «Adelante» vuelve al siguiente'));
    await c2.close();
  }
  // R4-15 (auditoría 2026-10-19): el calendario del curso no lleva el atributo del botón de calendario de los campos de
  // fecha, y su leyenda y sus motivos dicen los días de anticipación del parámetro (aquí 10)
  {
    const diez = JSON.parse(JSON.stringify(datos));
    diez.parametro.find((p) => p.clave === 'dias_anticipacion_grupo').valor = '10';
    const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    await c2.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(diez), contentType: 'application/json' }));
    const p2 = await c2.newPage();
    await p2.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
    await listoGrupos(p2);
    comprueba(!(await p2.evaluate(() => Boolean(document.querySelector('.arm-semana').closest('[data-calendario]')))) && /menos de 10 días/.test(await p2.textContent('[data-leyenda-no]'))
      && /Faltan menos de 10 días/.test(await p2.textContent('.arm-semana[data-lunes="2026-10-19"]')), t('R4-15: el calendario del curso no es un [data-calendario] y su leyenda y sus motivos toman los días del parámetro'));
    await c2.close();
  }

  // La dirección vieja de «Programar» con personas (?personas=) lleva al paso 3 con ellas marcadas
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
  await listoGrupos(pg);
  const cinco = (await pg.$$eval('[data-personas] .plan-persona input', (l) => l.map((i) => i.value))).slice(0, 5);
  await pg.goto(BASE + `programar.html?curso=poda-nueva&personas=${cinco.join(',')}`);
  await pg.waitForURL(/grupos\.html/);
  await listoGrupos(pg);
  const marcadas = await pg.$$eval('[data-personas] .plan-persona input:checked', (l) => l.map((i) => i.value));
  comprueba(marcadas.length === 5 && cinco.every((f) => marcadas.includes(f)) && await pasoDe(pg) === 3, t('programar.html con ?personas= lleva al paso 3 de Grupos con las cinco marcadas'));
  // Paso 2: la propuesta es el primer lunes que se puede. Desde la sesión del 23/10 (P149) pueden ir hasta 2 grupos a la
  // vez, de cualquier curso: el 26 de octubre ya tiene uno (APD-G-2026-005) y aun así se puede
  await pg.click('[data-barra] [data-ir="1"]');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 1);
  const elegida = pg.locator('.arm-semana[data-elegida]');
  comprueba((await elegida.getAttribute('data-lunes')) === '2026-10-26' && /1 lugar libre de 2/.test(await elegida.textContent()) && (await elegida.locator('.arm-marca[data-situacion="elegida"]').count()) === 5
    && (await pg.inputValue('#fecha_inicio')) === '26/10/2026', t('paso 2: propone el primer lunes posible (aunque ya haya un grupo: «1 lugar libre de 2») y marca los 5 días del grupo nuevo, con el primer día escrito'));
  comprueba(/Elegida/.test(await elegida.locator('.arm-semana-elegir').textContent()) && (await elegida.locator('.arm-semana-elegir').getAttribute('aria-pressed')) === 'true'
    && /^Semana elegida del 26 al 30 de octubre de 2026: 1 lugar libre de 2$/.test(await elegida.locator('.arm-semana-elegir').getAttribute('aria-label')), t('la semana elegida lo dice, con aria-pressed y su nombre completo'));
  // P150/P151: el curso de 5 días va de lunes a viernes: se elige la semana (sábado y domingo sombreados, sin botón); menos
  // de 7 días no se puede
  comprueba((await pg.$$('.arm-semana[data-lunes="2026-10-26"] .arm-dia[data-finde]')).length === 2 && (await pg.$$('.arm-dia-curso')).length === 0
    && (await pg.getAttribute('.arm-semana[data-lunes="2026-10-19"] [data-motivo]', 'data-motivo')) === 'anticipacion', t('de lunes a viernes: se elige la semana entera, sábado y domingo sombreados; con menos de 7 días, «No disponible»'));
  await pg.click('[data-mes="1"]');
  await pg.click('.arm-semana-elegir[data-lunes="2026-11-09"]');
  comprueba((await pg.getAttribute('.arm-semana-elegir[data-lunes="2026-11-09"]', 'aria-pressed')) === 'true' && (await pg.inputValue('#fecha_inicio')) === '09/11/2026' && /Del 9 al 13 de noviembre/.test(await texto('[data-elegida-nombre]')),
    t('tocar «Libre» elige la semana, escribe el primer día y la muestra a la derecha'));
  // Con el teclado: Tab llega al botón de la semana; Intro la elige y el foco se queda en ella
  await pg.focus('.arm-semana-elegir[data-lunes="2026-11-16"]');
  await pg.keyboard.press('Enter');
  comprueba((await pg.inputValue('#fecha_inicio')) === '16/11/2026' && await pg.evaluate(() => document.activeElement && document.activeElement.dataset.lunes) === '2026-11-16'
    && /Elegida la semana del 16 al 20 de noviembre/.test(await texto('[data-cal-estado]')), t('con el teclado: Intro elige la semana, el foco se queda en ella y se anuncia'));
  await siguientePaso(pg);
  // Paso 3: con menos de 5 se crea por confirmar, y se dice antes cuántas faltan
  await soloA(pg, cinco.slice(0, 2));
  await siguientePaso(pg);
  comprueba(/Se crea por confirmar/.test(await texto('[data-queda]')) && /3 personas más/.test(await texto('[data-queda]')) && /del 16 al 20 de noviembre/.test(await texto('[data-resumen]')),
    t('paso 4 con 2 personas: el resumen lleva el nombre calculado y dice que se crearía por confirmar, con cuántas faltan'));
  // Paso 4: ya no se propone instructor (ajustes del equipo, 25/10/2026: la asigna Capacitación); la hora no se elige: el
  // horario va en el resumen (24/10/2026)
  comprueba(await pg.locator('#instructor').count() === 0 && /Persona instructora\s*La asigna el área de Instructores y Capacitación/.test(await texto('[data-resumen]')),
    t('paso 4: ya no propone instructor: el resumen dice que la persona instructora la asigna el área de Instructores y Capacitación'));
  comprueba(await pg.locator('#hora_entrada').count() === 0 && /Horario\s*De 9:00 a 15:00, de lunes a viernes/.test(await texto('[data-resumen]')), t('paso 4: sin menú de hora; el resumen dice «Horario: de 9:00 a 15:00, de lunes a viernes»'));
  await sinDesborde(pg, t('grupos, paso 4'));
  await captura(pg, `programar-error-${sufijo}`);
  await pg.click('#paso-confirmar [data-accion="atras"]');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 2);
  await soloA(pg, cinco);
  await siguientePaso(pg);
  comprueba(/Se crea por confirmar/.test(await texto('[data-queda]')) && /Ya tiene lo que le toca a usted/.test(await texto('[data-queda]')) && (await texto('[data-armar="crear"]')) === 'Crear el grupo' && await pg.locator('[data-armar="sin-confirmar"]').count() === 0,
    t('con 5 personas y su semana: «Se crea por confirmar» (ya tiene lo que le toca a quien lo arma; lo confirma Capacitación), sin «Crear sin confirmar»'));
  await Promise.all([pg.waitForNavigation(), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Grupo creado, por confirmar: Poda nueva · del 16 al 20 de noviembre/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /APD-G-2026-007 · 5 personas · entrada a las 09:00/.test(await texto('[data-hecho]:not(.pasos-btn)'))
    && /Instructores y Capacitación le asigna la persona instructora y lo confirma/.test(await texto('[data-hecho]:not(.pasos-btn)'))
    && /Qué sigue/.test(await texto('[data-hecho]:not(.pasos-btn)')) && await pg.evaluate(() => document.activeElement && document.activeElement.closest('[data-hecho]:not(.pasos-btn)') !== null), t('«Crear el grupo»: aviso con el nombre calculado, el folio y «Qué sigue», con el foco ahí'));
  await captura(pg, `programar-hecho-${sufijo}`);
  await pg.reload();
  await listoGrupos(pg);
  comprueba(/Por confirmar/.test(await texto('[data-programados] tr[data-grupo="APD-G-2026-007"]')) && /Persona instructora/.test(await texto('[data-programados] tr[data-grupo="APD-G-2026-007"]'))
    && /Del 16\/11\/2026 al 20\/11\/2026/.test(await texto('[data-programados] tr[data-grupo="APD-G-2026-007"]')) && await pg.isHidden('[data-hecho]:not(.pasos-btn)'),
    t('al recargar, el grupo nuevo está por confirmar en su semana (le falta la persona instructora, de Capacitación) y el aviso no se repite'));
  // Un grupo sin fecha que ya existe: «Elegir semana» abre el paso 2 con ese grupo (sus personas ya están; se agregan más)
  await aProgramados(pg);
  await Promise.all([pg.waitForNavigation(), pg.click(`[data-programados] tr[data-grupo="${sinFecha.folio}"] a:has-text("Elegir semana")`)]);
  await listoGrupos(pg);
  comprueba(await pasoDe(pg) === 2 && new RegExp(`grupo=${sinFecha.folio}`).test(pg.url()), t('«Elegir semana» de la tabla abre el paso 2 con ese grupo'));
  await pg.click('[data-mes="1"]');
  await pg.click('.arm-semana-elegir[data-lunes="2026-11-23"]');
  await siguientePaso(pg);
  comprueba(/Ya están en el grupo \(4\)/.test(await texto('[data-ya-estan]')) && await pg.isHidden('[data-campo="integracion"]'), t('completar un grupo que existe: muestra a quienes ya están y no cambia su tipo'));
  await soloA(pg, []);
  await siguientePaso(pg);
  comprueba(/1 persona más/i.test(await texto('[data-queda]')) && (await texto('[data-armar="crear"]')) === 'Guardar los cambios', t('con 4 personas el grupo no se confirma: le falta una, y se dice antes'));
  await pg.click('#paso-confirmar [data-accion="atras"]');
  await pg.waitForFunction(() => FormKit.pasos.actual() === 2);
  await marcar(pg, '[data-personas] .plan-persona input');
  await siguientePaso(pg);
  await Promise.all([pg.waitForURL(/grupo\.html\?folio=/), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/Se guardaron los cambios del grupo/.test(await texto('[data-hecho]:not(.pasos-btn)')) && /del 23 al 27 de noviembre/.test(await texto('#t-grupo .grupo-nombre')) && (await texto('#t-grupo .grupo-folio')) === sinFecha.folio,
    t('el grupo sin fecha queda programado, con su mismo folio, por confirmar (lo confirma Capacitación)'));

  // «Mis grupos de hoy» del instructor: Asistencia y Aplicar el examen sin ?folio=. Desde la sesión del 23/10 (P150 y
  // P151) los cursos de cinco días van de lunes a viernes: al corte (miércoles 14/10) el instructor tiene un solo grupo
  // con clase, en su día 3 (APD-G-2026-003), y las dos pantallas entran directo a él; el viernes 9/10 tuvo el quinto día
  // de APD-G-2026-006 (se ve con la fecha de corte en ese día): «Mis grupos de hoy» con su tarjeta
  for (const [pagina, nombre, sel] of [['asistencia.html', 'Asistencia', '[data-bajada] .grupo-nombre'], ['aplicar.html', 'Aplicar el examen', '[data-grupo] .grupo-nombre']]) {
    await pg.goto(BASE + pagina);
    await pg.waitForSelector(sel);
    comprueba((await texto(sel)) === 'Poda nueva · del 12 al 16 de octubre · Iztapalapa', t(`${nombre} sin folio: con un solo grupo hoy entra directo a él, por su nombre calculado`));
    await sinDesborde(pg, t(`${nombre} sin folio`));
  }
  {
    const viernes = JSON.parse(JSON.stringify(datos));
    viernes.fecha_corte = '2026-10-09';
    await pg.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(viernes), contentType: 'application/json' }));
    await pg.goto(BASE + 'asistencia.html');
    await pg.waitForSelector('.hoy-grupo');
    const tarjetas = await pg.$$eval('.hoy-grupo', (l) => l.map((x) => ({ nombre: x.querySelector('.grupo-nombre').textContent, accion: x.querySelector('a.btn').getAttribute('href'), texto: x.textContent })));
    comprueba(/Mis grupos de hoy/.test(await texto('#t-mis-grupos, #t-sin-grupo')) && tarjetas.length === 1 && tarjetas[0].nombre === 'Poda nueva · del 5 al 9 de octubre' && /aplicar\.html\?folio=APD-G-2026-006/.test(tarjetas[0].accion)
      && /Repaso de conocimientos y examen final hoy/.test(tarjetas[0].texto) && /Pasar lista y aplicar/.test(tarjetas[0].texto),
    t('el quinto día del curso, «Mis grupos de hoy» dice «Repaso de conocimientos y examen final hoy» y lleva a «Pasar lista y aplicar»'));
    comprueba(/Próximos/.test(await texto('main')) && /del 26 al 30 de octubre/.test(await texto('.hoy-proximos')), t('«Mis grupos de hoy»: «Próximos» con los grupos que vienen'));
    await captura(pg, `mis-grupos-asistencia-${sufijo}`);
    await pg.click('.hoy-grupo a:has-text("Pasar lista y aplicar")');
    await pg.waitForURL(/aplicar\.html\?folio=APD-G-2026-006/);
    await pg.waitForSelector('[data-grupo] .grupo-nombre');
    comprueba(/Poda nueva · del 5 al 9 de octubre/.test(await texto('[data-grupo] .grupo-nombre')), t('«Aplicar el examen» abre el grupo de la tarjeta, con su nombre calculado'));
    await pg.unroute('**/datos/ficticios.json*');
  }
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
  await pg.waitForSelector('.asistencia-fila');
  comprueba((await texto('[data-bajada] .grupo-nombre')) === 'Poda nueva · del 12 al 16 de octubre · Iztapalapa' && (await texto('[data-bajada] .grupo-folio')) === 'APD-G-2026-003',
    t('«Asistencia» con ?folio= sigue funcionando y nombra al grupo por su nombre calculado'));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();
}

// Material de estudio (decisión 2026-10-18): la página pública sin cuenta y la del personal (agregar, ocultar)
async function materialEstudio(navegador, ancho, alto, sufijo) {
  const t = (m) => `[material ${sufijo}] ${m}`;
  // F3-01 (auditoría 2026-10-19): cada PDF que el proyecto abre con pdf.js por su cuenta lleva isEvalSupported: false,
  // como el visor del estándar
  const llamadas = readdirSync(join(raiz, 'sitio/app')).filter((f) => f.endsWith('.js'))
    .flatMap((f) => readFileSync(join(raiz, 'sitio/app', f), 'utf8').split('\n').filter((l) => /getDocument\(/.test(l)).map((l) => [f, l]));
  comprueba(llamadas.length > 0 && llamadas.every(([, l]) => /isEvalSupported: false/.test(l)), t(`F3-01: cada llamada a getDocument( de sitio/app (${llamadas.length}) lleva isEvalSupported: false`));
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const publicos = datos.material_estudio.filter((m) => m.vigente && m.publicado);
  await pg.goto(BASE + 'material.html');
  await pg.waitForSelector('.material-doc');
  comprueba((await pg.$$('.material-doc')).length === publicos.length && /libro cerrado/.test(await pg.textContent('main')),
    t(`la página pública muestra los ${publicos.length} documentos publicados y avisa que el examen es a libro cerrado`));
  const enlaces = await pg.$$eval('.material-archivo a[download]', (as) => as.map((a) => a.getAttribute('href')));
  let descargan = 0;
  for (const h of enlaces) if ((await pg.request.get(BASE + h)).status() === 200) descargan += 1;
  comprueba(enlaces.length === publicos.length && descargan === enlaces.length, t('cada documento se descarga'));
  const resumen = async () => Number(((await pg.textContent('[data-resumen]')) || '').match(/(\d+) apartados/)[1]);
  const poda = await resumen();
  await pg.check('input[name="curso"][value="dictaminador"]');
  comprueba(await resumen() > poda, t('quien prepara dictaminador ve además los apartados de dictaminación'));
  await pg.click('.material-temas summary');
  comprueba(/#page=\d+$/.test(await pg.getAttribute('.material-temas-lista a', 'href')), t('cada apartado abre el PDF en su página'));
  await sinDesborde(pg, t('página pública'));
  await captura(pg, `material-${sufijo}`);

  await pg.goto(BASE + 'material-personal.html');
  await pg.waitForSelector('[data-filas] tr');
  comprueba((await pg.$$('[data-filas] tr')).length === publicos.length, t('el personal ve los documentos con su situación'));
  await pg.click('[data-agregar]');
  await pg.fill('#titulo', 'Guía de prueba');
  await pg.fill('#edicion', 'Edición de prueba');
  await pg.fill('#descripcion', 'Un documento para probar la carga del material.');
  await pg.check('input[name="para"][value="ambas"]');
  await pg.fill('#temas', '2 - Introducción\n90 - Fuera del documento');
  await pg.setInputFiles('[data-campo="archivo"] input[type="file"]', join(raiz, 'sitio/material/NADF-001-RNAT-2015.pdf'));
  await pg.click('[data-guardar]');
  await pg.waitForFunction(() => /página 90/.test(document.querySelector('[data-campo="temas"]').textContent), null, { timeout: 15000 }).catch(() => {});
  const errTemas = (await pg.textContent('[data-campo="temas"]')) || '';
  comprueba(/página 90/.test(errTemas), t('un apartado con una página que no existe en el PDF no se guarda'));
  await pg.fill('#temas', '2 - Introducción\n7 - Requisitos (sólo dictaminador)');
  await pg.click('[data-guardar]');
  await pg.waitForURL(/hecho=nuevo/, { timeout: 20000 });
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/agregado/.test(await pg.textContent('[data-resultado]')), t('agregar un documento muestra el resultado'));
  await captura(pg, `material-personal-${sufijo}`);
  await pg.goto(BASE + 'material.html');
  await pg.waitForSelector('.material-doc');
  comprueba((await pg.$$('.material-doc')).length === publicos.length + 1, t('el documento agregado y publicado aparece en la página pública'));
  await pg.goto(BASE + 'material-personal.html');
  await pg.waitForSelector('[data-filas] tr');
  // C4 (auditoría 2026-10-18): editar, ocultar y publicar el documento agregado combinan con lo guardado, no lo borran
  const guia = () => pg.locator('[data-filas] tr', { hasText: 'Guía de prueba' });
  await guia().locator('[data-accion-material="editar"]').click();
  await pg.fill('#descripcion', 'Descripción editada en la prueba.');
  await pg.click('[data-guardar]');
  await pg.waitForURL(/hecho=editar/, { timeout: 15000 });
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  await guia().locator('[data-accion-material="ocultar"]').click();
  await pg.click('dialog [data-r="si"]');
  await pg.waitForURL(/hecho=oculto/);
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  const renglonGuia = (await guia().innerText()).replace(/\s+/g, ' ');
  comprueba(/Guía de prueba/.test(renglonGuia) && /\d+ págs\./.test(renglonGuia) && !/undefined|Invalid/.test(renglonGuia) && /Sin publicar/.test(renglonGuia),
    t(`C4: editar y ocultar el documento agregado conservan su archivo y sus datos, con su resultado (${renglonGuia.slice(0, 90)})`));
  await guia().locator('[data-accion-material="publicar"]').click();
  await pg.waitForURL(/hecho=publicado/);
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/Publicado/.test(await guia().innerText()), t('C4: publicarlo de nuevo lo deja publicado'));
  // Uno de los ficticios: la edición no se pierde al ocultarlo después
  const ficticio = datos.material_estudio.find((m) => m.vigente && m.publicado && m.clave !== 'ley_ambiental');
  await pg.click(`tr[data-clave-material="${ficticio.clave}"] [data-accion-material="editar"]`);
  await pg.fill('#titulo', `${ficticio.titulo} (editado)`);
  await pg.click('[data-guardar]');
  await pg.waitForURL(/hecho=editar/, { timeout: 15000 });
  await pg.click(`tr[data-clave-material="${ficticio.clave}"] [data-accion-material="ocultar"]`);
  await pg.click('dialog [data-r="si"]');
  await pg.waitForURL(/hecho=oculto/);
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba((await pg.textContent(`tr[data-clave-material="${ficticio.clave}"]`)).includes('(editado)'), t('C4: editar y después ocultar un documento de los ficticios conserva la edición'));
  await pg.click(`tr[data-clave-material="${ficticio.clave}"] [data-accion-material="publicar"]`);
  await pg.waitForURL(/hecho=publicado/);
  await pg.waitForSelector('[data-filas] tr');
  await pg.click('tr[data-clave-material="ley_ambiental"] [data-accion-material="ocultar"]');
  await pg.click('dialog [data-r="si"]');
  await pg.waitForURL(/hecho=oculto/);
  await pg.goto(BASE + 'material.html');
  await pg.waitForSelector('.material-doc');
  comprueba((await pg.$$('.material-doc')).length === publicos.length && !/Ley Ambiental/.test(await pg.textContent('[data-material]')),
    t('un documento oculto deja de verse en la página pública'));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();
}

/* Lo guardado en la versión de prueba llega a los datos como lo dejaría la base (auditoría 2026-10-18, C1, C2 y B5) */
async function persistenciaPrueba(navegador) {
  const t = (m) => `[persistencia] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: 1280, height: 900 } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  // C1: la corrección de una cita en pausa de una solicitud ficticia llega a la agenda del personal
  const pausa = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sp = datos.solicitud.find((s) => s.id === pausa.solicitud_id);
  await pg.goto(BASE + 'index.html');
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sp.solicitante_id);
  await pg.goto(BASE + `corregir.html?folio=${sp.folio}`);
  await pg.waitForSelector('#formulario:not([hidden])');
  for (const campo of await pg.$$('#formulario [data-campo^="doc_"]')) if (await campo.isVisible()) await (await campo.$('input[type="file"]')).setInputFiles(PDF);
  await pg.click('#formulario [data-accion="enviar"]');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  await pg.goto(BASE + `citas.html?dia=${datos.fecha_corte}`);
  await pg.waitForSelector('main tr');
  const fila = await pg.locator('tr', { hasText: sp.folio }).first().innerText();
  comprueba(/Documento cargado/.test(fila), t(`C1: la corrección de la cita en pausa de ${sp.folio} llega a la agenda («Documento cargado · retomar»)`));
  // C2: dos reenvíos de una solicitud con observaciones conservan la revisión de en medio. La solicitud ya trae una
  // revisión con observaciones y aquí recibe dos más: desde los ajustes del equipo (25/10/2026) la tercera la cerraría
  // (oportunidades_correccion = 2), así que esta comprobación corre con 3 oportunidades (el cierre se prueba en SOLO=ajustes25)
  await pg.route('**/datos/ficticios.json*', async (r) => { const res = await r.fetch(); const j = await res.json(); j.parametro.find((x) => x.clave === 'oportunidades_correccion').valor = '3'; await r.fulfill({ response: res, json: j }); });
  await pg.goto(BASE + 'revision.html');
  await pg.waitForFunction(() => window.APD_PERSONAL && window.APD_ARCHIVOS_PRUEBA);
  const so = datos.solicitud.find((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda');
  const revisionesAntes = datos.revision.filter((r) => r.solicitud_id === so.id).length;
  const r2 = await pg.evaluate(async (F) => {
    const espera = () => new Promise((r) => setTimeout(r, 30));
    const blob = new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' });
    const envio = () => APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: F, existente: true, estado_desde: new Date().toISOString(), persona: {} },
      [{ requisito: 'curp', blob, nombre: 'curp.pdf', tipo: 'application/pdf', size: 16 }]);
    const observa = () => APD_PERSONAL.guardaRevision(F, { resultado: 'con_observaciones', datos: { decision_curp: 'con_observacion', observacion_curp: 'No se lee.' }, revisor: 'revision.prueba', en: new Date().toISOString() });
    await envio(); await espera(); observa(); await espera(); await envio(); await espera(); observa(); await espera(); await envio();
    const d = await APD.cargar();
    const s = d.solicitud.find((x) => x.folio === F);
    return { estado: s.estado, revisiones: d.revision.filter((x) => x.solicitud_id === s.id).length, cargas: d.documento.filter((x) => x.solicitud_id === s.id && x.requisito === 'curp').length };
  }, so.folio);
  comprueba(r2.estado === 'enviada' && r2.revisiones === revisionesAntes + 2 && r2.cargas >= 4,
    t(`C2: con dos reenvíos se conservan las dos revisiones de la prueba y cada carga (${JSON.stringify(r2)})`));
  await pg.unroute('**/datos/ficticios.json*');
  // B5: un grupo confirmado en la prueba se inicia desde el menú de pruebas y ya admite asistencia
  const gi = datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio);
  await pg.goto(BASE + `grupo.html?folio=${gi.folio}`);
  await pg.waitForSelector('[data-sesion-personal] a');
  await pg.evaluate(async (folio) => {
    const d = await APD.cargar();
    const g = d.grupo.find((x) => x.folio === folio);
    const n = d.inscripcion.filter((i) => i.grupo_id === g.id && i.activa).length;
    const folios = APD_PERSONAL.enEspera(d, g.tipo_acreditacion, g.modalidad).slice(0, Math.max(0, g.cupo_minimo - n)).map((x) => x.s.folio);
    if (folios.length) await APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: g.id, folios, por: 'revision.prueba' });
    await new Promise((r) => setTimeout(r, 20));
    // Lo confirma el área de Instructores y Capacitación (ajustes del equipo, 25/10/2026)
    await APD_PERSONAL.guardaGrupo({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: APD.sumaDias(d.fecha_corte, 8), hora_entrada: '09:00', instructor: 'instructor.ficticio', perfil: 'capacitacion', por: 'capacitacion.prueba' });
  }, gi.folio);
  await pg.reload();
  await pg.click('.menu-pruebas-boton');
  await Promise.all([pg.waitForNavigation(), pg.click('dialog.menu-pruebas button:has-text("Iniciar el curso hoy")')]);
  await pg.goto(BASE + `asistencia.html?folio=${gi.folio}`);
  await pg.waitForLoadState('networkidle');
  comprueba(await pg.isHidden('[data-sin-grupo]') && /Día 1 de/.test(await pg.textContent('main')), t(`B5: el grupo ${gi.folio} confirmado se inicia en la prueba y su asistencia se captura`));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();
}

/* ── Auditoría «intentar romperlo» (18/10/2026), bloque 1: errores de lógica que pasarían al sistema real ──
   Una comprobación por hallazgo corregido (F1 = persona, F2 = revisión y cotejo, F3 = grupos y examen, F4 = datos y
   material); cada una habría detectado el error. Cada parte, en su propio navegador limpio. */
const PDF_PROTEGIDO = { name: 'protegido.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>\nendobj\ntrailer\n<< /Root 2 0 R /Encrypt 1 0 R >>\n%%EOF\n') };
const PDF_UNA_HOJA = { name: 'una-hoja.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n') };
const pdfDe = (bytes, nombre) => ({ name: nombre, mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes - 9, 0x20)]) });
const sumaDiasIso = (iso, n) => { const d = new Date(`${iso}T12:00:00-06:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const sumaMesesIso = (iso, n) => { const d = new Date(`${iso}T12:00:00-06:00`); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
/* Pega un texto en un control como lo haría el navegador (evento paste con su portapapeles) y devuelve el valor */
const pega = (pg, sel, texto) => pg.evaluate(([q, t]) => {
  const c = document.querySelector(q);
  c.value = '';
  c.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', t);
  const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  if (c.dispatchEvent(e)) { c.value = t.slice(0, c.maxLength > 0 ? c.maxLength : undefined); c.dispatchEvent(new Event('input', { bubbles: true })); }
  return c.value;
}, [sel, texto]);
const esperaQue = async (pg, fn, arg, ms = 6000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await pg.evaluate(fn, arg).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
};

async function romper(navegador) {
  const t = (m) => `[romper] ${m}`;
  const contexto = async (ancho = 1280, alto = 900) => {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(`${pg.url()} · ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(`${pg.url()} · ${m.text()}`); });
    return { c, pg, errores };
  };
  const sesion = (pg, id) => pg.evaluate((x) => localStorage.setItem('apd.sesion', JSON.stringify({ id: x })), id);
  const sinErrores = (errores, que) => comprueba(errores.length === 0, t(`${que}: sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));

  /* ── F1 · persona ── */
  let { c, pg, errores } = await contexto();
  await pg.goto(BASE + 'index.html');
  await sesion(pg, libre.id);
  await pg.goto(BASE + 'solicitud.html');
  await pg.waitForSelector(`${pasoVisible} #nivel_estudios`);
  // 12 · la carrera escrita lleva letras
  await pg.selectOption('#nivel_estudios', 'licenciatura');
  // En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026)
  if (await pg.isVisible('[data-campo="estatus_estudios"]')) await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
  for (const raro of ['🌳🌳🌳', '...']) {
    await pg.fill('#carrera', raro);
    await pg.keyboard.press('Escape');
    await siguiente(pg);
    const err = (await pg.textContent('[data-campo="carrera"] .err')) || '';
    comprueba(/letras/.test(err) && await pg.isVisible('#nivel_estudios'), t(`F1 12: la carrera «${raro}» no se acepta («${err.trim()}»)`));
  }
  await pg.fill('#carrera', 'Biología');
  await pg.keyboard.press('Escape');
  await siguiente(pg);
  await pg.waitForSelector(`${pasoVisible} [data-campo="doc_poda_nueva_curp"]`);
  // 13 · con teclado, al quedar cargado el archivo el foco va a su «Quitar», no a <body>
  await pg.focus('[data-campo="doc_poda_nueva_curp"] .zona-carga');
  await pg.setInputFiles('[data-campo="doc_poda_nueva_curp"] [data-archivos] > input[type="file"]', PDF);
  await pg.waitForSelector('[data-campo="doc_poda_nueva_curp"] .lista-arch li[data-estado="listo"]');
  await pg.waitForTimeout(200);
  const foco = await pg.evaluate(() => ({ tag: document.activeElement.tagName, clase: document.activeElement.className, dentro: Boolean(document.activeElement.closest('[data-campo="doc_poda_nueva_curp"]')) }));
  comprueba(foco.tag !== 'BODY' && /arch-quitar/.test(foco.clase) && foco.dentro, t(`F1 13: después de cargar, el foco queda en «Quitar» del archivo (${foco.tag}.${foco.clase})`));
  // 8 · un PDF con contraseña se rechaza al cargarlo, con su mensaje de tú
  await pg.setInputFiles('[data-campo="doc_poda_nueva_identificacion_oficial"] [data-archivos] > input[type="file"]', PDF_PROTEGIDO);
  const rechazado = await pg.waitForSelector('[data-campo="doc_poda_nueva_identificacion_oficial"] [data-rechazos] .arch-rechazo', { timeout: 5000 }).then(() => true, () => false);
  const motivo = rechazado ? await pg.textContent('[data-campo="doc_poda_nueva_identificacion_oficial"] [data-rechazos]') : '';
  comprueba(rechazado && /contraseña/.test(motivo) && /Guárdalo/.test(motivo) && await pg.locator('[data-campo="doc_poda_nueva_identificacion_oficial"] .lista-arch li').count() === 0,
    t(`F1 8: un PDF con contraseña se rechaza al cargarlo («${motivo.trim()}»)`));
  // F1 7 y F4 M6 · el borrador guarda el documento aparte, el menú lo cuenta como borrador y «Empezar de nuevo» lo borra
  const folioB = `borrador:${libre.id}:nueva`;
  const guardadoB = await esperaQue(pg, (f) => APD_ARCHIVOS_PRUEBA.documentos(f).then((l) => l.length >= 1), folioB);
  const cuenta = await pg.evaluate(() => APD_ARCHIVOS_PRUEBA.guardado());
  comprueba(guardadoB && cuenta.documentos === 0 && cuenta.borradores === 1 && cuenta.borradorArchivos >= 1,
    t(`F4 M6: los archivos del borrador se cuentan como borrador, no como «documentos cargados aparte» (${JSON.stringify({ d: cuenta.documentos, b: cuenta.borradores, a: cuenta.borradorArchivos })})`));
  await esperaQue(pg, (k) => Boolean(localStorage.getItem(k)), `apd.borrador.solicitud.${libre.id}.nueva`);
  await pg.reload();
  await pg.waitForSelector('[data-franja-borrador]:not([hidden])');
  await pg.click('[data-borrador="descartar"]');
  // 1.5.1 (FRM-42): «Empezar de nuevo» lleva el foco a «Conservar», no al botón que borra, y ése dice «Descartar borrador»
  const foco151 = await pg.evaluate(() => ({ foco: document.activeElement && document.activeElement.dataset.borrador, borra: document.querySelector('[data-borrador="descartar-si"]').textContent.trim() }));
  comprueba(foco151.foco === 'conservar' && foco151.borra === 'Descartar borrador', t(`1.5.1: «Empezar de nuevo» lleva el foco a «Conservar» y el botón que borra dice «Descartar borrador» (${JSON.stringify(foco151)})`));
  await pg.click('[data-borrador="descartar-si"]');
  comprueba(await esperaQue(pg, (f) => APD_ARCHIVOS_PRUEBA.documentos(f).then((l) => l.length === 0), folioB),
    t('F1 7: «Empezar de nuevo» borra también los documentos del borrador'));
  // 5 · el reenvío guarda lo corregido (estudios, experiencia, adscripción) y recalcula el perfil
  const obsDict = datos.solicitud.find((x) => x.estado === 'con_observaciones' && x.tipo_acreditacion === 'dictaminador');
  const borr = datos.solicitud.find((x) => x.estado === 'borrador');
  const alcaldia = datos.organizacion.find((o) => o.tipo === 'alcaldia');
  const r5 = await pg.evaluate(async ([fo, fb, org]) => {
    const A = APD_ARCHIVOS_PRUEBA;
    await A.guardaEnvio({ folio: fo, existente: true, estado_desde: new Date().toISOString(), nivel_estudios: 'maestria', carrera: 'Ciencias Forestales', carrera_tecnica: null,
      estatus_estudios: null, anios_experiencia: 7, persona: { adscripcion: 'alcaldia', organizacion_id: org, organizacion_nombre: '' } }, []);
    await A.guardaEnvio({ folio: fb, existente: true, estado_desde: new Date().toISOString(), nivel_estudios: 'tecnica', carrera: null, carrera_tecnica: 'Técnico forestal',
      estatus_estudios: null, anios_experiencia: 6, persona: { adscripcion: 'independiente', organizacion_id: null, organizacion_nombre: '' } }, []);
    const d = await APD.cargar();
    const so = d.solicitud.find((x) => x.folio === fo);
    const sb = d.solicitud.find((x) => x.folio === fb);
    return { o: [so.estado, so.nivel_estudios, so.carrera, so.anios_experiencia, so.perfil_academico, so.experiencia_minima, so.adscripcion, so.organizacion_id === org],
      b: [sb.estado, sb.nivel_estudios, sb.carrera_tecnica, sb.carrera] };
  }, [obsDict.folio, borr.folio, alcaldia.id]);
  comprueba(JSON.stringify(r5.o) === JSON.stringify(['enviada', 'maestria', 'Ciencias Forestales', 7, 'licenciatura_afin', 2, 'alcaldia', true]),
    t(`F1 5: el reenvío guarda estudios, experiencia y adscripción corregidos y recalcula perfil y mínimo (${JSON.stringify(r5.o)})`));
  comprueba(JSON.stringify(r5.b) === JSON.stringify(['enviada', 'tecnica', 'Técnico forestal', null]), t(`F1 5: el borrador enviado guarda lo que se cambió (${JSON.stringify(r5.b)})`));
  sinErrores(errores, 'F1 solicitud');
  await c.close();

  // 6 · «Mi perfil»: «Editar» propone lo último guardado
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'index.html');
  await sesion(pg, CON_ORG.id);
  await pg.goto(BASE + 'datos.html');
  await pg.waitForSelector('[data-editar="contacto"]');
  const correoNuevo = `nuevo.${Date.now()}@ejemplo.local`;
  await pg.click('[data-editar="contacto"]');
  await pg.waitForSelector('#form-contacto:not([hidden])');
  await pg.fill('#form-contacto #correo', correoNuevo);
  await pg.fill('#form-contacto #correo2', correoNuevo);
  await pg.click('#form-contacto [data-accion="enviar"]');
  await pg.waitForSelector('[data-guardado="contacto"]:not([hidden])');
  await pg.click('[data-editar="contacto"]');
  comprueba(await esperaQue(pg, (v) => document.querySelector('#form-contacto #correo').value === v, correoNuevo), t('F1 6: «Editar» contacto propone el correo recién guardado'));
  await pg.click('#form-contacto [data-cancelar]');
  await pg.click('[data-editar="adscripcion"]');
  await pg.waitForSelector('#form-adscripcion:not([hidden])');
  await pg.check('#form-adscripcion input[name="adscrito"][value="si"]', { force: true });
  await pg.check('#form-adscripcion input[name="tipo_adscripcion"][value="alcaldia"]', { force: true });
  await pg.selectOption('#form-adscripcion #alcaldia', alcaldia.clave);
  await pg.click('#form-adscripcion [data-accion="enviar"]');
  await pg.waitForSelector('[data-guardado="adscripcion"]:not([hidden])');
  await pg.click('[data-editar="adscripcion"]');
  comprueba(await esperaQue(pg, (k) => document.querySelector('#form-adscripcion input[name="tipo_adscripcion"][value="alcaldia"]').checked && document.querySelector('#form-adscripcion #alcaldia').value === k, alcaldia.clave),
    t('F1 6: «Editar» adscripción propone la alcaldía recién guardada, no «independiente»'));
  sinErrores(errores, 'F1 Mi perfil');
  await c.close();

  // 9, 10 y 11 · Verificar y la CURP pegada
  ({ c, pg, errores } = await contexto(390, 844));
  await pg.goto(BASE + 'verificar.html');
  await pg.fill('#numero', vigente.numero);
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-verificacion]:not([hidden])');
  await pg.fill('#numero', 'XX');
  const ocultoAlEscribir = await pg.isHidden('[data-verificacion]');
  await pg.click('[data-accion="enviar"]');
  await pg.waitForTimeout(400);
  comprueba(ocultoAlEscribir && await pg.isHidden('[data-verificacion]'), t('F1 9: el resultado anterior se oculta al escribir otro número y cuando el nuevo no es válido'));
  comprueba(/credencial/.test(await pg.textContent('[data-campo="numero"] .err')), t('F1 10: el mensaje de un número inválido habla de la credencial, no de un folio o un acuse'));
  await pg.fill('#numero', vigente.numero.replace(/-/g, '').toLowerCase());
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-verificacion]:not([hidden])');
  comprueba(/Vigente/.test(await pg.textContent('[data-verificacion]')), t(`F1 10: ${vigente.numero.replace(/-/g, '')} (sin guiones) se encuentra vigente`));
  for (const pagina of ['cuenta.html', 'entrar.html']) {
    await pg.goto(BASE + pagina);
    await pg.waitForSelector('#curp');
    const v = await pega(pg, '#curp', ` ${CON_ORG.curp}`);
    comprueba(v === CON_ORG.curp, t(`F1 11: en ${pagina}, la CURP pegada con un espacio queda completa (${v})`));
  }
  sinErrores(errores, 'F1 verificar y CURP');
  await c.close();

  /* ── F2 · revisión y cotejo ── */
  ({ c, pg, errores } = await contexto());
  const podaEnviada = enviadas.find((x) => x.tipo_acreditacion === 'poda' && !datos.revision.some((r) => r.solicitud_id === x.id));
  await pg.goto(BASE + `revisar.html?folio=${podaEnviada.folio}`);
  await pg.waitForSelector('#formulario:not([hidden])');
  await aceptaTodos(pg); // por pasos: cada documento en el suyo, hasta «Fecha de la cita»
  await pg.waitForSelector('#cita_fecha', { state: 'visible' });
  comprueba(await pega(pg, '#cita_fecha', '2026-10-20') === '20/10/2026', t('F2 A1: la fecha pegada como 2026-10-20 queda 20/10/2026, no 20/02/6102'));
  comprueba(await pega(pg, '#cita_fecha', ' 2026 - 10 - 21 ') === '21/10/2026', t('F2 A1: la fecha pegada como AAAA - MM - DD con espacios queda dd/mm/aaaa'));
  comprueba(await pega(pg, '#cita_fecha', ' 20/10/2026 ') === '20/10/2026', t('F2 B2: la fecha pegada con espacios alrededor queda completa'));
  // Lo que pone de una vez el autocompletado, el dictado o arrastrar texto (sin evento paste) también se acomoda
  for (const v of [' 20/10/2026 ', '2026-10-20']) {
    await pg.fill('#cita_fecha', '');
    await pg.focus('#cita_fecha');
    await pg.keyboard.insertText(v);
    comprueba(await pg.inputValue('#cita_fecha') === '20/10/2026', t(`F2 A1 y B2: «${v}» puesto de una vez queda 20/10/2026 (${await pg.inputValue('#cita_fecha')})`));
  }
  const max = sumaMesesIso(datos.fecha_corte, 6);
  comprueba(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-max') === max && (await pg.textContent('[data-cita-hasta]')) === dma(max),
    t(`F2 M4: la fecha de la cita tiene límite superior (${dma(max)}, meses_adelanto_cita) y la ayuda lo dice`));
  await pg.fill('#cita_fecha', '31/12/9999');
  await pg.locator('#cita_fecha').blur();
  await pg.click('[data-accion="enviar"]');
  comprueba(/posterior/.test((await pg.textContent('[data-campo="cita_fecha"] .err')) || ''), t('F2 M4: una cita el 31/12/9999 se rechaza con su mensaje'));
  // Desde la sesión del 23/10 (P151): de lunes a viernes, de 9:30 a 14:30
  comprueba(/de lunes a viernes/.test(await pg.textContent('#ay-cita_fecha')) && /de 9:30 a 14:30/.test(await pg.textContent('#ay-cita-hora')), t('F2 M4: la ayuda dice los días y el horario de atención (de lunes a viernes, de 9:30 a 14:30)'));
  // B3 · la observación conserva el nombre propio y sus renglones
  const b3 = await pg.evaluate(() => {
    const txt = APD.observacionDe('Comprobante de domicilio', 'Juárez no es tu alcaldía según lo que cargó.\n1) Uno\n2) Dos');
    const ul = document.createElement('ul'); ul.className = 'lista-obs'; const li = document.createElement('li'); ul.append(li); document.body.append(ul);
    const ws = getComputedStyle(li).whiteSpace; ul.remove();
    return { txt, ws, comun: APD.observacionDe('Constancia', 'La constancia no está actualizada') };
  });
  comprueba(b3.txt.startsWith('Comprobante de domicilio: Juárez') && /cargaste/.test(b3.txt) && b3.txt.includes('\n1) Uno') && b3.ws === 'pre-line' && /no está actualizada/.test(b3.comun),
    t(`F2 B3: la observación conserva «Juárez» y sus renglones (${JSON.stringify(b3)})`));
  comprueba(!/tal como lo escriba/.test(await pg.textContent('#formulario')), t('F2 B3: la ayuda ya no promete «tal como lo escriba»'));
  sinErrores(errores, 'F2 revisión');
  await c.close();

  // M3 · la clasificación de la carrera se guarda y recalcula el perfil
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'revision.html');
  const m3 = await pg.evaluate(async (F) => {
    APD_PERSONAL.guardaRevision(F, { resultado: 'validada', texto: 'Validada', datos: { clasificacion: 'afin', cita_fecha: '2026-10-22', cita_hora: '12:00' }, revisor: 'revision.prueba', en: new Date().toISOString() });
    const d = await APD.cargar();
    const s = d.solicitud.find((x) => x.folio === F);
    const car = d.carrera.find((x) => x.nombre_normalizado === APD_PERFIL_ACADEMICO.normaliza(s.carrera));
    return { estado: s.estado, perfil: s.perfil_academico, minimo: s.experiencia_minima, grupo: car && car.grupo };
  }, porClasificar.folio);
  comprueba(m3.estado === 'validada_en_linea' && m3.perfil !== 'por_clasificar' && m3.grupo === 'afin' && [2, 5].includes(m3.minimo),
    t(`F2 M3: la clasificación de la carrera queda en el catálogo y en el perfil de la solicitud (${JSON.stringify(m3)})`));
  await c.close();

  // A6 · una cita que todavía no llega no se atiende; en la prueba, «como si fuera su día»
  ({ c, pg, errores } = await contexto());
  const diaCita = conCita.cita_en.slice(0, 10);
  await pg.goto(BASE + `cotejo.html?folio=${conCita.folio}`);
  await pg.waitForSelector('[data-futura]:not([hidden])');
  comprueba(await pg.isHidden('#formulario') && /atiende ese día/i.test(await pg.textContent('[data-futura]')) && await pg.isVisible('[data-atender-simulada]'),
    t('F2 A6: una cita futura muestra su fecha sin formulario (en la prueba, con «Atenderla como si fuera…»)'));
  const a6 = await pg.evaluate(async ([F, en]) => {
    APD_PERSONAL.guardaCotejo(F, { resultado: 'no_se_presento', datos: { se_presento: 'no', cita_fecha: '2026-10-23', cita_hora: '09:00' }, en: new Date().toISOString(), cita_en: en, atendio: 'revision.prueba' });
    const d = await APD.cargar();
    const s = d.solicitud.find((x) => x.folio === F);
    return { inasistencias: s.inasistencias || 0, abiertas: d.cita.filter((x) => x.solicitud_id === s.id && x.resultado === 'pendiente').length, cita: s.cita_en };
  }, [conCita.folio, conCita.cita_en]);
  comprueba(a6.inasistencias === 0 && a6.abiertas === 1 && a6.cita === conCita.cita_en, t(`F2 A6: una inasistencia registrada antes del día de la cita no se aplica (${JSON.stringify(a6)})`));
  await pg.evaluate(() => localStorage.removeItem('apd.personal.cotejos'));
  await pg.reload();
  await pg.click('[data-atender-simulada]');
  await pg.waitForSelector('#formulario:not([hidden])');
  comprueba(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min') === sumaDiasIso(diaCita, 1) && await pg.getAttribute('[data-campo="cita_fecha"]', 'data-max') === sumaMesesIso(datos.fecha_corte, 6),
    t('F2 A6 y M4: la cita nueva no puede quedar antes de la perdida (desde el día siguiente) ni más allá del límite'));
  // M2 · RFC y folio fiscal pegados con espacios y guiones: se limpian antes de medir el largo
  comprueba(await pega(pg, '#factura_rfc', 'MUPA 800101 AB1') === 'MUPA800101AB1' && await pega(pg, '#factura_rfc', 'MUPA-800101-AB1') === 'MUPA800101AB1',
    t('F2 M2: el RFC pegado con espacios o guiones queda completo'));
  comprueba((await pega(pg, '#factura_folio_fiscal', ' 6f1c2d3e 4a5b 4c6d 8e7f 9a0b1c2d3e4f ')).replace(/-/g, '') === '6f1c2d3e4a5b4c6d8e7f9a0b1c2d3e4f',
    t('F2 M2: el folio fiscal pegado con espacios no pierde caracteres'));
  comprueba(Number(await pg.getAttribute('#factura_rfc', 'maxlength')) >= 20 && Number(await pg.getAttribute('#factura_folio_fiscal', 'maxlength')) >= 45,
    t('F2 M2: el largo lo mide la validación del formato, no el maxlength del control'));
  await pg.goto(BASE + `citas.html?dia=${diaCita}`);
  await pg.waitForSelector(`[data-filas] tr[data-folio="${conCita.folio}"]`);
  comprueba(/Ver la cita/.test(await pg.textContent(`[data-filas] tr[data-folio="${conCita.folio}"]`)) && !/Atender/.test(await pg.textContent(`[data-filas] tr[data-folio="${conCita.folio}"]`)),
    t('F2 A6: en la agenda, una cita de un día que no llega dice «Ver la cita», no «Atender»'));
  sinErrores(errores, 'F2 cita futura');
  await c.close();

  // A7 y B1 · retomar una pausa sin documento nuevo; la agenda y el cotejo leen lo que la persona carga después
  const pausaCita = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sPausa = datos.solicitud.find((x) => x.id === pausaCita.solicitud_id);
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'revision.html');
  const a7 = await pg.evaluate(async ([F, en]) => {
    const d0 = await APD.cargar();
    const s0 = d0.solicitud.find((x) => x.folio === F);
    const k = s0.cotejo_pausa.docs[0];
    APD_PERSONAL.guardaCotejo(F, { resultado: 'terminado', datos: { [`coincide_${k}`]: 'si', pago: 'si', factura_rfc: 'XAXX010101000', factura_razon_social: 'Prueba', factura_folio_fiscal: '6F1C2D3E-4A5B-4C6D-8E7F-9A0B1C2D3E4F' },
      en: new Date().toISOString(), cita_en: en, expediente: 'EXP-2026-9999', atendio: 'revision.prueba' });
    const d = await APD.cargar();
    return { k, estado: d.solicitud.find((x) => x.folio === F).estado };
  }, [sPausa.folio, sPausa.cita_en]);
  comprueba(a7.estado === 'validada_en_linea', t(`F2 A7: retomar una pausa sin el documento nuevo no termina el cotejo con el que no coincidió (${a7.estado})`));
  await c.close();
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + `cotejo.html?folio=${sPausa.folio}`);
  await pg.waitForSelector('#formulario:not([hidden])');
  const radio = `input[name="coincide_${a7.k}"][value="si"]`;
  comprueba(await pg.isDisabled(radio), t('F2 A7: al retomar, «Sí, coincide» está deshabilitado mientras la persona no carga el documento nuevo'));
  const agenda = await c.newPage();
  await agenda.goto(BASE + `citas.html?dia=${datos.fecha_corte}`);
  await agenda.waitForSelector(`[data-filas] tr[data-folio="${sPausa.folio}"]`);
  const antes = await agenda.textContent(`[data-filas] tr[data-folio="${sPausa.folio}"]`);
  const persona2 = await c.newPage();
  await persona2.goto(BASE + 'index.html');
  await persona2.evaluate(([F, k]) => APD_ARCHIVOS_PRUEBA.guardaDocumento(F, k, { blob: new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), nombre: 'nuevo.pdf', tipo: 'application/pdf', size: 16 }, {}), [sPausa.folio, a7.k]);
  comprueba(await esperaQue(pg, (q) => !document.querySelector(q).disabled, radio), t('F2 A7: el cotejo abierto se entera, sin recargar, de que la persona cargó el documento'));
  comprueba(/En pausa/.test(antes) && await esperaQue(agenda, (f) => /Documento cargado/.test(document.querySelector(`[data-filas] tr[data-folio="${f}"]`).textContent), sPausa.folio),
    t('F2 B1: la agenda abierta pasa sola a «Documento cargado · retomar»'));
  sinErrores(errores, 'F2 pausa');
  await c.close();

  /* ── F3 · grupos, programar, asistencia y examen ── */
  const conRuta = async (pg, cambia) => pg.route('**/datos/ficticios.json*', async (r) => { const res = await r.fetch(); const j = await res.json(); cambia(j); await r.fulfill({ response: res, json: j }); });
  ({ c, pg, errores } = await contexto());
  // M3 · un grupo por confirmar lleno se confirma y se le elige semana
  await conRuta(pg, (j) => { const g = j.grupo.find((x) => x.folio === 'APD-G-2026-004'); const n = j.inscripcion.filter((i) => i.grupo_id === g.id && i.activa).length; g.cupo_minimo = 1; g.cupo_maximo = n; });
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await aProgramados(pg);
  await pg.waitForSelector('[data-programados] tr[data-grupo="APD-G-2026-004"]');
  const lleno = await pg.textContent('[data-programados] tr[data-grupo="APD-G-2026-004"]');
  // Desde los ajustes del equipo (25/10/2026) quien arma los grupos ya no lo confirma: lo dice la fila, sin el botón
  comprueba(!/Confirmar el grupo/.test(lleno) && /Elegir semana/.test(lleno) && /lleno/.test(lleno) && /persona instructora/i.test(lleno),
    t('F3 M3: el grupo por confirmar lleno ofrece «Elegir semana», con su cupo, y dice que le falta la persona instructora (Capacitación); ya no «Confirmar el grupo»'));
  await pg.unroute('**/datos/ficticios.json*');
  // M4 · en un grupo de una organización (o si todas son de la misma) se completa con las que caben, una por una
  const m4 = await pg.evaluate(() => {
    const xs = Array.from({ length: 13 }, (_, i) => ({ s: { folio: `F${i}`, organizacion_id: 'org-1' }, organizacion: 'Org' }));
    return [APD_PERSONAL.lasQueMasEsperan(xs, 2, (y) => y.s.organizacion_id === 'org-1').length, APD_PERSONAL.lasQueMasEsperan(xs, 2).length];
  });
  comprueba(m4[0] === 2 && m4[1] === 2, t(`F3 M4: con 13 de la misma organización y 2 lugares se proponen 2 (${m4.join(', ')})`));
  // B5 · el aviso de un grupo sin fecha dice su folio
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&hecho=agregadas&a=APD-G-2026-004&n=1');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(/APD-G-2026-004/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')), t('F3 B5: el aviso de un grupo sin fecha lleva su folio'));
  // B6 · un enlace a un grupo que ya no recibe lo dice
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&grupo=APD-G-2026-001');
  await listoGrupos(pg);
  comprueba(await pg.isVisible('[data-modo-grupo]') && /ya no recibe/.test(await pg.textContent('[data-modo-grupo]')), t('F3 B6: «Ese grupo ya no recibe personas», con su ficha'));
  // B7 · las elegidas se conservan al cambiar de curso y volver
  // (desde el 24/10, en el paso 3 de Grupos: se marcan 2, se cambia de curso en el paso 1 y se regresa)
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
  await listoGrupos(pg);
  const casillas = await pg.$$eval('[data-personas] input.plan-casilla[value]', (l) => l.map((k) => k.value));
  await soloA(pg, casillas.slice(0, 2));
  await pg.click('[data-barra] [data-ir="0"]');
  await marcar(pg, 'input[name="curso"][value="poda-renovacion"]');
  await marcar(pg, 'input[name="curso"][value="poda-nueva"]');
  await siguientePaso(pg);
  await siguientePaso(pg);
  comprueba(await pg.locator('[data-personas] input.plan-casilla[value]:checked').count() === 2, t('F3 B7: las 2 elegidas siguen marcadas al volver al curso'));
  sinErrores(errores, 'F3 grupos');
  await c.close();

  ({ c, pg, errores } = await contexto());
  // M5 · con ?personas= que ya tienen grupo no se marca a nadie y se dice
  const inscritaF = datos.solicitud.find((x) => x.estado === 'inscrita' && x.tipo_acreditacion === 'poda' && x.modalidad === 'nueva');
  await pg.goto(BASE + `programar.html?curso=poda-nueva&personas=${inscritaF.folio}`);
  await pg.waitForURL(/grupos\.html/);
  await listoGrupos(pg);
  comprueba(await pg.locator('[data-personas] input:checked').count() === 0 && /ya no está en espera/.test(await pg.textContent('[data-propuesta]')),
    t('F3 M5: si las elegidas ya tienen grupo, no se propone a otras y se dice'));
  // B2 · una fecha imposible en la dirección se ignora
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&semana=2026-13-45&paso=2');
  await listoGrupos(pg);
  comprueba(await pg.isVisible('#armar') && !/No se pud/.test(await pg.textContent('[data-bajada]')) && (await pg.inputValue('#fecha_inicio')) === '26/10/2026', t('F3 B2: con ?semana=2026-13-45 se propone la primera semana posible'));
  // B3 · el primer día ya no se escribe en «Grupos» (sale de la semana elegida: el campo es de sólo lectura); una fecha que
  // no existe escrita en la ficha del grupo se dice al momento
  comprueba(await pg.getAttribute('#fecha_inicio', 'readonly') !== null, t('F3 B3: en «Grupos» el primer día sale de la semana elegida (no se escribe)'));
  // Desde los ajustes del equipo (25/10/2026) la ficha del grupo ya no tiene el primer día: una fecha que no existe se prueba
  // en la otra fecha día/mes/año del personal, la cita de «Revisar»
  await pg.goto(BASE + 'revisar.html?folio=APD-S-2026-00044');
  await pg.waitForSelector('#formulario:not([hidden])');
  await aceptaTodos(pg);
  await pg.fill('#cita_fecha', '29/02/2027');
  await pg.locator('#cita_fecha').blur();
  await pg.waitForFunction(() => document.getElementById('cita_fecha').getAttribute('aria-invalid') === 'true', null, { timeout: 3000 }).catch(() => null);
  comprueba((await pg.getAttribute('#cita_fecha', 'aria-invalid')) === 'true', t('F3 B3: 29/02/2027 escrito en una fecha del personal (la cita de «Revisar») se marca al momento'));
  // B4 · el año en el resumen cuando el curso cruza de año
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&semana=2026-12-28&paso=4');
  await listoGrupos(pg);
  comprueba(/2027/.test(await pg.textContent('[data-resumen]')), t('F3 B4: el resumen del paso 4 lleva el año cuando el curso cruza de año'));
  // B9 · la persona instructora propuesta en un grupo por confirmar (APD-G-2026-005, del 26 al 30/10) tampoco está libre
  // esas fechas: desde los ajustes del equipo (25/10/2026), en la ficha de Capacitación sólo se eligen las libres
  const folioB9 = await pg.evaluate(() => APD.cargar().then((d) => { const folio = APD_PERSONAL.siguienteFolioGrupo(d); const id = `prueba-grupo:${folio}:b9`;
    return APD_PERSONAL.guardaGrupo({ tipo: 'crear', grupo_id: id, folio, tipo_acreditacion: 'dictaminador', modalidad: 'nueva', integracion: 'combinado', organizacion_id: null, folios: [], por: 'revision.prueba' })
      .then(() => APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: id, fecha_inicio: '2026-10-26', hora_entrada: '09:00', por: 'revision.prueba', perfil: 'revision_cotejo' })).then(() => folio); }));
  await pg.goto(BASE + `grupo.html?folio=${folioB9}&perfil=capacitacion`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  const b9 = await pg.$$eval('#instructor option', (l) => l.filter((o) => o.value).map((o) => [o.value, o.disabled, o.textContent]));
  comprueba(b9.some(([v, dis, txt]) => v === 'instructor.ficticio' && dis && /tiene otro curso esas fechas/.test(txt)) && b9.some(([v, dis, txt]) => v === 'instructor2.ficticio' && !dis && /libre esas fechas/.test(txt)),
    t('F3 B9: la persona instructora con un grupo por confirmar esas fechas no se puede elegir («tiene otro curso esas fechas»); la libre, sí'));
  // M5 · al crear, recargar no reabre el grupo a medias ni repite el aviso: la dirección regresa al paso 1
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=4');
  await listoGrupos(pg);
  await Promise.all([pg.waitForNavigation(), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  comprueba(!/hecho=/.test(pg.url()) && /paso=1/.test(pg.url()) && await pasoDe(pg) === 1, t(`F3 M5: después de crear, la dirección no lleva el aviso y el paso a paso empieza de nuevo (${pg.url().split('/').pop()})`));
  // M7 · la propuesta no dice que el grupo estuvo confirmado
  await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005');
  await pg.waitForSelector('[data-datos] .datos');
  // (desde los ajustes del equipo, 25/10/2026, la propuesta es la semana: la persona instructora la asigna Capacitación)
  comprueba(/propuesta, todavía sin confirmar/.test(await pg.textContent('[data-datos]')) && !/dejó de estar confirmado/.test(await pg.textContent('[data-datos]')), t('F3 M7: la fecha propuesta se dice «todavía sin confirmar»'));
  sinErrores(errores, 'F3 programar');
  await c.close();

  ({ c, pg, errores } = await contexto(390, 844));
  // M8 · quien ya presentó el examen tiene su fila cerrada
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-006&dia=1');
  await pg.waitForSelector('[data-personas] .asistencia-fila');
  const filas6 = await pg.locator('[data-personas] .asistencia-fila').count();
  comprueba(filas6 > 0 && await pg.locator('[data-personas] .asistencia-fila .opcion-input:disabled').count() === filas6 * 2 && await pg.locator('.asis-cerrada').count() === filas6,
    t('F3 M8: con la calificación registrada, la asistencia no se puede cambiar y la fila lo dice'));
  // B1 · al corregir un día anterior se vuelve al de hoy, sin «(simulado)»
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003&dia=1');
  await pg.waitForSelector('[data-todas]');
  // B11 · el botón del menú de pruebas no tapa «Sí» ni «No» (opción corta del estándar desde el bloque 4, C6-09)
  const tapa = await pg.evaluate(() => {
    const b = document.querySelector('.menu-pruebas-boton').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.asistencia-fila .opcion-corta')).some((o) => { const r = o.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom); });
  });
  comprueba(!tapa, t('F3 B11: en teléfono, el botón del menú de pruebas no tapa «Sí» ni «No» de «¿Asistió?»'));
  await pg.click('[data-todas]');
  await Promise.all([pg.waitForNavigation(), pg.click('[data-guardar]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  const hecho1 = await pg.textContent('[data-hecho]:not(.pasos-btn)');
  // Desde el reporte del 24/10/2026 se queda en el día corregido y ofrece seguir con el siguiente; el de hoy, en «Corregir otro día»
  comprueba(!/simulado/.test(hecho1) && /Seguir con el día 2\b/.test(hecho1) && await pg.locator('[data-dias] a', { hasText: 'Volver al día de hoy (día 3)' }).count() === 1,
    t(`F3 B1: al corregir un día anterior ofrece seguir con el siguiente y volver al de hoy, sin «(simulado)» («${hecho1.trim().slice(0, 120)}»)`));
  // B8 · todas ya presentaron
  await pg.goto(BASE + 'aplicar.html?folio=APD-G-2026-006');
  await pg.waitForSelector('[data-cuenta]');
  await pg.waitForFunction(() => /inscritas/.test(document.querySelector('[data-cuenta]').textContent));
  comprueba(/ya presentaron el examen/.test(await pg.textContent('[data-cuenta]')) && !/0 con derecho/.test(await pg.textContent('[data-cuenta]')), t('F3 B8: «las 5 ya presentaron el examen», no «0 con derecho»'));
  sinErrores(errores, 'F3 asistencia');
  await c.close();
  // M9 · el único grupo de hoy tiene examen: «Mis grupos de hoy» con «Pasar lista y aplicar»
  ({ c, pg, errores } = await contexto());
  // Desde la sesión del 23/10 (P151) el quinto día de APD-G-2026-006 fue el viernes 9/10: la fecha de corte va en ese día
  await conRuta(pg, (j) => { j.fecha_corte = '2026-10-09'; j.grupo.find((x) => x.folio === 'APD-G-2026-003').instructor = 'instructor2.ficticio'; });
  await pg.goto(BASE + 'asistencia.html');
  await pg.waitForSelector('[data-sin-grupo]:not([hidden]), [data-con-grupo]:not([hidden])');
  comprueba(await pg.isVisible('[data-sin-grupo]') && await pg.locator('[data-mis-grupos] a[href="aplicar.html?folio=APD-G-2026-006"]').count() === 1,
    t('F3 M9: con un solo grupo y su examen hoy, «Asistencia» muestra «Pasar lista y aplicar»'));
  // E1-01 (decisión 12 de la auditoría del 2026-10-19): el instructor no abre ni opera, con ?folio=, el grupo de otra persona
  for (const pagina of ['asistencia', 'aplicar']) {
    await pg.goto(BASE + `${pagina}.html?folio=APD-G-2026-003`);
    await pg.waitForSelector('[data-sin-grupo]:not([hidden]), [data-con-grupo]:not([hidden])');
    comprueba(await pg.isVisible('[data-sin-grupo]') && await pg.isHidden('[data-con-grupo]') && /Este grupo lo da otra persona/.test(await pg.textContent('[data-sin-grupo-texto]'))
      && !(await pg.$$eval('main a[href*="APD-G-2026-003"]', (l) => l.length)), t(`E1-01: «${pagina}.html?folio=» de un grupo de otro instructor dice «Este grupo lo da otra persona» y no lo abre ni lo ofrece`));
  }
  await c.close();
  // B5-03 (auditoría 2026-10-19): si el banco del examen no carga, un código válido no se da por inexistente
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'aplicar.html?folio=APD-G-2026-003');
  const presente = pg.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
  const insB5 = await presente.getAttribute('data-ins');
  await presente.click();
  await pg.waitForSelector(`tr[data-ins="${insB5}"] .examen-codigo`);
  const codigoB5 = (await pg.textContent(`tr[data-ins="${insB5}"] .examen-codigo`)).trim();
  await c.route('**/datos/examen-ficticio.js*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'global.APD_EXAMEN_BANCO = {' }));
  const exB5 = await c.newPage();
  await exB5.goto(BASE + 'examen.html');
  await exB5.fill('#codigo', codigoB5);
  await exB5.click('#entrar [data-accion="enviar"]');
  await exB5.waitForSelector('#entrar [data-estado-envio]:not([hidden])');
  const juntoB5 = await exB5.evaluate(() => document.querySelector('#codigo').closest('[data-campo]').innerText);
  comprueba(!/no existe/.test(juntoB5) && /No se pudo abrir el examen\. Avisa a quien aplica el examen\./.test(await exB5.textContent('#entrar [data-estado-envio]')),
    t('B5-03: sin banco del examen, el código válido no se da por inexistente: «No se pudo abrir el examen. Avisa a quien aplica el examen.»'));
  await c.close();
  // B5-04 (auditoría 2026-10-19): un registro null en los datos no tumba las pantallas de grupos
  ({ c, pg, errores } = await contexto());
  await conRuta(pg, (j) => { j.grupo.push(null); j.inscripcion.push(null); });
  const cargaron = [];
  for (const [pagina, sel] of [['grupos.html?curso=poda-nueva', '[data-programados] tr[data-grupo]'], ['programar.html?curso=poda-nueva', '.arm-semana-elegir'], ['aplicar.html?folio=APD-G-2026-003', '[data-con-grupo]:not([hidden])'], ['asistencia.html?folio=APD-G-2026-003', '.asistencia-fila']]) {
    await pg.goto(BASE + pagina);
    // attached: en escritorio los grupos programados van en su pestaña (acomodo de escritorio, parte B, 25/10/2026)
    cargaron.push(await pg.waitForSelector(sel, { timeout: 8000, state: 'attached' }).then(() => true, () => false) && !/No se pud/.test(await pg.textContent('main')));
  }
  comprueba(cargaron.every(Boolean), t(`B5-04: con un grupo y una inscripción null en los datos, Grupos, Programar, Aplicar y Asistencia cargan (${cargaron.join(', ')})`));
  sinErrores(errores, 'B5-04');
  await c.close();
  // B5-01 (ya corregido en 0.58, F3 B2): sin las tablas de grupos, «Grupos» no deja el paso a paso a medias ni lo envía
  ({ c, pg, errores } = await contexto());
  await conRuta(pg, (j) => { delete j.grupo; delete j.inscripcion; });
  await pg.goto(BASE + 'programar.html?curso=poda-nueva');
  await pg.waitForURL(/grupos\.html/);
  await pg.waitForFunction(() => /No se pudieron cargar/.test(document.querySelector('[data-bajada]').textContent));
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(300);
  comprueba(await pg.isHidden('#armar') && !(await pg.$$eval('[data-armar], [data-accion="siguiente"]', (l) => l.filter((b) => b.offsetParent).length)) && /grupos\.html\?curso=poda-nueva&paso=2$/.test(pg.url())
    && !(await pg.evaluate(() => localStorage.getItem('apd.personal.grupos'))), t('B5-01: sin datos de grupos, «Grupos» oculta el paso a paso y sus botones, y no envía nada'));
  await c.close();

  /* ── F4 · datos, material y menú de pruebas ── */
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'index.html');
  // M5 · un examen guardado con el banco anterior se ignora; uno del banco vigente sí llega
  const ins003 = datos.inscripcion.find((i) => i.activa && i.grupo_id === datos.grupo.find((g) => g.folio === 'APD-G-2026-003').id);
  const m5 = await pg.evaluate(async (ins) => {
    const ahora = new Date().toISOString();
    localStorage.setItem('apd.examen.lista', JSON.stringify({ [ins]: { presente: true, en: ahora, por: 'instructor.ficticio' } }));
    const reg = (preguntas) => ({ codigo: 'KKKK-KKKK', inscripcion_id: ins, preguntas, respuestas: {}, orden_opciones: {}, generado_en: ahora, iniciado_en: ahora, terminado_en: ahora, calificacion: 9.5 });
    localStorage.setItem('apd.examen.c.KKKK-KKKK', JSON.stringify(reg(['F11', 'F12', 'F13'])));
    const viejo = (await APD.cargar()).examen.some((x) => x.inscripcion_id === ins);
    localStorage.setItem('apd.examen.c.KKKK-KKKK', JSON.stringify(reg(['F01', 'F02', 'F03'])));
    const vigente = (await APD.cargar()).examen.some((x) => x.inscripcion_id === ins);
    localStorage.removeItem('apd.examen.c.KKKK-KKKK');
    localStorage.removeItem('apd.examen.lista');
    return { viejo, vigente };
  }, ins003.id);
  comprueba(!m5.viejo && m5.vigente, t(`F4 M5: un examen del banco anterior no cuenta como calificación registrada; uno del vigente sí (${JSON.stringify(m5)})`));
  // B7 · un material sin páginas ni nombre de archivo no se publica
  const b7 = await pg.evaluate(async () => {
    await APD_ARCHIVOS_PRUEBA.guardaMaterial({ id: 'prueba-viejo', clave: 'material_viejo', titulo: 'Material viejo', publicado: true, blob: new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }) });
    return (await APD.cargar()).material_estudio.some((m) => m.clave === 'material_viejo');
  });
  comprueba(!b7, t('F4 B7: un material guardado sin páginas ni nombre de archivo no se muestra («undefined páginas»)'));
  // M7 · el acuse de la solicitud: el día simulado, en 24 horas
  const m7 = await pg.evaluate((corte) => new Date(APD_ARCHIVOS_PRUEBA.alCorte({ fecha_corte: corte }, new Date().toISOString())).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }), datos.fecha_corte);
  comprueba(m7 === datos.fecha_corte, t(`F4 M7: la fecha del acuse se lleva al día simulado (${m7})`));
  await c.close();

  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'material-personal.html');
  await pg.waitForSelector('[data-filas] tr');
  // A7 y B6 · un PDF de 26 MB se acepta (el total es el del parámetro, 30 MB); uno de 30 MB + 1 dice que pasa del máximo
  await pg.click('[data-agregar]');
  await pg.setInputFiles('[data-campo="archivo"] input[type="file"]', pdfDe(26 * 1048576, 'pesa-26mb.pdf'));
  comprueba(await pg.waitForSelector('[data-campo="archivo"] .lista-arch li[data-estado="listo"]', { timeout: 20000 }).then(() => true, () => false),
    t('F4 A7: un PDF de 26 MB se acepta en el material (el total del campo es de 30 MB)'));
  await pg.click('[data-campo="archivo"] .arch-quitar');
  await pg.setInputFiles('[data-campo="archivo"] input[type="file"]', pdfDe(31457281, 'pesa-30mb-mas-1.pdf'));
  await pg.waitForSelector('[data-campo="archivo"] [data-rechazos] .arch-rechazo');
  comprueba(/pasa del máximo de 30 MB/.test(await pg.textContent('[data-campo="archivo"] [data-rechazos]')), t('F4 B6: 30 MB + 1 byte «pasa del máximo de 30 MB»'));
  await pg.click('[data-cancelar]');
  // B4 y B5 · «Qué estudiar»: un apartado repetido y una página de cinco cifras
  const norma = 'tr[data-clave-material="norma_poda"]';
  for (const [temas, re, que] of [['3 - Uno\n3 - Uno', /repite/, 'B4: un apartado repetido se avisa'], ['12345 - Lejos', /cita la página 12345/, 'B5: «12345 - Lejos» dice la página que no existe']]) {
    await pg.click(`${norma} [data-accion-material="editar"]`);
    await pg.fill('#temas', temas);
    await pg.click('[data-guardar]');
    const ok = await pg.waitForFunction((r) => new RegExp(r).test(document.querySelector('[data-campo="temas"]').textContent), re.source, { timeout: 6000 }).then(() => true, () => false);
    comprueba(ok, t(`F4 ${que}`));
    await pg.click('[data-cancelar]');
  }
  // M4 · reemplazar el archivo por uno con menos páginas que los apartados se rechaza
  await pg.click(`${norma} [data-accion-material="reemplazar"]`);
  await pg.setInputFiles('[data-campo="archivo"] input[type="file"]', PDF_UNA_HOJA);
  await pg.waitForSelector('[data-campo="archivo"] .lista-arch li[data-estado="listo"]');
  await pg.click('[data-guardar]');
  comprueba(await pg.waitForFunction(() => /no le caben los apartados/.test(document.querySelector('[data-campo="archivo"]').textContent), null, { timeout: 15000 }).then(() => true, () => false),
    t('F4 M4: un archivo nuevo de 1 página no se acepta si los apartados citan páginas que ya no tendría'));
  sinErrores(errores, 'F4 material');
  await c.close();

  // B1 y B2 · el menú de pruebas dice el caso elegido
  ({ c, pg, errores } = await contexto());
  await pg.goto(BASE + 'index.html');
  await pg.click('.menu-pruebas-boton');
  await pg.waitForSelector('dialog.menu-pruebas[open]');
  const perfil = await pg.evaluate(() => APD_CASOS_PRUEBA.perfilDe('no-renovable'));
  await pg.selectOption('#menu-pruebas-perfil', perfil);
  await pg.selectOption('#menu-pruebas-persona', 'no-renovable');
  await Promise.all([pg.waitForNavigation(), pg.click('dialog.menu-pruebas .menu-pruebas-acciones button:text-is("Entrar")')]);
  await pg.click('.menu-pruebas-boton');
  await pg.waitForSelector('dialog.menu-pruebas[open]');
  comprueba(/Caso: Vencida hace más de un año/.test(await pg.textContent('dialog.menu-pruebas')), t('F4 B1: el menú dice el caso elegido, aunque otro caso use a la misma persona'));
  const kobo = await pg.evaluate(async () => { const d = await APD.cargar(); const c = APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos).find((x) => x.clave === 'kobo-vigente'); return c && c.persona.id; });
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));
  await pg.goto(BASE + `cuenta.html?migrada=${encodeURIComponent(kobo)}`);
  await pg.waitForSelector('#curp');
  await pg.click('.menu-pruebas-boton');
  await pg.waitForSelector('dialog.menu-pruebas[open]');
  comprueba(/Caso: Con su poda vigente/.test(await pg.textContent('dialog.menu-pruebas')), t('F4 B2: en «Crea tu cuenta» del registro anterior, el menú dice el caso'));
  sinErrores(errores, 'F4 menú');
  await c.close();
}

/* ── Auditoría «intentar romperlo», bloque 2: dos pestañas, dos personas a la vez y doble clic ──
   Dos páginas del mismo contexto de Playwright son dos pestañas del mismo navegador (comparten localStorage, IndexedDB y
   el canal apd-prueba). Una comprobación por hallazgo (F1 1 a 4, F2 A2 a A5 y M1, F3 A1, M1, M2, M6 y B10, y el doble
   clic de los botones propios); cada una falla con el código anterior. Cada parte, en su propio navegador limpio. */
async function romperDos(navegador) {
  const t = (m) => `[romper 2] ${m}`;
  const contexto = async (ancho = 1280, alto = 900) => {
    const c = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    // Una violación de la política de contenido cuenta como error de consola (B7-01)
    await c.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`)));
    const errores = [];
    const pagina = async (url) => {
      const pg = await c.newPage();
      pg.on('pageerror', (e) => errores.push(`${pg.url()} · ${e.message}`));
      pg.on('console', (m) => { if (m.type() === 'error') errores.push(`${pg.url()} · ${m.text()}`); });
      if (url) await pg.goto(BASE + url);
      return pg;
    };
    return { c, pagina, errores };
  };
  const sinErrores = (errores, que) => comprueba(errores.length === 0, t(`${que}: sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  const sesion = (pg, id) => pg.evaluate((x) => (x ? localStorage.setItem('apd.sesion', JSON.stringify({ id: x })) : localStorage.removeItem('apd.sesion')), id);
  const libres = datos.solicitante.filter((p) => p.estado === 'activa' && !datos.acreditacion.some((a) => a.solicitante_id === p.id)
    && !datos.solicitud.some((s) => s.solicitante_id === p.id && !FINALES.includes(s.estado)));
  const aviso = async (pg, sel = '[data-estado-envio]') => (await pg.isVisible(sel) ? (await pg.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
  // Una solicitud nueva de poda llevada hasta la revisión (paso final), sin enviarla
  const hastaRevision = async (pg) => {
    await pg.goto(BASE + 'solicitud.html');
    await pg.waitForSelector(`${pasoVisible} #nivel_estudios`);
    await pg.selectOption('#nivel_estudios', 'licenciatura');
    await pg.fill('#carrera', 'Biología');
    await pg.keyboard.press('Escape');
    // En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026)
    if (await pg.isVisible('[data-campo="estatus_estudios"]')) await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
    await siguiente(pg);
    await pg.waitForSelector(`${pasoVisible} [data-campo^="doc_"]`);
    await cargaObligatorios(pg);
    await siguiente(pg);
    await marcaCasillas(pg);
  };
  /* Cada parte, aparte: si una se detiene (con el código anterior, por ejemplo), se cuenta como fallida y siguen las demás */
  const parte = async (nombre, fn) => {
    const cx = await contexto();
    try { await fn(cx); } catch (e) { mal(t(`${nombre}: se detuvo: ${e.message.split('\n')[0]}`)); }
    sinErrores(cx.errores, nombre);
    await cx.c.close();
  };
  const envia = async (pg) => {
    await pg.click('[data-accion="enviar"]');
    await pg.waitForSelector('[data-acuse]:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
    return { acuse: await pg.isVisible('[data-acuse]:not([hidden])'), aviso: await aviso(pg) };
  };

  /* ── F1 1 · la sesión cambió en otra pestaña (solicitud y «Mi perfil») ── */
  const [A, B, C3] = libres;
  await parte('F1 1 solicitud', async ({ pagina }) => {
    const p1 = await pagina('index.html');
    await sesion(p1, A.id);
    await hastaRevision(p1);
    const p2 = await pagina('index.html');
    await sesion(p2, B.id);
    const r = await envia(p1);
    const deAyB = await p1.evaluate(([a, b]) => APD.cargar().then((d) => d.solicitud.filter((s) => s.de_prueba && [a, b].includes(s.solicitante_id)).length), [A.id, B.id]);
    comprueba(!r.acuse && /Tu sesión cambió en otra pestaña/.test(r.aviso) && await p1.locator('[data-estado-envio] a[href^="entrar.html?volver="]').count() === 1 && deAyB === 0,
      t(`F1 1: con la sesión cambiada en otra pestaña la solicitud no se envía a nombre de otra persona («${r.aviso.slice(0, 90)}», ${deAyB} enviadas)`));
  });
  // F1 2 · sin sesión: tampoco se envía ni se crea una solicitud sin persona
  await parte('F1 2', async ({ pagina }) => {
    const p1 = await pagina('index.html');
    await sesion(p1, A.id);
    await hastaRevision(p1);
    const p2 = await pagina('index.html');
    await sesion(p2, null);
    const r = await envia(p1);
    const sinPersona = await p1.evaluate(() => APD.cargar().then((d) => d.solicitud.filter((s) => s.de_prueba).length));
    // B6-01 (auditoría 2026-10-20): sin sesión dice que terminó y que lo capturado sigue; «otra pestaña», sólo con otra cuenta
    comprueba(!r.acuse && /Tu sesión terminó\. No se envió nada, pero lo que capturaste sigue en este dispositivo/.test(r.aviso) && !/otra pestaña|No se guardó nada/.test(r.aviso) && sinPersona === 0,
      t(`F1 2 y B6-01: sin sesión no se envía la solicitud y el aviso dice que la sesión terminó («${r.aviso.slice(0, 110)}», ${sinPersona} creadas)`));
    // Lo que dice es cierto: por su enlace se vuelve a entrar y la solicitud ofrece recuperar lo capturado
    const entrar = await p1.getAttribute('[data-estado-envio] a[href^="entrar.html?volver="]', 'href');
    await p1.goto(BASE + entrar);
    await sesion(p1, A.id);
    await p1.goto(BASE + decodeURIComponent(entrar.split('volver=')[1]));
    const franja = await p1.waitForSelector('[data-franja-borrador]:not([hidden])', { timeout: 8000 }).then(() => true, () => false);
    comprueba(franja, t('B6-01: al volver a entrar por el enlace del aviso, la solicitud ofrece recuperar lo capturado'));
  });
  // «Mi perfil»: A edita su contacto, B entra en otra pestaña, A guarda → no se guarda en ninguna de las dos cuentas
  await parte('F1 1 Mi perfil', async ({ pagina }) => {
    const p1 = await pagina('index.html');
    const p2 = await pagina('index.html');
    await sesion(p2, A.id);
    await p1.goto(BASE + 'datos.html');
    await p1.waitForSelector('[data-editar="contacto"]');
    await p1.click('[data-editar="contacto"]');
    await p1.waitForSelector('#form-contacto:not([hidden])');
    await p1.fill('#form-contacto #telefono', '5512340000');
    await sesion(p2, B.id);
    await p1.click('#form-contacto [data-accion="enviar"]');
    await p1.waitForSelector('#form-contacto [data-estado-envio]:not([hidden]), [data-guardado="contacto"]:not([hidden])', { timeout: 8000 }).catch(() => null);
    const perfil = await aviso(p1, '#form-contacto [data-estado-envio]');
    const perfiles = await p1.evaluate(() => JSON.parse(localStorage.getItem('apd.perfiles') || '{}'));
    comprueba(/Tu sesión cambió en otra pestaña/.test(perfil) && !perfiles[A.id] && !perfiles[B.id] && await p1.isHidden('[data-guardado="contacto"]'),
      t(`F1 1: «Mi perfil» no se guarda en la cuenta de quien entró en otra pestaña («${perfil.slice(0, 80)}»)`));
  });

  /* ── F1 3 · la misma persona, dos pestañas, la misma acreditación ── */
  await parte('F1 3', async ({ pagina }) => {
    const p1 = await pagina('index.html');
    await sesion(p1, C3.id);
    await hastaRevision(p1);
    const p2 = await pagina();
    await hastaRevision(p2);
    const r1 = await envia(p1);
    const r2 = await envia(p2);
    const activas = await p1.evaluate((id) => APD.cargar().then((d) => d.solicitud.filter((s) => s.solicitante_id === id && s.tipo_acreditacion === 'poda' && !APD.FINALES.includes(s.estado)).length), C3.id);
    comprueba(r1.acuse && !r2.acuse && /trámite en curso/.test(r2.aviso) && activas === 1, t(`F1 3: la segunda pestaña no crea otra solicitud activa del mismo tipo («${r2.aviso.slice(0, 90)}», ${activas} activa)`));
    // La mezcla aplica la misma regla de la base (una activa por persona y tipo; folio único): un envío nuevo guardado
    // directo, y otro con el folio de una solicitud ficticia, no se aplican
    const mez = await p1.evaluate(async ([id, F]) => {
      const A = APD_ARCHIVOS_PRUEBA;
      const d0 = await APD.cargar();
      const p = d0.solicitante.find((x) => x.id === id);
      const ahora = new Date().toISOString();
      await A.guardaEnvio({ folio: 'APD-S-2026-09999', existente: false, tipo_acreditacion: 'poda', modalidad: 'nueva', enviada_en: ahora, estado_desde: ahora, nivel_estudios: 'preparatoria', persona: Object.assign({}, p) }, []);
      const ficticia = d0.solicitud.find((x) => x.folio === F);
      await A.guardaEnvio({ folio: F, existente: false, tipo_acreditacion: 'poda', modalidad: 'nueva', enviada_en: ahora, estado_desde: ahora, nivel_estudios: 'preparatoria', persona: Object.assign({}, p) }, []);
      const d = await APD.cargar();
      return { otra: d.solicitud.some((x) => x.folio === 'APD-S-2026-09999'), igual: d.solicitud.find((x) => x.folio === F).estado === ficticia.estado };
    }, [C3.id, datos.solicitud.find((x) => x.estado === 'lista_para_curso').folio]);
    comprueba(!mez.otra && mez.igual, t(`F1 3: la mezcla no aplica una segunda solicitud activa ni un envío nuevo con el folio de otra (${JSON.stringify(mez)})`));
  });

  /* ── F1 4 · una pestaña vieja de «Corregir y reenviar» no deshace una validación ── */
  const obsPoda = datos.solicitud.find((x) => x.estado === 'con_observaciones' && x.tipo_acreditacion === 'poda');
  await parte('F1 4', async ({ pagina }) => {
    const p1 = await pagina('index.html');
    await sesion(p1, obsPoda.solicitante_id);
    const vieja = await pagina(`solicitud.html?folio=${obsPoda.folio}`);
    await vieja.waitForSelector(`${pasoVisible}`);
    await vieja.waitForFunction(() => /_/.test(document.getElementById('tramite').value));
    // La persona reenvía desde otra pestaña y el personal la valida (como lo guardan solicitud.html y revisar.html)
    await p1.evaluate(async ([F, docs]) => {
      const ahora = new Date().toISOString();
      await APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: F, existente: true, estado_desde: ahora }, []);
      const datosRev = { cita_fecha: '2026-10-22', cita_hora: '10:00' };
      for (const k of docs) datosRev[`decision_${k}`] = 'aceptado';
      // La revisión, después del reenvío y antes de lo que haga la pestaña vieja (los eventos se aplican en su orden)
      await new Promise((r) => setTimeout(r, 30));
      localStorage.setItem('apd.personal.revisiones', JSON.stringify({ [F]: [{ resultado: 'validada', texto: 'Validada', datos: datosRev, revisor: 'revision.prueba', en: new Date().toISOString() }] }));
      await new Promise((r) => setTimeout(r, 30));
    }, [obsPoda.folio, datos.documento.filter((x) => x.solicitud_id === obsPoda.id && x.vigente).map((x) => x.requisito)]);
    const antes4 = await p1.evaluate((F) => APD.cargar().then((d) => d.solicitud.find((x) => x.folio === F).estado), obsPoda.folio);
    const r4 = await vieja.evaluate(() => new Promise((ok) => {
      window.FORMKIT_OPCIONES.enviar({ datos: { nivel_estudios: 'licenciatura', carrera: 'Biología', estatus_estudios: 'titulado' }, archivos: [] }, { signal: new AbortController().signal })
        .then((x) => ok({ hecho: x && x.folio }), (e) => ok({ codigo: e && (e.codigo || e.message), texto: e && e.texto }));
    }));
    const despues4 = await p1.evaluate((F) => APD.cargar().then((d) => d.solicitud.find((x) => x.folio === F).estado), obsPoda.folio);
    comprueba(antes4 === 'validada_en_linea' && r4.codigo === 'transicion_invalida' && despues4 === 'validada_en_linea',
      t(`F1 4: la pestaña vieja no reenvía una solicitud ya validada (${antes4} → ${despues4}; ${r4.codigo || 'enviada'})`));
    // Y la mezcla, como la base: un reenvío guardado directo sobre una solicitud validada no la regresa a revisión
    const m4 = await p1.evaluate(async (F) => {
      await APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: F, existente: true, estado_desde: new Date().toISOString() }, []);
      return (await APD.cargar()).solicitud.find((x) => x.folio === F).estado;
    }, obsPoda.folio);
    comprueba(m4 === 'validada_en_linea', t(`F1 4: la mezcla no aplica un reenvío de una solicitud validada (transicion_invalida; ${m4})`));
  });

  /* ── F2 A2 y M1 · dos pestañas de la misma revisión ── */
  const podaEnviada = enviadas.find((x) => x.tipo_acreditacion === 'poda' && !datos.revision.some((rv) => rv.solicitud_id === x.id));
  const docsDe = (pg) => docsRevision(pg); // por pasos: un paso por documento
  const abreRevision = async (pg) => { await pg.goto(BASE + `revisar.html?folio=${podaEnviada.folio}`); await pg.waitForSelector('#formulario:not([hidden])'); };
  const valida = async (pg) => {
    await aceptaTodos(pg);
    await pg.waitForSelector('#cita_fecha', { state: 'visible' });
    await pg.fill('#cita_fecha', dma(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min')));
    await pg.selectOption('#cita_hora', '10:00');
  };
  const observa = async (pg) => {
    const [k, ...resto] = await docsDe(pg);
    await decideDoc(pg, k, 'con_observacion', 'El documento no se lee bien: cárgalo otra vez, completo.');
    for (const x of resto) await decideDoc(pg, x, 'aceptado');
    return k;
  };
  const registraRev = async (pg) => {
    await pulsaEnviar(pg);
    await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden]) .resultado, [data-hecho]:not(.pasos-btn):not(:empty), [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
    return { hecho: await pg.isHidden('#formulario'), aviso: await aviso(pg) };
  };
  // A2 · A observa; la persona reenvía con un documento nuevo; B (abierta antes) valida
  await parte('F2 A2', async ({ pagina }) => {
    const ra = await pagina();
    const rb = await pagina();
    await abreRevision(ra);
    await abreRevision(rb);
    const k2 = await observa(ra);
    await registraRev(ra);
    await ra.evaluate(([F, k]) => APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: F, existente: true, estado_desde: new Date().toISOString() },
      [{ requisito: k, blob: new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), nombre: 'nuevo.pdf', tipo: 'application/pdf', size: 16 }]), [podaEnviada.folio, k2]);
    await valida(rb);
    const a2 = await registraRev(rb);
    const s2 = await ra.evaluate(([F, k]) => APD.cargar().then((d) => { const s = d.solicitud.find((x) => x.folio === F); return { estado: s.estado, doc: d.documento.find((x) => x.solicitud_id === s.id && x.vigente && x.requisito === k).estado }; }), [podaEnviada.folio, k2]);
    comprueba(!a2.hecho && /cambió desde que la abrió/.test(a2.aviso) && s2.estado === 'enviada' && s2.doc === 'pendiente',
      t(`F2 A2: la pestaña vieja no valida la 2.ª vuelta con un documento que nadie abrió («${a2.aviso.slice(0, 80)}», ${JSON.stringify(s2)})`));
  });
  // M1 · A valida; B (abierta antes) observa: no anuncia un resultado que no ocurrió y la bandeja dice el que sí
  await parte('F2 M1', async ({ pagina }) => {
    const ma = await pagina();
    const mb = await pagina();
    await abreRevision(ma);
    await abreRevision(mb);
    await valida(ma);
    await registraRev(ma);
    await observa(mb);
    const m1 = await registraRev(mb);
    const bandeja = await pagina('revision.html');
    await bandeja.waitForSelector('[data-revisadas]:not([hidden])');
    const revisadas = await bandeja.textContent('[data-revisadas]');
    comprueba(!m1.hecho && /Ya se registró otra revisión/.test(m1.aviso) && /Validada/.test(revisadas) && !/Con observaciones ·/.test(revisadas),
      t(`F2 M1: la pestaña cuya revisión no se aplica lo dice y la bandeja enseña la que sí se aplicó («${m1.aviso.slice(0, 70)}»)`));
  });

  /* ── F2 A3, A4 y A5 · cotejo en dos pestañas ── */
  const [c42, c43] = ['APD-S-2026-00042', 'APD-S-2026-00043'].map((f) => datos.solicitud.find((x) => x.folio === f));
  const uuid = () => crypto.randomUUID().toUpperCase();
  const registraCita = async (pg) => {
    await pulsaEnviar(pg);
    await pg.waitForSelector('#formulario[hidden], [data-estado-envio]:not([hidden]), .resumen-errores', { timeout: 8000 }).catch(() => null);
    return { hecho: await pg.isHidden('#formulario'), aviso: await aviso(pg), texto: (await pg.textContent('[data-hecho]:not(.pasos-btn)')) || '' };
  };
  const terminaCotejo = async (pg, folioFiscal) => {
    await cotejoHastaPago(pg);
    await pg.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', PDF);
    await pg.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
    await pg.fill('#factura_rfc', 'XAXX010101000');
    await pg.fill('#factura_razon_social', 'Prueba Ejemplo');
    await pg.fill('#factura_folio_fiscal', folioFiscal);
    return registraCita(pg);
  };
  const estadoDe = (pg, F) => pg.evaluate((f) => APD.cargar().then((d) => {
    const s = d.solicitud.find((x) => x.folio === f);
    const citas = d.cita.filter((x) => x.solicitud_id === s.id).map((x) => `${x.programada_en.slice(0, 10)}:${x.resultado}`);
    return { estado: s.estado, inasistencias: s.inasistencias || 0, citas, expediente: (d.solicitante.find((p) => p.id === s.solicitante_id) || {}).numero_expediente || null };
  }), F);
  // C1 · A: no se presentó, cita nueva el 22/10; B (abierta antes): terminar el cotejo
  await parte('F2 A3 C1', async ({ pagina }) => {
    const ca = await pagina();
    const cb = await pagina();
    await abreCotejo(ca, c43.folio);
    await abreCotejo(cb, c43.folio);
    await marcar(ca, 'input[name="se_presento"][value="no"]');
    await alPaso(ca, 'Resultado');
    await ca.fill('#cita_fecha', '22/10/2026');
    await ca.selectOption('#cita_hora', '09:30');
    await registraCita(ca);
    const c1 = await terminaCotejo(cb, uuid());
    const e1 = await estadoDe(ca, c43.folio);
    comprueba(!c1.hecho && /Esta cita ya se registró/.test(c1.aviso) && e1.estado === 'validada_en_linea' && e1.citas.includes('2026-10-22:pendiente'),
      t(`F2 A3: el cotejo de la pestaña vieja no se aplica a la cita nueva que dio la otra («${c1.aviso.slice(0, 60)}», ${JSON.stringify(e1)})`));
  });
  // C2 · A: un documento no coincide, en pausa; B (abierta antes): no se presentó
  await parte('F2 A3 C2', async ({ pagina }) => {
    const ca = await pagina();
    const cb = await pagina();
    await abreCotejo(ca, c43.folio);
    await abreCotejo(cb, c43.folio);
    await marcar(ca, 'input[name="se_presento"][value="si"]');
    await marcar(ca, 'input[name="identidad"][value="misma"]');
    await alPaso(ca, 'Documentos originales');
    const [kNo, ...kSi] = await ca.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
    for (const k of kSi) await marcar(ca, `input[name="coincide_${k}"][value="si"]`);
    await marcar(ca, `input[name="coincide_${kNo}"][value="no"]`);
    await ca.fill(`#diferencia_${kNo}`, 'Trae una versión distinta de la que cargó.');
    await marcar(ca, 'input[name="hoy_documento"][value="si"]');
    await registraCita(ca);
    await marcar(cb, 'input[name="se_presento"][value="no"]');
    await alPaso(cb, 'Resultado');
    await cb.fill('#cita_fecha', '23/10/2026');
    await cb.selectOption('#cita_hora', '09:30');
    const c2 = await registraCita(cb);
    const e2 = await estadoDe(ca, c43.folio);
    comprueba(!c2.hecho && /Esta cita ya se registró/.test(c2.aviso) && e2.inasistencias === 0 && e2.citas.includes('2026-10-21:en_pausa') && !e2.citas.some((x) => x.startsWith('2026-10-23')),
      t(`F2 A3: una cita en pausa no pasa a «no se presentó» desde otra pestaña (${JSON.stringify(e2)})`));
  });
  // A4 · dos ventanillas terminan a la vez el cotejo de dos personas sin expediente: números distintos
  await parte('F2 A4', async ({ pagina }) => {
    const ca = await pagina();
    const cb = await pagina();
    await abreCotejo(ca, c42.folio);
    await abreCotejo(cb, c43.folio);
    const h42 = await terminaCotejo(ca, uuid());
    const h43 = await terminaCotejo(cb, uuid());
    const [x42, x43] = [await estadoDe(ca, c42.folio), await estadoDe(ca, c43.folio)];
    comprueba(h42.hecho && h43.hecho && x42.expediente && x43.expediente && x42.expediente !== x43.expediente && h43.texto.includes(x43.expediente) && h42.texto.includes(x42.expediente),
      t(`F2 A4: dos cotejos a la vez dan expedientes distintos y cada pantalla dice el suyo (${x42.expediente}, ${x43.expediente})`));
  });
  // A5 · un folio fiscal ya registrado en otra solicitud no se acepta: junto al campo
  await parte('F2 A5', async ({ pagina }) => {
    const ca = await pagina();
    await abreCotejo(ca, c42.folio);
    const repetido = datos.solicitud.find((x) => x.factura_folio_fiscal).factura_folio_fiscal;
    const a5 = await terminaCotejo(ca, repetido.toLowerCase());
    const err5 = (await ca.textContent('[data-campo="factura_folio_fiscal"] .err')) || '';
    comprueba(!a5.hecho && /ya está registrado en otra solicitud/.test(err5) && (await estadoDe(ca, c42.folio)).estado === 'validada_en_linea',
      t(`F2 A5: el folio fiscal repetido se rechaza junto al campo («${err5.trim()}»)`));
    // Y la mezcla, como la base (folio_fiscal_repetido): un cotejo guardado directo con ese folio no termina
    const m5 = await ca.evaluate(async ([F, en, ff]) => {
      const d0 = await APD.cargar();
      const s = d0.solicitud.find((x) => x.folio === F);
      const datosC = { pago: 'si', factura_rfc: 'XAXX010101000', factura_razon_social: 'Prueba', factura_folio_fiscal: ff };
      for (const x of d0.documento.filter((y) => y.solicitud_id === s.id && y.vigente)) datosC[`coincide_${x.requisito}`] = 'si';
      APD_PERSONAL.guardaCotejo(F, { resultado: 'terminado', datos: datosC, en: new Date().toISOString(), cita_en: en, simulada: true, atendio: 'revision.prueba' });
      return (await APD.cargar()).solicitud.find((x) => x.folio === F).estado;
    }, [c42.folio, c42.cita_en, repetido]);
    comprueba(m5 === 'validada_en_linea', t(`F2 A5: la mezcla no termina un cotejo con un folio fiscal repetido (${m5})`));
  });

  /* ── F3 A1 y M6 · dos pestañas de «Grupos» (antes «Programar un curso») y doble clic en «Crear el grupo» ── */
  const eventosG = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('apd.personal.grupos') || '[]'));
  const gruposPrueba = (pg) => pg.evaluate(() => APD.cargar().then((d) => d.grupo.filter((g) => g.de_prueba).map((g) => ({ folio: g.folio, inicio: g.fecha_inicio, instructor: g.instructor, hora: g.hora_entrada }))));
  await parte('F3 A1', async ({ pagina }) => {
    const pa = await pagina('grupos.html?curso=poda-nueva&paso=4');
    // La segunda, otra semana: desde la sesión del 23/10 (P149) la del 26/10 ya queda con 2 grupos a la vez
    const pb = await pagina('grupos.html?curso=poda-nueva&semana=2026-11-02&mes=2026-11&paso=4');
    for (const pg of [pa, pb]) await listoGrupos(pg);
    await Promise.all([pa.waitForNavigation(), pa.click('[data-armar="crear"]')]);
    await pa.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
    const deA = (await gruposPrueba(pa))[0];
    await pb.click('[data-armar="crear"]');
    await pb.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso, [data-estado-envio]:not([hidden])');
    const gs = await gruposPrueba(pa);
    const aDespues = gs.find((g) => g.folio === deA.folio);
    // El aviso de la segunda dice su propio folio; el de la primera sólo puede salir al explicar quién no entró (ya está en él)
    const textoB = ((await pb.textContent('[data-hecho]:not(.pasos-btn) .aviso-texto p')) || '').split(' de las que eligió no ')[0];
    comprueba(gs.length === 2 && new Set(gs.map((g) => g.folio)).size === 2 && JSON.stringify(aDespues) === JSON.stringify(deA) && !textoB.includes(deA.folio),
      t(`F3 A1: la segunda pestaña de «Grupos» crea su propio grupo y no sobrescribe el de la primera (${gs.map((g) => `${g.folio} ${g.instructor} ${g.hora}`).join('; ')})`));
    // La mezcla, como la base (grupo_folio_uk): un «crear» con el folio de otro grupo no se aplica, ni lo que lo acompaña
    const mA1 = await pa.evaluate(async () => {
      const en = new Date().toISOString();
      const l = JSON.parse(localStorage.getItem('apd.personal.grupos') || '[]');
      l.push({ tipo: 'crear', grupo_id: 'prueba-grupo:otro', folio: 'APD-G-2026-004', tipo_acreditacion: 'poda', modalidad: 'nueva', integracion: 'combinado', folios: [], por: 'x', en });
      l.push({ tipo: 'proponer', grupo_id: 'prueba-grupo:otro', fecha_inicio: '2026-12-07', hora_entrada: '09:00', instructor: 'instructor2.ficticio', por: 'x', en });
      localStorage.setItem('apd.personal.grupos', JSON.stringify(l));
      const d = await APD.cargar();
      return d.grupo.filter((g) => g.folio === 'APD-G-2026-004').map((g) => g.fecha_inicio);
  });
  comprueba(mA1.length === 1 && mA1[0] === null, t(`F3 A1: la mezcla ignora un «crear» con un folio que ya existe y sus eventos (${JSON.stringify(mA1)})`));
  });
  await parte('F3 M6', async ({ pagina }) => {
    const pd = await pagina('grupos.html?curso=poda-nueva&paso=4');
    await listoGrupos(pd);
    // Desde los ajustes del equipo (25/10/2026) ya no hay «Crear sin confirmar»: «Crear el grupo» siempre lo deja por confirmar
    await Promise.all([pd.waitForNavigation(), pd.dblclick('[data-armar="crear"]')]);
    await pd.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
    await pd.waitForTimeout(600);
    const crear = (await eventosG(pd)).filter((e) => e.tipo === 'crear').length;
    comprueba(crear === 1 && /por confirmar/.test(await pd.textContent('[data-hecho]:not(.pasos-btn)')), t(`F3 M6: doble clic en «Crear el grupo» crea un solo grupo, por confirmar (${crear} creaciones)`));
  });

  /* ── F3 M1 y B10 · agregar desde dos pestañas y doble clic en «Completar» ── */
  await parte('F3 M1', async ({ pagina }) => {
    // Dos pestañas con la misma persona: una la agrega a APD-G-2026-004 y la otra intenta agregarla a APD-G-2026-005
    const ga = await pagina('grupos.html?grupo=APD-G-2026-004&paso=3');
    const gb = await pagina('grupos.html?grupo=APD-G-2026-005&paso=3');
    for (const pg of [ga, gb]) await listoGrupos(pg);
    const folioX = await ga.getAttribute('[data-personas] input.plan-casilla[value]', 'value');
    for (const pg of [ga, gb]) { await soloA(pg, [folioX]); await siguientePaso(pg); }
    await Promise.all([ga.waitForNavigation(), ga.click('[data-armar="crear"]')]);
    await gb.click('[data-armar="crear"]');
    await gb.waitForSelector('#armar [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
    const m1g = await aviso(gb, '#armar [data-estado-envio]');
    const en005 = await gb.evaluate(() => APD.cargar().then((d) => d.inscripcion.filter((i) => i.activa && i.grupo_id === d.grupo.find((g) => g.folio === 'APD-G-2026-005').id).length));
    comprueba(/No se agregó a nadie/.test(m1g) && /ya está en/.test(m1g) && /grupos\.html\?grupo=APD-G-2026-005/.test(gb.url()) && en005 === 1,
      t(`F3 M1: si la persona ya tiene grupo, no dice «Se agregó 1 persona»: dice quién no entró y por qué («${m1g.slice(0, 90)}»)`));
  });
  await parte('F3 B10', async ({ pagina }) => {
    const gc = await pagina('grupos.html?curso=poda-nueva');
    const completar = '[data-programados] tr[data-grupo="APD-G-2026-005"] button:has-text("Completar")';
    await aProgramados(gc);
    await gc.waitForSelector(completar);
    await Promise.all([gc.waitForNavigation(), gc.dblclick(completar)]);
    await gc.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
    const agregar = (await eventosG(gc)).filter((e) => e.tipo === 'agregar').length;
    comprueba(agregar === 1, t(`F3 B10: doble clic en «Completar con las que más esperan» guarda una sola vez (${agregar})`));
  });
  // Doble clic en «Guardar la asistencia» (botón propio): una sola captura
  await parte('asistencia doble clic', async ({ pagina }) => {
    const gc = await pagina();
    await gc.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
    await gc.waitForSelector('[data-todas]');
    await gc.click('[data-todas]');
    await Promise.all([gc.waitForNavigation(), gc.dblclick('[data-guardar]')]);
    const asis = (await eventosG(gc)).filter((e) => e.tipo === 'asistencia').length;
    comprueba(asis === 1, t(`doble clic en «Guardar la asistencia» guarda una sola vez (${asis})`));
  });

  /* ── F3 M2 · confirmar en una pestaña después de una baja en la otra ── */
  await parte('F3 M2', async ({ pagina }) => {
    const g0 = await pagina('grupos.html?curso=poda-nueva&paso=3');
    await g0.waitForSelector('[data-personas] input.plan-casilla[value]');
    const folioY = await g0.getAttribute('[data-personas] input.plan-casilla[value]', 'value');
    // Quien arma el grupo completa el grupo y le da su semana (un lunes: desde la sesión del 23/10 el curso de cinco días
    // empieza en lunes, P151); desde los ajustes del equipo (25/10/2026) lo confirma Capacitación en la ficha
    await g0.evaluate((f) => APD.cargar().then((d) => { const id = d.grupo.find((g) => g.folio === 'APD-G-2026-004').id;
      return APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: id, folios: [f], por: 'revision.prueba' })
        .then(() => APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: id, fecha_inicio: '2026-11-02', hora_entrada: '09:00', por: 'revision.prueba', perfil: 'revision_cotejo' })); }), folioY);
    const fa = await pagina('grupo.html?folio=APD-G-2026-004&perfil=capacitacion');
    const fb = await pagina('grupo.html?folio=APD-G-2026-004');
    await fa.waitForSelector('#confirmar:not([hidden])');
    await fb.waitForSelector('[data-filas] button');
    await fb.click('[data-filas] button:has-text("Dar de baja")');
    await fb.fill('#motivo-baja', 'Pidió cambiar de fecha por trabajo.');
    await Promise.all([fb.waitForNavigation(), fb.click('#baja [data-accion="enviar"]')]);
    await fa.selectOption('#instructor', 'instructor.ficticio');
    await fa.click('#confirmar [data-accion="enviar"]');
    await fa.waitForSelector('#confirmar [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
    const m2 = await aviso(fa, '#confirmar [data-estado-envio]');
    const g004 = await fa.evaluate(() => APD.cargar().then((d) => d.grupo.find((g) => g.folio === 'APD-G-2026-004').estado));
    comprueba(/No se confirmó el grupo/.test(m2) && /4 personas y el mínimo es 5/.test(m2) && g004 === 'en_integracion' && /folio=APD-G-2026-004&perfil=capacitacion$/.test(fa.url()) && await fa.inputValue('#instructor') === 'instructor.ficticio',
      t(`F3 M2: no dice «Grupo confirmado» si no se confirmó; dice por qué y conserva lo elegido («${m2.slice(0, 90)}»)`));
  });
}

/* ───── Auditoría «intentar romperlo», bloque 3: guardados que fallan y registros dañados (F4 A1 a A6, A8, M1 a M3, B3) ─────
   El navegador hostil se simula con scripts de inicio (los del frente 4 de la auditoría): localStorage que lanza al leerse
   o en cada método, sin IndexedDB, cuota llena en IndexedDB o en localStorage. Cada comprobación falla con el código del
   bloque 2 (commit 2bd8fd9) y pasa con el del bloque 3. */
const HOSTIL = {
  lsLanza: `(() => { const e = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: e, configurable: true }); })();`,
  lsMetodos: `(() => { const e = () => { throw new DOMException('denied', 'SecurityError'); };
    const falso = { getItem: e, setItem: e, removeItem: e, clear: e, key: e, get length() { e(); } };
    Object.defineProperty(window, 'localStorage', { get: () => falso, configurable: true }); })();`,
  idbNo: `(() => { try { delete window.indexedDB; } catch (e) {} Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true, writable: true }); })();`,
  cuotaIdb: `(() => { const q = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const put = IDBObjectStore.prototype.put; const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.put = function () { if (window.__cuota) throw q(); return put.apply(this, arguments); };
    IDBObjectStore.prototype.add = function () { if (window.__cuota) throw q(); return add.apply(this, arguments); };
    window.__cuota = true; })();`,
  // Toda escritura nueva en localStorage falla, salvo la sesión y las marcas de la prueba; __cuotaLs la apaga o la prende
  cuotaLs: (prendida = true) => `(() => { const q = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__cuotaLs && this === window.localStorage && !/^apd\\.sesion$|^apd\\.prueba\\./.test(k)) throw q(); return set.call(this, k, v); };
    window.__cuotaLs = ${prendida}; })();`,
  sesion: (id) => `try { localStorage.setItem('apd.sesion', JSON.stringify({ id: ${JSON.stringify(id)} })); } catch (e) {}`
};

async function romperTres(navegador) {
  const t = (m) => `[romper 3] ${m}`;
  const libres = datos.solicitante.filter((p) => p.estado === 'activa' && !datos.acreditacion.some((a) => a.solicitante_id === p.id)
    && !datos.solicitud.some((s) => s.solicitante_id === p.id && !FINALES.includes(s.estado)));
  const texto = async (pg, sel) => (await pg.isVisible(sel) ? (await pg.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
  /* Cada parte en su contexto, con sus scripts de inicio; si una se detiene, cuenta como fallida y siguen las demás */
  const parte = async (nombre, inicio, fn) => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    for (const s of inicio) await c.addInitScript(s);
    const errores = [];
    const pagina = async (url) => {
      const pg = await c.newPage();
      pg.on('pageerror', (e) => errores.push(`${pg.url()} · ${e.message}`));
      pg.on('console', (m) => { if (m.type() === 'error') errores.push(`${pg.url()} · ${m.text()}`); });
      if (url) await pg.goto(BASE + url);
      return pg;
    };
    try { await fn({ c, pagina }); } catch (e) { mal(t(`${nombre}: se detuvo: ${e.message.split('\n')[0]}`)); }
    comprueba(errores.length === 0, t(`${nombre}: sin errores ni promesas sin atender${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
  };
  const hastaRevision = async (pg) => {
    await pg.goto(BASE + 'solicitud.html');
    await pg.waitForSelector(`${pasoVisible} #nivel_estudios`);
    await pg.selectOption('#nivel_estudios', 'licenciatura');
    await pg.fill('#carrera', 'Biología');
    await pg.keyboard.press('Escape');
    // En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026)
    if (await pg.isVisible('[data-campo="estatus_estudios"]')) await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
    await siguiente(pg);
    await pg.waitForSelector(`${pasoVisible} [data-campo^="doc_"]`);
    await cargaObligatorios(pg);
    await siguiente(pg);
    await marcaCasillas(pg);
  };
  const envia = async (pg, listo = '[data-acuse]:not([hidden])') => {
    await pg.click('[data-accion="enviar"]');
    await pg.waitForSelector(`${listo}, [data-estado-envio]:not([hidden])`, { timeout: 8000 }).catch(() => null);
    return { listo: await pg.isVisible(listo), aviso: await texto(pg, '[data-estado-envio]') };
  };

  /* ── A1 · la solicitud no se guarda: no hay acuse ni folio ── */
  for (const [nombre, hostil, p] of [['sin IndexedDB', HOSTIL.idbNo, libres[0]], ['IndexedDB lleno', HOSTIL.cuotaIdb, libres[1]]]) {
    await parte(`A1 ${nombre}`, [HOSTIL.sesion(p.id), hostil], async ({ pagina }) => {
      const pg = await pagina('index.html');
      await hastaRevision(pg);
      const r = await envia(pg);
      const deP = await pg.evaluate((id) => APD.cargar().then((d) => d.solicitud.filter((s) => s.de_prueba && s.solicitante_id === id).length), p.id);
      comprueba(!r.listo && /No se envió tu solicitud\. Este navegador no permitió guardar tu solicitud de prueba/.test(r.aviso) && deP === 0,
        t(`A1 (${nombre}): la solicitud que no se guardó no da acuse ni folio («${r.aviso.slice(0, 90)}»)`));
    });
  }

  /* ── A2 · la revisión no se guarda (localStorage lleno) ── */
  const podaEnviada = enviadas.find((x) => x.tipo_acreditacion === 'poda' && !datos.revision.some((rv) => rv.solicitud_id === x.id));
  await parte('A2', [HOSTIL.cuotaLs()], async ({ pagina }) => {
    const pg = await pagina(`revisar.html?folio=${podaEnviada.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    await aceptaTodos(pg); // por pasos, hasta «Fecha de la cita»
    await pg.waitForSelector('#cita_fecha', { state: 'visible' });
    await pg.fill('#cita_fecha', dma(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min')));
    await pg.selectOption('#cita_hora', '10:00');
    const r = await envia(pg, '#formulario[hidden]');
    const estado = await pg.evaluate((F) => APD.cargar().then((d) => d.solicitud.find((s) => s.folio === F).estado), podaEnviada.folio);
    comprueba(!r.listo && /No se guardó su revisión\. Este navegador no permitió guardar su revisión de prueba/.test(r.aviso) && estado === 'enviada',
      t(`A2: la revisión que no se guardó no dice «Quedó guardado» («${r.aviso.slice(0, 90)}», ${estado})`));
  });

  /* ── A3 · el cotejo no se guarda: localStorage lleno (no se presentó) e IndexedDB lleno (la factura) ── */
  const registraCita = async (pg) => {
    await pulsaEnviar(pg);
    await pg.waitForSelector('#formulario[hidden], [data-estado-envio]:not([hidden]), .resumen-errores', { timeout: 8000 }).catch(() => null);
    return { hecho: await pg.isHidden('#formulario'), aviso: await texto(pg, '[data-estado-envio]') };
  };
  await parte('A3 localStorage lleno', [HOSTIL.cuotaLs()], async ({ pagina }) => {
    const pg = await pagina();
    await abreCotejo(pg, conCita.folio);
    await marcar(pg, 'input[name="se_presento"][value="no"]');
    await alPaso(pg, 'Resultado');
    await pg.fill('#cita_fecha', dma(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min')));
    await pg.selectOption('#cita_hora', '09:30');
    const r = await registraCita(pg);
    const citas = await pg.evaluate((F) => APD.cargar().then((d) => { const s = d.solicitud.find((x) => x.folio === F); return d.cita.filter((x) => x.solicitud_id === s.id && x.resultado === 'pendiente').length; }), conCita.folio);
    comprueba(!r.hecho && /Este navegador no permitió guardar el registro de la cita/.test(r.aviso) && citas === 1,
      t(`A3: «No se presentó» que no se guardó no dice «Quedó guardado» («${r.aviso.slice(0, 90)}»)`));
  });
  await parte('A3 IndexedDB lleno', [HOSTIL.cuotaIdb], async ({ pagina }) => {
    const pg = await pagina();
    await abreCotejo(pg, conCita.folio);
    await cotejoHastaPago(pg);
    await pg.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', PDF);
    await pg.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
    await pg.fill('#factura_rfc', 'XAXX010101000');
    await pg.fill('#factura_razon_social', 'Prueba Ejemplo');
    await pg.fill('#factura_folio_fiscal', crypto.randomUUID().toUpperCase());
    const r = await registraCita(pg);
    const estado = await pg.evaluate((F) => APD.cargar().then((d) => d.solicitud.find((x) => x.folio === F).estado), conCita.folio);
    comprueba(!r.hecho && /Este navegador no permitió guardar el registro de la cita/.test(r.aviso) && estado === 'validada_en_linea',
      t(`A3: el cotejo terminado sin la factura guardada no se registra («${r.aviso.slice(0, 90)}», ${estado})`));
  });

  /* ── A4 · el documento correcto de una cita en pausa no se guarda (IndexedDB lleno) ── */
  const pausaCita = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sPausa = datos.solicitud.find((x) => x.id === pausaCita.solicitud_id);
  await parte('A4', [HOSTIL.sesion(sPausa.solicitante_id), HOSTIL.cuotaIdb], async ({ pagina }) => {
    const pg = await pagina(`corregir.html?folio=${sPausa.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    for (const campo of await pg.$$('#formulario [data-campo^="doc_"]')) if (await campo.isVisible()) await (await campo.$('input[type="file"]')).setInputFiles(PDF);
    const r = await envia(pg, '[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(!r.listo && /Este navegador no permitió guardar tu documento de prueba/.test(r.aviso),
      t(`A4: el documento que no se guardó no dice «Recibimos la corrección de tus documentos» («${r.aviso.slice(0, 90)}»)`));
  });

  /* ── A5 · examen: la respuesta y el envío no se guardan (localStorage se llena a medio examen) ── */
  await parte('A5', [HOSTIL.cuotaLs(false)], async ({ pagina }) => {
    const ap = await pagina('aplicar.html?folio=APD-G-2026-003');
    const boton = ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
    const ins = await boton.getAttribute('data-ins');
    await boton.click();
    await ap.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
    const codigo = (await ap.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
    const ex = await pagina('examen.html');
    await ex.fill('#codigo', codigo);
    await ex.click('#entrar [data-accion="enviar"]');
    await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
    await ex.click('[data-ir-vista="instrucciones"]');
    await ex.click('[data-empezar]');
    await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
    await ex.evaluate(() => { window.__cuotaLs = true; });
    await ex.check('[data-opciones] input[name="respuesta"] >> nth=0', { force: true });
    await ex.waitForSelector('[data-vista="pregunta"] [data-aviso-falla]:not([hidden]), [data-guardado]:text("Respuesta guardada.")', { timeout: 5000 }).catch(() => null);
    const avisoResp = await texto(ex, '[data-vista="pregunta"] [data-aviso-falla]');
    const guardada = (await ex.textContent('[data-guardado]')).trim();
    const marcada = await ex.isChecked('[data-opciones] input[name="respuesta"] >> nth=0');
    comprueba(/No se pudo guardar tu respuesta: levanta la mano/.test(avisoResp) && guardada !== 'Respuesta guardada.' && !marcada,
      t(`A5: la respuesta que no se guardó no dice «Respuesta guardada.» («${avisoResp.slice(0, 70)}», «${guardada}»)`));
    for (let i = 0; i < 12 && await ex.isHidden('[data-vista="revision"]'); i++) await ex.click('[data-siguiente]');
    await ex.click('[data-enviar]');
    await ex.click('.dialogo-confirma [data-r="si"]');
    await ex.waitForSelector('[data-vista="revision"] [data-aviso-falla]:not([hidden]), [data-vista="resultado"]:not([hidden])', { timeout: 5000 }).catch(() => null);
    const avisoEnvio = await texto(ex, '[data-vista="revision"] [data-aviso-falla]');
    const terminado = await ex.evaluate((cod) => JSON.parse(localStorage.getItem(`apd.examen.c.${cod}`)).terminado_en, codigo);
    comprueba(await ex.isHidden('[data-vista="resultado"]') && /No se pudo enviar tu examen: levanta la mano/.test(avisoEnvio) && terminado === null,
      t(`A5: el examen que no se guardó no muestra un resultado («${avisoEnvio.slice(0, 70)}», terminado_en ${terminado})`));
  });

  /* ── M3 · aplicar el examen con localStorage bloqueado: el pase de lista no se registra y se dice ── */
  await parte('M3', [HOSTIL.lsLanza], async ({ pagina }) => {
    const ap = await pagina('aplicar.html?folio=APD-G-2026-003');
    await ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first().click();
    await ap.waitForSelector('[data-aviso-accion]:not([hidden])', { timeout: 5000 }).catch(() => null);
    const a = await texto(ap, '[data-aviso-accion]');
    comprueba(/No se registró a .+No se registró el pase de lista: este navegador no permitió guardarlo/.test(a), t(`M3: «Presente» que no se guardó lo dice («${a.slice(0, 90)}»)`));
  });

  /* ── A6 · registros dañados: se saltan, lo demás se ve y el aviso lo dice una vez ── */
  const [nuevaA6] = libres.slice(2);
  const otraEnviada = enviadas.find((x) => x.id !== podaEnviada.id);
  const gIntegracion = datos.grupo.find((g) => g.estado === 'en_integracion');
  const FOLIO_A6 = 'APD-S-2026-09990';
  await parte('A6', [], async ({ pagina }) => {
    const pg = await pagina('revision.html');
    await pg.waitForSelector('[data-cuenta]');
    await pg.evaluate(async ([F, p, P2, F3, g]) => {
      const ahora = () => new Date().toISOString();
      const espera = () => new Promise((r) => setTimeout(r, 20));
      // Lo válido: una solicitud enviada en la prueba, una revisión y una fecha propuesta de un grupo
      await APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: F, existente: false, tipo_acreditacion: 'poda', modalidad: 'nueva', enviada_en: ahora(), estado_desde: ahora(),
        nivel_estudios: 'licenciatura', carrera: 'Biología', estatus_estudios: 'titulado', anios_experiencia: null,
        persona: { id: p.id, nombre: p.nombre, primer_apellido: p.primer_apellido, segundo_apellido: p.segundo_apellido || null, curp: p.curp, correo: p.correo, telefono: p.telefono, adscripcion: 'independiente', organizacion_id: null, organizacion_nombre: '' } }, []);
      APD_PERSONAL.guardaRevision(P2, { resultado: 'con_observaciones', texto: 'Con observaciones', datos: {}, revisor: 'revision.prueba', en: ahora() });
      // Lo dañado: una revisión null, un evento null y otro que no se puede aplicar, un pase de lista null y una solicitud sin persona
      const rev = JSON.parse(localStorage.getItem('apd.personal.revisiones'));
      rev[F3] = null;
      localStorage.setItem('apd.personal.revisiones', JSON.stringify(rev));
      await espera();
      localStorage.setItem('apd.personal.grupos', JSON.stringify([null, { tipo: 'agregar', grupo_id: g, folios: 5, en: ahora() }]));
      await espera();
      APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: g, fecha_inicio: '2026-11-30', hora_entrada: '09:00' });
      localStorage.setItem('apd.examen.lista', JSON.stringify({ 'inscripcion-que-no-existe': null }));
      await APD_ARCHIVOS_PRUEBA.guardaEnvio({ folio: 'APD-S-2026-09991', existente: false, tipo_acreditacion: 'poda', modalidad: 'nueva' }, []);
    }, [FOLIO_A6, nuevaA6, podaEnviada.folio, otraEnviada.folio, gIntegracion.id]);
    const r = await pg.evaluate(([F, P2, g]) => APD.cargar().then((d) => ({
      nueva: (d.solicitud.find((s) => s.folio === F) || {}).estado || null,
      revisada: d.solicitud.find((s) => s.folio === P2).estado,
      propuesta: d.grupo.find((x) => x.id === g).fecha_inicio,
      ignorados: d.prueba_ignorados
    })), [FOLIO_A6, podaEnviada.folio, gIntegracion.id]);
    comprueba(r.nueva === 'enviada' && r.revisada === 'con_observaciones' && r.propuesta === '2026-11-30' && r.ignorados === 5,
      t(`A6: con registros dañados, lo demás guardado se sigue viendo y se cuentan los ignorados (${JSON.stringify(r)})`));
    await pg.goto(BASE + 'revision.html');
    await pg.waitForSelector('[data-aviso-prueba="ignorados"]', { timeout: 6000 }).catch(() => null);
    const franja = await texto(pg, '[data-aviso-prueba="ignorados"]');
    const cuenta = await texto(pg, '[data-cuenta]');
    comprueba(/5 registros guardados no se pudieron leer/.test(franja) && /Borrar lo guardado/.test(franja) && await pg.locator('[data-aviso-prueba]').count() === 1,
      t(`A6: bajo la franja, un solo aviso dice cuántos registros no se pudieron leer («${franja.slice(0, 90)}»)`));
    comprueba(!/No se pudieron cargar/.test(cuenta) && await pg.locator(`[data-filas] tr[data-folio="${FOLIO_A6}"]`).count() === 1,
      t(`A6: la bandeja muestra la solicitud enviada en la prueba, sin el mensaje de error («${cuenta.slice(0, 60)}»)`));
    await pg.click('.menu-pruebas-boton');
    const menu = await texto(pg, 'dialog.menu-pruebas [data-guardado]');
    await pg.click('dialog.menu-pruebas >> button:text-is("Borrar lo guardado")');
    await pg.waitForFunction(() => /Se borró/.test(document.querySelector('.menu-pruebas-estado').textContent));
    comprueba(/5 registros guardados no se pudieron leer/.test(menu) && await pg.locator('[data-aviso-prueba="ignorados"]').count() === 0,
      t(`A6: el menú de pruebas también lo dice y «Borrar lo guardado» quita el aviso («${menu.slice(-60)}»)`));
  });
  // La bandeja nunca muestra a la vez el error y la lista
  await parte('A6 bandeja', [], async ({ pagina }) => {
    const pg = await pagina();
    // Una revisión aplicada sin forma: la bandeja ya pintó la lista cuando falla al listar «Revisadas en esta prueba»
    await pg.route('**/app/personal.js*', async (r) => { const res = await r.fetch(); const js = (await res.text()).replace('function revisiones(datos) {', 'function revisiones(datos) { if (window.__rompe) return { "APD-S-2026-00000": null }; '); await r.fulfill({ response: res, body: js }); });
    await pg.addInitScript(() => { window.__rompe = true; });
    await pg.goto(BASE + 'revision.html');
    await pg.waitForFunction(() => /No se pudieron cargar/.test(document.querySelector('[data-cuenta]').textContent), null, { timeout: 6000 }).catch(() => null);
    const filas = await pg.locator('[data-filas] tr').count();
    comprueba(/No se pudieron cargar/.test(await pg.textContent('[data-cuenta]')) && filas === 0 && await pg.isHidden('[data-revisadas]'),
      t(`A6: si la bandeja no se puede cargar, dice el error sin la lista (${filas} filas)`));
  });

  /* ── A8 · «Mi perfil»: el contacto (localStorage lleno) y la fotografía (IndexedDB lleno) no se guardan ── */
  await parte('A8 contacto', [HOSTIL.sesion(CON_ORG.id), HOSTIL.cuotaLs()], async ({ pagina }) => {
    const pg = await pagina('datos.html');
    await pg.waitForSelector('[data-editar="contacto"]');
    await pg.click('[data-editar="contacto"]');
    await pg.waitForSelector('#form-contacto:not([hidden])');
    await pg.fill('#form-contacto #telefono', '5512345678');
    await pg.click('#form-contacto [data-accion="enviar"]');
    await pg.waitForSelector('#form-contacto [data-estado-envio]:not([hidden]), [data-guardado="contacto"]:not([hidden])', { timeout: 8000 }).catch(() => null);
    const a = await texto(pg, '#form-contacto [data-estado-envio]');
    comprueba(/No se guardó\. Este navegador no permitió guardar tu contacto/.test(a) && await pg.isHidden('[data-guardado="contacto"]'),
      t(`A8: el contacto que no se guardó no dice «Se guardó tu contacto» («${a.slice(0, 80)}»)`));
  });
  await parte('A8 fotografía', [HOSTIL.sesion(CON_ORG.id), HOSTIL.cuotaIdb], async ({ pagina }) => {
    const pg = await pagina('datos.html');
    await pg.waitForSelector('[data-editar="contacto"]');
    const r = await pg.evaluate(() => APD_PERFIL.guarda('foto', { datos: {}, archivos: [{ campo: 'foto', blob: new Blob(['x'], { type: 'image/png' }), nombre: 'f.png', tipo: 'image/png', size: 1 }] },
      { signal: new AbortController().signal }).then(() => 'guardada', (e) => (e && e.codigo) || 'error'));
    const marca = await pg.evaluate((id) => (JSON.parse(localStorage.getItem('apd.perfiles') || '{}')[id] || {}).foto_nueva || false, CON_ORG.id);
    comprueba(r === 'almacenamiento' && !marca, t(`A8: la fotografía que no se guardó se rechaza y no queda marcada como nueva (${r}, ${marca})`));
  });

  /* ── M1 · la sesión no se guarda: Entrar, «Entrar como» y Crear cuenta lo dicen ── */
  await parte('M1 Entrar', [HOSTIL.lsMetodos], async ({ pagina }) => {
    const pg = await pagina('entrar.html');
    await pg.fill('#curp', CON_ORG.curp);
    await pg.fill('#contrasena', CONTRASENA);
    const r = await envia(pg, 'body.nunca');
    comprueba(/entrar\.html/.test(pg.url()) && /Este navegador no permitió guardar tu sesión de prueba/.test(r.aviso), t(`M1: «Entrar» sin poder guardar la sesión lo dice («${r.aviso.slice(0, 90)}»)`));
  });
  await parte('M1 Entrar como', [HOSTIL.lsMetodos], async ({ pagina }) => {
    const pg = await pagina('index.html');
    await pg.click('.menu-pruebas-boton');
    await pg.selectOption('#menu-pruebas-perfil', 'poda');
    const caso = await pg.locator('#menu-pruebas-persona option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean)[0]);
    await pg.selectOption('#menu-pruebas-persona', caso);
    await pg.click('dialog.menu-pruebas >> button:text-is("Entrar")');
    await pg.waitForTimeout(400);
    const e = await texto(pg, '.menu-pruebas-estado');
    comprueba(/index\.html/.test(pg.url()) && /Este navegador no permitió guardar la sesión de prueba/.test(e), t(`M1: «Entrar como» sin poder guardar la sesión lo dice («${e.slice(0, 80)}»)`));
  });
  await parte('M1 Crear cuenta', [HOSTIL.lsMetodos], async ({ pagina }) => {
    const pg = await pagina('cuenta.html');
    await pg.waitForSelector('#curp');
    await llenaCuenta(pg, NUEVA);
    const r = await envia(pg);
    comprueba(!r.listo && /Tu cuenta de prueba quedó guardada, pero este navegador no permitió guardar tu sesión/.test(r.aviso),
      t(`M1: «Crea tu cuenta» sin poder guardar la sesión no da el acuse («${r.aviso.slice(0, 90)}»)`));
  });

  /* ── M2 · material de estudio sin IndexedDB: ocultar y agregar lo dicen ── */
  await parte('M2', [HOSTIL.idbNo], async ({ pagina }) => {
    const pg = await pagina('material-personal.html');
    await pg.waitForSelector('[data-filas] tr [data-accion-material="ocultar"]');
    await pg.locator('[data-filas] tr [data-accion-material="ocultar"]').first().click();
    await pg.click('dialog [data-r="si"]');
    await pg.waitForSelector('[data-aviso-material]:not([hidden])', { timeout: 5000 }).catch(() => null);
    const a = await texto(pg, '[data-aviso-material]');
    comprueba(/No se guardó.*Este navegador no permitió guardar el cambio de «/.test(a), t(`M2: «Ocultar» sin IndexedDB lo dice («${a.slice(0, 90)}»)`));
    await pg.click('[data-agregar]');
    await pg.fill('#titulo', 'Guía de prueba');
    await pg.fill('#edicion', 'Edición de prueba');
    await pg.fill('#descripcion', 'Un documento para probar la carga del material.');
    await pg.check('input[name="para"][value="ambas"]');
    await pg.fill('#temas', '2 - Introducción');
    await pg.setInputFiles('[data-campo="archivo"] input[type="file"]', join(raiz, 'sitio/material/NADF-001-RNAT-2015.pdf'));
    await pg.click('[data-guardar]');
    await pg.waitForSelector('#form-material [data-estado-envio]:not([hidden])', { timeout: 15000 }).catch(() => null);
    const f = await texto(pg, '#form-material [data-estado-envio]');
    comprueba(/No se guardó\. Este navegador no permitió guardar el documento/.test(f), t(`M2: «Agregar un documento» sin IndexedDB dice que es el navegador («${f.slice(0, 90)}»)`));
  });

  /* ── B3 · lo guardado caducó: se dice una vez ── */
  await parte('B3', [], async ({ pagina }) => {
    const pg = await pagina('revision.html');
    await pg.waitForSelector('[data-cuenta]');
    await pg.evaluate(([id, F]) => {
      localStorage.setItem('apd.sesion', JSON.stringify({ id }));
      APD_PERSONAL.guardaRevision(F, { resultado: 'con_observaciones', texto: 'Con observaciones', datos: {}, revisor: 'revision.prueba', en: new Date().toISOString() });
      localStorage.setItem('apd.prueba.ultimo_uso', String(Date.now() - 8 * 864e5));
    }, [CON_ORG.id, podaEnviada.folio]);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForURL(/entrar\.html/);
    await pg.waitForSelector('[data-aviso-prueba="caducada"]', { timeout: 6000 }).catch(() => null);
    const a = await texto(pg, '[data-aviso-prueba="caducada"]');
    const queda = await pg.evaluate(() => localStorage.getItem('apd.personal.revisiones'));
    await pg.waitForTimeout(1700);
    await pg.goto(BASE + 'index.html');
    await pg.waitForSelector('.menu-pruebas-boton');
    const otraVez = await pg.locator('[data-aviso-prueba="caducada"]').count();
    comprueba(/Lo guardado en esta prueba se borró/.test(a) && /más de 7 días sin usarla/.test(a) && queda === null && otraVez === 0,
      t(`B3: al caducar lo guardado se dice una vez, en la pantalla a la que se llega («${a.slice(0, 80)}», después ${otraVez})`));
  });
}

/* Fechas (auditoría 2026-10-19): fecha pegada como AAAA-MM-DD en cada campo día/mes/año (R4-01, F2-A1), primer día del
   curso hasta un año después de hoy (decisión 3), plazo de renovación de una acreditación que vence un 29 de febrero
   (B8-01, decisión 11), «hoy mismo» por el día de la Ciudad (B8-02) y «Mis trámites» y «Verificar» con el navegador en
   UTC (B8-03). */
async function fechas(navegador) {
  const t = (m) => `[fechas] ${m}`;
  const nuevo = async ({ zona = ZONA, datosDe } = {}) => {
    const c = await navegador.newContext({ timezoneId: zona, viewport: { width: 1280, height: 900 } });
    await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    // datosDe: cambia una copia de los ficticios (como la base los entregaría en otro caso)
    if (datosDe) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(datosDe(structuredClone(datos))) }));
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, pg, errores };
  };
  // Pegar con el portapapeles (Ctrl+V) o insertar de golpe (como un autocompletado); se sale del campo
  const pega = async (pg, sel, texto) => {
    await pg.fill(sel, ''); await pg.focus(sel);
    await pg.evaluate((x) => navigator.clipboard.writeText(x), texto); await pg.keyboard.press('Control+V');
    await pg.keyboard.press('Tab'); return pg.inputValue(sel);
  };
  const inserta = async (pg, sel, texto) => { await pg.fill(sel, ''); await pg.focus(sel); await pg.keyboard.insertText(texto); await pg.keyboard.press('Tab'); return pg.inputValue(sel); };
  const errorDe = (pg, campo) => pg.evaluate((c) => ((document.querySelector(`[data-campo="${c}"] .err`) || {}).textContent || '').trim(), campo);
  // Fechas guardadas con un año imposible (grupos y citas)
  const anioImposible = (pg) => pg.evaluate(() => APD.cargar().then((d) => [...d.grupo.map((g) => g.fecha_inicio), ...d.solicitud.map((s) => s.cita_en), ...(d.cita || []).map((x) => x.programada_en)]
    .filter((f) => f && Number(String(f).slice(0, 4)) > 2030)));
  const aceptaTodo = (pg) => aceptaTodos(pg); // por pasos (decisión de Liber del 24/10/2026), hasta «Fecha de la cita»
  const corte = datos.fecha_corte;
  const unAnio = `${corte.slice(8, 10)}/${corte.slice(5, 7)}/${Number(corte.slice(0, 4)) + 1}`; // 14/10/2027 (el corte no es un 29/02)

  // 1 · Revisar: la cita pegada como AAAA-MM-DD
  let { c, pg, errores } = await nuevo();
  const porRevisar = datos.solicitud.find((s) => s.folio === 'APD-S-2026-00044' && s.estado === 'enviada');
  await pg.goto(BASE + `revisar.html?folio=${porRevisar.folio}`);
  await pg.waitForSelector('#formulario:not([hidden])');
  await aceptaTodo(pg);
  comprueba(await pega(pg, '#cita_fecha', '2026-11-02') === '02/11/2026', t('revisar: pegar «2026-11-02» en la cita deja 02/11/2026'));
  comprueba(await pega(pg, '#cita_fecha', ' 2026-11-02 ') === '02/11/2026', t('revisar: también con espacios alrededor'));
  await pg.selectOption('#cita_hora', '10:00');
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  // El resultado es un aviso: la cita con fecha larga (decisión 16 b del 20/10; C5-01)
  comprueba(/cita el lunes 2 de noviembre de 2026 a las 10:00/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')) && (await anioImposible(pg)).length === 0, t('revisar: la cita queda el lunes 2 de noviembre de 2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`revisar sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 2 · Cotejo: la cita nueva (no se presentó), insertada de golpe
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + `cotejo.html?folio=${conCita.folio}`);
  // La cita es de otro día: en la prueba se atiende «como si fuera su día» (romper F2 A6)
  await pg.waitForSelector('[data-atender-simulada]:not([hidden]), #formulario:not([hidden])');
  if (await pg.isVisible('[data-atender-simulada]')) await pg.click('[data-atender-simulada]');
  await pg.waitForSelector('#formulario:not([hidden])');
  await marcar(pg, 'input[name="se_presento"][value="no"]');
  await alPaso(pg, 'Resultado');
  comprueba(await inserta(pg, '#cita_fecha', '2026-11-02') === '02/11/2026', t('cotejo: «2026-11-02» insertado de golpe en la cita nueva deja 02/11/2026'));
  comprueba(await pega(pg, '#cita_fecha', '02.11.2026') === '02/11/2026' && await inserta(pg, '#cita_fecha', '02-11-2026') === '02/11/2026', t('cotejo: dd.mm.aaaa y dd-mm-aaaa también quedan en 02/11/2026'));
  await pg.selectOption('#cita_hora', '09:30');
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
  comprueba(/lunes 2 de noviembre de 2026 a las 09:30/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')) && (await anioImposible(pg)).length === 0, t('cotejo: la cita nueva queda el lunes 2 de noviembre de 2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`cotejo sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 3 · «Grupos» (antes «Programar»): el primer día sale de la semana elegida (no se escribe ni se pega: lo pegado y lo
  // escrito se prueba en la ficha del grupo, abajo); fecha a más de un año en ?semana=
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
  await listoGrupos(pg);
  await pg.click('[data-mes="1"]');
  await pg.click('.arm-semana-elegir[data-lunes="2026-11-02"]');
  comprueba(await pg.inputValue('#fecha_inicio') === '02/11/2026' && /Del 2 al 6 de noviembre/.test(await pg.textContent('[data-elegida-nombre]')), t('grupos: elegir la semana deja 02/11/2026 y la semana elegida dice del 2 al 6 de noviembre'));
  await siguientePaso(pg);
  await siguientePaso(pg);
  await Promise.all([pg.waitForNavigation(), pg.click('[data-armar="crear"]')]);
  await pg.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  // Desde los ajustes del equipo (25/10/2026) se crea por confirmar: lo confirma Capacitación
  comprueba(/Grupo creado, por confirmar: Poda nueva · del 2 al 6 de noviembre/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')) && (await anioImposible(pg)).length === 0,
    t('grupos: el grupo se crea del 2 al 6 de noviembre (por confirmar), sin años imposibles'));
  await c.close();
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
  await listoGrupos(pg);
  comprueba((await pg.getAttribute('[data-campo="fecha_inicio"]', 'data-max')) === `${Number(corte.slice(0, 4)) + 1}${corte.slice(4)}`,
    t(`grupos: el primer día tiene máximo un año después de hoy (${unAnio})`));
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&semana=2099-01-05&paso=2');
  await listoGrupos(pg);
  comprueba(await pg.inputValue('#fecha_inicio') === '26/10/2026' && await pg.locator('.arm-semana[data-lunes="2099-01-05"]').count() === 0 && /falta más de un año/.test(await pg.textContent('[data-cal-estado]'))
    && !/2099/.test(await pg.textContent('[data-mes-nombre]')), t('grupos: ?semana=2099-01-05 no se acepta, dice por qué y propone la primera semana posible'));
  comprueba(errores.length === 0, t(`grupos sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 4 · Desde los ajustes del equipo (25/10/2026) la ficha del grupo ya no tiene el primer día: la semana la elige quien
  // arma el grupo, en «Grupos», y Capacitación asigna a la persona instructora y lo confirma. Lo que se probaba al escribir,
  // pegar e insertar ese día se prueba en la otra fecha día/mes/año del personal con máximo: la cita de «Revisar»
  // (hasta meses_adelanto_cita meses)
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + `revisar.html?folio=${porRevisar.folio}`);
  await pg.waitForSelector('#formulario:not([hidden])');
  await aceptaTodo(pg);
  const hastaCita = (await pg.getAttribute('[data-campo="cita_fecha"]', 'data-max')).split('-').reverse().join('/');
  await pg.fill('#cita_fecha', '01/01/2099'); await pg.press('#cita_fecha', 'Tab');
  comprueba((await errorDe(pg, 'cita_fecha')).includes(`posterior al ${hastaCita}`), t(`revisar: 01/01/2099 en la cita da el error «…posterior al ${hastaCita}»`));
  comprueba(await pega(pg, '#cita_fecha', ' 2026-11-09 ') === '09/11/2026', t('revisar: pegar « 2026-11-09 » en la cita deja 09/11/2026'));
  comprueba(await inserta(pg, '#cita_fecha', '2026-11-02') === '02/11/2026', t('revisar: «2026-11-02» insertado de golpe en la cita deja 02/11/2026'));
  await c.close();
  // La ficha del grupo: con su semana (la del 2 de noviembre, elegida en «Grupos») y 5 personas, Capacitación lo confirma
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await listoGrupos(pg);
  const g4 = datos.grupo.find((g) => g.folio === 'APD-G-2026-004');
  await pg.evaluate((id) => APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: id, folios: ['APD-S-2026-00037'], por: APD_PERSONAL.REVISORA.usuario })
    .then(() => APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: id, fecha_inicio: '2026-11-02', hora_entrada: '09:00', por: APD_PERSONAL.REVISORA.usuario, perfil: 'revision_cotejo' })), g4.id);
  await pg.goto(BASE + `grupo.html?folio=${g4.folio}&perfil=capacitacion`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  await pg.selectOption('#instructor', 'instructor2.ficticio');
  await pg.click('#confirmar [data-accion="enviar"]');
  await pg.waitForURL(/hecho=confirmado/);
  await pg.waitForLoadState('networkidle');
  await pg.waitForSelector('[data-situacion] .estado');
  comprueba(await pg.evaluate((f) => APD.cargar().then((d) => { const g = d.grupo.find((x) => x.folio === f); return `${g.estado} ${g.fecha_inicio}`; }), g4.folio) === 'confirmado 2026-11-02'
    && (await anioImposible(pg)).length === 0, t('grupo: Capacitación lo confirma el 02/11/2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`grupo sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 5 · Crea tu cuenta: desde la decisión de Liber del 24/10/2026 la fecha de nacimiento no se escribe ni se pega: se toma
  // de la CURP, en día/mes/año (lo de pegar AAAA-MM-DD en una fecha lo comprueban la cita de «Revisar» y la de «Cotejo»)
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'cuenta.html');
  await pg.waitForSelector('#fecha_nacimiento');
  await pg.fill('#curp', NUEVA.curp);
  comprueba(await pg.inputValue('#fecha_nacimiento') === dma(NUEVA.nacimiento) && await pg.evaluate(() => document.getElementById('fecha_nacimiento').readOnly) && !(await errorDe(pg, 'fecha_nacimiento')),
    t(`cuenta: la fecha de nacimiento se toma de la CURP en día/mes/año, sin escribirla (${await pg.inputValue('#fecha_nacimiento')})`));
  await c.close();

  // 6 · Acreditación que vence un 29 de febrero: se renueva hasta el 28 de febrero del año siguiente, como la base
  for (const zona of [ZONA, 'UTC']) {
    let numero = null;
    let sujeto = null;
    ({ c, pg, errores } = await nuevo({ zona, datosDe: (d) => {
      const a = d.acreditacion.find((x) => x.tipo_acreditacion === 'poda' && d.estado_acreditacion[x.numero] === 'por_vencer'
        && !d.solicitud.some((s) => s.solicitante_id === x.solicitante_id && !FINALES.includes(s.estado)));
      d.fecha_corte = '2028-06-01'; a.emitida_en = '2027-03-01'; a.vence_en = '2028-02-29';
      d.estado_acreditacion[a.numero] = 'vencida_renovable';
      numero = a.numero; sujeto = a.solicitante_id;
      return d;
    } }));
    await pg.goto(BASE + 'index.html');
    await pg.evaluate(() => APD.cargar());
    await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sujeto);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('.ficha-sigue');
    const ficha = await pg.locator('article.ficha', { hasText: numero }).first().textContent();
    comprueba(/renovarla hasta el 28\/02\/2029/.test(ficha), t(`${zona}: vence el 29/02/2028 → «Puedes renovarla hasta el 28/02/2029»`));
    await c.close();
  }

  // 7 · «Recoge tu credencial hoy mismo» sólo si aprobó hoy, en el día de la Ciudad (hoy simulado: 14/10/2026)
  const aprobada = datos.solicitud.find((s) => s.estado === 'aprobada');
  for (const [desde, hoyMismo] of [['2026-10-14T01:30:00Z', false], ['2026-10-15T03:00:00Z', true]]) {
    ({ c, pg, errores } = await nuevo({ zona: 'UTC', datosDe: (d) => { d.solicitud.find((s) => s.id === aprobada.id).estado_desde = desde; return d; } }));
    await pg.goto(BASE + 'index.html');
    await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), aprobada.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-solicitudes] .ficha');
    const ficha = await pg.locator('[data-solicitudes] .ficha', { hasText: aprobada.folio }).textContent();
    comprueba(/hoy mismo/.test(ficha) === hoyMismo, t(`aprobó ${desde} (${hoyMismo ? '14' : '13'}/10 en la Ciudad): ${hoyMismo ? 'dice' : 'no dice'} «hoy mismo»`));
    await c.close();
  }

  // 8 · Con el navegador en UTC, «Mis trámites» y «Verificar» dicen lo mismo que en la Ciudad de México
  const personas = [paraDictaminador, persona(inscrita.solicitante_id), persona(conObs.solicitante_id), persona(conCita.solicitante_id), persona(aprobada.solicitante_id)];
  const vistas = {};
  for (const zona of [ZONA, 'UTC']) {
    ({ c, pg, errores } = await nuevo({ zona }));
    vistas[zona] = [];
    await pg.goto(BASE + 'index.html');
    for (const p of personas) {
      await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), p.id);
      await pg.goto(BASE + 'tramites.html');
      await pg.waitForSelector('[data-solicitudes] .ficha, [data-solicitudes] .vacio, [data-acreditaciones] .ficha');
      await pg.waitForLoadState('networkidle');
      vistas[zona].push((await pg.textContent('main')).replace(/\s+/g, ' '));
    }
    for (const v of [vigente, noVigente]) {
      await pg.goto(BASE + 'verificar.html');
      await pg.fill('#numero', v.numero);
      await pg.click('[data-accion="enviar"]');
      await pg.waitForSelector('[data-verificacion]:not([hidden])');
      vistas[zona].push((await pg.textContent('[data-verificacion]')).replace(/\s+/g, ' '));
    }
    comprueba(errores.length === 0, t(`${zona}: «Mis trámites» y «Verificar» sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
  }
  const distintas = vistas[ZONA].map((v, i) => (v === vistas.UTC[i] ? null : i)).filter((i) => i !== null);
  comprueba(distintas.length === 0, t(`UTC: «Mis trámites» de ${personas.length} personas y «Verificar» de 2 números dicen lo mismo que en la Ciudad de México${distintas.length ? ` (distintas: ${distintas.join(', ')})` : ''}`));
}

// En teléfono y en escritorio (auditoría 2026-10-19, A1-04: antes sólo a 390 px y sin «Corregir un documento»)
async function accesibilidad(navegador, ancho = 390, alto = 844) {
  if (!process.env.AXE) { console.log('OMITIDO  accesibilidad: falta AXE=<ruta a axe.min.js del estándar>'); return; }
  const axe = readFileSync(process.env.AXE, 'utf8');
  // Con movimiento reducido (el estándar anula sus transiciones) y esperando a que terminen las animaciones: axe medía el
  // contraste de una opción recién marcada a media transición de color (falla intermitente en GitHub, 20/10/2026)
  const page = await navegador.newPage({ timezoneId: ZONA, viewport: { width: ancho, height: alto }, reducedMotion: 'reduce' });
  await page.goto(BASE + 'index.html');
  await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), paraDictaminador.id);
  const pantallas = [['index.html'], ['cuenta.html'], ['cuenta.html', 'con errores'], ['entrar.html'], ['tramites.html'], ['datos.html'], ['solicitud.html?tipo=dictaminador'], ['solicitud.html?tipo=dictaminador', 'con errores'], ['verificar.html'],
    ['revision.html'], [`revisar.html?folio=${porClasificar.folio}`], [`revisar.html?folio=${porClasificar.folio}`, 'con errores'], [`revisar.html?folio=${noCumple.folio}`, 'rechazo'], [`revisar.html?folio=${porClasificar.folio}`, 'visor'],
    // «Grupos» paso a paso (24/10/2026): cada paso, el de un día (renovación) y los dos errores (sin curso, sin personas)
    ['grupos.html'], ['grupos.html', 'sin curso'], ['grupos.html?curso=poda-nueva&paso=2'], ['grupos.html?curso=poda-renovacion&paso=2'], ['grupos.html?curso=poda-nueva&paso=3'],
    ['grupos.html?curso=poda-nueva&paso=3', 'sin personas'], ['grupos.html?curso=poda-nueva&paso=4'], ['grupos.html?grupo=APD-G-2026-004&paso=3'], ['asistencia.html'], ['aplicar.html'], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_integracion').folio}`], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}`],
    [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-12').folio}`], [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-12').folio}`, 'sin marcar'],
    ['material.html'], ['material-personal.html'], ['citas.html'], [`cotejo.html?folio=${conCita.folio}`], [`cotejo.html?folio=${conCita.folio}`, 'cita futura'], [`cotejo.html?folio=${conCita.folio}`, 'con errores'], [`cotejo.html?folio=${conCita.folio}`, 'factura'],
    ['solicitud.html', 'menú de pruebas'], ['cuenta.html', 'menú de pruebas'], ['entrar.html', 'menú de pruebas']];
  // «Cargar el documento correcto» de una cita en pausa, con la sesión de su persona (al final: cambia la sesión)
  const pausaHoy = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sCorregir = datos.solicitud.find((x) => x.id === pausaHoy.solicitud_id);
  pantallas.push([`corregir.html?folio=${sCorregir.folio}`], [`corregir.html?folio=${sCorregir.folio}`, 'con errores']);
  // Cancelación (P120) y reposición de la credencial (P140), sesión del 23/10/2026: las pantallas del personal y las de la
  // persona, con la sesión de quien está en cada paso (tercer elemento)
  const enPaso = (e) => datos.acreditacion.find((a) => a.id === datos.reposicion.find((r) => r.estado === e).acreditacion_id);
  const canc = datos.acreditacion.find((a) => a.cancelada_en);
  pantallas.push(['acreditaciones.html'], ['acreditacion.html?numero=PD-2025-K100&perfil=instructor'], ['acreditacion.html?numero=PD-2025-K100&perfil=instructor', 'diálogo de cancelación'],
    ['acreditacion.html?numero=PD-2025-K100&perfil=instructor', 'cancelación con errores'], [`acreditacion.html?numero=${canc.numero}`],
    [`acreditacion.html?numero=${enPaso('solicitada').numero}`], [`acreditacion.html?numero=${enPaso('solicitada').numero}`, 'acta con errores'],
    [`acreditacion.html?numero=${enPaso('acta_aceptada').numero}`], [`acreditacion.html?numero=${enPaso('acta_aceptada').numero}`, 'entrega con errores'],
    ['verificar.html', 'cancelada'],
    ['tramites.html', null, canc.solicitante_id], ['tramites.html', null, enPaso('con_observaciones').solicitante_id], ['tramites.html', null, enPaso('acta_aceptada').solicitante_id],
    [`reposicion.html?numero=${enPaso('repuesta').numero}`, null, enPaso('repuesta').solicitante_id], [`reposicion.html?numero=${enPaso('repuesta').numero}`, 'con errores', enPaso('repuesta').solicitante_id],
    [`reposicion.html?numero=${enPaso('con_observaciones').numero}`, null, enPaso('con_observaciones').solicitante_id]);
  for (const [url, estado, sesion] of pantallas) {
    if (sesion) await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sesion);
    if (url.startsWith('corregir.html')) await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sCorregir.solicitante_id);
    await page.goto(BASE + url);
    if (url.startsWith('corregir.html')) await page.waitForSelector('#formulario:not([hidden])');
    await page.waitForLoadState('networkidle');
    // La cita futura se atiende «como si fuera su día» (F2 A6), salvo cuando se revisa su aviso
    if (url.startsWith('cotejo.html') && estado !== 'cita futura' && await page.isVisible('[data-atender-simulada]')) await page.click('[data-atender-simulada]');
    // «Revisar», «Cita de cotejo» y «Crea tu cuenta» van por pasos (decisión de Liber del 24/10/2026): el rechazo se ve en
    // «Resultado»; los errores, al pulsar «Siguiente» en el primer paso. Cada paso se revisa aparte en SOLO=pasos.
    if (estado === 'rechazo') { await page.check('input[name="comprobante_confirma"][value="si"]'); await sigPaso(page); }
    else if (estado === 'menú de pruebas') { await page.click('.menu-pruebas-boton'); await page.waitForSelector('dialog.menu-pruebas[open] [data-guardado]'); }
    else if (estado === 'factura') await cotejoHastaPago(page); else if (estado === 'sin marcar') await page.click('[data-guardar]');
    else if (estado === 'sin personas') {
      await soloA(page, []);
      await page.click('#paso-personas [data-accion="siguiente"]');
      await page.waitForSelector('[data-error-personas] .aviso');
    } else if (estado === 'sin curso') {
      await page.click('#paso-curso [data-accion="siguiente"]');
      await page.waitForSelector('#paso-curso .resumen-errores');
    }
    else if (estado === 'visor') { await page.click('[data-ver="comprobante_estudios"]'); await page.waitForSelector('.visor-lienzo'); }
    else if (estado === 'cita futura') await page.waitForSelector('[data-futura]:not([hidden])');
    else if (estado === 'diálogo de cancelación' || estado === 'cancelación con errores') {
      await page.click('button:has-text("Cancelar acreditación")');
      await page.waitForSelector('#dlg-cancelar[open]');
      if (estado === 'cancelación con errores') { await page.click('#dlg-cancelar [data-accion="enviar"]'); await page.waitForSelector('#motivo-cancelar[aria-invalid="true"]'); }
    } else if (estado === 'acta con errores') { await page.click('#acta [data-accion="enviar"]'); await page.waitForSelector('#acta [aria-invalid="true"]'); }
    else if (estado === 'entrega con errores') { await page.click('#entrega [data-accion="enviar"]'); await page.waitForSelector('#entrega [aria-invalid="true"]'); }
    else if (estado === 'cancelada') {
      await page.fill('#numero', canc.numero);
      await page.click('[data-accion="enviar"]');
      await page.waitForSelector('[data-verificacion]:not([hidden])');
    }
    else if (estado) await page.click(/^(solicitud|cuenta|revisar|cotejo)\.html/.test(url) ? `${pasoVisible} [data-accion="siguiente"]` : '[data-accion="enviar"]');
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.evaluate(axe); // por el protocolo del navegador: la política de contenido no deja scripts en línea
    // Cada violación con el marcado del elemento, para saber cuál es sin volver a correr. Sin excepciones (la barra fija de
    // elegidas de «Grupos», que pedía cuidar las casillas que quedaban debajo, ya no existe desde el 24/10/2026)
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 200)).join(' || ')}`));
    comprueba(v.length === 0, `[accesibilidad ${ancho} px] ${url}${estado ? ' ' + estado : ''}${v.length ? ': ' + v.join(', ') : ''}`);
  }
  await page.close();
}

/* ── Licencias (auditoría 2026-10-19, F3-02; decisión 10) ──
   El repositorio declara su licencia (P167: «Todos los derechos reservados» mientras decide la Secretaría) y cada archivo
   de terceros copiado en sitio/vendor está en el manifiesto con su huella y su licencia, y en LICENCIA.md. */
async function licencias() {
  const t = (m) => `[licencias] ${m}`;
  const { createHash } = await import('node:crypto');
  const lic = readFileSync(join(raiz, 'LICENCIA.md'), 'utf8');
  comprueba(/Todos los derechos reservados/.test(lic) && /P167/.test(lic), t('LICENCIA.md: «Todos los derechos reservados» y el pendiente P167'));
  const m = JSON.parse(readFileSync(join(raiz, 'sitio/vendor/MANIFIESTO.json'), 'utf8'));
  const enDisco = (d) => readdirSync(join(raiz, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? enDisco(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const archivos = enDisco('sitio/vendor').filter((f) => !f.endsWith('/MANIFIESTO.json')).map((f) => f.slice('sitio/vendor/'.length));
  const declarados = new Map(m.bibliotecas.flatMap((b) => b.archivos.map((a) => [a.ruta, a.sha256])));
  const sin = archivos.filter((f) => !declarados.has(f));
  const distintos = [...declarados].filter(([r, h]) => !archivos.includes(r) || createHash('sha256').update(readFileSync(join(raiz, 'sitio/vendor', r))).digest('hex') !== h).map(([r]) => r);
  comprueba(!sin.length && !distintos.length, t(`sitio/vendor: los ${archivos.length} archivos están en el manifiesto con su huella${sin.length ? '; sin declarar: ' + sin.join(', ') : ''}${distintos.length ? '; huella distinta o falta: ' + distintos.join(', ') : ''}`));
  const faltan = m.bibliotecas.filter((b) => !lic.includes(b.version) || !lic.includes(b.licencia)).map((b) => b.paquete);
  comprueba(!faltan.length, t(`LICENCIA.md lista cada biblioteca copiada con su versión y licencia${faltan.length ? '; faltan: ' + faltan.join(', ') : ''}`));
  const fuentes = readdirSync(join(raiz, 'sitio/formkit/fuentes'));
  comprueba(['Roboto', 'Cabin'].every((f) => fuentes.includes(`${f}-OFL.txt`) && lic.includes(`${f}-OFL.txt`)), t('las fuentes llevan su licencia y LICENCIA.md las lista'));
}

/* ── Política de contenido y de referente (auditoría 2026-10-19, B7-01; decisión 9) ──
   Las 21 páginas declaran la misma CSP estricta (sin 'unsafe-inline' ni 'unsafe-eval') y el referente same-origin,
   antes de cualquier recurso; y en el navegador nada la viola: cada página, el visor de PDF, la foto de la cuenta
   (vista previa y recodificación) y el examen. La genera herramientas/construir-sitio.mjs. */
async function politicaContenido(navegador) {
  const t = (m) => `[csp] ${m}`;
  const paginas = readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html')).sort();
  const politicas = new Set();
  const malas = [];
  for (const p of paginas) {
    const h = readFileSync(join(raiz, 'sitio', p), 'utf8');
    const m = h.match(/^<!DOCTYPE html>\n<html[^>]*>\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="([^"]+)">\n<meta name="referrer" content="same-origin">\n/);
    if (!m || (h.match(/Content-Security-Policy/g) || []).length !== 1) { malas.push(p); continue; }
    politicas.add(m[1]);
  }
  // 21 hasta la sesión del 23/10/2026, parte B: más «Acreditaciones», «Una acreditación» y «Reposición de tu credencial»
  // 25 desde los ajustes del equipo (25/10/2026): el inicio de Capacitación (capacitacion.html); 27 con el registro
  // asistido (25/10/2026); 26 sin él (decisión del 26/10/2026): se quita asistido.html y queda ventanilla.html («Consultar
  // un trámite»)
  comprueba(paginas.length === 26 && !malas.length, t(`las ${paginas.length} páginas declaran la política y el referente justo después de charset${malas.length ? '; faltan: ' + malas.join(', ') : ''}`));
  /* Excepción documentada (decisión del 23/10/2026, P68): la página con el mapa de Google de la sede (data-mapa-sede; sólo
     «Mis trámites») agrega frame-src con los dos dominios del mapa y nada más; las demás, la política estricta sin cambio */
  const conMapa = paginas.filter((p) => /\sdata-mapa-sede[\s>]/.test(readFileSync(join(raiz, 'sitio', p), 'utf8')));
  const FRAME_MAPA = '; frame-src https://www.google.com https://maps.google.com';
  const politicaDe = (p) => readFileSync(join(raiz, 'sitio', p), 'utf8').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const p of conMapa) politicas.delete(politicaDe(p));
  const csp = [...politicas][0] || '';
  comprueba(politicas.size === 1 && /script-src 'self';/.test(csp) && /style-src 'self';/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && !/unsafe/.test(csp) && !/frame-src/.test(csp),
    t(`una sola política, estricta, en las ${paginas.length - conMapa.length} páginas sin mapa: «${csp}»`));
  comprueba(conMapa.join() === 'tramites.html' && conMapa.every((p) => politicaDe(p) === csp + FRAME_MAPA),
    t(`excepción del mapa (P68) sólo en ${conMapa.join(', ') || 'ninguna'}: la misma política más «${FRAME_MAPA.slice(2)}», sin scripts ni estilos de Google`));
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: 390, height: 844 } });
  await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim())); });
  const pg = await c.newPage();
  const enConsola = [];
  pg.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) enConsola.push(m.text().slice(0, 140)); });
  const violaciones = async () => (await pg.evaluate(() => window.__csp || [])).concat(enConsola.splice(0));
  const revisa = async (donde) => { const v = await violaciones(); comprueba(!v.length, t(`${donde}: sin violaciones${v.length ? ': ' + [...new Set(v)].slice(0, 3).join(' | ') : ''}`)); };
  await pg.goto(BASE + 'index.html');
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), paraDictaminador.id);
  for (const p of paginas) { await pg.goto(BASE + p); await pg.waitForLoadState('networkidle'); await revisa(p); }
  // El visor de PDF (pdf.js y su worker)
  await pg.goto(BASE + `revisar.html?folio=${porClasificar.folio}`);
  await pg.click('[data-ver="comprobante_estudios"]'); // en el paso «Perfil» (revisión por pasos, 24/10/2026)
  await pg.waitForSelector('.visor-lienzo');
  await pg.waitForTimeout(500);
  await revisa('revisar con el visor de PDF abierto');
  // La foto de la cuenta: vista previa (blob:) y recodificación en lienzo
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));
  await pg.goto(BASE + 'cuenta.html');
  // La fotografía está en el tercer paso de «Crea tu cuenta» (24/10/2026)
  for (const [id, v] of [['nombre', NUEVA.nombre], ['primer_apellido', NUEVA.primer_apellido], ['segundo_apellido', NUEVA.segundo_apellido], ['curp', NUEVA.curp]]) await pg.fill(`#${id}`, v);
  await sigPaso(pg);
  for (const [id, v] of [['correo', 'csp@ejemplo.local'], ['correo2', 'csp@ejemplo.local'], ['telefono', '5500000077']]) await pg.fill(`#${id}`, v);
  await pg.check('input[name="adscrito"][value="no"]', { force: true });
  await sigPaso(pg);
  await cargaFoto(pg);
  await revisa('cuenta con la fotografía cargada');
  // «Mis trámites» con el mapa (una persona con cita): el marco de Google se carga (aquí, la página mínima de
  // herramientas/sin-google.mjs) sin violación; en una página sin la excepción, el mismo marco se bloquea (frame-src)
  const conCitaId = conCita.solicitante_id;
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), conCitaId);
  await pg.goto(BASE + 'tramites.html');
  await pg.locator('[data-mapa]').scrollIntoViewIfNeeded();
  await (await (await pg.$('[data-mapa]')).contentFrame()).waitForSelector('[data-mapa-prueba]');
  await revisa('tramites con el mapa de Google cargado');
  await pg.goto(BASE + 'index.html');
  await pg.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://maps.google.com/maps?q=0,0&output=embed'; document.body.append(f); });
  await pg.waitForFunction(() => (window.__csp || []).length > 0, null, { timeout: 5000 }).catch(() => {});
  const bloqueado = (await violaciones()).filter((v) => /frame-src|child-src|default-src/.test(v) && /maps\.google\.com|Refused to frame/.test(v));
  comprueba(bloqueado.length >= 1, t(`index.html (sin la excepción) bloquea un marco de Google: ${bloqueado[0] || 'no lo bloqueó'}`));
  await c.close();
}

/* ── Mapa de la sede (decisión de Liber del 23/10/2026, P68; SOLO=mapa) ──
   «Mis trámites» muestra un mapa de Google del Vivero Nezahualcóyotl cuando la persona tiene que ir: su cita de cotejo,
   su curso o la entrega de su credencial. Un solo mapa por pantalla, aunque haya cita y curso a la vez; sin nada de eso,
   no hay mapa. El marco lleva título, se carga al acercarse (lazy) y sin referente; el enlace «Abrir en Google Maps» va a
   las coordenadas del parámetro sede_mapa y dice que se abre en otra pestaña; junto al mapa se dice que lo muestra
   Google. Sin desborde a 320 y 390 px, axe sin violaciones y la política de contenido permite el marco (la página mínima
   de herramientas/sin-google.mjs llega a cargarse) sin otra violación. */
async function mapaSede(navegador) {
  const t = (m) => `[mapa] ${m}`;
  const param = (datos.parametro.find((x) => x.clave === 'sede_mapa') || {}).valor || '';
  const [lat, lng] = param.split(',');
  const nombre = (datos.parametro.find((x) => x.clave === 'sede') || {}).valor;
  // La dirección confirmada por Liber el 23/10/2026, sin la marca de las referencias, que siguen pendientes
  const direccion = 'Canal de Chalco s/n, colonia Ciénega Grande, Alcaldía Xochimilco';
  // A qué va a la sede cada solicitud, calculado aquí desde los datos (no desde la pantalla)
  const entregada = (s) => (datos.acreditacion.find((a) => a.solicitud_id === s.id) || {}).entregada_en;
  const aQueVa = (s) => {
    if (s.estado === 'validada_en_linea' && s.cita_en) return 'cita';
    if (s.estado === 'inscrita') {
      const ins = datos.inscripcion.find((i) => i.solicitud_id === s.id && i.activa);
      const g = ins && datos.grupo.find((x) => x.id === ins.grupo_id);
      return g && g.fecha_inicio && ['confirmado', 'en_curso'].includes(g.estado) ? 'curso' : null;
    }
    if (s.estado === 'aprobada') return 'entrega';
    if (s.estado === 'acreditada' && datos.acreditacion.some((a) => a.solicitud_id === s.id) && !entregada(s)) return 'entrega';
    return null;
  };
  // También va a la entrega quien tiene la reposición de su credencial con el acta aceptada (P140, sesión del 23/10/2026)
  const reponeEnSede = (p, d) => (d.reposicion || []).some((r) => r.estado === 'acta_aceptada' && d.acreditacion.some((a) => a.id === r.acreditacion_id && a.solicitante_id === p.id));
  const lugaresDe = (p, d = datos) => new Set(d.solicitud.filter((s) => s.solicitante_id === p.id).map(aQueVa).concat(reponeEnSede(p, d) ? ['entrega'] : []).filter(Boolean));
  // Todas las cuentas activas tienen «Mis trámites» (sin registro asistido, decisión del 26/10/2026)
  const activas = datos.solicitante.filter((p) => p.estado === 'activa');
  const conLugar = (k) => activas.find((p) => { const l = lugaresDe(p); return l.size === 1 && l.has(k); });
  const sinLugar = activas.find((p) => !lugaresDe(p).size && datos.solicitud.some((s) => s.solicitante_id === p.id));

  const nuevo = async (ancho, alto, { sesion, datosDe } = {}) => {
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, reducedMotion: 'reduce' });
    if (sesion) await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    if (datosDe) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(datosDe(structuredClone(datos))) }));
    await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || ''}`.trim())); });
    const page = await c.newPage();
    const errores = [];
    const aGoogle = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errores.push(m.text().slice(0, 160)); });
    page.on('request', (q) => { if (/^https:\/\/(?:www|maps)\.google\.com\//.test(q.url())) aGoogle.push(q.url()); });
    return { c, page, errores, aGoogle };
  };
  const abre = async (page) => {
    await page.goto(BASE + 'tramites.html');
    await page.waitForFunction(() => { const n = document.querySelector('[data-cargando]'); return n && !/Cargando/.test(n.textContent); });
  };
  const lee = (page) => page.evaluate(() => {
    const sec = document.querySelector('[data-mapa-sede]');
    const f = document.querySelector('iframe');
    const a = document.querySelector('[data-mapa-abrir]');
    const ficha = f && f.closest('.ficha');
    return { marcos: document.querySelectorAll('iframe').length, bloques: document.querySelectorAll('[data-mapa-sede]').length, visible: Boolean(sec && !sec.hidden && sec.checkVisibility()),
      frase: ((sec && sec.querySelector('.ficha-sigue')) || {}).textContent || '', pendientes: sec ? [...sec.querySelectorAll('.pendiente')].map((p) => p.textContent) : [],
      marco: f && { title: f.getAttribute('title'), loading: f.getAttribute('loading'), ref: f.getAttribute('referrerpolicy'), src: f.getAttribute('src'),
        ancho: f.getBoundingClientRect().width, anchoFicha: ficha ? ficha.clientWidth : 0, alto: f.getBoundingClientRect().height },
      enlace: a && { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), texto: a.textContent.replace(/\s+/g, ' ').trim() },
      aviso: sec ? [...sec.querySelectorAll('p')].map((p) => p.textContent).find((x) => /Google/.test(x) && !/Abrir/.test(x)) || '' : '',
      csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '', violaciones: window.__csp || [] };
  });

  // 1. Todas las personas con cuenta, en teléfono: mapa (uno solo) si y sólo si tiene cita, curso o entrega
  {
    const { c, page, errores } = await nuevo(390, 844);
    await page.goto(BASE + 'index.html');
    const malas = [];
    const cuenta = { con: 0, sin: 0 };
    for (const p of activas) {
      await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), p.id);
      await abre(page);
      const r = await lee(page);
      const debe = lugaresDe(p).size > 0;
      cuenta[debe ? 'con' : 'sin']++;
      if (debe ? !(r.marcos === 1 && r.visible) : (r.marcos || r.visible)) malas.push(`${p.curp} (${[...lugaresDe(p)].join(', ') || 'nada'}: ${r.marcos} marcos)`);
    }
    comprueba(!malas.length && cuenta.con >= 3 && cuenta.sin >= 3 && !errores.length,
      t(`las ${activas.length} personas con cuenta: mapa sólo con cita, curso o entrega (${cuenta.con} con mapa, ${cuenta.sin} sin)${malas.length ? '; mal: ' + malas.slice(0, 4).join(', ') : ''}${errores.length ? '; consola: ' + errores.slice(0, 2).join(' | ') : ''}`));
    await c.close();
  }

  // 2. Cita, curso y entrega, en teléfono y en escritorio: el marco, el enlace, el aviso de Google y la política
  const casos = [['cita', conLugar('cita'), 'Tu cita de cotejo es'], ['curso', conLugar('curso'), 'Tu curso es'], ['entrega', conLugar('entrega'), 'La entrega de tu credencial es']];
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    for (const [k, p, frase] of casos) {
      if (!p) { mal(t(`no hay en los datos una persona sólo con ${k}`)); continue; }
      const { c, page, errores, aGoogle } = await nuevo(ancho, alto, { sesion: p.id });
      await abre(page);
      await page.locator('[data-mapa]').scrollIntoViewIfNeeded();
      const marco = await (await page.$('[data-mapa]')).contentFrame();
      await marco.waitForSelector('[data-mapa-prueba]');
      const r = await lee(page);
      const m = r.marco || {};
      const e = r.enlace || {};
      comprueba(r.marcos === 1 && r.bloques === 1 && r.frase === `${frase} en el ${nombre}, ${direccion}.` && r.pendientes.join() === 'Pendiente: referencias para llegar (puerta de acceso y transporte).'
        && m.title === `Mapa de la ubicación del ${nombre}` && m.loading === 'lazy' && m.ref === 'no-referrer'
        && m.src === `https://maps.google.com/maps?q=${lat},${lng}&z=16&hl=es&output=embed` && m.alto >= 200,
        t(`${k} a ${ancho} px: un solo mapa, «${r.frase}» (${r.pendientes.join(' ')}), marco con título, lazy y sin referente, a ${param}`));
      const destino = e.href ? new URL(e.href) : null;
      comprueba(destino && destino.origin === 'https://www.google.com' && destino.searchParams.get('query') === `${lat},${lng}` && destino.searchParams.get('api') === '1'
        && e.target === '_blank' && /noopener/.test(e.rel || '') && e.texto === 'Abrir en Google Maps (se abre en otra pestaña)' && /^El mapa lo muestra Google/.test(r.aviso),
        t(`${k} a ${ancho} px: «${e.texto}» lleva a las coordenadas del parámetro y junto al mapa dice «${r.aviso}»`));
      comprueba(/frame-src https:\/\/www\.google\.com https:\/\/maps\.google\.com$/.test(r.csp) && aGoogle.length >= 1 && aGoogle.every((u) => u.startsWith('https://maps.google.com/maps?'))
        && !r.violaciones.length && !errores.length,
        t(`${k} a ${ancho} px: la política permite el marco (cargó ${aGoogle.length} vez), sin violaciones ni errores${r.violaciones.length || errores.length ? ': ' + [...r.violaciones, ...errores].slice(0, 3).join(' | ') : ''}`));
      comprueba(m.ancho <= m.anchoFicha + 0.5, t(`${k} a ${ancho} px: el mapa no pasa del ancho de su tarjeta (${Math.round(m.ancho)} de ${m.anchoFicha} px)`));
      await sinDesborde(page, t(`${k} a ${ancho} px`));
      if (k === 'cita') await captura(page, `mapa-cita-${ancho}`);
      await c.close();
    }
  }

  // 3. Cita y curso a la vez (dos solicitudes de la misma persona): un solo mapa, después de las dos tarjetas
  {
    const pCurso = conLugar('curso');
    const sCita = datos.solicitud.find((s) => aQueVa(s) === 'cita' && s.solicitante_id !== pCurso.id);
    const datosDe = (d) => { d.solicitud.find((s) => s.id === sCita.id).solicitante_id = pCurso.id; return d; };
    for (const ancho of [320, 390, 1280]) {
      const { c, page, errores } = await nuevo(ancho, 900, { sesion: pCurso.id, datosDe });
      await abre(page);
      const r = await lee(page);
      const despues = await page.evaluate(() => Boolean(document.querySelector('[data-solicitudes]').compareDocumentPosition(document.querySelector('[data-mapa-sede]')) & Node.DOCUMENT_POSITION_FOLLOWING));
      const fichas = await page.$$eval('[data-solicitudes] > .ficha', (l) => l.length);
      comprueba(fichas === 2 && r.marcos === 1 && r.bloques === 1 && r.visible && despues && r.frase === `Tu cita de cotejo y tu curso son en el ${nombre}, ${direccion}.` && !errores.length,
        t(`cita y curso a la vez a ${ancho} px: ${fichas} tarjetas y ${r.marcos} mapa, después de ellas: «${r.frase}»`));
      comprueba(r.marco && r.marco.ancho <= r.marco.anchoFicha + 0.5, t(`cita y curso a ${ancho} px: el mapa cabe en su tarjeta (${r.marco && Math.round(r.marco.ancho)} px)`));
      await sinDesborde(page, t(`cita y curso a ${ancho} px`));
      await c.close();
    }
  }

  // 4. Sin cita, curso ni entrega no hay bloque ni petición a Google; con sede_mapa vacío, la dirección sin mapa ni enlace
  {
    const { c, page, errores, aGoogle } = await nuevo(390, 844, { sesion: sinLugar.id });
    await abre(page);
    const r = await lee(page);
    comprueba(!r.marcos && !r.visible && !aGoogle.length && !errores.length, t(`sin cita, curso ni entrega (${sinLugar.curp}): sin «Dónde es», sin mapa y sin pedir nada a Google`));
    await c.close();
  }
  {
    // Sin ubicación ni dirección (los dos parámetros vacíos o «[pendiente]»): la sede y lo que falta, sin mapa
    const datosDe = (d) => { d.parametro.find((x) => x.clave === 'sede_mapa').valor = ''; d.parametro.find((x) => x.clave === 'sede_direccion').valor = '[pendiente] Dirección.'; return d; };
    const { c, page, errores, aGoogle } = await nuevo(390, 844, { sesion: conLugar('cita').id, datosDe });
    await abre(page);
    const r = await lee(page);
    comprueba(r.visible && !r.marcos && !r.enlace && !r.aviso && !aGoogle.length && r.frase === `Tu cita de cotejo es en el ${nombre}.`
      && r.pendientes.join() === 'Pendiente: dirección y referencias para llegar.' && !errores.length,
      t(`con sede_mapa y sede_direccion vacíos: «Dónde es» con «${r.frase}» y «${r.pendientes.join(' ')}», sin mapa, sin enlace y sin pedir nada a Google`));
    await c.close();
  }

  // 5. axe sobre «Mis trámites» con el mapa (cita y curso a la vez), en teléfono y en escritorio
  if (process.env.AXE) {
    const axe = readFileSync(process.env.AXE, 'utf8');
    const pCurso = conLugar('curso');
    const sCita = datos.solicitud.find((s) => aQueVa(s) === 'cita' && s.solicitante_id !== pCurso.id);
    const datosDe = (d) => { d.solicitud.find((s) => s.id === sCita.id).solicitante_id = pCurso.id; return d; };
    for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
      const { c, page } = await nuevo(ancho, alto, { sesion: pCurso.id, datosDe });
      await abre(page);
      await page.locator('[data-mapa]').scrollIntoViewIfNeeded();
      await (await (await page.$('[data-mapa]')).contentFrame()).waitForSelector('[data-mapa-prueba]');
      await page.evaluate(axe);
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
        .violations.map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 160)).join(' || ')}`));
      comprueba(!v.length, t(`axe a ${ancho} px con el mapa: sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
      await c.close();
    }
  } else console.log('OMITIDO  [mapa] axe: falta AXE=<ruta a axe.min.js del estándar>');
}

/* ── Limpieza del código (auditoría 2026-10-19, R4-07, A4-01 y R4-08) ──
   Sin clases de apd.css que nada usa, sin nombres exportados por APD y APD_PERSONAL que nadie usa fuera de su archivo
   (salvo los que se usan dentro), y las horas y los instructores de grupo.html y grupos.html (antes programar.html) iguales. */
async function limpieza(navegador) {
  const t = (m) => `[limpieza] ${m}`;
  const leer = (r) => readFileSync(join(raiz, r), 'utf8');
  const app = readdirSync(join(raiz, 'sitio/app')).filter((f) => f.endsWith('.js')).map((f) => `sitio/app/${f}`);
  const paginas = readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html')).map((f) => `sitio/${f}`);
  // Las pantallas, el código del proyecto y el del estándar (que arma parte del marcado), sin vendor
  const estandar = (d) => readdirSync(join(raiz, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'vendor' ? [] : estandar(`${d}/${e.name}`)) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));
  const fuentes = [...app, ...paginas, ...estandar('sitio/formkit')].map(leer).join('\n');
  const css = leer('sitio/app/apd.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const clases = [...new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];
  const usada = (c) => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(fuentes);
  const sinUso = clases.filter((c) => !usada(c));
  comprueba(!sinUso.length, t(`apd.css sin clases que nada usa${sinUso.length ? ': ' + sinUso.join(', ') : ''}`));
  // Exportados: se usan fuera de su archivo, o están en la lista de los que se usan sólo dentro
  const DENTRO = { APD: ['fechaPegada', 'activa'], APD_PERSONAL: ['proximosDe', 'retiraGrupo'] };
  for (const [archivo, global, alias] of [['sitio/app/apd.js', 'APD', '(?:APD|window\\.APD)'], ['sitio/app/personal.js', 'APD_PERSONAL', '(?:APD_PERSONAL|P)']]) {
    const propio = leer(archivo);
    const m = propio.match(new RegExp(`global\\.${global} = \\{([\\s\\S]*?)\\};`));
    const nombres = m[1].split(',').map((x) => x.trim().split(':')[0].trim()).filter(Boolean);
    const otros = [...app.filter((f) => f !== archivo), ...paginas, ...readdirSync(join(raiz, 'herramientas')).filter((f) => f.endsWith('.mjs')).map((f) => `herramientas/${f}`)].map(leer).join('\n');
    const sinUsoJs = nombres.filter((n) => !DENTRO[global].includes(n) && !new RegExp(`${alias}\\.${n}\\b|\\{[^}]*\\b${n}\\b[^}]*\\}\\s*=\\s*${alias}\\b`).test(otros));
    comprueba(!sinUsoJs.length, t(`${global}: cada nombre exportado se usa fuera de su archivo${sinUsoJs.length ? '; sin uso: ' + sinUsoJs.join(', ') : ''}`));
  }
  // R4-08: las listas cerradas de horas e instructores se quedan en el HTML (de ahí sale el esquema del servidor), pero
  // son las mismas en la ficha del grupo y en «Grupos» (paso 4; antes «Programar»), y los instructores, los de APD_PERSONAL
  const c = await navegador.newContext({ timezoneId: ZONA });
  const pg = await c.newPage();
  // Desde los ajustes del equipo (25/10/2026) la lista de instructores sólo está en la ficha del grupo (la usa el área de
  // Instructores y Capacitación); «Grupos» ya no la tiene. Se compara con los instructores de APD_PERSONAL.
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=4');
  await pg.waitForSelector('#armar[data-formkit="listo"]', { state: 'attached' });
  const enGrupos = await pg.locator('#instructor').count();
  await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005&perfil=capacitacion');
  await pg.waitForSelector('#confirmar:not([hidden])');
  const lista = await pg.evaluate(() => [...document.querySelectorAll('#instructor option')].filter((o) => o.value).map((o) => o.value));
  // La hora del curso es fija (decisión de Liber del 24/10/2026): la ficha de un grupo por confirmar la dice como dato
  const horario = await pg.textContent('[data-horario]');
  comprueba(horario === 'Horario: de 9:00 a 15:00, de lunes a viernes.' && await pg.locator('#hora_entrada').count() === 0, t(`ficha del grupo: sin menú de hora y con el horario como dato («${horario}»)`));
  // La ficha agrega al nombre si está libre esas fechas: se compara que cada opción empiece con el nombre de su cuenta
  const nombresIguales = await pg.$$eval('#instructor option', (l) => l.filter((o) => o.value).every((o) => o.textContent.startsWith(APD_PERSONAL.nombreInstructor(o.value))) && l.length > 1);
  const deP = await pg.evaluate(() => APD_PERSONAL.INSTRUCTORES.map((i) => i.usuario));
  comprueba(enGrupos === 0 && JSON.stringify(lista) === JSON.stringify(deP) && nombresIguales,
    t('instructores: sólo en la ficha del grupo (no en «Grupos»), los mismos de APD_PERSONAL.INSTRUCTORES'));
  comprueba(!/const MESES = \[/.test(leer('sitio/app/grupos.js')) && !/const MESES = \[/.test(leer('sitio/app/programar.js')) && !/nombreCurso/.test(fuentes), t('sin copias de MESES ni de nombreCurso (APD.MESES, APD.cursoLargo)'));
  await c.close();
  await estandarAlDia();
}

// ── Estándar de formularios 1.5.1 (auditoría 2026-10-19, bloque 4): lo que el estándar ya resuelve no se rodea en el
// proyecto (P126, P130, P131, P134, P135, P145, P148) y el proyecto no usa textos que el estándar retiró ──
async function estandarAlDia() {
  const t = (m) => `[estándar 1.5.1] ${m}`;
  const leer = (r) => readFileSync(join(raiz, r), 'utf8');
  const paginas = readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html'));
  const app = readdirSync(join(raiz, 'sitio/app')).filter((f) => f.endsWith('.js')).map((f) => leer(`sitio/app/${f}`)).join('\n');
  comprueba(/versión 1\.5\.1 del /.test(leer('sitio/formkit/LEEME.md')), t('sitio/formkit es la copia de la 1.5.1'));
  // P130: el <img> del logotipo dice el tamaño real del archivo (477 × 96), en todas las páginas
  const png = readFileSync(join(raiz, 'sitio/formkit/imagenes/logotipo-sedema.png'));
  const [ancho, alto] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const malas = paginas.filter((p) => { const m = leer(`sitio/${p}`).match(/<img class="cabecera-logo"[^>]*>/); return !m || !m[0].includes(`width="${ancho}" height="${alto}"`); });
  comprueba(ancho === 477 && alto === 96 && !malas.length, t(`P130: logotipo de ${ancho} × ${alto} y el mismo tamaño en el <img> de las ${paginas.length} páginas${malas.length ? '; distinto en: ' + malas.join(', ') : ''}`));
  // Reglas de apd.css que el estándar ya trae: etiquetas de estado (P126), bajadas (P134), chips fijos (P135), tablas (P145)
  const css = leer('sitio/app/apd.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const sobran = [
    [/(^|\})\s*\.estado\s*\{/, '.estado'], [/\.tabla-bandeja \.estado/, '.tabla-bandeja .estado'], [/\.chip-fijo/, '.chip-fijo'],
    [/\.bajada[^{]*\{[^}]*max-width:\s*none/, '.bajada max-width: none'], [/\.tabla-bandeja \.(tabla-valor|mono|btn|btn-enlace)\b/, '.tabla-bandeja .tabla-valor/.mono/.btn']
  ].filter(([re]) => re.test(css)).map(([, n]) => n);
  comprueba(!sobran.length, t(`apd.css no repite lo que el estándar ya resuelve${sobran.length ? '; sobra: ' + sobran.join(', ') : ''}`));
  // P131 y P134: los avisos son FormKit.aviso y las líneas de datos, .linea-datos (sin APD.aviso ni APD.meta)
  comprueba(!/APD\.aviso\(|APD\.meta\(/.test(app) && !/\n\s*function (aviso|meta)\(/.test(leer('sitio/app/apd.js')), t('P131 y P134: sin APD.aviso ni APD.meta'));
  // P148: el borrador de la solicitud es el del núcleo, con el almacén de la prueba como proveedor de archivos
  comprueba(/borradorArchivos/.test(leer('sitio/app/config-solicitud.js')) && !/localStorage\.setItem/.test(leer('sitio/app/solicitud.js')), t('P148: el borrador de la solicitud es el del núcleo, con proveedor de archivos'));
  // 1.5.1: «sesionExpira» se retiró del estándar; el proyecto no lo define
  comprueba(!/sesionExpira\s*:/.test(leer('sitio/app/mensajes-usted.js')), t('1.5.1: mensajes-usted.js no define «sesionExpira» (retirado)'));
}

/* Una foto JPG como la de un teléfono, con su ubicación en el EXIF (GPS: 19° 25′ N, 99° 8′ W). El navegador hace el JPG
   (canvas) y aquí se le agrega el segmento APP1 «Exif» con un IFD GPS (TIFF big-endian). Es ruido muy comprimido: al
   recodificarla pesa más que la original, el caso en que la 1.4.1 guardaba la original con su ubicación (P127). */
function exifConGps() {
  const b = [];
  const u16 = (n) => b.push((n >> 8) & 255, n & 255);
  const u32 = (n) => { u16(Math.floor(n / 65536)); u16(n % 65536); };
  const racional = (n, d) => { u32(n); u32(d); };
  b.push(0x4D, 0x4D); u16(42); u32(8); // cabecera TIFF; IFD0 en 8
  u16(1); u16(0x8825); u16(4); u32(1); u32(26); u32(0); // IFD0: GPSInfo → IFD GPS en 26
  u16(4); // IFD GPS: latitud N y longitud W, cada una con tres racionales (80 y 104)
  u16(1); u16(2); u32(2); b.push(0x4E, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(80);
  u16(3); u16(2); u32(2); b.push(0x57, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(104);
  u32(0);
  racional(19, 1); racional(25, 1); racional(36, 1);
  racional(99, 1); racional(8, 1); racional(2, 1);
  const tiff = Buffer.from(b);
  const largo = 2 + 6 + tiff.length;
  return Buffer.concat([Buffer.from([0xFF, 0xE1, largo >> 8, largo & 255]), Buffer.from('Exif\0\0', 'latin1'), tiff]);
}
async function jpgConGps(page) {
  const datosUrl = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500;
    const x = c.getContext('2d'); const img = x.createImageData(400, 500);
    let semilla = 7; const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % 256; };
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = azar(); img.data[i + 1] = azar(); img.data[i + 2] = azar(); img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.08);
  });
  const jpg = Buffer.from(datosUrl.split(',')[1], 'base64');
  return { name: 'foto-telefono.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([jpg.subarray(0, 2), exifConGps(), jpg.subarray(2)]) };
}
const tieneExif = (bytes) => Buffer.from(bytes).includes(Buffer.from('Exif\0\0', 'latin1'));

// ── Estándar 1.5.1 en pantalla (bloque 4 de la auditoría del 19/10/2026), en teléfono y escritorio: etiquetas de estado
// largas (P126), foto sin ubicación (P127), hora en 24 horas (P128), RFC con Ñ (P129), avisos con pasos y enlaces (P131),
// líneas de datos y bajadas (P134), motivos frecuentes (P135) y tablas (P145) ──
async function estandarPantallas(navegador, ancho, alto, sufijo) {
  const t = (m) => `[estándar 1.5.1 ${sufijo}] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(`${pg.url()} · ${m.text()}`); });
  pg.on('pageerror', (e) => errores.push(`${pg.url()} · ${e.message}`));
  // Salir de un formulario a medias (el cotejo) pregunta antes de salir: aquí se sale
  pg.on('dialog', (d) => d.accept().catch(() => {}));
  const escritorio = ancho >= 760;
  // Una etiqueta de estado larga: se parte en renglones en teléfono, sin ensanchar su tarjeta ni la página
  const etiquetaLarga = async (sel, donde) => {
    const r = await pg.evaluate((s) => {
      const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null);
      if (!e) return null;
      const texto = [...e.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent.trim());
      (texto || e).textContent = 'Confirmado · no inició · la Dirección de Infraestructura Verde lo revisa con el instructor';
      const caja = e.closest('.plan-grupo, .plan-persona, tr, .tarjeta') || e.parentElement;
      const rects = [...e.getClientRects()];
      return { renglones: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || 20)), ancho: e.getBoundingClientRect().width,
        caja: caja.getBoundingClientRect().right, pantalla: document.documentElement.clientWidth, desborde: document.documentElement.scrollWidth > window.innerWidth + 1, rects: rects.length };
    }, sel);
    comprueba(r && !r.desborde && r.caja <= r.pantalla + 1 && (escritorio || r.renglones >= 2),
      t(`P126: en ${donde}, una etiqueta de estado larga ${escritorio ? 'no ensancha su tarjeta' : 'se parte en renglones y no ensancha su tarjeta ni la página'} (${JSON.stringify(r)})`));
  };
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await aProgramados(pg);
  await pg.waitForSelector('[data-programados] .tabla .estado');
  await etiquetaLarga('[data-programados] .tabla .estado', '«Grupos programados»');
  await captura(pg, `151-grupos-etiqueta-larga-${sufijo}`);
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
  await pg.waitForSelector('.plan-persona');
  // «En espera» es la espera del paso 3 de «Grupos»; si nadie trae etiqueta, se le pone una a la primera fila
  await pg.evaluate(() => { const f = document.querySelector('.plan-persona'); if (f && !f.querySelector('.estado')) f.querySelector('.plan-persona-nombre, span').after(APD.estado('Prioritaria', 'pend')); });
  await etiquetaLarga('.plan-persona .estado', '«En espera» (paso 3 de «Grupos»)');
  await captura(pg, `151-espera-etiqueta-larga-${sufijo}`);
  // P145 y P126: en la tabla de computadora, botones, folios y etiquetas no se parten
  await pg.goto(BASE + 'revision.html');
  await pg.waitForSelector('[data-filas] tr');
  const tabla = await pg.evaluate(() => {
    const ws = (s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).map((e) => getComputedStyle(e).whiteSpace);
    return { mono: ws('.tabla .mono'), btn: ws('.tabla .btn, .tabla .btn-enlace'), estado: ws('.tabla .estado') };
  });
  const todos = (l, v) => l.length > 0 && l.every((x) => x === v);
  comprueba(escritorio ? todos(tabla.mono, 'nowrap') && todos(tabla.btn, 'nowrap') && todos(tabla.estado, 'nowrap') : tabla.estado.length > 0 && tabla.estado.every((x) => x !== 'nowrap'),
    t(`P145 y P126: en «Solicitudes por revisar» ${escritorio ? 'folios, botones y etiquetas no se parten' : 'la etiqueta de la tarjeta sí se parte'} (${JSON.stringify(Object.fromEntries(Object.entries(tabla).map(([k, v]) => [k, [...new Set(v)]])))})`));
  await captura(pg, `151-solicitudes-por-revisar-${sufijo}`);

  // P134: líneas de datos con .linea-datos; cada dato entero, y en un renglón cuando cabe
  const lineas = async (donde) => {
    const r = await pg.evaluate(() => [...document.querySelectorAll('.linea-datos')].filter((e) => e.offsetParent !== null).map((e) => {
      const items = [...e.querySelectorAll('.linea-datos-item')];
      const tops = new Set(items.map((i) => Math.round(i.getBoundingClientRect().top)));
      const partidos = items.filter((i) => new Set([...i.getClientRects()].map((x) => Math.round(x.top))).size > 1 || getComputedStyle(i).whiteSpace !== 'nowrap').length;
      const r = document.createRange(); r.selectNodeContents(e);
      const necesita = items.reduce((s, i) => s + i.getBoundingClientRect().width, 0) + (items.length - 1) * 12;
      return { items: items.length, renglones: tops.size, partidos, cabe: necesita <= e.getBoundingClientRect().width, texto: e.textContent.trim().slice(0, 60) };
    }));
    const malas = r.filter((x) => x.partidos || (x.cabe && x.renglones > 1));
    comprueba(r.length > 0 && !malas.length, t(`P134: en ${donde}, ${r.length} línea(s) de datos con cada dato entero y en un renglón cuando cabe${malas.length ? '; mal: ' + JSON.stringify(malas) : ''}`));
    return r;
  };
  const porRevisar = datos.solicitud.find((s) => s.estado === 'enviada');
  await pg.goto(BASE + `revisar.html?folio=${porRevisar.folio}`);
  // Desde 1024 px la línea de la cabeza es la corta de la franja de contexto (escritorio, parte A, 25/10/2026)
  await pg.waitForSelector('[data-cabeza] .linea-datos:visible');
  await lineas('la revisión documental');
  // P135: motivos frecuentes completos (un renglón cada uno, sin encogerse) y al pasar el cursor sólo cambia el borde
  const doc = await pg.$eval('[data-doc]:not([hidden]) input[value="con_observacion"]', (i) => i.name);
  await marcar(pg, `input[name="${doc}"][value="con_observacion"]`);
  const chip = `[data-campo="${doc.replace('decision_', 'observacion_')}"] .chip-fijo`;
  await pg.waitForSelector(chip);
  const chips = await pg.$$eval(chip, (l) => l.map((b) => { const r = document.createRange(); r.selectNodeContents(b); return { texto: b.textContent.trim(), renglones: new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size, encoge: getComputedStyle(b).flexShrink }; }));
  const antes = await pg.$eval(chip, (b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).borderColor]);
  await pg.hover(chip);
  await pg.waitForTimeout(250);
  const encima = await pg.$eval(chip, (b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).borderColor]);
  comprueba(chips.length === 5 && chips.every((x) => x.renglones === 1 && x.encoge === '0') && antes[0] === encima[0] && antes[1] !== encima[1],
    t(`P135: los ${chips.length} motivos frecuentes van completos en un renglón y al pasar el cursor sólo cambia el borde (${JSON.stringify({ largos: chips.filter((x) => x.renglones > 1).map((x) => x.texto), fondo: [antes[0], encima[0]], borde: [antes[1], encima[1]] })})`));
  await pg.mouse.move(0, 0);
  await captura(pg, `151-revision-documental-${sufijo}`);
  await abreCotejo(pg, conCita.folio);
  await lineas('el cotejo');
  // P129: el RFC conserva la Ñ (en la página y en lo que se envía); está en el paso «Pago y factura»
  await cotejoHastaPago(pg);
  await pg.fill('#factura_rfc', 'muño800101ab1');
  await pg.press('#factura_rfc', 'Tab');
  const rfc = await pg.evaluate(() => ({ valor: document.getElementById('factura_rfc').value, error: (document.querySelector('[data-campo="factura_rfc"] .err') || {}).textContent || '',
    envia: FormKit.iniciar(document.getElementById('formulario')).payload().datos.factura_rfc }));
  comprueba(rfc.valor === 'MUÑO800101AB1' && !rfc.error.trim() && rfc.envia === 'MUÑO800101AB1', t(`P129: un RFC con Ñ se conserva en el cotejo y en lo que se envía (${JSON.stringify(rfc)})`));
  await pg.$eval('#factura_rfc', (e) => e.scrollIntoView({ block: 'center' }));
  await pg.screenshot({ path: CAPTURAS ? join(CAPTURAS, `151-cotejo-rfc-enie-${sufijo}.png`) : undefined }).catch(() => {});
  await pg.goto(BASE + `citas.html?dia=${conCita.cita_en.slice(0, 10)}`);
  await pg.waitForSelector('[data-filas] tr:not([hidden])');
  await captura(pg, `151-citas-${sufijo}`);
  await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005');
  await pg.waitForSelector('[data-bajada] .linea-datos');
  await lineas('la ficha del grupo');
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
  await pg.waitForSelector('[data-bajada] .linea-datos');
  await lineas('«Asistencia»');
  await captura(pg, `151-asistencia-${sufijo}`);
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=4');
  // Desde 1024 px, lo elegido va en el panel «Tu grupo» y la línea de arriba del paso no se ve (acomodo de escritorio,
  // parte B, 25/10/2026): la línea se revisa donde se ve
  if (ancho < 1024) {
    await pg.waitForSelector('[data-eleccion] .linea-datos');
    await lineas('«Grupos» (lo elegido en el paso a paso)');
  } else await pg.waitForSelector('[data-panel-datos] dd');
  await captura(pg, `151-grupos-${sufijo}`);

  // P131: avisos con pasos (secuencia numerada) y con enlace, en div.aviso-texto, con el icono de su tono
  const aviso = (sel) => pg.$eval(sel, (a) => ({ cuerpo: a.querySelector('.aviso-texto') && a.querySelector('.aviso-texto').tagName, icono: Boolean(a.querySelector(':scope > svg.icono')),
    pasos: a.querySelectorAll('ol.secuencia > li.secuencia-item').length, enlaces: a.querySelectorAll('.aviso-texto a').length, titulo: (a.querySelector('.aviso-titulo') || {}).textContent }));
  const enIntegracion = datos.grupo.find((g) => g.estado === 'en_integracion');
  await pg.goto(BASE + `grupos.html?curso=${enIntegracion.tipo_acreditacion}-${enIntegracion.modalidad}&grupo=${enIntegracion.folio}`);
  await pg.waitForSelector('[data-modo-grupo] .aviso');
  const conEnlace = await aviso('[data-modo-grupo] .aviso');
  comprueba(conEnlace.cuerpo === 'DIV' && conEnlace.icono && conEnlace.enlaces === 1, t(`P131: el aviso «Completando …» lleva su enlace en div.aviso-texto, con icono (${JSON.stringify(conEnlace)})`));
  await captura(pg, `151-aviso-con-enlace-${sufijo}`);
  const sinPago = await pg.evaluate(async () => { const d = await APD.cargar(); const s = d.solicitud.find((x) => x.estado === 'validada_en_linea' && x.cita_motivo === 'sin_pago'); return s ? d.solicitante.find((p) => p.id === s.solicitante_id).curp : null; });
  await entra(pg, sinPago);
  const conPasos = await aviso('.aviso:has(ol.secuencia)');
  comprueba(conPasos.cuerpo === 'DIV' && conPasos.icono && conPasos.pasos === 3 && /comprobante de pago/.test(conPasos.titulo), t(`P131: «No presentaste tu comprobante de pago» lleva sus 3 pasos en una secuencia numerada (${JSON.stringify(conPasos)})`));
  await pg.$eval('.aviso:has(ol.secuencia)', (e) => e.scrollIntoView({ block: 'center' }));
  await captura(pg, `151-aviso-con-pasos-${sufijo}`);
  await pg.click('[data-sesion] button');

  // P127 y P128: «Crea tu cuenta» con una foto JPG con su ubicación: se agrega y lo que se guarda no lleva EXIF; el acuse
  // dice la hora en 24 horas
  const foto = await jpgConGps(pg);
  // «Crea tu cuenta» por pasos (decisión de Liber del 24/10/2026)
  await pg.goto(BASE + 'cuenta.html');
  await pg.fill('#nombre', NUEVA.nombre);
  await pg.fill('#primer_apellido', NUEVA.primer_apellido);
  await pg.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await pg.fill('#curp', NUEVA.curp);
  await sigPaso(pg);
  await pg.fill('#correo', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await pg.fill('#correo2', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await pg.fill('#telefono', '0000000077');
  await marcar(pg, 'input[name="adscrito"][value="no"]');
  await sigPaso(pg);
  await pg.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', foto);
  const agregada = await pg.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]', { timeout: 8000 }).then(() => true, () => false);
  await captura(pg, `151-cuenta-foto-con-gps-${sufijo}`);
  await sigPaso(pg);
  await pg.fill('#contrasena', 'una frase larga de prueba');
  await pg.fill('#contrasena2', 'una frase larga de prueba');
  await marcaCasillas(pg);
  await pulsaEnviar(pg);
  await pg.waitForSelector('[data-acuse]:not([hidden])');
  const guardada = await pg.evaluate(async (curp) => { const r = await APD_ARCHIVOS_PRUEBA.foto(curp); return r && r.blob ? [...new Uint8Array(await r.blob.arrayBuffer())] : null; }, NUEVA.curp);
  comprueba(tieneExif(foto.buffer) && agregada && guardada && guardada[0] === 0xFF && guardada[1] === 0xD8 && !tieneExif(guardada),
    t(`P127: una foto JPG con su ubicación (EXIF con GPS) se agrega y se guarda como JPG sin EXIF (${guardada ? `${guardada.length} bytes, EXIF: ${tieneExif(guardada) ? 'sí' : 'no'}` : 'no se guardó'})`));
  const recibida = (await pg.textContent('[data-acuse-fecha]')) || '';
  comprueba(/\b([01]\d|2[0-3]):[0-5]\d\b/.test(recibida) && !/[ap]\.\s?m\./.test(recibida), t(`P128: el acuse de «Crea tu cuenta» dice la hora en 24 horas («${recibida.trim()}»)`));
  // La fecha del borrador y del acuse salen de la misma función del núcleo: zona de la Ciudad y 24 horas
  const reloj = await pg.evaluate(() => FormKit.utilidades.fechaHora('2026-10-18T05:27:00Z'));
  comprueba(/17 de octubre de 2026/.test(reloj) && /23:27/.test(reloj) && !/[ap]\.\s?m\./.test(reloj), t(`P128: FormKit.utilidades.fechaHora escribe la hora de la Ciudad en 24 horas («${reloj}»)`));
  await captura(pg, `151-cuenta-acuse-${sufijo}`);
  comprueba(!errores.length, t(`sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
  await c.close();
}

/* ── Foco y accesibilidad (auditoría de seguimiento del 2026-10-20, bloque 1 de su plan de corrección) ──
   Cada prueba repite, en pequeño, el guion del revisor que encontró la falla (docs/auditoria-2026-10-20/guiones/ri y r3).
   Elemento oculto por completo: los cinco puntos (centro y esquinas) caen en algo fijo o pegajoso que no lo contiene. */
const ocultoPorFijo = () => {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  const fijos = [...document.querySelectorAll('body *')].filter((x) => /fixed|sticky/.test(getComputedStyle(x).position) && !x.contains(a) && x.checkVisibility());
  const r = a.getBoundingClientRect();
  const puntos = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 1, r.top + 1], [r.right - 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.right - 1, r.bottom - 1]];
  const dentro = puntos.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
  const tapados = dentro.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return e && fijos.some((f) => f.contains(e)); });
  return { total: dentro.length > 0 && tapados.length === dentro.length, tapados: tapados.length, puntos: dentro.length, casilla: a.matches('.plan-casilla') };
};
const dosCuadros = (page) => page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))));
/* Observador de regiones vivas (el de guiones/ri/gestion-foco.mjs): cada vez que el texto propio de una región viva
   (aria-live, role status/alert/log, <output>) cambia a algo no vacío, se anota con la marca de la acción en curso. Se
   inyecta antes de cargar la página; window.__vivasMarca = n marca la acción n. */
function observadorVivas() {
  const SEL = '[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"],output';
  const ev = (window.__vivas = []);
  window.__vivasMarca = 0;
  const ult = new WeakMap();
  const propio = (r) => {
    let t = '';
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n !== r && n.nodeType === 1 && (n.matches(SEL) || n.hidden || n.getAttribute('aria-hidden') === 'true') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeType === 3) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  };
  const revisa = () => {
    for (const r of document.querySelectorAll(SEL)) {
      const vis = r.checkVisibility() || r.closest('.solo-lector');
      const t = vis && !r.closest('[hidden],[aria-hidden="true"]') ? propio(r) : '';
      const antes = ult.get(r);
      ult.set(r, t);
      if (t && t !== antes) ev.push({ marca: window.__vivasMarca, region: `${r.tagName.toLowerCase()}${[...r.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 1).map((a) => `[${a.name}]`).join('')}${r.getAttribute('role') ? `[role=${r.getAttribute('role')}]` : ''}`, rol: r.getAttribute('role') || '', texto: t });
    }
  };
  let pend = false;
  // Además, cada vez que se escribe en una región viva aunque sea el mismo texto (el registro de anuncios de r3,
  // guiones/r3/teclado-lib.mjs): volver a escribir el mismo texto también lo vuelve a anunciar
  const escritos = (window.__vivasEscritos = []);
  new MutationObserver((registros) => {
    for (const r of registros) {
      if (r.type === 'attributes') continue;
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const region = n && n.closest(SEL);
      if (region && !region.closest('[hidden]')) escritos.push({ marca: window.__vivasMarca, region: region.getAttribute('data-mes-nombre') !== null ? 'cal-mes' : [...region.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).join(' '), texto: region.textContent.replace(/\s+/g, ' ').trim() });
    }
    if (pend) return; pend = true; queueMicrotask(() => { pend = false; revisa(); });
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'role', 'aria-live', 'open', 'class'] });
}
let marcaVivas = 0;
const nuevaMarca = (page) => page.evaluate((k) => { window.__vivasMarca = k; return k; }, ++marcaVivas);
const anunciosDe = (page, k) => page.evaluate((m) => window.__vivas.filter((e) => e.marca === m), k);
// Espera a que la acción k haya anunciado algo (o a que pase su plazo) y deja correr los retardos de los anuncios
async function anunciosTras(page, k, { minimo = 1, plazo = 4000 } = {}) {
  await page.waitForFunction(([m, n]) => window.__vivas.filter((e) => e.marca === m).length >= n, [k, minimo], { timeout: plazo }).catch(() => {});
  await page.waitForTimeout(400);
  return anunciosDe(page, k);
}
const textosDe = (l) => l.map((e) => `${e.region}: «${e.texto.slice(0, 60)}»`).join(' | ');
const escritosDe = (page, k) => page.evaluate((m) => window.__vivasEscritos.filter((e) => e.marca === m), k);
async function focoAccesibilidad(navegador) {
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    await c.addInitScript(observadorVivas);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };

  // B4-01 (decisión 1a): la barra fija de elegidas ya no existe desde el paso a paso del 24/10/2026 (opción B1): en el paso
  // 3 de «Grupos» nada queda fijo ni pegajoso sobre la lista (la barra de pasos del estándar va sin .barra-fija, P177) y
  // ninguna casilla enfocada con Tab queda debajo de algo fijo (el botón del menú de pruebas)
  for (const [w, h] of [[1440, 900], [1280, 720]]) {
    const { c, page } = await nuevo(w, h);
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
    await listoGrupos(page);
    await dosCuadros(page);
    // El panel «Tu grupo» (acomodo de escritorio, parte B, 25/10/2026) es fijo, pero va al lado de la lista: cuenta lo fijo
    // que cruza la columna de la lista
    const pegajosos = await page.evaluate(() => {
      const l = document.querySelector('[data-personas]').getBoundingClientRect();
      return [...document.querySelectorAll('#contenido *')].filter((x) => /fixed|sticky/.test(getComputedStyle(x).position) && x.checkVisibility())
        .filter((x) => { const r = x.getBoundingClientRect(); return r.left < l.right && r.right > l.left; }).map((x) => x.className);
    });
    comprueba(!pegajosos.length, `[${w}×${h}] B4-01: en el paso 3 de «Grupos» nada queda fijo ni pegajoso sobre la lista${pegajosos.length ? ` (${pegajosos.join(', ')})` : ''}`);
    await page.focus('#paso-personas .titulo-paso');
    let casillas = 0; const ocultas = [];
    for (let k = 0; k < 80; k++) {
      await page.keyboard.press('Tab');
      await dosCuadros(page);
      const m = await page.evaluate(ocultoPorFijo);
      if (await page.evaluate(() => !!document.activeElement.closest('#paso-personas .acciones'))) break;
      if (m && m.casilla) { casillas += 1; if (m.total) ocultas.push(k + 1); }
    }
    comprueba(casillas >= 5 && !ocultas.length, `[${w}×${h}] B4-01: ninguna de las ${casillas} casillas del paso 3 queda debajo de algo fijo al enfocarla con Tab${ocultas.length ? ` (ocultas en las paradas ${ocultas.join(', ')})` : ''}`);
    await c.close();
  }

  // RI-02: «Día siguiente» de Citas y «Mes anterior/siguiente» de Grupos (paso 2), al llegar a su límite, quedan inactivos sin
  // perder el foco (aria-disabled), y en el límite no hacen nada
  {
    const { c, page } = await nuevo(1280, 720);
    const enfocado = (sel) => page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
    await page.goto(BASE + 'citas.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    await page.focus('[data-ir="1"]');
    let pulsaciones = 0;
    while (pulsaciones < 30 && (await page.getAttribute('[data-ir="1"]', 'aria-disabled')) !== 'true') { await page.keyboard.press('Enter'); pulsaciones += 1; }
    const diaFinal = await page.textContent('[data-dia]');
    await page.keyboard.press('Enter');
    comprueba(pulsaciones > 0 && pulsaciones < 30 && await enfocado('[data-ir="1"]') && (await page.textContent('[data-dia]')) === diaFinal && !(await page.$('[data-ir="1"]:disabled')),
      `RI-02: en Citas, «Día siguiente» en el último día queda inactivo con aria-disabled, conserva el foco y no cambia de día (${pulsaciones} pulsaciones)`);
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=2');
    await listoGrupos(page);
    for (const [sel, max] of [['[data-mes="-1"]', 3], ['[data-mes="1"]', 15]]) {
      await page.focus(sel);
      let n = 0;
      while (n < max && (await page.getAttribute(sel, 'aria-disabled')) !== 'true') { await page.keyboard.press('Enter'); n += 1; }
      const mes = await page.textContent('[data-mes-nombre]');
      await page.keyboard.press('Enter');
      comprueba((await page.getAttribute(sel, 'aria-disabled')) === 'true' && await enfocado(sel) && (await page.textContent('[data-mes-nombre]')) === mes,
        `RI-02: en Grupos, «${sel.includes('-1') ? 'Mes anterior' : 'Mes siguiente'}» en su límite (${mes}) queda inactivo, conserva el foco y no cambia de mes`);
    }
    await c.close();
  }

  // RS-01 (falla del estándar, rodeada en app/solicitud.js) y RI-03: al recuperar o descartar el borrador con el teclado
  // el foco no cae en <body> (va al primer campo del paso) y el mensaje se anuncia una sola vez
  const sinTramite = SIN_TRAMITE;
  for (const [w, h] of [[390, 844], [1280, 720]]) {
    for (const accion of ['recuperar', 'descartar']) {
      const { c, page, errores } = await nuevo(w, h, sinTramite.id);
      await page.goto(BASE + 'solicitud.html');
      await page.waitForSelector('#nivel_estudios');
      await page.focus('#nivel_estudios');
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => Object.keys(localStorage).some((k) => /borrador/i.test(k)));
      await page.reload();
      await page.waitForSelector('[data-borrador="recuperar"]', { state: 'visible' });
      if (accion === 'descartar') { await page.focus('[data-borrador="descartar"]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-borrador="descartar-si"]', { state: 'visible' }); }
      const k = await nuevaMarca(page);
      await page.focus(accion === 'recuperar' ? '[data-borrador="recuperar"]' : '[data-borrador="descartar-si"]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-borrador-recuperado]', { state: 'visible' });
      const lista = await anunciosTras(page, k);
      const foco = await page.evaluate(() => { const a = document.activeElement; return a && a !== document.body && a.closest('#formulario') && a.checkVisibility() ? (a.id || a.name) : null; });
      const texto = accion === 'recuperar' ? /Borrador recuperado/ : /Se descartó el borrador/;
      const veces = lista.filter((e) => texto.test(e.texto)).length;
      comprueba(Boolean(foco), `[${w}×${h}] RS-01: al ${accion === 'recuperar' ? 'recuperar' : 'descartar'} el borrador con Intro el foco va al primer campo del paso (${foco || 'quedó en <body>'})`);
      comprueba(veces === 1, `[${w}×${h}] RI-03: «${accion === 'recuperar' ? 'Borrador recuperado' : 'Se descartó el borrador'}» se anuncia una sola vez (${veces}: ${textosDe(lista)})`);
      comprueba(!errores.length, `[${w}×${h}] borrador (${accion}): sin errores en la consola${errores.length ? ': ' + errores.slice(0, 2).join(' | ') : ''}`);
      await c.close();
    }
  }

  // B4-03: «Borrador guardado en este dispositivo.» (núcleo; rodeado en app/solicitud.js) se anuncia sólo la primera vez
  {
    const { c, page } = await nuevo(390, 844, sinTramite.id);
    await page.goto(BASE + 'solicitud.html');
    await page.waitForSelector('#nivel_estudios');
    const k = await nuevaMarca(page);
    for (const tecla of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
      const antes = await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find((x) => /borrador/i.test(x)) || '') || '');
      await page.focus('#nivel_estudios');
      await page.keyboard.press(tecla);
      // Cada cambio escribe el borrador (con su retardo): se espera a que cambie lo guardado
      await page.waitForFunction((a) => (localStorage.getItem(Object.keys(localStorage).find((x) => /borrador/i.test(x)) || '') || '') !== a, antes);
      await page.waitForSelector('[data-guardado][data-visible]');
    }
    const lista = await anunciosTras(page, k);
    const veces = lista.filter((e) => /Borrador guardado/.test(e.texto)).length + (await escritosDe(page, k)).filter((e) => /Borrador guardado/.test(e.texto) && !/anuncios/.test(e.region)).length;
    comprueba(veces === 1, `B4-03: con tres cambios seguidos, «Borrador guardado» se anuncia una vez (${veces})`);
    await c.close();
  }

  // B4-03: en «Grupos» (paso 2), elegir semanas dentro del mismo mes da un anuncio por semana y no vuelve a anunciar el
  // nombre del mes; «Mes siguiente» sí lo anuncia, una vez
  {
    const { c, page } = await nuevo(1440, 900);
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&semana=2026-11-02&mes=2026-11&paso=2');
    await listoGrupos(page);
    const k = await nuevaMarca(page);
    for (const l of ['2026-11-09', '2026-11-16']) { await page.focus(`.arm-semana-elegir[data-lunes="${l}"]`); await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    const lista = await anunciosTras(page, k, { minimo: 2 });
    comprueba(lista.length === 2 && lista.every((e) => /^Elegida la semana/.test(e.texto)) && !lista.some((e) => /Noviembre de 2026/.test(e.texto)), `B4-03: dos semanas elegidas en noviembre dan un anuncio cada una y no vuelven a anunciar el mes (${textosDe(lista)})`);
    const m = await nuevaMarca(page);
    await page.click('[data-mes="1"]');
    const mes = await anunciosTras(page, m);
    comprueba(/Diciembre de 2026/.test(await page.textContent('[data-mes-nombre]')) && mes.length === 1 && /Diciembre de 2026/.test(mes[0].texto), `B4-03: «Mes siguiente» sí cambia y anuncia el mes, una vez (${textosDe(mes)})`);
    await c.close();
  }

  // B4-03: el resumen del cotejo no se vuelve a escribir si no cambió
  {
    const { c, page } = await nuevo(1440, 900);
    await abreCotejo(page, conCita.folio);
    await page.check('input[name="se_presento"][value="si"]');
    await page.check('input[name="identidad"][value="misma"]');
    await page.waitForFunction(() => document.querySelector('[data-resumen]').textContent.trim() !== '');
    const k = await nuevaMarca(page);
    for (let i = 0; i < 3; i++) await page.evaluate(() => document.querySelector('input[name="identidad"]:checked').dispatchEvent(new Event('change', { bubbles: true })));
    await dosCuadros(page);
    const veces = (await escritosDe(page, k)).filter((e) => e.region.includes('data-resumen')).length;
    comprueba(veces === 0, `B4-03: en el cotejo, recalcular sin cambios no vuelve a escribir el resumen (${veces} veces)`);
    // Por pasos (decisión de Liber del 24/10/2026): un anuncio por acción. Marcar «Sí, es igual» no anuncia nada (lo dice la
    // opción misma) y el foco se queda en ella, a la vista; «Siguiente» da un solo anuncio (el paso) y lleva el foco a su título
    await sigPaso(page);
    const docs = await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.checkVisibility()).map((x) => x.dataset.doc));
    await page.waitForTimeout((await page.evaluate(() => FormKit.config.anuncios.retardoMs)) + 300);
    const malos = [];
    for (const doc of docs) {
      const m = await nuevaMarca(page);
      await page.focus(`input[name="coincide_${doc}"][value="si"]`);
      await page.keyboard.press('Space');
      const lista = await anunciosTras(page, m, { plazo: 1200 });
      const dentro = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      if (lista.length !== 0 || !dentro) malos.push(`${doc}: ${lista.length} (${textosDe(lista)})${dentro ? '' : ', foco fuera de la ventana'}`);
    }
    comprueba(docs.length >= 3 && !malos.length, `B4-03: en el cotejo, marcar «Sí, es igual» en ${docs.length} documentos no da anuncios de más y el foco se queda a la vista${malos.length ? ': ' + malos.join(' | ') : ''}`);
    const m = await nuevaMarca(page);
    await page.focus(`${pasoVisible} [data-accion="siguiente"]`);
    await page.keyboard.press('Enter');
    const lista = await anunciosTras(page, m);
    const foco = await page.evaluate(() => document.activeElement.matches('.titulo-paso') && document.activeElement.closest('[data-paso]').dataset.titulo);
    comprueba(lista.length === 1 && /^Paso 3 de 4: Pago y factura/.test(lista[0].texto) && foco === 'Pago y factura',
      `B4-03: en el cotejo, «Siguiente» da un anuncio (el paso) y el foco va a su título (${textosDe(lista)}; foco: ${foco})`);
    await c.close();
  }

  // RI-03, RI-04 y RI-06 por pasos (decisión de Liber del 24/10/2026): en «Revisar una solicitud», decidir un documento no
  // anuncia nada (la opción lo dice); «Siguiente documento» da un solo anuncio, el del paso, y el foco va a su título, a la
  // vista; el último lleva a «Resultado» igual
  const enviadaPoda = datos.solicitud.find((s) => s.estado === 'enviada' && s.tipo_acreditacion === 'poda');
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const { c, page, errores } = await nuevo(w, h);
    await page.goto(BASE + `revisar.html?folio=${enviadaPoda.folio}`);
    await page.waitForSelector('#formulario input[name^="decision_"]');
    // En computadora, la página abre sola el primer documento y el visor anuncia «Cargando el documento…» con retardo:
    // en una máquina lenta (GitHub) ese anuncio de la carga caía dentro de la primera decisión. Se espera a que el
    // visor termine de pintar (hojas con contenido y aviso oculto) y a que pase el retardo de los anuncios.
    if (w >= 760) await page.waitForFunction(() => { const h = document.querySelector('[data-visor-hojas]'); const a = document.querySelector('[data-visor-aviso]'); return h && h.childElementCount > 0 && (!a || a.hidden); }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout((await page.evaluate(() => FormKit.config.anuncios.retardoMs)) + 300);
    const docs = await docsRevision(page);
    const malos = [];
    for (const [i, k] of docs.entries()) {
      let m = await nuevaMarca(page);
      await page.focus(`#formulario input[name="decision_${k}"][value="aceptado"]`);
      await page.keyboard.press('Space');
      const alDecidir = await anunciosTras(page, m, { plazo: 1200 });
      m = await nuevaMarca(page);
      await page.focus(`${pasoVisible} [data-accion="siguiente"]`);
      await page.keyboard.press('Enter');
      const lista = await anunciosTras(page, m);
      const ultimo = i === docs.length - 1;
      await page.waitForFunction(() => { const r = document.activeElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }, null, { timeout: 4000 }).catch(() => {});
      const foco = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { titulo: a.matches('.titulo-paso') && !a.closest('[data-paso]').hidden, dentro: r.bottom > 0 && r.top < innerHeight, texto: a.textContent.trim().slice(0, 40) }; });
      const ok = alDecidir.length === 0 && lista.length === 1 && (ultimo ? /: Resultado\.$/.test(lista[0].texto) : /^Paso \d+ de \d+: /.test(lista[0].texto)) && foco.titulo && foco.dentro;
      if (!ok) malos.push(`${k}: ${alDecidir.length} al decidir (${textosDe(alDecidir)}), ${lista.length} al seguir (${textosDe(lista)}), foco en «${foco.texto}»${foco.dentro ? '' : ' fuera de la ventana'}`);
    }
    comprueba(docs.length >= 3 && !malos.length, `[${w}×${h}] RI-03, RI-04 y RI-06: ${docs.length} documentos, un anuncio por paso y el foco en el título que se muestra${malos.length ? ': ' + malos.join(' | ') : ''}`);
    comprueba(!errores.length, `[${w}×${h}] revisión con el teclado: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 2).join(' | ') : ''}`);
    await c.close();
  }

  // RI-04: en Citas, un anuncio por cambio de día (el día con su cuenta) y uno al terminar de escribir la búsqueda
  {
    const { c, page } = await nuevo(1280, 720);
    await page.goto(BASE + 'citas.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    await page.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-cuenta]').textContent));
    let k = await nuevaMarca(page);
    await page.focus('[data-ir="1"]');
    await page.keyboard.press('Enter');
    let lista = await anunciosTras(page, k);
    comprueba(lista.length === 1 && /^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d+ de [a-z]+ de \d{4}: /.test(lista[0].texto), `RI-04: en Citas, «Día siguiente» da un anuncio con el día y su cuenta (${textosDe(lista)})`);
    k = await nuevaMarca(page);
    await page.focus('#buscar');
    await page.keyboard.type('ana', { delay: 120 });
    lista = await anunciosTras(page, k, { plazo: 5000 });
    await page.waitForTimeout(800);
    lista = await anunciosDe(page, k);
    comprueba(lista.length === 1 && /coincide/.test(lista[0].texto), `RI-04: en Citas, escribir «ana» da un solo anuncio, al terminar (${lista.length}: ${textosDe(lista)})`);
    await c.close();
  }

  // RI-04: en «Grupos» (paso 3), al cargar no se anuncian la espera ni la cuenta de lugares; marcar o desmarcar a alguien da
  // un anuncio con la cuenta
  {
    const { c, page } = await nuevo(1280, 720);
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
    await listoGrupos(page);
    await page.waitForSelector('.plan-persona input');
    await dosCuadros(page);
    const alCargar = (await anunciosDe(page, 0)).filter((e) => !/interno|pruebas/.test(e.region));
    comprueba(!alCargar.some((e) => /en espera|elegida|lugares/.test(e.texto)), `RI-04: «Grupos» no anuncia al cargar la espera ni la cuenta de lugares (${textosDe(alCargar) || 'nada'})`);
    const k = await nuevaMarca(page);
    await page.focus('.plan-persona input');
    await page.keyboard.press('Space');
    const lista = await anunciosTras(page, k);
    comprueba(lista.length === 1 && /^\d+ de 25 lugares/.test(lista[0].texto), `RI-04: marcar o desmarcar a una persona anuncia la cuenta («n de 25 lugares») una vez (${textosDe(lista)})`);
    await c.close();
  }

  // RI-08: en teléfono, al cerrar el visor con Escape el foco vuelve al botón y éste ya no dice «En el visor»
  for (const [pagina, listo, normal] of [[`revisar.html?folio=${enviadaPoda.folio}`, '#formulario [data-ver]', 'Ver documento'], [`cotejo.html?folio=${conCita.folio}`, null, 'Ver lo que cargó']]) {
    const { c, page } = await nuevo(390, 844);
    if (listo) { await page.goto(BASE + pagina); await page.waitForSelector(listo); } else {
      await abreCotejo(page, conCita.folio);
      await page.check('input[name="se_presento"][value="si"]');
      await page.check('input[name="identidad"][value="misma"]');
      await sigPaso(page); // «Ver lo que cargó» está en el paso «Documentos originales»
    }
    const boton = page.locator('#formulario [data-ver]:visible').first();
    await boton.focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[data-visor][open]');
    const abierto = (await boton.textContent()).trim();
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[data-visor]:not([open])', { state: 'attached' });
    await page.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-ver]'));
    // El texto del botón cambia al cerrarse el visor, que puede llegar después del foco: se espera la condición (si no
    // llega en 5 s, la comprobación falla con lo que haya) (intermitente en la batería completa, bloque 2)
    await page.waitForFunction(() => !/^En el visor/.test(document.activeElement.textContent.trim()) && !document.activeElement.hasAttribute('aria-current'), null, { timeout: 5000 }).catch(() => {});
    const r = await page.evaluate(() => ({ texto: document.activeElement.textContent.trim(), actual: document.activeElement.hasAttribute('aria-current') }));
    comprueba(/^En el visor/.test(abierto) && r.texto.startsWith(normal) && !r.actual,
      `RI-08: en ${pagina.split('.')[0]}, al cerrar el visor en teléfono el botón enfocado vuelve a decir «${normal}» («${r.texto.slice(0, 40)}»${r.actual ? ', con aria-current' : ''})`);
    await c.close();
  }

  // B1-03 (también RI-05 y B4-09): en la versión de prueba la página reserva al pie el lugar del botón «Menú de pruebas»;
  // al recorrer la bandeja con Tab ningún control queda tapado por él en más de un cuarto
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const { c, page } = await nuevo(w, h);
    await page.goto(BASE + 'revision.html');
    await page.waitForSelector('[data-filas] tr');
    await page.waitForSelector('.menu-pruebas-boton');
    const reserva = await page.evaluate(() => { const b = document.querySelector('.menu-pruebas-boton').getBoundingClientRect(); return { necesita: Math.ceil(innerHeight - b.top), tiene: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0 }; });
    let paradas = 0; const tapadas = [];
    for (let k = 0; k < 120; k++) {
      await page.keyboard.press('Tab');
      await dosCuadros(page);
      const m = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body || a.closest('.menu-pruebas-boton, dialog')) return null;
        const r = a.getBoundingClientRect(); const b = document.querySelector('.menu-pruebas-boton').getBoundingClientRect();
        const area = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
        return { fraccion: r.width * r.height ? area / (r.width * r.height) : 0, texto: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40), primero: window.__b103 === a, marca: (window.__b103 = window.__b103 || a) };
      });
      if (!m) continue;
      if (m.primero && paradas) break;
      paradas += 1;
      if (m.fraccion > 0.25) tapadas.push(`«${m.texto}» ${Math.round(m.fraccion * 100)} %`);
    }
    comprueba(reserva.tiene >= reserva.necesita && paradas > 10 && !tapadas.length,
      `[${w}×${h}] B1-03: la página reserva ${reserva.tiene} px al pie para el «Menú de pruebas» (ocupa ${reserva.necesita}) y ninguna de ${paradas} paradas queda tapada más de un cuarto${tapadas.length ? ': ' + tapadas.slice(0, 3).join(', ') : ''}`);
    await c.close();
  }

  // B4-05: la sección actual de la cabecera del personal se distingue también sin color (subrayado más grueso)
  {
    const { c, page } = await nuevo(1440, 900);
    await page.goto(BASE + 'citas.html');
    await page.waitForSelector('.sesion-enlaces a[aria-current="page"]');
    const r = await page.evaluate(() => {
      const rasgo = (a) => { const cs = getComputedStyle(a); return `${cs.textDecorationLine} ${cs.textDecorationThickness} ${cs.borderBottomWidth} ${cs.borderBottomStyle}`; };
      const actual = document.querySelector('.sesion-enlaces a[aria-current="page"]');
      const otros = [...document.querySelectorAll('.sesion-enlaces a:not([aria-current])')];
      return { actual: actual.textContent, rasgo: rasgo(actual), otros: [...new Set(otros.map(rasgo))] };
    });
    comprueba(r.actual === 'Citas de cotejo' && r.otros.length > 0 && !r.otros.includes(r.rasgo), `B4-05: «${r.actual}» lleva aria-current y un rasgo que no es color (${r.rasgo} frente a ${r.otros.join(' | ')})`);
    await c.close();
  }

  // B4-06: con el espaciado de texto de WCAG 1.4.12 a 320 px, revisar, cotejo y grupos no se desbordan a lo ancho
  {
    const espaciado = () => { const h = new CSSStyleSheet(); h.replaceSync('*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, h]; };
    const paginas = [...datos.solicitud.filter((x) => x.estado === 'enviada').map((x) => `revisar.html?folio=${x.folio}`), `cotejo.html?folio=${conCita.folio}`, 'grupos.html?curso=poda-nueva&paso=2', 'grupos.html?curso=poda-renovacion&paso=2', 'grupos.html?curso=dictaminador-nueva&paso=3', 'grupos.html?curso=poda-nueva&paso=4'];
    const anchas = [];
    for (const u of paginas) {
      const { c, page } = await nuevo(320, 700);
      if (u.startsWith('cotejo')) await abreCotejo(page, conCita.folio); else { await page.goto(BASE + u); await page.waitForSelector(u.startsWith('grupos') ? '#armar[data-formkit="listo"]' : '#formulario input[name^="decision_"]', { state: 'attached' }); }
      await page.evaluate(espaciado);
      await dosCuadros(page);
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      if (ancho > 321) anchas.push(`${u.split('?')[0]}${u.includes('folio') ? ' ' + u.split('=')[1] : u.includes('curso') ? ' ' + u.split('?')[1] : ''}: ${ancho} px`);
      await c.close();
    }
    comprueba(!anchas.length, `B4-06: con el espaciado de texto aumentado a 320 px, ${paginas.length} pantallas de revisar, cotejo y grupos sin desborde${anchas.length ? ': ' + anchas.join('; ') : ''}`);
  }

  // B4-07: en «Grupos» y en «Material de estudio» no hay dos enlaces con el mismo nombre que lleven a lugares distintos
  for (const [u, sel, sesion] of [['grupos.html?curso=poda-nueva', '[data-programados] tr[data-grupo]', null], ['material.html', '.material-doc', null]]) {
    const { c, page } = await nuevo(1440, 900, sesion);
    await page.goto(BASE + u);
    // En «Grupos», los enlaces de los grupos programados están en su pestaña (acomodo de escritorio, parte B)
    if (/grupos/.test(u)) await aProgramados(page);
    await page.waitForSelector(sel);
    const repetidos = await page.evaluate(() => {
      const nombre = (a) => (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim();
      const por = new Map();
      for (const a of document.querySelectorAll('main a[href]')) { if (!a.checkVisibility()) continue; const n = nombre(a); if (!por.has(n)) por.set(n, new Set()); por.get(n).add(a.getAttribute('href') + (a.hasAttribute('download') ? ' (descarga)' : '')); }
      return [...por].filter(([, h]) => h.size > 1).map(([n, h]) => `«${n}» ×${h.size}`);
    });
    comprueba(!repetidos.length, `B4-07: en ${u.split('?')[0]} cada nombre de enlace lleva a un solo lugar${repetidos.length ? ': ' + repetidos.join(', ') : ''}`);
    await c.close();
  }

  // A6-01 (rodeo de FC-1): el marcador de posición de «Crea tu cuenta» llega a 4.5:1 sobre el fondo de solo lectura y el
  // de error
  {
    const { c, page } = await nuevo(390, 844);
    await page.goto(BASE + 'cuenta.html');
    await page.waitForSelector('#sexo');
    // El fondo de error es el de un campo con aria-invalid (lo pone el estándar al validar); aquí se mide sólo el color
    await page.evaluate(() => document.getElementById('fecha_nacimiento').setAttribute('aria-invalid', 'true'));
    const r = await page.evaluate(() => {
      const rgb = (t) => t.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([R, G, B]) => [R, G, B].map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
      const razon = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      return ['sexo', 'fecha_nacimiento'].map((id) => { const e = document.getElementById(id); const ph = getComputedStyle(e, '::placeholder'); return [id, e.getAttribute('aria-invalid') === 'true' ? 'error' : e.readOnly ? 'solo lectura' : 'campo', +razon(rgb(ph.color), rgb(getComputedStyle(e).backgroundColor)).toFixed(2)]; });
    });
    comprueba(r.every(([, , x]) => x >= 4.5), `A6-01: marcador de posición a 4.5:1 o más (${r.map(([id, f, x]) => `${id}, ${f}: ${x}:1`).join('; ')})`);
    await c.close();
  }
}

/* ── Tareas por pasos (decisión de Liber del 24/10/2026): ayudas ──
   «Revisar una solicitud», «Cita de cotejo» y «Crea tu cuenta» van por pasos (módulo «pasos» del estándar). Lo que antes
   se marcaba en una sola página ahora está en su paso: estas ayudas van al paso que lo contiene con el módulo (que valida
   los pasos intermedios, como «Siguiente»), y «enviar» va al paso del botón y lo pulsa. Las pruebas de SOLO=pasos están
   en pasosTareas(), más abajo. */
// Título del paso que se ve
async function tituloPaso(page) {
  return page.evaluate(() => { const p = document.querySelector('#formulario section[data-paso]:not([hidden])'); return p ? p.dataset.titulo : ''; });
}
// Va al paso con ese título, o al que contiene ese elemento; devuelve si llegó (un paso intermedio con errores lo detiene)
async function alPaso(page, titulo) {
  return page.evaluate((t) => { const i = FormKit.pasos.elementos.findIndex((p) => p.dataset.titulo === t); return i >= 0 && FormKit.pasos.ir(i); }, titulo);
}
async function alPasoDe(page, sel) {
  return page.evaluate((q) => { const i = FormKit.pasos.elementos.findIndex((p) => p.querySelector(q)); return i >= 0 && FormKit.pasos.ir(i); }, sel);
}
// «Siguiente» del paso que se ve; espera a que cambie el paso o a que aparezcan los errores
async function sigPaso(page) {
  const antes = await tituloPaso(page);
  await page.click(`${pasoVisible} [data-accion="siguiente"]`);
  await page.waitForFunction((a) => { const p = document.querySelector('#formulario section[data-paso]:not([hidden])'); return (p && p.dataset.titulo !== a) || (p && p.querySelector('.resumen-errores:not([hidden])')); }, antes);
}
// Enviar: va al paso donde está el botón para registrar o crear y, si llegó, lo pulsa
async function pulsaEnviar(page) {
  await page.evaluate(() => { const b = document.querySelector('#formulario [data-accion="enviar"]'); const i = FormKit.pasos.elementos.findIndex((p) => p.contains(b)); if (i >= 0) FormKit.pasos.ir(i); });
  if (await page.isVisible('#formulario [data-accion="enviar"]')) await page.click('#formulario [data-accion="enviar"]');
}
// Revisión: los documentos que tienen paso, en su orden
async function docsRevision(page) { return page.$$eval('#formulario [data-paso-doc]', (l) => l.map((x) => x.dataset.pasoDoc)); }
// Revisión: decide un documento en su paso («Sí, está bien» = aceptado; «No, tiene un problema» = con_observacion)
async function decideDoc(page, k, dec, texto) {
  await alPasoDe(page, `input[name="decision_${k}"]`);
  await marcar(page, `input[name="decision_${k}"][value="${dec}"]`);
  if (texto !== undefined) await page.fill(`#observacion_${k}`, texto);
}
// Revisión: acepta todos los documentos por decidir y llega a «Fecha de la cita» (o a «Resultado» si no se valida)
async function aceptaTodos(page) {
  for (const k of await docsRevision(page)) if (await page.$(`input[name="decision_${k}"]`) && await page.evaluate((n) => document.getElementById(`decidir_${n}`).value === 'si', k)) await decideDoc(page, k, 'aceptado');
  await alPaso(page, 'Resultado');
  if (await page.evaluate(() => document.getElementById('resultado').value === 'validada')) await alPaso(page, 'Fecha de la cita');
}
// Cotejo: llega la persona, es ella, todos los originales son iguales y el pago (si se pide) queda contestado; termina en
// «Pago y factura»
async function cotejoHastaPago(page, pago = 'si') {
  if (await page.$('input[name="se_presento"]')) {
    await marcar(page, 'input[name="se_presento"][value="si"]');
    await marcar(page, 'input[name="identidad"][value="misma"]');
  }
  await alPaso(page, 'Documentos originales');
  for (const k of await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await marcar(page, `input[name="coincide_${k}"][value="si"]`);
  await alPaso(page, 'Pago y factura');
  if (pago) await marcar(page, `input[name="pago"][value="${pago}"]`);
}
// Cotejo: marca si coincide cada documento (en su paso)
async function coteja(page, k, v) {
  await alPasoDe(page, `input[name="coincide_${k}"]`);
  await marcar(page, `input[name="coincide_${k}"][value="${v}"]`);
}

/* ── Tareas por pasos (decisión de Liber del 24/10/2026; SOLO=pasos) ──
   «Revisar una solicitud», «Cita de cotejo» y «Crea tu cuenta» por pasos, con el módulo «pasos» del estándar 1.5.1. Cada
   flujo completo con el teclado (Tab, Espacio, flechas, Intro y lo que se escribe; los archivos con su selector), en
   320, 390 y 1280 px, y en cada paso: «Paso N de M · Título» a la vista, el foco en el título al llegar, un solo anuncio,
   objetivos de 44 px o más, sin desborde a lo ancho y axe sin violaciones (a 390 y 1280). Los caminos alternos: un
   documento con un problema, no es la persona, un documento que no es igual en el cotejo, la inasistencia, el rechazo por
   perfil, regresar sin perder lo escrito y «Atrás» del navegador con algo sin guardar. */
async function pasosTareas(navegador) {
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  if (!axe) console.log('OMITIDO  pasos: axe (falta AXE=<ruta a axe.min.js del estándar>)');
  const nuevo = async (ancho, alto = 900) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
    await c.addInitScript(observadorVivas);
    const pg = await c.newPage();
    const errores = [];
    const dialogos = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    pg.on('dialog', (d) => { dialogos.push(d.type()); d.dismiss().catch(() => {}); });
    return { c, pg, errores, dialogos };
  };
  // Teclado: Tab hasta que el foco quede en ese elemento
  const tabHasta = async (pg, sel, max = 80) => {
    for (let i = 0; i < max; i++) {
      if (await pg.evaluate((q) => Boolean(document.activeElement && document.activeElement.matches(q)), sel)) return true;
      await pg.keyboard.press('Tab');
    }
    throw new Error(`con Tab no se llegó a ${sel}`);
  };
  const pulsa = async (pg, sel, tecla = 'Enter') => { await tabHasta(pg, sel); await pg.keyboard.press(tecla); };
  const escribe = async (pg, sel, texto) => { await tabHasta(pg, sel); await pg.keyboard.type(texto); };
  // «Siguiente» con el teclado: un solo anuncio (el del paso) y el foco en el título del paso nuevo, a la vista
  const siguienteTeclado = async (pg, donde, ancho) => {
    const antes = await tituloPaso(pg);
    // Lo que anunció lo escrito antes (p. ej., «Sexo: Mujer, tomado de la CURP») sale antes de la marca
    await pg.waitForTimeout((await pg.evaluate(() => FormKit.config.anuncios.retardoMs)) + 150);
    const m = await nuevaMarca(pg);
    await pulsa(pg, `${pasoVisible} [data-accion="siguiente"]`);
    await pg.waitForFunction((a) => { const p = document.querySelector('#formulario section[data-paso]:not([hidden])'); return p && p.dataset.titulo !== a; }, antes, { timeout: 5000 });
    // El visor callado por la página (aria-live="off", rodeo de P181) no cuenta: su <output> lo cuenta el observador igual
    const callado = await pg.evaluate(() => { const z = document.querySelector('[data-visor-zoom]'); return Boolean(z && z.getAttribute('aria-live') === 'off'); });
    const lista = (await anunciosTras(pg, m)).filter((e) => !/interno|pruebas/.test(e.region) && !(callado && /^output\[data-visor-zoom\]/.test(e.region)));
    const foco = await pg.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { titulo: a.matches('.titulo-paso') && Boolean(a.closest('section[data-paso]:not([hidden])')), dentro: r.bottom > 0 && r.top < innerHeight, paso: (a.closest('[data-paso]') || {}).dataset ? a.closest('[data-paso]').dataset.titulo : '' }; });
    comprueba(lista.length === 1 && /^Paso \d+ de \d+: /.test(lista[0].texto) && foco.titulo && foco.dentro,
      `[pasos ${ancho}] ${donde}: «Siguiente» de «${antes}» lleva a «${foco.paso}» con un anuncio y el foco en su título${lista.length === 1 && foco.titulo ? '' : ` (${textosDe(lista)}; foco: ${JSON.stringify(foco)})`}`);
  };
  // Lo que se revisa en cada paso
  const revisaPaso = async (pg, donde, ancho) => {
    const r = await pg.evaluate(() => {
      const paso = document.querySelector('#formulario section[data-paso]:not([hidden])');
      const actual = document.querySelector('[data-barra] [data-paso-actual]');
      const sel = 'button, a, .opcion-fila, .casilla, input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=file]), select, textarea';
      const zona = [...document.querySelectorAll('[data-barra]')].concat(paso ? [paso] : []);
      // Fuera: lo que no es un objetivo (aria-hidden, como el calendario nativo) y los enlaces dentro de un renglón de texto (excepción «en línea» de WCAG 2.5.8)
      const chicos = zona.flatMap((z) => [...z.querySelectorAll(sel)]).filter((e) => e.checkVisibility() && !e.closest('dialog,[data-trampa],.solo-lector,[aria-hidden="true"]') && !(e.matches('a:not(.btn):not(.btn-atras)') && e.closest('p')))
        .map((e) => { const b = e.getBoundingClientRect(); return { e: `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} «${(e.textContent || e.name || '').trim().slice(0, 24)}»`, w: Math.round(b.width), h: Math.round(b.height) }; })
        .filter((x) => x.w < 44 || x.h < 44);
      return { titulo: paso ? paso.dataset.titulo : '', actual: actual && actual.checkVisibility() ? actual.textContent.trim() : '', chicos, ancho: document.documentElement.scrollWidth, ventana: innerWidth };
    });
    comprueba(new RegExp(`^Paso \\d+ de \\d+ · ${r.titulo.replace(/[?¿]/g, '.')}$`).test(r.actual), `[pasos ${ancho}] ${donde} · ${r.titulo}: «Paso N de M» a la vista («${r.actual}»)`);
    comprueba(!r.chicos.length, `[pasos ${ancho}] ${donde} · ${r.titulo}: objetivos de 44 px o más${r.chicos.length ? ': ' + r.chicos.map((x) => `${x.e} ${x.w}×${x.h}`).join('; ') : ''}`);
    comprueba(r.ancho <= r.ventana + 1, `[pasos ${ancho}] ${donde} · ${r.titulo}: sin desborde a lo ancho (${r.ancho} px)`);
    if (axe && ancho !== 320) {
      // Desde arriba, como las demás pruebas de axe: el botón fijo «Menú de pruebas» (sólo en la versión de prueba) tapa lo
      // que queda en la esquina de abajo de la ventana y axe lo contaría como objetivo tapado
      await pg.evaluate(() => window.scrollTo(0, 0));
      await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
      if (!(await pg.evaluate(() => Boolean(window.axe)))) await pg.evaluate(axe);
      const v = await pg.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
        .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 160)).join(' || ')}`));
      comprueba(!v.length, `[pasos ${ancho}] ${donde} · ${r.titulo}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`);
    }
  };
  const sinErr = (errores, ancho, donde) => comprueba(!errores.length, `[pasos ${ancho}] ${donde}: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  const poda = datos.solicitud.find((s) => s.estado === 'enviada' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && !datos.revision.some((r) => r.solicitud_id === s.id));
  const docsPoda = datos.documento.filter((d) => d.solicitud_id === poda.id && d.vigente).length;
  const dict = datos.solicitud.find((s) => s.estado === 'enviada' && s.perfil_academico === 'por_clasificar');
  const [c42] = ['APD-S-2026-00042'].map((f) => datos.solicitud.find((x) => x.folio === f));
  const pausa = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sPausa = datos.solicitud.find((x) => x.id === pausa.solicitud_id);

  for (const ancho of [320, 390, 1280]) {
    /* 1 · Revisar: un paso por documento que trae la solicitud; todo bien → resultado → fecha de la cita, con el teclado */
    {
      const { c, pg, errores } = await nuevo(ancho);
      await pg.goto(BASE + `revisar.html?folio=${poda.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      const docs = await docsRevision(pg);
      const pasos = await pg.$$eval('#formulario section[data-paso]', (l) => l.map((x) => x.dataset.titulo));
      comprueba(docs.length === docsPoda && pasos.length === docsPoda + 2 && pasos.slice(-2).join() === 'Resultado,Fecha de la cita',
        `[pasos ${ancho}] revisar: ${docs.length} pasos de documentos (los que trae la solicitud), «Resultado» y «Fecha de la cita» (${pasos.join(' · ')})`);
      for (const k of docs) {
        await revisaPaso(pg, 'revisar', ancho);
        comprueba(await pg.isVisible(`${pasoVisible} legend:text-is("¿El documento está bien?")`) && /Sí, está bien/.test(await pg.textContent(`[data-campo="decision_${k}"]`)) && /No, tiene un problema/.test(await pg.textContent(`[data-campo="decision_${k}"]`)),
          `[pasos ${ancho}] revisar · ${k}: una pregunta, «¿El documento está bien?», con «Sí, está bien» y «No, tiene un problema»`);
        await pulsa(pg, `input[name="decision_${k}"][value="aceptado"]`, 'Space');
        await siguienteTeclado(pg, 'revisar', ancho);
      }
      await revisaPaso(pg, 'revisar', ancho);
      comprueba((await pg.$$('[data-resumen-lista] li')).length === docs.length && /Los \d+ documentos están revisados/.test(await pg.textContent('[data-resumen]')) && await pg.isVisible('[data-si-validada]'),
        `[pasos ${ancho}] revisar · Resultado: el resumen antes de confirmar lista los ${docs.length} documentos y lleva a la fecha de la cita`);
      await siguienteTeclado(pg, 'revisar', ancho);
      await revisaPaso(pg, 'revisar', ancho);
      const min = await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min');
      let dia = min;
      while ([0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) dia = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      if (ancho === 390) {
        // La escritura guiada del formato «fecha-dma» del estándar (decisión 2026-10-16), que antes se probaba en la fecha
        // de nacimiento de «Crea tu cuenta» (desde el 24/10/2026 se toma de la CURP): se prueba en la fecha de la cita
        const campo = pg.locator('#cita_fecha');
        await campo.fill(''); await campo.pressSequentially('3012');
        const aMedias = await campo.inputValue();
        await campo.pressSequentially('2026');
        comprueba(aMedias === '30/12/' && await campo.inputValue() === '30/12/2026', '[pasos 390] fecha día/mes/año: al teclear, las diagonales se ponen solas (30/12/2026)');
        await campo.fill(''); await campo.pressSequentially('4');
        comprueba(await campo.inputValue() === '04/', '[pasos 390] fecha día/mes/año: un día que empieza con 4 pasa solo al mes (04/)');
        await campo.press('Backspace'); await campo.press('Backspace');
        comprueba(await campo.inputValue() === '0', '[pasos 390] fecha día/mes/año: al borrar no se reacomoda');
        await campo.fill('30112026'); await campo.press('Tab');
        comprueba(await campo.inputValue() === '30/11/2026', '[pasos 390] fecha día/mes/año: «30112026» queda como 30/11/2026');
        await campo.fill('31/02/2027'); await campo.press('Tab');
        comprueba(/fecha real/.test((await pg.textContent('[data-campo="cita_fecha"] .err')) || ''), '[pasos 390] fecha día/mes/año: una fecha que no existe se rechaza');
        comprueba(await pg.getAttribute('#cita_fecha', 'type') === 'text', '[pasos 390] fecha día/mes/año: se escribe (con el calendario como ayuda)');
        await campo.fill('');
        await pg.focus('[data-campo="cita_fecha"] .control-calendario').catch(() => {});
        await pg.evaluate(() => { const h = document.querySelector('#formulario section[data-paso]:not([hidden]) .titulo-paso'); h.focus(); });
      }
      await escribe(pg, '#cita_fecha', dia.split('-').reverse().join(''));
      await tabHasta(pg, '#cita_hora');
      await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown');
      comprueba(await pg.inputValue('#cita_fecha') === dma(dia) && /^\d\d:\d\d$/.test(await pg.inputValue('#cita_hora')), `[pasos ${ancho}] revisar · Fecha de la cita: con el teclado, día hábil ${dma(dia)} y hora ${await pg.inputValue('#cita_hora')}`);
      comprueba((await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Validar y dar la cita', `[pasos ${ancho}] revisar: el botón con verbo, «Validar y dar la cita», en el último paso`);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      comprueba(/Validada: cita el/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')) && await pg.isHidden('[data-con-formulario]'), `[pasos ${ancho}] revisar: con el teclado se valida y se da la cita; la barra de pasos se va`);
      sinErr(errores, ancho, 'revisar');
      await c.close();
    }
    /* 1b · Revisar: un documento con un problema (motivo frecuente y texto), regresar sin perder lo decidido, resumen y
       «Enviar las observaciones a la persona»; «Atrás» del navegador con algo sin registrar avisa */
    {
      const { c, pg, errores, dialogos } = await nuevo(ancho);
      await pg.goto(BASE + `revisar.html?folio=${poda.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      const [k1, k2, ...resto] = await docsRevision(pg);
      await pulsa(pg, `input[name="decision_${k1}"][value="aceptado"]`, 'Space');
      await siguienteTeclado(pg, 'revisar con problema', ancho);
      await tabHasta(pg, `input[name="decision_${k2}"][value="aceptado"]`);
      await pg.keyboard.press('ArrowDown'); // «No, tiene un problema»
      await pulsa(pg, `[data-campo="observacion_${k2}"] .chip-fijo`);
      await escribe(pg, `#observacion_${k2}`, ' Vuelve a escanearlo completo.');
      const texto = await pg.inputValue(`#observacion_${k2}`);
      comprueba(await pg.isChecked(`input[name="decision_${k2}"][value="con_observacion"]`) && /^No se lee completo\. ?Vuelve a escanearlo completo\.$/.test(texto),
        `[pasos ${ancho}] revisar: «No, tiene un problema» abre los motivos frecuentes y lo que se le dirá a la persona («${texto}»)`);
      // Regresar no pierde nada
      await pulsa(pg, `${pasoVisible} [data-accion="atras"]`);
      await pg.waitForFunction((k) => !document.querySelector(`[data-doc="${k}"]`).closest('[data-paso]').hidden, k1);
      comprueba(await pg.isChecked(`input[name="decision_${k1}"][value="aceptado"]`) && await pg.inputValue(`#observacion_${k2}`) === texto, `[pasos ${ancho}] revisar: «Atrás» regresa al documento anterior sin perder lo decidido ni lo escrito`);
      await siguienteTeclado(pg, 'revisar con problema', ancho);
      await siguienteTeclado(pg, 'revisar con problema', ancho);
      for (const k of resto) { await pulsa(pg, `input[name="decision_${k}"][value="aceptado"]`, 'Space'); await siguienteTeclado(pg, 'revisar con problema', ancho); }
      const res = await pg.$$eval('[data-resumen-lista] li', (l) => l.map((x) => x.textContent));
      comprueba(await tituloPaso(pg) === 'Resultado' && res.some((x) => /Tiene un problema/.test(x) && x.includes('Vuelve a escanearlo')) && await pg.isHidden('[data-si-validada]')
        && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Enviar las observaciones a la persona',
        `[pasos ${ancho}] revisar: con un problema, «Resultado» lo resume con lo que se le dirá y el botón es «Enviar las observaciones a la persona» (sin fecha de la cita)`);
      await revisaPaso(pg, 'revisar con problema', ancho);
      await pg.goBack({ timeout: 3000 }).catch(() => {});
      comprueba(dialogos.includes('beforeunload') && await pg.isVisible('#formulario'), `[pasos ${ancho}] revisar: «Atrás» del navegador con la revisión sin registrar avisa antes de salir`);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      comprueba(/Con observaciones: 1 documento regresa/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')), `[pasos ${ancho}] revisar: con el teclado se envían las observaciones`);
      sinErr(errores, ancho, 'revisar con problema');
      await c.close();
    }
    /* 1c · Revisar un dictaminador: «Perfil» primero; no afín → del perfil al resultado (rechazo, con confirmación) */
    {
      const { c, pg, errores } = await nuevo(ancho);
      await pg.goto(BASE + `revisar.html?folio=${dict.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      const pasos = await pg.$$eval('#formulario section[data-paso]', (l) => l.map((x) => x.dataset.titulo));
      comprueba(pasos[0] === 'Perfil' && pasos.length === datos.documento.filter((d) => d.solicitud_id === dict.id && d.vigente).length + 3, `[pasos ${ancho}] revisar dictaminador: «Perfil», un paso por documento, «Resultado» y «Fecha de la cita» (${pasos.length})`);
      await revisaPaso(pg, 'revisar dictaminador', ancho);
      await tabHasta(pg, 'input[name="clasificacion"]');
      await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); // «No afín»
      comprueba(await pg.isChecked('input[name="clasificacion"][value="no_afin"]'), `[pasos ${ancho}] revisar dictaminador: «No afín» con el teclado`);
      await siguienteTeclado(pg, 'revisar dictaminador', ancho);
      comprueba(await tituloPaso(pg) === 'Resultado' && (await pg.inputValue('#motivo_rechazo')).length > 20 && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Rechazar la solicitud',
        `[pasos ${ancho}] revisar dictaminador: no afín → del perfil al resultado, con el motivo propuesto y «Rechazar la solicitud»`);
      await revisaPaso(pg, 'revisar dictaminador', ancho);
      await pulsa(pg, `${pasoVisible} [data-accion="atras"]`);
      comprueba(await tituloPaso(pg) === 'Perfil', `[pasos ${ancho}] revisar dictaminador: «Atrás» del resultado regresa al perfil (sin pasar por los documentos)`);
      await siguienteTeclado(pg, 'revisar dictaminador', ancho);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('dialog[open] [data-r="si"]');
      await pulsa(pg, 'dialog[open] [data-r="si"]');
      await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      comprueba(/Rechazada/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')), `[pasos ${ancho}] revisar dictaminador: con el teclado se confirma el rechazo`);
      sinErr(errores, ancho, 'revisar dictaminador');
      await c.close();
    }
    /* 2 · Cita de cotejo: ¿es la persona? → documentos originales → pago y factura → resultado, con el teclado */
    {
      const { c, pg, errores } = await nuevo(ancho);
      await pg.goto(BASE + `cotejo.html?folio=${c42.folio}`);
      await pg.waitForSelector('[data-atender-simulada]:not([hidden])');
      await pulsa(pg, '[data-atender-simulada]');
      await pg.waitForSelector('#formulario:not([hidden])');
      comprueba((await pg.$$eval('#formulario section[data-paso]', (l) => l.map((x) => x.dataset.titulo))).join() === '¿Es la persona?,Documentos originales,Pago y factura,Resultado'
        && await pg.evaluate(() => document.activeElement.matches('.titulo-paso')), `[pasos ${ancho}] cotejo: cuatro pasos y, al atenderla, el foco en el título del primero`);
      await revisaPaso(pg, 'cotejo', ancho);
      await pulsa(pg, 'input[name="se_presento"][value="si"]', 'Space');
      await pulsa(pg, 'input[name="identidad"][value="misma"]', 'Space');
      comprueba(await pg.isVisible('[data-foto-grande]') && /Sí, es la persona/.test(await pg.textContent('[data-campo="identidad"]')), `[pasos ${ancho}] cotejo: «¿Es la persona?» con la fotografía de la cuenta y «Sí, es la persona»`);
      await revisaPaso(pg, 'cotejo', ancho);
      await siguienteTeclado(pg, 'cotejo', ancho);
      const ks = await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.checkVisibility()).map((x) => x.dataset.doc));
      for (const k of ks) await pulsa(pg, `input[name="coincide_${k}"][value="si"]`, 'Space');
      await revisaPaso(pg, 'cotejo', ancho);
      await siguienteTeclado(pg, 'cotejo', ancho);
      await pulsa(pg, 'input[name="pago"][value="si"]', 'Space');
      await pg.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', PDF);
      await pg.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
      await escribe(pg, '#factura_rfc', 'XAXX010101000');
      await escribe(pg, '#factura_razon_social', 'Teclado Ejemplo');
      await escribe(pg, '#factura_folio_fiscal', crypto.randomUUID());
      await revisaPaso(pg, 'cotejo', ancho);
      await siguienteTeclado(pg, 'cotejo', ancho);
      const res = await pg.$$eval('[data-resumen-lista] li', (l) => l.map((x) => x.textContent));
      comprueba(res.length === 3 && /Sí es la persona/.test(res[0]) && /Todos son iguales/.test(res[1]) && /El pago está bien/.test(res[2]) && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Terminar el cotejo',
        `[pasos ${ancho}] cotejo · Resultado: el resumen (persona, originales, pago) antes de «Terminar el cotejo»`);
      await revisaPaso(pg, 'cotejo', ancho);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      comprueba(/Cotejo terminado/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')) && await pg.isHidden('[data-con-formulario]'), `[pasos ${ancho}] cotejo: con el teclado se termina; pasa a la espera de grupo`);
      sinErr(errores, ancho, 'cotejo');
      await c.close();
    }
    /* 2b · Cotejo: no es la persona (se detiene y bloquea, con confirmación); un documento que no es igual (pausa del día);
       la inasistencia; regresar sin perder lo marcado; «Atrás» del navegador */
    {
      const { c, pg, errores, dialogos } = await nuevo(ancho);
      await abreCotejo(pg, c42.folio);
      await pulsa(pg, 'input[name="se_presento"][value="si"]', 'Space');
      await tabHasta(pg, 'input[name="identidad"]');
      await pg.keyboard.press('ArrowDown'); // «No es la persona»
      comprueba(await pg.isChecked('input[name="identidad"][value="no_es"]') && /La cita se detiene aquí/.test(await pg.textContent(`${pasoVisible}`)), `[pasos ${ancho}] cotejo: «No es la persona» dice que la cita se detiene`);
      await escribe(pg, '#nota_identidad', 'La identificación es de otra persona.');
      await siguienteTeclado(pg, 'cotejo no es la persona', ancho);
      comprueba(await tituloPaso(pg) === 'Resultado' && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'No atender y avisar a la Dirección', `[pasos ${ancho}] cotejo: no es la persona → del primer paso al resultado, «No atender y avisar a la Dirección»`);
      await pg.goBack({ timeout: 3000 }).catch(() => {});
      comprueba(dialogos.includes('beforeunload') && await pg.isVisible('#formulario'), `[pasos ${ancho}] cotejo: «Atrás» del navegador con la cita sin registrar avisa antes de salir`);
      await pulsa(pg, `${pasoVisible} [data-accion="atras"]`);
      comprueba(await tituloPaso(pg) === '¿Es la persona?' && await pg.inputValue('#nota_identidad') === 'La identificación es de otra persona.', `[pasos ${ancho}] cotejo: «Atrás» regresa a «¿Es la persona?» sin perder la nota`);
      // Cambia de idea: sí es; un documento no es igual y lo trae hoy → pausa
      await tabHasta(pg, 'input[name="identidad"]'); await pg.keyboard.press('ArrowUp');
      await siguienteTeclado(pg, 'cotejo con faltante', ancho);
      const [kNo, ...kSi] = await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.checkVisibility()).map((x) => x.dataset.doc));
      await tabHasta(pg, `input[name="coincide_${kNo}"]`); await pg.keyboard.press('ArrowDown'); // «No es igual»
      await escribe(pg, `#diferencia_${kNo}`, 'Trae otra versión del documento.');
      for (const k of kSi) await pulsa(pg, `input[name="coincide_${k}"][value="si"]`, 'Space');
      await pulsa(pg, 'input[name="hoy_documento"][value="si"]', 'Space');
      await revisaPaso(pg, 'cotejo con faltante', ancho);
      await siguienteTeclado(pg, 'cotejo con faltante', ancho);
      comprueba(await tituloPaso(pg) === 'Resultado' && /no es igual/.test((await pg.$$eval('[data-resumen-lista] li', (l) => l.map((x) => x.textContent))).join()) && /queda en pausa/.test(await pg.textContent('[data-resumen]'))
        && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Poner la cita en pausa', `[pasos ${ancho}] cotejo: con un faltante, de los originales al resultado (sin pago): «Poner la cita en pausa»`);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      comprueba(/En pausa/.test(await pg.textContent('[data-hecho]:not(.pasos-btn)')), `[pasos ${ancho}] cotejo: con el teclado la cita queda en pausa del día`);
      sinErr(errores, ancho, 'cotejo alternos');
      await c.close();
    }
    {
      // Retomar la pausa de hoy: sin «¿Es la persona?»; la inasistencia sigue disponible en otra cita
      const { c, pg, errores } = await nuevo(ancho);
      await pg.goto(BASE + `cotejo.html?folio=${sPausa.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      const pasos = await pg.$$eval('#formulario section[data-paso]', (l) => l.map((x) => x.dataset.titulo));
      comprueba(pasos.join() === 'Documentos originales,Pago y factura,Resultado' && /^Paso 1 de 3 · Documentos originales$/.test((await pg.textContent('[data-paso-actual]')).trim()),
        `[pasos ${ancho}] cotejo en pausa: se retoma en «Documentos originales» (Paso 1 de 3), sin «¿Es la persona?»`);
      await revisaPaso(pg, 'cotejo en pausa', ancho);
      await abreCotejo(pg, c42.folio);
      await pulsa(pg, 'input[name="se_presento"][value="si"]', 'Space');
      await pg.keyboard.press('ArrowRight'); // «No se presentó»
      await siguienteTeclado(pg, 'cotejo inasistencia', ancho);
      comprueba(await tituloPaso(pg) === 'Resultado' && await pg.isVisible('#cita_fecha') && (await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Registrar la inasistencia y la cita nueva',
        `[pasos ${ancho}] cotejo: «No se presentó» → resultado con la cita nueva («Registrar la inasistencia y la cita nueva»)`);
      await revisaPaso(pg, 'cotejo inasistencia', ancho);
      sinErr(errores, ancho, 'cotejo en pausa e inasistencia');
      await c.close();
    }
    /* 3 · Crea tu cuenta: ¿quién eres? → ¿cómo te avisamos? → tu fotografía → tu contraseña → revisa y crea, con el teclado */
    {
      const { c, pg, errores, dialogos } = await nuevo(ancho);
      await pg.goto(BASE + 'cuenta.html');
      await pg.waitForSelector('#formulario[data-formkit="listo"]');
      comprueba((await pg.$$eval('#formulario section[data-paso]', (l) => l.map((x) => x.dataset.titulo))).join() === 'Quién eres,Cómo te avisamos,Tu fotografía,Tu contraseña,Revisa y crea',
        `[pasos ${ancho}] cuenta: cinco pasos (quién eres, cómo te avisamos, tu fotografía, tu contraseña, revisa y crea)`);
      await revisaPaso(pg, 'cuenta', ancho);
      await escribe(pg, '#nombre', NUEVA.nombre);
      await escribe(pg, '#primer_apellido', NUEVA.primer_apellido);
      await escribe(pg, '#segundo_apellido', NUEVA.segundo_apellido);
      await escribe(pg, '#curp', NUEVA.curp.toLowerCase());
      await pg.keyboard.press('Tab');
      comprueba(await pg.inputValue('#curp') === NUEVA.curp && await pg.inputValue('#fecha_nacimiento') === dma(NUEVA.nacimiento) && ['Mujer', 'Hombre'].includes(await pg.inputValue('#sexo')),
        `[pasos ${ancho}] cuenta · ¿Quién eres?: con la CURP se sabe la fecha de nacimiento y el sexo, sin escribirlos`);
      await siguienteTeclado(pg, 'cuenta', ancho);
      const correo = `${NUEVA.curp.toLowerCase()}@ejemplo.local`;
      await escribe(pg, '#correo', correo);
      await escribe(pg, '#correo2', 'otro@ejemplo.local');
      await escribe(pg, '#telefono', '5500000077');
      await tabHasta(pg, 'input[name="adscrito"]'); await pg.keyboard.press('ArrowDown'); // «No, soy independiente»
      await pulsa(pg, `${pasoVisible} [data-accion="siguiente"]`);
      comprueba(await tituloPaso(pg) === 'Cómo te avisamos' && await pg.getAttribute('#correo2', 'aria-invalid') === 'true', `[pasos ${ancho}] cuenta: el correo escrito dos veces distinto no deja avanzar (mismo mensaje del estándar)`);
      await pg.fill('#correo2', correo);
      await revisaPaso(pg, 'cuenta', ancho);
      await siguienteTeclado(pg, 'cuenta', ancho);
      await cargaFoto(pg);
      await revisaPaso(pg, 'cuenta', ancho);
      await siguienteTeclado(pg, 'cuenta', ancho);
      await escribe(pg, '#contrasena', 'corta');
      await escribe(pg, '#contrasena2', 'corta');
      await pulsa(pg, `${pasoVisible} [data-accion="siguiente"]`);
      comprueba(await tituloPaso(pg) === 'Tu contraseña' && await pg.getAttribute('#contrasena', 'aria-invalid') === 'true', `[pasos ${ancho}] cuenta: una contraseña de menos de 12 caracteres no deja avanzar (las reglas reales)`);
      await pg.fill('#contrasena', ''); await pg.fill('#contrasena2', '');
      await escribe(pg, '#contrasena', 'una frase larga de prueba');
      await escribe(pg, '#contrasena2', 'una frase larga de prueba');
      await pulsa(pg, 'input[name="aviso"]', 'Space');
      await pulsa(pg, 'input[name="humano"]', 'Space');
      await revisaPaso(pg, 'cuenta', ancho);
      await siguienteTeclado(pg, 'cuenta', ancho);
      const resumen = await pg.textContent('[data-resumen-cuenta]');
      comprueba(resumen.includes(NUEVA.curp) && resumen.includes(correo) && resumen.includes(dma(NUEVA.nacimiento)) && /No, soy independiente/.test(resumen) && /Lista/.test(resumen) && !resumen.includes('una frase larga'),
        `[pasos ${ancho}] cuenta · Revisa y crea: el resumen con todo lo escrito, sin la contraseña`);
      await revisaPaso(pg, 'cuenta', ancho);
      // Regresar hasta el principio no pierde nada (tampoco la contraseña ni la fotografía, que no van al borrador)
      for (let i = 0; i < 4; i++) { await pulsa(pg, `${pasoVisible} [data-accion="atras"]`); await pg.waitForTimeout(100); }
      const vals = await pg.evaluate(() => ['nombre', 'curp', 'correo', 'telefono', 'contrasena'].map((id) => document.getElementById(id).value));
      comprueba(await tituloPaso(pg) === 'Quién eres' && vals[0] === NUEVA.nombre.toUpperCase() && vals[1] === NUEVA.curp && vals[2] === correo && vals[4] === 'una frase larga de prueba'
        && await pg.locator('[data-campo="foto"] .lista-arch li[data-estado="listo"]').count() === 1, `[pasos ${ancho}] cuenta: con «Atrás» hasta el primer paso no se pierde nada`);
      // «Cambiar» del resumen lleva al campo
      await alPaso(pg, 'Revisa y crea');
      await pulsa(pg, '[data-resumen-cuenta] [data-editar="telefono"]');
      comprueba(await tituloPaso(pg) === 'Cómo te avisamos' && await pg.evaluate(() => document.activeElement.id === 'telefono'), `[pasos ${ancho}] cuenta: «Cambiar» del resumen abre su paso con el foco en el campo`);
      await pg.goBack({ timeout: 3000 }).catch(() => {});
      comprueba(dialogos.includes('beforeunload') && await pg.isVisible('#formulario'), `[pasos ${ancho}] cuenta: «Atrás» del navegador con la cuenta escrita avisa antes de salir`);
      await alPaso(pg, 'Revisa y crea');
      comprueba((await pg.textContent(`${pasoVisible} [data-accion="enviar"]`)).trim() === 'Crear mi cuenta', `[pasos ${ancho}] cuenta: el botón con verbo, «Crear mi cuenta»`);
      await pulsa(pg, `${pasoVisible} [data-accion="enviar"]`);
      await pg.waitForSelector('[data-acuse]:not([hidden])');
      comprueba(await pg.isHidden('[data-con-formulario]') && await pg.evaluate(() => localStorage.getItem('apd.borrador.cuenta')) === null, `[pasos ${ancho}] cuenta: con el teclado se crea; el acuse sin la barra de pasos y sin borrador`);
      sinErr(errores, ancho, 'cuenta');
      await c.close();
    }
  }
  /* Revisar un dictaminador en teléfono chico: diez pasos; cada uno conserva su objetivo de 44 px y la barra se desplaza
     dentro de sí, no la página */
  {
    const { c, pg } = await nuevo(320, 700);
    await pg.goto(BASE + `revisar.html?folio=${dict.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    const r = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-barra] .pasos-btn')].map((x) => x.getBoundingClientRect()); const l = document.querySelector('[data-barra] .pasos'); return { n: b.length, min: Math.min(...b.map((x) => Math.min(x.width, x.height))), desplaza: l.scrollWidth > l.clientWidth, pagina: document.documentElement.scrollWidth }; });
    comprueba(r.n === 10 && r.min >= 44 && r.desplaza && r.pagina <= 321, `[pasos 320] revisar dictaminador: 10 pasos de ${Math.round(r.min)} px o más; la barra se desplaza dentro de sí y la página no (${r.pagina} px)`);
    await c.close();
  }
}

/* ── Mensajes y continuidad (auditoría de seguimiento 2026-10-20, bloque 2; SOLO=continuidad) ──
   B6-01 (la sesión que terminó), B6-02 («Crea tu cuenta» avisa y recupera), B6-03 («Atrás» tras recuperar el borrador),
   B6-04/D4-03 (la versión escrita en la página), B1-02, B1-04, B1-05, C5-02 a C5-04 y el aviso de Citas (como RI-09). */
async function continuidad(navegador) {
  const t = (m) => `[continuidad] ${m}`;
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  const aviso = (pg) => pg.evaluate(() => { const a = document.querySelector('[data-estado-envio]:not([hidden])'); return a ? a.textContent.replace(/\s+/g, ' ').trim() : ''; });

  // B6-01: sin sesión, «Mi perfil» y «Cargar el documento correcto» dicen que la sesión terminó (no «otra pestaña») y, como
  // no tienen borrador, no prometen que lo capturado sigue (la solicitud, que sí lo tiene, se prueba en «romper 2», F1 2)
  {
    const { c, page, errores } = await nuevo(390, 844, CON_ORG.id);
    await page.goto(BASE + 'datos.html');
    await page.waitForSelector('[data-editar="contacto"]');
    await page.click('[data-editar="contacto"]');
    await page.waitForSelector('#form-contacto:not([hidden])');
    await page.fill('#form-contacto #telefono', '5512340000');
    await page.evaluate(() => localStorage.removeItem('apd.sesion'));
    await page.click('#form-contacto [data-accion="enviar"]');
    await page.waitForSelector('#form-contacto [data-estado-envio]:not([hidden]) a[href^="entrar.html?volver="]');
    const texto = await aviso(page);
    comprueba(/Tu sesión terminó\. No se guardó tu cambio: vuelve a entrar y hazlo otra vez/.test(texto) && !/otra pestaña|sigue en este dispositivo/.test(texto) && !errores.length,
      t(`B6-01: «Mi perfil» sin sesión dice que la sesión terminó y que el cambio no se guardó («${texto.slice(0, 100)}»)`));
    await c.close();
  }
  {
    const pausaHoy = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
    const sp = datos.solicitud.find((x) => x.id === pausaHoy.solicitud_id);
    const { c, page, errores } = await nuevo(390, 844, sp.solicitante_id);
    await page.goto(BASE + `corregir.html?folio=${sp.folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    for (const campo of await page.$$('#formulario [data-campo^="doc_"]')) if (await campo.isVisible()) await (await campo.$('input[type="file"]')).setInputFiles(PDF);
    await page.evaluate(() => localStorage.removeItem('apd.sesion'));
    await page.click('#formulario [data-accion="enviar"]');
    await page.waitForSelector('#formulario [data-estado-envio]:not([hidden]) a[href^="entrar.html?volver="]');
    const texto = await aviso(page);
    comprueba(/Tu sesión terminó\. No se cargó nada: vuelve a entrar y carga otra vez/.test(texto) && !/otra pestaña|sigue en este dispositivo/.test(texto) && !errores.length,
      t(`B6-01: «Cargar el documento correcto» sin sesión dice que la sesión terminó y que no se cargó nada («${texto.slice(0, 100)}»)`));
    await c.close();
  }

  // B6-02 (decisión 6, «avisar y recuperar»): «Crea tu cuenta» escrita a mano avisa al recargar y al salir, ofrece
  // recuperar lo escrito sin la contraseña ni la fotografía (que nunca se guardan) y, al crear la cuenta, borra el borrador
  {
    const { c, page, errores } = await nuevo(390, 844);
    const dialogos = [];
    page.on('dialog', (d) => { dialogos.push(d.type()); d.accept().catch(() => {}); });
    await page.goto(BASE + 'index.html');
    await page.goto(BASE + 'cuenta.html');
    await page.waitForSelector('#formulario[data-formkit="listo"]');
    // Por pasos (decisión de Liber del 24/10/2026): la fecha de nacimiento se toma de la CURP; se llega hasta «Tu contraseña»
    const fecha = dma(NUEVA.nacimiento);
    const correo = `prueba.${NUEVA.curp.toLowerCase()}@ejemplo.local`;
    for (const [id, v] of [['nombre', NUEVA.nombre], ['primer_apellido', NUEVA.primer_apellido], ['segundo_apellido', NUEVA.segundo_apellido], ['curp', NUEVA.curp]]) await page.fill(`#${id}`, v);
    await sigPaso(page);
    for (const [id, v] of [['correo', correo], ['correo2', correo], ['telefono', '5512345678']]) await page.fill(`#${id}`, v);
    await marcar(page, 'input[name="adscrito"][value="no"]');
    await sigPaso(page);
    await cargaFoto(page);
    await sigPaso(page);
    for (const [id, v] of [['contrasena', CONTRASENA], ['contrasena2', CONTRASENA]]) await page.fill(`#${id}`, v);
    await marcar(page, 'input[name="aviso"]');
    await page.waitForFunction((curp) => (localStorage.getItem('apd.borrador.cuenta') || '').includes(curp), NUEVA.curp);
    const guardado = await page.evaluate(() => localStorage.getItem('apd.borrador.cuenta'));
    comprueba(!guardado.includes(CONTRASENA) && !/"foto"|data:image/.test(guardado), t('B6-02: el borrador de «Crea tu cuenta» no guarda la contraseña ni la fotografía'));
    await page.reload();
    await page.waitForSelector('[data-franja-borrador]:not([hidden])');
    comprueba(dialogos.includes('beforeunload') && await page.inputValue('#curp') === '', t(`B6-02: recargar con la cuenta escrita avisa antes de salir y ofrece recuperarla (${dialogos.join(', ') || 'sin aviso'})`));
    await page.click('[data-borrador="recuperar"]');
    await page.waitForSelector('[data-borrador-recuperado]:not([hidden])');
    // El borrador recuerda el paso: se vuelve a «Tu contraseña» y el foco va a su primer campo (RS-01)
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'contrasena');
    comprueba(await tituloPaso(page) === 'Tu contraseña', t('B6-02: al recuperar, la cuenta vuelve al paso en que se quedó («Tu contraseña»)'));
    const r = await page.evaluate(() => ({ curp: document.getElementById('curp').value, correo: document.getElementById('correo2').value, telefono: document.getElementById('telefono').value, fecha: document.getElementById('fecha_nacimiento').value,
      sexo: document.getElementById('sexo').value, adscrito: (document.querySelector('input[name="adscrito"]:checked') || {}).value, contrasena: document.getElementById('contrasena').value + document.getElementById('contrasena2').value,
      foto: document.querySelectorAll('[data-campo="foto"] .lista-arch li').length, aviso: document.querySelector('input[name="aviso"]').checked, nota: document.querySelector('[data-borrador-recuperado]').textContent }));
    comprueba(r.curp === NUEVA.curp && r.correo === correo && r.telefono === '5512345678' && r.fecha === fecha && r.sexo && r.adscrito === 'no' && !r.contrasena && !r.foto && !r.aviso && /fotografía y tu contraseña/.test(r.nota),
      t(`B6-02: «Recuperar lo que escribiste» trae los datos y la adscripción, sin contraseña, fotografía ni casillas, y lo dice (${JSON.stringify(r).slice(0, 160)})`));
    dialogos.length = 0;
    await page.click('a.btn-atras');
    await page.waitForURL(/index\.html/);
    comprueba(dialogos.includes('beforeunload'), t('B6-02: salir de «Crea tu cuenta» con algo escrito avisa antes de salir'));
    await page.goto(BASE + 'cuenta.html');
    await page.click('[data-borrador="recuperar"]');
    await page.waitForFunction((curp) => document.getElementById('curp').value === curp, NUEVA.curp);
    await alPaso(page, 'Tu fotografía'); // la fotografía no se guarda: se pone otra vez (regresar no pierde lo demás)
    await cargaFoto(page);
    await sigPaso(page);
    await page.fill('#contrasena', CONTRASENA);
    await page.fill('#contrasena2', CONTRASENA);
    await marcar(page, 'input[name="aviso"]');
    await marcar(page, 'input[name="humano"]');
    await pulsaEnviar(page);
    await page.waitForSelector('[data-acuse]:not([hidden])');
    dialogos.length = 0;
    await page.reload();
    await page.waitForSelector('#formulario[data-formkit="listo"]', { state: 'attached' });
    comprueba(await page.evaluate(() => localStorage.getItem('apd.borrador.cuenta')) === null && await page.isHidden('[data-franja-borrador]') && !dialogos.length && !errores.length,
      t('B6-02: al crear la cuenta se borra el borrador; recargar ya no avisa ni ofrece recuperar'));
    await c.close();
  }

  // B6-03: después de recargar en «Documentos», cada «Atrás» cambia de paso o de página, tanto al recuperar el borrador
  // como al descartarlo (antes, el primero o el segundo no hacían nada)
  const sinTramite = SIN_TRAMITE;
  for (const accion of ['recuperar', 'descartar']) {
    const { c, page, errores } = await nuevo(390, 844, sinTramite.id);
    const paso = () => page.evaluate(() => { const x = [...document.querySelectorAll('section[data-paso]')].find((p) => !p.hidden); return x ? x.dataset.titulo : location.pathname.split('/').pop(); });
    await page.goto(BASE + 'tramites.html');
    await page.goto(BASE + 'solicitud.html');
    await page.waitForSelector(`${pasoVisible} #nivel_estudios`);
    await page.selectOption('#nivel_estudios', 'licenciatura');
    await page.fill('#carrera', 'Biología');
    await page.keyboard.press('Escape');
    // En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026)
    if (await page.isVisible('[data-campo="estatus_estudios"]')) await marcar(page, 'input[name="estatus_estudios"][value="titulado"]');
    await siguiente(page);
    const enDocumentos = () => page.waitForFunction(() => { const x = [...document.querySelectorAll('section[data-paso]')].find((p) => !p.hidden); return x && x.dataset.titulo === 'Documentos'; });
    await enDocumentos();
    await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith('apd.borrador.solicitud.') && /"paso":1/.test(localStorage.getItem(k))));
    await page.reload();
    await page.waitForSelector('[data-franja-borrador]:not([hidden])');
    if (accion === 'recuperar') {
      await page.click('[data-borrador="recuperar"]');
      await enDocumentos();
    } else {
      await page.click('[data-borrador="descartar"]');
      await page.click('[data-borrador="descartar-si"]');
      await page.waitForSelector('[data-franja-borrador]', { state: 'hidden' });
    }
    const vistos = [await paso()];
    for (let k = 0; k < (accion === 'recuperar' ? 2 : 1); k++) {
      const antes = page.url() + vistos[vistos.length - 1];
      await page.goBack();
      await page.waitForFunction((a) => location.href + ([...document.querySelectorAll('section[data-paso]')].find((p) => !p.hidden) || { dataset: { titulo: location.pathname.split('/').pop() } }).dataset.titulo !== a, antes, { timeout: 5000 }).catch(() => {});
      vistos.push(await paso());
    }
    const esperado = accion === 'recuperar' ? ['Documentos', 'Trámite', 'tramites.html'] : ['Trámite', 'tramites.html'];
    comprueba(JSON.stringify(vistos) === JSON.stringify(esperado) && !errores.length,
      t(`B6-03: al ${accion} el borrador después de recargar, cada «Atrás» cambia de paso o de página (${vistos.join(' → ')})`));
    await c.close();
  }

  // B6-04 y D4-03 (decisión 7a): la versión va escrita en cada página; el distintivo y el menú de pruebas la leen de ahí,
  // ninguna pantalla pide VERSION y, sin red o con VERSION nuevo y la página de antes, se ve la versión de la página
  {
    const version = readFileSync(join(raiz, 'VERSION'), 'utf8').trim();
    const paginas = readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html') && f !== 'espera.html');
    for (const modo of ['sin red', 'VERSION nuevo']) {
      const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: 390, height: 844 } });
      let pedidos = 0;
      await c.route('**/VERSION*', (r) => { pedidos += 1; return modo === 'sin red' ? r.abort('internetdisconnected') : r.fulfill({ body: '0.999\n', contentType: 'text/plain' }); });
      const page = await c.newPage();
      const distintos = [];
      for (const pg of paginas) {
        // Sin sesión, algunas pantallas llevan a «Entrar»: se mira la página en la que se queda
        await page.goto(BASE + pg, { waitUntil: 'networkidle' });
        let r = null;
        for (let i = 0; !r && i < 4; i++) {
          r = await page.waitForFunction(() => /Versión/.test((document.getElementById('version-sia') || {}).textContent || ''))
            .then(() => page.evaluate(() => ({ meta: (document.querySelector('meta[name="sia-version"]') || {}).content, distintivo: document.getElementById('version-sia').textContent })))
            .catch(() => page.waitForLoadState('networkidle').then(() => null));
        }
        r = r || { meta: null, distintivo: 'sin leer' };
        if (r.meta !== version || r.distintivo !== `Versión de prueba ${version}`) distintos.push(`${pg}: ${r.meta} · ${r.distintivo}`);
      }
      await page.goto(BASE + 'index.html');
      const menu = await page.waitForSelector('.menu-pruebas-boton', { timeout: 8000 }).then(() => true, () => false);
      comprueba(!distintos.length && !pedidos && menu, t(`B6-04 y D4-03 (${modo}): las ${paginas.length} pantallas llevan escrita la versión ${version}, la muestran sin pedir VERSION (${pedidos} pedidos) y el menú de pruebas aparece${distintos.length ? `; distintas: ${distintos.join(' | ')}` : ''}`));
      await c.close();
    }
  }
  // C5-02: la persona espera el curso (el personal arma los grupos): en «Mis trámites» no lee «espera de grupo»
  {
    const ins = datos.inscripcion.find((x) => !x.activa && /^Grupo cancelado/.test(x.motivo_baja || '')
      && datos.solicitud.some((s) => s.id === x.solicitud_id && s.estado === 'lista_para_curso' && datos.solicitante.some((p) => p.id === s.solicitante_id && p.estado === 'activa')));
    const s = datos.solicitud.find((x) => x.id === ins.solicitud_id);
    const { c, page, errores } = await nuevo(390, 844, s.solicitante_id);
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('text=Tu grupo se canceló');
    const texto = await page.textContent('main');
    comprueba(/Sigues en espera de un curso/.test(texto) && !/espera de grupo/i.test(texto) && !errores.length, t('C5-02: con su grupo cancelado, «Mis trámites» dice «en espera de un curso» y no «espera de grupo»'));
    await c.close();
  }
  // C5-03 y C5-04: en las pantallas del personal la franja de ubicación no habla de tú; «Vence el» con la misma mayúscula
  // que «Vencida el»; ninguna oración con dos «:» (la razón de un día que no se puede va entre paréntesis)
  {
    const { c, page, errores } = await nuevo(1280, 900);
    const dosPuntos = () => page.evaluate(() => {
      const fuera = (n) => n.closest('.ubicacion-prueba, .entorno-pruebas, dialog, script, style, .solo-lector');
      const textos = [...document.querySelectorAll('main p, main li, main span, main [role="alert"], main .aviso-texto')].filter((n) => !fuera(n) && n.childElementCount === 0).map((n) => n.textContent.replace(/\s+/g, ' ').trim());
      return textos.flatMap((x) => x.split(/(?<=[.!?])\s+/)).filter((o) => (o.match(/: /g) || []).length > 1);
    });
    await page.goto(BASE + 'grupos.html?curso=poda-renovacion&paso=3');
    await listoGrupos(page);
    const ubic = await page.waitForSelector('nav.ubicacion-prueba').then((n) => n.getAttribute('aria-label'));
    const espera = await page.$$eval('.plan-persona-espera > *', (xs) => xs.map((x) => x.textContent.trim()));
    const conVence = espera.filter((x) => /^vence el/i.test(x));
    comprueba(ubic === 'Ubicación en el trámite (versión de prueba)', t(`C5-03: la franja de ubicación del personal se llama «${ubic}»`));
    comprueba(conVence.length > 0 && conVence.every((x) => x.startsWith('Vence el')) && espera.some((x) => /^Vencida el/.test(x)),
      t(`C5-04: en la espera de renovación «Vencida el» y «Vence el» llevan la misma mayúscula (${conVence.length} con «Vence el»)`));
    const doblesG = await dosPuntos();
    comprueba(!doblesG.length && /^No disponible: ya pasó, faltan menos de \d+ días o ya hay \d+ grupos$/.test(await page.textContent('[data-leyenda-no]')), t(`C5-04: «Grupos» no tiene oraciones con dos «:» y la leyenda de lo que no está disponible lleva uno solo${doblesG.length ? `: ${doblesG.slice(0, 3).join(' | ')}` : ''}`));
    // Paso 2 del curso de un día: un día que no se puede, tocado, se dice con un solo «:» (la razón va entre paréntesis)
    await page.click('[data-barra] [data-ir="1"]');
    await page.waitForFunction(() => FormKit.pasos.actual() === 1);
    await page.click('.arm-dia-curso[aria-disabled="true"]', { force: true }); // aria-disabled: se toca igual y dice por qué no
    await page.waitForFunction(() => /no se puede: faltan menos de \d+ días \(el curso empieza/.test(document.querySelector('[data-cal-estado]').textContent));
    const dobles = await dosPuntos();
    comprueba(!dobles.length && !errores.length, t(`C5-04: «Grupos» dice por qué un día del curso no se puede sin dos «:» seguidos${dobles.length ? `: ${dobles.slice(0, 3).join(' | ')}` : ''}`));
  }

}

/* ── Tareas y estados del personal (auditoría de seguimiento 2026-10-20, bloque 3; SOLO=tareas) ──
   Con los datos ficticios de siempre; lo que necesita volumen está en herramientas/probar-volumen.mjs. */
async function tareasPersonal(navegador) {
  const t = (m) => `[tareas] ${m}`;
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };

  // C1-04: en una solicitud reenviada, lo que se le pidió corregir está junto al documento corregido y «Revisiones
  // anteriores» abre desplegado
  {
    const { c, page, errores } = await nuevo(1280, 900);
    const reenv = datos.solicitud.find((s) => s.estado === 'enviada' && datos.revision.some((r) => r.solicitud_id === s.id)
      && datos.documento.some((d) => d.solicitud_id === s.id && d.estado === 'con_observacion' && d.observacion));
    const doc = datos.documento.filter((d) => d.solicitud_id === reenv.id && d.estado === 'con_observacion' && d.observacion).pop();
    await page.goto(BASE + `revisar.html?folio=${reenv.folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    const bloque = await page.textContent(`[data-doc="${doc.requisito}"]`);
    comprueba(await page.$eval('[data-anteriores]', (d) => d.open) && bloque.includes('Corregido para esta revisión') && bloque.includes(`Se le pidió: ${doc.observacion}`) && !errores.length,
      t(`C1-04: ${reenv.folio}, junto al documento corregido «Se le pidió: ${doc.observacion.slice(0, 40)}…» y las revisiones anteriores abiertas`));
    await c.close();
  }

  // C1-07 (decisión 12 a): «Mostrar: Por atender» en «Citas» deja sólo las citas del día sin resultado, queda en la
  // dirección (?ver=por-atender) y sobrevive a recargar. C4-03: la búsqueda sobrevive a «Atrás» y a recargar (en esta
  // pestaña, no en la dirección), y al llegar de nuevo desde el menú la agenda empieza sin búsqueda.
  {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + 'citas.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    const dia = await page.evaluate(() => APD.cargar().then((d) => {
      const por = {};
      for (const x of APD_PERSONAL.citas(d)) { const k = APD_PERSONAL.diaDe(x.en); (por[k] ||= []).push(x.pendiente); }
      // Un día con citas ya cerradas (y, si lo hay, con alguna abierta) y el folio de una cita abierta, para buscarla
      const dias = Object.keys(por).sort();
      const k = dias.find((x) => por[x].some(Boolean) && por[x].some((v) => !v)) || dias.find((x) => por[x].some((v) => !v));
      const abierta = APD_PERSONAL.citas(d).find((x) => x.pendiente);
      return { dia: k, abiertas: por[k].filter(Boolean).length, todas: por[k].length, folio: abierta.s.folio };
    }));
    await page.goto(BASE + `citas.html?dia=${dia.dia}`);
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    await page.selectOption('#ver', 'por-atender');
    const filtrada = () => page.waitForFunction(() => /sin resultado|No quedan citas por atender/.test(document.querySelector('[data-cuenta]').textContent));
    await filtrada();
    const vis = () => page.$$eval('[data-filas] tr:not([hidden])', (l) => l.map((tr) => Boolean(tr.querySelector('a'))));
    const conFiltro = await vis();
    comprueba(conFiltro.length === dia.abiertas && conFiltro.every(Boolean) && (dia.abiertas || await page.isVisible('[data-tabla-vacia]')) && /[?&]ver=por-atender/.test(page.url()),
      t(`C1-07: el ${dia.dia}, «Por atender» deja ${conFiltro.length} de ${dia.todas} citas, las que no tienen resultado, y queda en la dirección`));
    await page.reload();
    await filtrada();
    comprueba((await page.inputValue('#ver')) === 'por-atender' && (await vis()).length === dia.abiertas, t('C1-07: al recargar sigue en «Por atender»'));
    await page.selectOption('#ver', '');
    const folio = dia.folio;
    await page.fill('#buscar', folio);
    await page.waitForFunction(() => /coincide/.test(document.querySelector('[data-cuenta]').textContent));
    const cuenta = await page.textContent('[data-cuenta]');
    await page.locator('[data-filas] tr:not([hidden]) a').first().click();
    await page.waitForURL(/cotejo\.html/);
    await page.goBack();
    await page.waitForFunction(() => /coincide/.test(document.querySelector('[data-cuenta]').textContent));
    const atras = [await page.inputValue('#buscar'), await page.textContent('[data-cuenta]')];
    await page.reload();
    await page.waitForFunction(() => /coincide/.test(document.querySelector('[data-cuenta]').textContent));
    const recarga = [await page.inputValue('#buscar'), await page.textContent('[data-cuenta]')];
    comprueba(atras[0] === folio && atras[1] === cuenta && recarga[0] === folio && recarga[1] === cuenta && !page.url().includes(folio),
      t(`C4-03: la búsqueda «${folio}» sigue con «Atrás» y al recargar («${cuenta}»), sin quedar en la dirección`));
    await page.goto(BASE + 'citas.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    await page.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-cuenta]').textContent));
    comprueba((await page.inputValue('#buscar')) === '' && !errores.length, t(`C4-03: al llegar de nuevo, la agenda empieza sin búsqueda${errores.length ? `; errores: ${errores[0]}` : ''}`));
    await c.close();
  }

  // C4-01: los filtros de la bandeja quedan en la dirección y sobreviven a «Atrás» y a recargar; «Revisar una solicitud»
  // regresa a la bandeja con ellos. C4-02: la cuenta filtrada dice con qué filtros. En teléfono (filtros plegados) y en
  // escritorio.
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    const { c, page, errores } = await nuevo(ancho, alto);
    const tam = ancho < 600 ? 'teléfono' : 'escritorio';
    await page.goto(BASE + 'revision.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    if (await page.isVisible('[data-filtrar]')) await page.click('[data-filtrar]');
    await page.selectOption('#f_tipo', 'poda');
    await page.selectOption('#f_vuelta', 'primera');
    await page.waitForFunction(() => /Se muestran/.test(document.querySelector('[data-cuenta]').textContent));
    const cuenta = (await page.textContent('[data-cuenta]')).trim();
    const n = (await page.$$('[data-filas] tr:not([hidden])')).length;
    comprueba(/[?&]tipo=poda/.test(page.url()) && /[?&]vuelta=primera/.test(page.url()) && /\(Poda y derribo · Primera vez\)/.test(cuenta),
      t(`C4-01 y C4-02 (${tam}): los filtros van en la dirección y la cuenta los nombra («${cuenta}»)`));
    await Promise.all([page.waitForURL(/revisar\.html/), page.locator('[data-filas] tr:not([hidden]) a').first().click()]);
    await page.waitForLoadState('load');
    const vuelta = await page.getAttribute('a.btn-atras', 'href');
    await page.goBack();
    await page.waitForFunction((x) => document.querySelector('[data-cuenta]').textContent.trim() === x, cuenta);
    const atras = [await page.inputValue('#f_tipo'), await page.inputValue('#f_vuelta'), (await page.$$('[data-filas] tr:not([hidden])')).length];
    await page.reload();
    await page.waitForFunction((x) => document.querySelector('[data-cuenta]').textContent.trim() === x, cuenta);
    const recarga = [await page.inputValue('#f_tipo'), await page.inputValue('#f_vuelta'), (await page.$$('[data-filas] tr:not([hidden])')).length];
    comprueba(atras.join() === `poda,primera,${n}` && recarga.join() === `poda,primera,${n}` && /^revision\.html\?(?=.*tipo=poda)(?=.*vuelta=primera)/.test(vuelta || '') && !errores.length,
      t(`C4-01 (${tam}): con «Atrás» y al recargar siguen los filtros y las ${n} solicitudes; «Solicitudes por revisar» regresa con ellos (${vuelta})`));
    await c.close();
  }

  // C4-05: la bandeja se entera de una revisión registrada en otra pestaña (la fila sale y la cuenta baja)
  {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + 'revision.html');
    await page.waitForSelector('[data-filas] tr', { state: 'attached' });
    const total = (await page.$$('[data-filas] tr')).length;
    const folio = await page.getAttribute('[data-filas] tr', 'data-folio');
    const otra = await c.newPage();
    await otra.goto(BASE + `revisar.html?folio=${folio}`);
    await otra.waitForSelector('#formulario', { state: 'attached' });
    await otra.evaluate((F) => APD_PERSONAL.guardaRevision(F, { resultado: 'con_observaciones', texto: 'Con observaciones', datos: {}, revisor: 'revision.prueba', en: new Date().toISOString() }), folio);
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction((F) => !document.querySelector(`[data-filas] tr[data-folio="${F}"]`), folio, { timeout: 8000 }).catch(() => {});
    const despues = (await page.$$('[data-filas] tr')).length;
    comprueba(despues === total - 1 && new RegExp(`^${total - 1} solicitud`).test((await page.textContent('[data-cuenta]')).trim()) && !errores.length,
      t(`C4-05: revisada en otra pestaña, ${folio} sale de la bandeja (${total} → ${despues}) y la cuenta baja`));
    await c.close();
  }

  // C2-02: «Mis trámites» con grupo confirmado, en 390 × 844: cuándo, a qué hora y dónde, arriba en un recuadro como el de
  // la cita, con la fecha larga, y en la primera pantalla
  {
    const ins = datos.inscripcion.find((i) => i.activa && ['confirmado', 'en_curso'].includes((datos.grupo.find((g) => g.id === i.grupo_id) || {}).estado)
      && (datos.solicitud.find((s) => s.id === i.solicitud_id) || {}).estado === 'inscrita');
    const quien = datos.solicitud.find((s) => s.id === ins.solicitud_id).solicitante_id;
    const { c, page, errores } = await nuevo(390, 844, quien);
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-solicitudes] .ficha-cita');
    const r = await page.evaluate(() => {
      const caja = document.querySelector('[data-solicitudes] .ficha-cita');
      const dt = (re) => [...caja.querySelectorAll('dt, .datos-etiqueta')].find((x) => re.test(x.textContent));
      const inicio = dt(/Preséntate el|Tu curso empezó el/);
      const lugar = dt(/Lugar del curso/);
      const sigue = caja.closest('.ficha').querySelector('.ficha-sigue');
      return { valor: inicio ? inicio.nextElementSibling.textContent.trim() : '', lugarY: lugar ? lugar.getBoundingClientRect().bottom + scrollY : 1e9,
        antes: Boolean(sigue) && Boolean(caja.compareDocumentPosition(sigue) & Node.DOCUMENT_POSITION_FOLLOWING), ventana: innerHeight };
    });
    comprueba(/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} de [a-z]+ de \d{4}( a las \d{2}:\d{2})?$/.test(r.valor) && r.lugarY < r.ventana && r.antes && !errores.length,
      t(`C2-02: con grupo, «${r.valor}» y el lugar en un recuadro antes de «Qué sigue», en la primera pantalla (hasta ${Math.round(r.lugarY)} de ${r.ventana} px)`));
    await c.close();
  }

  // C4-04: las personas elegidas en el planeador de «Grupos» siguen marcadas al recargar; al llegar de nuevo, ninguna
  {
    const { c, page, errores } = await nuevo(1280, 900);
    // (desde el 24/10, en el paso 3 de «Grupos»: al llegar se proponen las que más esperan)
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
    await listoGrupos(page);
    const marcadas = () => page.$$eval('.plan-persona input:checked', (l) => l.map((k) => k.value).sort().join());
    const propuesta = await marcadas();
    const dos = await page.$$eval('.plan-persona input', (l) => l.slice(0, 2).map((k) => k.value));
    await soloA(page, dos);
    const antes = await marcadas();
    await page.reload();
    await listoGrupos(page);
    const recarga = await marcadas();
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
    await listoGrupos(page);
    const nueva = await marcadas();
    comprueba(antes.split(',').length === 2 && recarga === antes && nueva === propuesta && nueva !== antes && !errores.length,
      t(`C4-04: las 2 elegidas siguen al recargar (${recarga}) y al llegar de nuevo vuelve la propuesta de las que más esperan`));
    await c.close();
  }

  // C3-02: en la solicitud y en «Carga el documento correcto», el formato y el tamaño se dicen una vez y no en cada
  // documento. C3-03 (decisión 13 a): la solicitud ya no pide «No soy un programa automático» (sí «Crea tu cuenta»)
  {
    const { c, page, errores } = await nuevo(390, 844, CON_ORG.id);
    await page.goto(BASE + 'solicitud.html');
    await page.waitForSelector('[data-si="tramite=poda_nueva"] [data-campo^="doc_"] .zona-carga', { state: 'attached' });
    await page.waitForLoadState('load');
    const r = await page.evaluate(() => {
      const zonas = [...document.querySelectorAll('[data-campo^="doc_"]')];
      return { zonas: zonas.length, conLimite: zonas.filter((z) => /Formato admitido|Un archivo de hasta/.test(z.textContent)).length,
        bajada: [...document.querySelectorAll('.bajada')].some((b) => /sólo en PDF, de hasta 5 MB/.test(b.textContent)),
        humano: Boolean(document.querySelector('input[name="humano"]')), trampa: Boolean(document.querySelector('[data-trampa] input[name="sitio_web"]')) };
    });
    const [cuenta, corregir] = await page.evaluate(() => Promise.all(['cuenta.html', 'corregir.html'].map((u) => fetch(u).then((x) => x.text()))));
    comprueba(r.zonas >= 20 && r.conLimite === 0 && r.bajada && !/data-limite-texto/.test(corregir.replace(/<!--[\s\S]*?-->/g, '')) && /Sólo PDF, de hasta 5 MB/.test(corregir),
      t(`C3-02: ninguna de las ${r.zonas} zonas de carga de la solicitud repite el formato; la bajada y «Carga el documento correcto» lo dicen una vez`));
    comprueba(!r.humano && r.trampa && /name="humano"/.test(cuenta) && !errores.length, t('C3-03: la solicitud no pide «No soy un programa automático» (queda la trampa); «Crea tu cuenta» sí'));
    await c.close();
  }

  // C4-06: «Mis trámites» abierta y, en otra pestaña, se entra con otra cuenta (o se sale): la pestaña vieja lo dice y deja
  // de mostrar los trámites de la persona anterior
  for (const salir of [false, true]) {
    const [X, Y] = datos.solicitante.filter((p) => p.estado === 'activa' && datos.solicitud.some((s) => s.solicitante_id === p.id && !FINALES.includes(s.estado)));
    const { c, page, errores } = await nuevo(390, 844, X.id);
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-solicitudes] .ficha');
    await page.waitForLoadState('load');
    const otra = await c.newPage();
    await otra.goto(BASE + 'index.html');
    await otra.evaluate((id) => { if (id) localStorage.setItem('apd.sesion', JSON.stringify({ id })); else localStorage.removeItem('apd.sesion'); }, salir ? null : Y.id);
    await page.bringToFront();
    await page.waitForSelector('[data-sesion-cambio]', { timeout: 8000 }).catch(() => {});
    const aviso = (await page.textContent('[data-sesion-cambio]').catch(() => '')) || '';
    comprueba((salir ? /Tu sesión terminó/.test(aviso) : /Tu sesión cambió en otra pestaña/.test(aviso)) && await page.isHidden('[data-solicitudes]') && await page.isVisible('[data-sesion-cambio] a[href^="entrar.html?volver="]') && !errores.length,
      t(`C4-06: ${salir ? 'se salió' : 'se entró con otra cuenta'} en otra pestaña y «Mis trámites» lo dice sin mostrar los trámites de antes («${aviso.replace(/\s+/g, ' ').trim()}»)`));
    await c.close();
  }
}

/* ── Formas de fecha (auditoría de seguimiento 2026-10-20, bloque 6, C5-01; SOLO=fechas) ──
   Decisión de Liber del 20/10 (puntos 16 b y 17 b): fecha larga para lo que se recuerda («martes 20 de octubre de 2026
   a las 10:00», APD.fechaLarga), 20/10/2026 en tablas y datos («20/10/2026 10:00», APD.fechaCorta) y el acuse con la
   fecha larga del estándar. Recorre las 21 pantallas con los casos del menú de pruebas y falla si aparece otra forma
   (el clasificador está en herramientas/formatos-fecha.mjs); antes había 14 formas, hasta 5 en una pantalla. */
async function formatosFecha(navegador) {
  const t = (m) => `[formas de fecha] ${m}`;
  const { clasifica, CASOS_CLASIFICADOR } = await import('./formatos-fecha.mjs');

  // 1 · El clasificador: lo decidido pasa y cada forma vieja de C5-01 se detecta
  const malClasificados = CASOS_CLASIFICADOR.filter(([texto, ok]) => { const r = clasifica(texto); return (r.length > 0 && r.every((x) => x.permitida)) !== ok; });
  comprueba(!malClasificados.length, t(`el clasificador acepta lo decidido y detecta las ${CASOS_CLASIFICADOR.filter((x) => !x[1]).length} formas viejas${malClasificados.length ? ': falla con ' + malClasificados.map((x) => `«${x[0]}»`).join(', ') : ''}`));

  // 2 · Las dos funciones, en tres zonas horarias del navegador: el resultado es siempre el de la Ciudad de México
  const ESPERADO = {
    larga: 'martes 20 de octubre de 2026',
    largaHoraTexto: 'martes 20 de octubre de 2026 a las 09:00',
    medianoche: 'miércoles 21 de octubre de 2026 a las 00:00',
    medianocheCorta: '21/10/2026 00:00',
    cambioDeDia: '20/10/2026 21:30',
    cambioDeDiaLarga: 'martes 20 de octubre de 2026 a las 21:30',
    corta: '20/10/2026',
    cortaSinHoraDeInstante: '20/10/2026',
    anioNuevo: 'viernes 1 de enero de 2027',
    mayuscula: 'Martes 20 de octubre de 2026',
    vacias: ['', '', '', ''],
    hora: '00:00'
  };
  for (const zona of [ZONA, 'UTC', 'Asia/Tokyo']) {
    const c = await navegador.newContext({ timezoneId: zona, locale: 'en-US' });
    const pg = await c.newPage();
    await pg.goto(BASE + 'index.html');
    await pg.waitForFunction(() => window.APD);
    const r = await pg.evaluate(() => (!APD.fechaLarga || !APD.fechaCorta ? {} : {
      larga: APD.fechaLarga('2026-10-20'),
      largaHoraTexto: APD.fechaLarga('2026-10-20', { hora: '09:00:00' }),
      medianoche: APD.fechaLarga('2026-10-21T06:00:00Z', { hora: true }),
      medianocheCorta: APD.fechaCorta('2026-10-21T00:00:00-06:00', { hora: true }),
      cambioDeDia: APD.fechaCorta('2026-10-21T03:30:00Z', { hora: true }),
      cambioDeDiaLarga: APD.fechaLarga('2026-10-21T03:30:00Z', { hora: true }),
      corta: APD.fechaCorta('2026-10-20'),
      cortaSinHoraDeInstante: APD.fechaCorta('2026-10-21T03:30:00Z'),
      anioNuevo: APD.fechaLarga('2027-01-01'),
      mayuscula: APD.fechaLarga('2026-10-20', { mayuscula: true }),
      vacias: [APD.fechaLarga(null), APD.fechaCorta(''), APD.fechaLarga('no es fecha'), APD.fechaCorta(undefined, { hora: true })],
      hora: APD.hora('2026-10-21T06:00:00Z')
    }));
    const distintas = Object.keys(ESPERADO).filter((k) => JSON.stringify(r[k]) !== JSON.stringify(ESPERADO[k]));
    comprueba(!distintas.length, t(`APD.fechaLarga y APD.fechaCorta con el navegador en ${zona}: medianoche «${r.medianoche}», cambio de día «${r.cambioDeDia}», sin hora «${r.larga}» y «${r.corta}»${distintas.length ? ` · distinto: ${distintas.map((k) => `${k} «${r[k]}»`).join(', ')}` : ''}`));
    await c.close();
  }

  // 3 · Recorrido: renglones visibles, bloques ocultos y nombres accesibles, sin lo que sólo existe en la prueba
  const extrae = () => {
    const limpio = (x) => String(x || '').replace(/[ \t ]+/g, ' ').trim();
    const lineas = (x) => String(x || '').split(/\n+/).map(limpio).filter(Boolean);
    const dePrueba = (e) => e.closest('.entorno-pruebas, .ubicacion-prueba, .version-sia, dialog.menu-pruebas, .menu-pruebas-boton');
    const acuse = new Set([...document.querySelectorAll('[data-acuse], .acuse')].flatMap((e) => lineas(e.innerText || e.textContent)));
    const quitar = new Set([...document.querySelectorAll('.entorno-pruebas, .ubicacion-prueba, .version-sia, dialog.menu-pruebas, .menu-pruebas-boton')].flatMap((e) => lineas(e.innerText)));
    const r = new Map();
    for (const l of lineas(document.body.innerText)) if (!quitar.has(l)) r.set(l, acuse.has(l));
    for (const e of document.querySelectorAll('[hidden], dialog:not([open]), template')) {
      if (dePrueba(e) || e.closest('script,style')) continue;
      for (const l of lineas(e.tagName === 'TEMPLATE' ? e.content.textContent : e.textContent)) if (!r.has(l)) r.set(l, acuse.has(l));
    }
    for (const e of document.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')) {
      if (dePrueba(e)) continue;
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v && v.trim()) r.set(limpio(v), false); }
    }
    return [...r].map(([texto, enAcuse]) => ({ texto, acuse: enAcuse }));
  };
  const porPantalla = new Map();
  const anota = (pantalla, estado, renglones) => {
    const p = porPantalla.get(pantalla) || { estados: 0, formas: new Set(), malas: [] };
    p.estados++;
    for (const { texto, acuse } of renglones) {
      if (texto.length > 400) continue;
      for (const x of clasifica(texto, { acuse })) { p.formas.add(x.forma); if (!x.permitida) p.malas.push(`${estado}: ${x.forma} en «${texto.slice(0, 110)}»`); }
    }
    porPantalla.set(pantalla, p);
  };
  const errores = [];
  const visita = async (pantalla, url, { sesion, ancho = 1280, antes } = {}) => {
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: 900 }, isMobile: ancho < 600, hasTouch: ancho < 600 });
    if (sesion) await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    const pg = await c.newPage();
    pg.on('pageerror', (e) => errores.push(`${url}: ${e.message}`));
    pg.on('dialog', (d) => d.dismiss().catch(() => {}));
    await pg.goto(BASE + url);
    await pg.waitForLoadState('networkidle');
    await pg.waitForFunction(() => !/Cargando/.test((document.querySelector('main') || document.body).innerText), null, { timeout: 8000 }).catch(() => {});
    if (antes) await antes(pg);
    anota(pantalla, url, await pg.evaluate(extrae));
    await c.close();
  };

  // Los casos del menú de pruebas (persona), como los arma el menú
  const c0 = await navegador.newContext({ timezoneId: ZONA });
  const p0 = await c0.newPage();
  await p0.goto(BASE + 'index.html');
  await p0.waitForFunction(() => window.APD && window.APD_CASOS_PRUEBA);
  const casos = await p0.evaluate(() => APD.cargar().then((d) => APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.map((x) => ({ clave: x.clave, persona: x.persona ? x.persona.id : null, migrada: Boolean(x.migrada), pantalla: x.pantalla || null })))));
  await c0.close();
  for (const x of casos) {
    if (x.pantalla || !x.persona) continue;
    if (x.migrada) { await visita('cuenta', `cuenta.html?migrada=${encodeURIComponent(x.persona)}`, { ancho: 390 }); continue; }
    await visita('tramites', 'tramites.html', { sesion: x.persona, ancho: 390 });
    if (/^cita|pausa/.test(x.clave)) await visita('corregir', 'corregir.html', { sesion: x.persona, ancho: 390 });
  }
  // «Cargar el documento correcto» de la cita en pausa de hoy: «En tu cita del martes … a las …»
  const pausaHoy = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sPausaHoy = datos.solicitud.find((x) => x.id === pausaHoy.solicitud_id);
  await visita('corregir', `corregir.html?folio=${sPausaHoy.folio}`, { sesion: sPausaHoy.solicitante_id, ancho: 390, antes: (pg) => pg.waitForSelector('#formulario:not([hidden])') });
  // La solicitud: nueva y con observaciones (lo que se pidió corregir, con sus fechas)
  const sinTramite = SIN_TRAMITE;
  await visita('solicitud', 'solicitud.html', { sesion: sinTramite.id, ancho: 390 });
  await visita('solicitud', `solicitud.html?folio=${conObs.folio}`, { sesion: conObs.solicitante_id, ancho: 390 });
  const acreditada = casos.find((x) => x.clave === 'acreditada');
  if (acreditada) await visita('datos', 'datos.html', { sesion: acreditada.persona, ancho: 390 });
  for (const u of ['index.html', 'entrar.html', 'material.html']) await visita(u.replace('.html', ''), u, { ancho: 390 });
  for (const a of [datos.acreditacion.find((x) => x.vence_en > datos.fecha_corte && x.numero), datos.acreditacion.find((x) => x.vence_en < datos.fecha_corte && x.numero)].filter(Boolean)) {
    await visita('verificar', 'verificar.html', { ancho: 390, antes: async (pg) => { await pg.fill('#numero', a.numero); await pg.click('[data-accion="enviar"]'); await pg.waitForSelector('[data-resultado]:not([hidden]), .resultado:not([hidden]), [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => {}); } });
  }
  // El acuse de «Crea tu cuenta», con los datos ficticios del menú: conserva la fecha larga del estándar (decisión 17 b)
  await visita('cuenta (acuse)', 'cuenta.html', { ancho: 390, antes: async (pg) => {
    await pg.click('.menu-pruebas-boton'); await pg.click('dialog.menu-pruebas >> text="Llenar con datos ficticios"');
    await pg.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
    await pg.waitForFunction(() => document.querySelector('#curp') && document.querySelector('#curp').value.length === 18);
    // «Crea tu cuenta» por pasos (24/10/2026): la fotografía ficticia, en su paso, y luego «Crear mi cuenta» en el último
    await pg.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]', { state: 'attached' });
    await pulsaEnviar(pg);
    await pg.waitForSelector('[data-acuse]:not([hidden])', { timeout: 15000 });
  } });
  // El personal, con los datos ficticios
  await visita('revision', 'revision.html');
  for (const s of datos.solicitud.filter((x) => x.estado === 'enviada').slice(0, 4)) await visita('revisar', `revisar.html?folio=${s.folio}`);
  await visita('citas', 'citas.html');
  for (const s of datos.solicitud.filter((x) => x.estado === 'validada_en_linea')) await visita('cotejo', `cotejo.html?folio=${s.folio}`);
  for (const curso of ['poda-nueva', 'poda-renovacion', 'dictaminador-nueva', 'dictaminador-renovacion']) {
    // «Grupos» paso a paso (24/10/2026): el calendario (paso 2) y el resumen (paso 4); antes, el planeador y «Programar»
    await visita('grupos', `grupos.html?curso=${curso}&paso=2`);
    await visita('grupos', `grupos.html?curso=${curso}&paso=4`);
  }
  await visita('grupos', 'grupos.html');
  await visita('espera', 'espera.html?curso=poda-nueva');
  for (const g of datos.grupo) await visita('grupo', `grupo.html?folio=${g.folio}`);
  await visita('asistencia', 'asistencia.html');
  for (const g of datos.grupo.filter((x) => ['en_curso', 'concluido', 'confirmado'].includes(x.estado))) await visita('asistencia', `asistencia.html?folio=${g.folio}`, { ancho: 390 });
  await visita('aplicar', 'aplicar.html');
  for (const g of datos.grupo.filter((x) => ['en_curso', 'concluido'].includes(x.estado))) await visita('aplicar', `aplicar.html?folio=${g.folio}`);
  await visita('material-personal', 'material-personal.html');
  // «Grupos»: la semana elegida en el calendario, el resumen y lo que se dice al elegir (antes, «Programar»)
  await visita('grupos', 'grupos.html?curso=poda-nueva&semana=2026-11-02&mes=2026-11&paso=2', { ancho: 390, antes: (pg) => pg.waitForSelector('.arm-semana-elegir[aria-pressed="true"]') });
  // La dirección vieja de «Programar» (sólo lleva a «Grupos» con su curso y su semana): lo que se ve al llegar
  await visita('programar', 'programar.html?curso=poda-nueva&semana=2026-11-02', { antes: (pg) => pg.waitForSelector('#paso-semana:not([hidden]) .arm-semana-elegir[aria-pressed="true"]') });
  // El examen: pasar lista, entrar con el código y enviar; el resultado dice cuándo se envió
  {
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: 1280, height: 900 } });
    const ap = await c.newPage();
    ap.on('dialog', (d) => d.dismiss().catch(() => {}));
    const grupo = datos.grupo.find((g) => g.estado === 'en_curso');
    await ap.goto(BASE + `aplicar.html?folio=${grupo.folio}`);
    await ap.waitForSelector('[data-filas] tr');
    const boton = ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
    const ins = await boton.getAttribute('data-ins');
    await boton.click();
    await ap.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
    const codigo = (await ap.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
    const ex = await c.newPage();
    ex.on('pageerror', (e) => errores.push(`examen: ${e.message}`));
    await ex.goto(BASE + 'examen.html');
    await ex.fill('#codigo', codigo); await ex.click('#entrar [data-accion="enviar"]');
    await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
    anota('examen', 'examen · ¿eres tú?', await ex.evaluate(extrae));
    await ex.click('[data-ir-vista="instrucciones"]'); await ex.click('[data-empezar]');
    await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
    for (let i = 0; i < 40 && !(await ex.isVisible('[data-vista="revision"]')); i++) {
      await ex.locator('[data-vista="pregunta"]:not([hidden]) [data-opciones] input').first().check();
      await ex.click('[data-siguiente]');
    }
    await ex.click('[data-enviar]'); await ex.click('.dialogo-confirma [data-r="si"]');
    await ex.waitForSelector('[data-vista="resultado"]:not([hidden])');
    anota('examen', 'examen · resultado', await ex.evaluate(extrae));
    await ap.reload(); await ap.waitForSelector('[data-filas] tr');
    anota('aplicar', 'aplicar · tras un examen', await ap.evaluate(extrae));
    await c.close();
  }

  // Una comprobación por pantalla: sólo las formas decididas (el acuse, sólo en el acuse)
  for (const [pantalla, p] of [...porPantalla].sort()) {
    comprueba(!p.malas.length, t(`${pantalla} (${p.estados} ${p.estados === 1 ? 'estado' : 'estados'}): sólo las formas decididas (${[...p.formas].sort().join(', ') || 'sin fechas'})${p.malas.length ? ` · ${p.malas.length} fuera: ${[...new Set(p.malas)].slice(0, 4).join(' | ')}` : ''}`));
  }
  const acuse = porPantalla.get('cuenta (acuse)');
  comprueba(Boolean(acuse) && acuse.formas.has('acuse'), t('el acuse de «Crea tu cuenta» conserva la fecha larga del estándar (FormKit.utilidades.fechaHora, decisión 17 b)'));
  const todas = new Set([...porPantalla.values()].flatMap((p) => [...p.formas]));
  comprueba([...todas].every((f) => ['larga', 'largaHora', 'corta', 'cortaHora', 'acuse', 'grupo'].includes(f)) && ['larga', 'largaHora', 'corta', 'cortaHora'].every((f) => todas.has(f)),
    t(`en todo el sitio, sólo las dos formas decididas (con y sin hora), la del acuse y el nombre del grupo: ${[...todas].sort().join(', ')}`));
  const pantallas = [...porPantalla.keys()].filter((k) => !k.includes('(')).length;
  comprueba(pantallas === 21 && !errores.length, t(`${pantallas} pantallas recorridas, más el acuse, sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
}

/* ── Sistema visual (auditoría de seguimiento 2026-10-20, bloque 4; SOLO=visual) ──
   C6-02 con P164 (decisión 2): un solo botón principal (relleno guinda) por pantalla en «Grupos», «Programar», «Mis grupos
   de hoy» y «Mis trámites» con la poda por vencer, y ningún principal entre los destinos con «Ninguna elegida» (C2-01).
   C6-01: con colores forzados, lo elegido se distingue. C6-03: lo elegido con el tratamiento del estándar. C6-04
   (decisión 3 a): la espera de 10 días o más, «te toca actuar» en rojo con «N días · atrasada». C6-09 (decisión 4 a):
   «Asistencia» con la opción corta Sí/No del estándar. Decisión 5 b: el motivo de una opción deshabilitada va fuera de
   ella, a contraste normal. A6-02: los días del calendario delimitados a 3:1 o más. */
async function sistemaVisual(navegador) {
  const t = (m) => `[visual] ${m}`;
  const GUINDA = 'rgb(157, 33, 72)';
  const AZUL_CL = 'rgb(238, 243, 250)';
  const AZUL = 'rgb(26, 86, 168)';
  const nuevo = async (ancho, alto, { sesion, forzado = 'none', datosPropios } = {}) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, forcedColors: forzado });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    if (datosPropios) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(datosPropios), contentType: 'application/json' }));
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  // Controles visibles con relleno guinda (el aspecto del botón principal), sin «Ir al contenido»
  const guindas = (page) => page.evaluate((g) => [...document.querySelectorAll('a, button, label, summary, [role="button"]')].filter((e) => !e.matches('.salto')
    && e.checkVisibility() && e.getBoundingClientRect().width > 0 && getComputedStyle(e).backgroundColor === g).map((e) => e.textContent.replace(/\s+/g, ' ').trim()), GUINDA);
  const ult = (p, tipo) => datos.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === tipo).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en))[0];
  const porVencer = datos.solicitante.find((p) => p.estado === 'activa' && ult(p, 'poda') && datos.estado_acreditacion[ult(p, 'poda').numero] === 'por_vencer'
    && !datos.solicitud.some((s) => s.solicitante_id === p.id));

  // 1. Un principal por pantalla, en teléfono y en escritorio. La pantalla espera a lo que la página pinta.
  const VIERNES_9 = { ...datos, fecha_corte: '2026-10-09' };
  const PANTALLAS = [
    // «Grupos» paso a paso (24/10/2026): el principal es el de cada paso; los de la tabla de grupos son secundarios
    ['Grupos, paso 1', 'grupos.html', '#paso-curso:not([hidden])', null, 'Siguiente'],
    ['Grupos, paso 2 (renovación)', 'grupos.html?curso=poda-renovacion&paso=2', '#paso-semana:not([hidden]) .arm-dia-curso', null, 'Siguiente'],
    ['Grupos, paso 4', 'grupos.html?curso=poda-nueva&paso=4', '#paso-confirmar:not([hidden])', null, 'Crear el grupo'],
    // El quinto día de APD-G-2026-006 (viernes 9/10): desde la sesión del 23/10 el corte (miércoles) no es día de examen y
    // el instructor tiene un solo grupo hoy. «Aplicar el examen» con un solo grupo entra directo a él (sin «Mis grupos de
    // hoy»), así que ya no va en esta lista
    ['Mis grupos de hoy (asistencia)', 'asistencia.html', '.hoy-grupo', null, 'Pasar lista y aplicar', VIERNES_9],
    ['Mis trámites con la poda por vencer (P164)', 'tramites.html', '[data-acreditaciones] .ficha', porVencer.id, 'Renovar']
  ];
  for (const [ancho, alto] of [[390, 844], [1440, 900]]) {
    for (const [nombre, ruta, listo, sesion, principal, datosPropios] of PANTALLAS) {
      const { c, page, errores } = await nuevo(ancho, alto, { sesion, datosPropios });
      await page.goto(BASE + ruta);
      await page.waitForSelector(listo);
      const g = await guindas(page);
      const extra = ruta.startsWith('grupos') ? await page.evaluate(() => ({ destinos: document.querySelectorAll('[data-programados] .btn-primario').length })) : null;
      comprueba(g.length === 1 && g[0].startsWith(principal) && (!extra || extra.destinos === 0) && !errores.length,
        t(`C6-02: ${nombre} a ${ancho} px, un solo principal: «${g.join('», «')}»${extra ? `; ${extra.destinos} principales en la tabla de grupos (C2-01)` : ''}`));
      await c.close();
    }
  }
  // Con la poda por vencer, «Iniciar una solicitud» sigue a la vista, como secundario (P164)
  {
    const { c, page } = await nuevo(390, 844, { sesion: porVencer.id });
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-acreditaciones] .ficha');
    const iniciar = await page.getAttribute('[data-nueva] a', 'class');
    comprueba(await page.isVisible('[data-nueva] a') && /btn-secundario/.test(iniciar) && /btn-primario/.test(await page.getAttribute('[data-acreditaciones] a:has-text("Renovar")', 'class')),
      t('P164: con la poda por vencer, «Renovar» es el principal e «Iniciar una solicitud» queda como secundario'));
    await c.close();
  }

  // 2 y 3. Lo elegido: el tratamiento del estándar y, con colores forzados, distinto de lo no elegido
  const ELEGIDO = [
    // «Grupos» paso a paso (24/10/2026): el curso (opción del estándar), la persona (paso 3; la propuesta viene marcada: se
    // desmarca la primera) y la semana elegida en el calendario (noviembre)
    ['el curso de «Grupos»', 'grupos.html?curso=poda-nueva', '#paso-curso:not([hidden]) .opcion', null, '.arm-cursos .opcion:has(.opcion-input:checked)', '.arm-cursos .opcion:has(.opcion-input:not(:checked))'],
    ['la persona elegida', 'grupos.html?curso=poda-nueva&paso=3', '#paso-personas:not([hidden]) .plan-persona', (pg) => pg.locator('.plan-persona .casilla-input').first().evaluate((e) => e.click()), '.plan-persona:has(.casilla-input:checked)', '.plan-persona:not(:has(.casilla-input:checked))'],
    ['la semana elegida en el calendario', 'grupos.html?curso=poda-nueva&semana=2026-11-02&mes=2026-11&paso=2', '#paso-semana:not([hidden]) .arm-semana-elegir', null, '.arm-semana-elegir[aria-pressed="true"]', '.arm-semana-elegir[aria-pressed="false"]'],
    ['la respuesta de «¿Asistió?»', 'asistencia.html?folio=APD-G-2026-003', '.asistencia-fila', (pg) => marcar(pg, '.asistencia-fila input[value="no"]:enabled'), '.asistencia-fila .opcion:has(.opcion-input:checked)', '.asistencia-fila .opcion:has(.opcion-input:not(:checked):enabled)']
  ];
  const lee = (page, sel) => page.$eval(sel, (e) => { const cs = getComputedStyle(e); return { fondo: cs.backgroundColor, borde: cs.borderTopColor, todo: [cs.backgroundColor, cs.color, cs.borderTopColor, cs.borderTopWidth, `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, cs.boxShadow].join(' · ') }; });
  for (const forzado of ['none', 'active']) {
    for (const [nombre, ruta, listo, accion, elegido, otro] of ELEGIDO) {
      const { c, page, errores } = await nuevo(1440, 900, { forzado });
      await page.goto(BASE + ruta);
      await page.waitForSelector(listo);
      if (accion) await accion(page);
      await page.waitForFunction((s) => Boolean(document.querySelector(s)), elegido);
      // Las opciones del estándar cambian de color con una transición: se lee al terminar
      await page.evaluate(() => Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {}))));
      const [a, b] = [await lee(page, elegido), await lee(page, otro)];
      if (forzado === 'none') comprueba(a.fondo === AZUL_CL && a.borde === AZUL && !errores.length, t(`C6-03: ${nombre}, con fondo azul claro y borde azul, como lo elegido del estándar (${a.fondo}, ${a.borde})`));
      else comprueba(a.todo !== b.todo, t(`C6-01: con colores forzados se distingue ${nombre} (${a.todo} frente a ${b.todo})`));
      await c.close();
    }
  }

  // 4. Bandeja: una solicitud que espera 15 días lleva la etiqueta de «te toca actuar» en rojo, «15 días · atrasada»
  {
    const propios = JSON.parse(JSON.stringify(datos));
    const s = propios.solicitud.find((x) => x.estado === 'enviada');
    const hace = new Date(`${propios.fecha_corte}T12:00:00-06:00`);
    hace.setDate(hace.getDate() - 15);
    s.estado_desde = `${hace.toISOString().slice(0, 10)}T10:00:00-06:00`;
    const { c, page, errores } = await nuevo(1440, 900, { datosPropios: propios });
    await page.goto(BASE + 'revision.html');
    await page.waitForSelector(`[data-filas] tr[data-folio="${s.folio}"]`, { state: 'attached' });
    const e = await page.$eval(`[data-filas] tr[data-folio="${s.folio}"] .estado`, (x) => ({ texto: x.textContent.trim(), clase: x.className, icono: (x.querySelector('use') || { getAttribute: () => '' }).getAttribute('href'), fondo: getComputedStyle(x).backgroundColor, borde: getComputedStyle(x).borderTopColor }));
    const otras = await page.$$eval('[data-filas] .estado-rechazo', (l) => l.length);
    // Las que llevan 10 días o más en la bandeja: ésta y las de los ficticios que ya esperaban tanto (desde los ajustes del
    // equipo, 25/10/2026, la reenviada con su segunda corrección espera desde el 17/09)
    const diaMx = (iso) => new Date(`${new Date(iso.length === 10 ? `${iso}T12:00:00-06:00` : iso).toLocaleDateString('en-CA', { timeZone: ZONA })}T12:00:00Z`);
    const atrasadas = propios.solicitud.filter((x) => x.estado === 'enviada' && Math.round((diaMx(propios.fecha_corte) - diaMx(x.estado_desde)) / 864e5) >= 10).length;
    comprueba(e.texto === '15 días · atrasada' && /estado-atencion/.test(e.clase) && /alerta/.test(e.icono) && e.fondo === 'rgb(253, 243, 242)' && e.borde === 'rgb(179, 38, 30)' && !otras
      && new RegExp(`${atrasadas} con 10 días o más`).test(await page.textContent('[data-cuenta]')) && !errores.length,
      t(`C6-04: la espera de 15 días dice «${e.texto}», con la etiqueta de «te toca actuar» (${e.icono}) en rojo; ninguna con la de «cerrado sin éxito»`));
    await c.close();
  }

  // 5. «Asistencia»: «¿Asistió?» con la opción corta Sí/No del estándar; «No» elegido no se parece al botón de peligro
  for (const [ancho, alto] of [[390, 844], [1440, 900]]) {
    const { c, page, errores } = await nuevo(ancho, alto);
    await page.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
    await page.waitForSelector('.asistencia-fila');
    await marcar(page, '.asistencia-fila input[value="no"]:enabled');
    await page.evaluate(() => Promise.all(document.getAnimations().map((x) => x.finished.catch(() => {}))));
    const r = await page.$eval('.asistencia-fila', (f) => {
      const ops = [...f.querySelectorAll('.opciones-cortas > label.opcion.opcion-corta')];
      const no = f.querySelector('.opcion:has(.opcion-input:checked)');
      const a = ops[0].getBoundingClientRect(); const b = ops[1].getBoundingClientRect();
      return { textos: ops.map((o) => o.textContent.trim()), pregunta: f.querySelector('legend').textContent, fondo: getComputedStyle(no).backgroundColor, palomita: getComputedStyle(no.querySelector('.opcion-marca')).display, renglon: Math.abs(a.top - b.top) < 2 };
    });
    comprueba(r.textos.join('/') === 'Sí/No' && /¿Asistió\?$/.test(r.pregunta) && r.fondo === AZUL_CL && r.palomita !== 'none' && r.renglon && !errores.length,
      t(`C6-09: a ${ancho} px, «${r.pregunta}» con Sí/No del estándar en un renglón; «No» elegido en azul claro con palomita (${r.fondo}), no como el botón de peligro`));
    await c.close();
  }

  // 6. Decisión 5 b: la opción deshabilitada lleva su motivo fuera, como ayuda de la pregunta, a 4.5:1 o más, y la opción
  // la nombra en su descripción accesible
  {
    const p = datos.solicitante.find((x) => x.estado === 'activa' && ult(x, 'poda') && ['vencida_renovable', 'vencida_no_renovable'].includes(datos.estado_acreditacion[ult(x, 'poda').numero])
      && !datos.solicitud.some((s) => s.solicitante_id === x.id && !FINALES.includes(s.estado)));
    const { c, page, errores } = await nuevo(390, 844, { sesion: p.id });
    await page.goto(BASE + 'solicitud.html');
    await page.waitForSelector('[data-motivo-tipo]:not([hidden])');
    const r = await page.evaluate(() => {
      const ayuda = document.querySelector('[data-motivo-tipo]');
      const dis = document.querySelector('input[name="tipo"]:disabled');
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      let o = 1; for (let x = ayuda; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
      const col = getComputedStyle(ayuda).color.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => v * o + 255 * (1 - o));
      return { texto: ayuda.textContent, dentro: Boolean(ayuda.closest('label')), razon: 1.05 / (lum(col) + 0.05), describe: Boolean(dis) && (dis.getAttribute('aria-describedby') || '').split(' ').includes(ayuda.id) };
    });
    comprueba(/Dictaminador técnico: .*poda y derribo/.test(r.texto) && !r.dentro && r.razon >= 4.5 && r.describe && !errores.length,
      t(`decisión 5 b: «${r.texto.slice(0, 60)}…» fuera de la opción, a ${r.razon.toFixed(2)}:1, y en la descripción de la opción`));
    await c.close();
  }

  // 7. A6-02: lo que se elige en el calendario se delimita a 3:1 o más: el día disponible del curso de un día con el borde de
  // un control (--borde, no --linea) y la semana libre con el azul de lo tocable (paso 2 de «Grupos», 24/10/2026)
  {
    const { c, page } = await nuevo(1440, 900);
    await page.goto(BASE + 'grupos.html?curso=poda-renovacion&paso=2');
    await page.waitForSelector('#paso-semana:not([hidden]) .arm-dia-curso');
    const borde = await page.$eval('.arm-dia-curso[aria-pressed="false"]:not([aria-disabled])', (e) => getComputedStyle(e).borderTopColor);
    const semana = await page.$eval('.arm-semana-elegir[aria-pressed="false"]', (e) => getComputedStyle(e).borderTopColor);
    comprueba(borde === 'rgb(135, 139, 142)' && semana === AZUL, t(`A6-02: el día disponible del calendario tiene el borde de un control (${borde}, 3.43:1) y la semana libre, el azul de lo tocable (${semana})`));
    await c.close();
  }

  // 8. Decisión de Liber del 21/10 sobre C6-05 (opción a): «Vencida · puedes renovarla» en ámbar cuando se puede renovar y
  // «Vencida» en gris cuando no; el color dice algo distinto porque el texto también. «Verificar» dice «Vencida» con la
  // familia gris, y para el personal (menú de pruebas de «Crear cuenta») es «puede renovarla».
  {
    const sinTramite = (x) => !datos.solicitud.some((s) => s.solicitante_id === x.id && !FINALES.includes(s.estado));
    const sitPoda = (x) => ult(x, 'poda') && datos.estado_acreditacion[ult(x, 'poda').numero];
    const renovable = datos.solicitante.find((x) => x.estado === 'activa' && sitPoda(x) === 'vencida_renovable' && sinTramite(x));
    const enTramite = datos.solicitante.find((x) => x.estado === 'activa' && sitPoda(x) === 'vencida_renovable' && !sinTramite(x));
    const noRenovable = datos.solicitante.find((x) => x.estado === 'activa' && sitPoda(x) === 'vencida_no_renovable');
    const etiquetas = [];
    for (const p of [renovable, enTramite, noRenovable].filter(Boolean)) {
      const { c, page, errores } = await nuevo(390, 844, { sesion: p.id });
      await page.goto(BASE + 'tramites.html');
      await page.waitForSelector('[data-acreditaciones] .ficha');
      const f = page.locator('[data-acreditaciones] .ficha', { has: page.locator('.ficha-titulo', { hasText: 'Poda y derribo' }) }).first();
      etiquetas.push({ texto: (await f.locator('.estado').textContent()).trim(), clase: await f.locator('.estado').getAttribute('class'),
        icono: await f.locator('.estado use').getAttribute('href'), renovar: await f.locator('a:has-text("Renovar")').count(), errores: errores.length });
      await c.close();
    }
    const [a, b, n] = [etiquetas[0], enTramite ? etiquetas[1] : null, etiquetas[enTramite ? 2 : 1]];
    comprueba(a.texto === 'Vencida · puedes renovarla' && /estado-atencion/.test(a.clase) && a.icono === '#i-alerta' && a.renovar === 1
      && n.texto === 'Vencida' && /estado-terminado/.test(n.clase) && n.icono === '#i-archivo' && !n.renovar
      && (!b || (b.texto === 'Vencida' && /estado-terminado/.test(b.clase) && !b.renovar)) && etiquetas.every((x) => !x.errores),
      t(`decisión del 21/10 (C6-05 a): «Mis trámites» dice «${a.texto}» en ámbar con «Renovar», y «${n.texto}» en gris cuando no se puede renovar${b ? ` (también con la renovación ya en trámite: «${b.texto}»)` : ''}`));
    const { c, page, errores } = await nuevo(390, 844);
    await page.goto(BASE + 'verificar.html');
    await page.fill('#numero', noVigente.numero);
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-verificacion]:not([hidden])');
    const v = await page.$eval('[data-verificacion]', (x) => { const s = x.querySelector('.verificacion-situacion'); return { tono: x.dataset.tono, texto: s.textContent.trim(), icono: s.querySelector('use').getAttribute('href'), color: getComputedStyle(s).color, borde: getComputedStyle(x).borderTopColor }; });
    comprueba(v.tono === 'terminado' && v.texto === 'Vencida' && v.icono === '#i-archivo' && v.color === 'rgb(43, 45, 46)' && v.borde === 'rgb(135, 139, 142)' && !errores.length,
      t(`decisión del 21/10: «Verificar» dice «${v.texto}» con la familia gris de «Mis trámites» (${v.icono}, texto ${v.color}, borde ${v.borde}), no en rojo`));
    await page.goto(BASE + 'cuenta.html');
    await page.click('.menu-pruebas-boton');
    const ops = await page.$$eval('#menu-pruebas-migrada option', (l) => l.map((o) => o.textContent));
    comprueba(ops.some((o) => /vencida · puede renovarla/.test(o)) && !ops.some((o) => /no vigente|puedes/.test(o)),
      t(`decisión del 21/10: para el personal, «puede renovarla» (menú de pruebas: «${(ops.find((o) => /vencida/.test(o)) || '').replace(/^[^—]+— /, '')}»)`));
    await c.close();
  }

  // 9. Decisión de Liber del 21/10 sobre C6-10 (opción c), con el calendario del paso a paso (24/10/2026): en teléfono el
  // calendario es una lista de semanas sin notas en los días (cada semana dice sus fechas) y la semana elegida dice cuándo
  // empieza y cuándo es el examen (fecha larga, sin hora); en escritorio las notas de los días se quedan, a 12 px o más y
  // completas. Ningún texto de «Grupos» a menos de 12 px.
  for (const [ancho, alto, curso] of [[320, 700, 'poda-nueva'], [390, 844, 'poda-nueva'], [390, 844, 'poda-renovacion'], [1440, 900, 'poda-nueva'], [1440, 900, 'poda-renovacion']]) {
    const { c, page, errores } = await nuevo(ancho, alto);
    await page.goto(BASE + `grupos.html?curso=${curso}&paso=2`);
    await page.waitForSelector('#paso-semana:not([hidden]) .arm-semana[data-elegida]');
    const r = await page.evaluate(() => {
      const visibles = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.textContent && e.checkVisibility() && e.getBoundingClientRect().width > 1);
      const chicos = [...document.querySelectorAll('main *')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().width > 1 && [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12);
      return { notas: visibles('.arm-marca').map((e) => ({ t: e.textContent, tam: parseFloat(getComputedStyle(e).fontSize), cabe: e.scrollWidth <= e.clientWidth })),
        fechas: visibles('.arm-semana-fechas').length, linea: document.querySelector('[data-elegida-horario]').textContent,
        lector: document.querySelector('.arm-semana[data-elegida] .arm-semana-elegir').getAttribute('aria-label'),
        chicos: chicos.map((e) => `${e.className} ${getComputedStyle(e).fontSize}`) };
    });
    const telefono = ancho < 760;
    const corto = curso.endsWith('renovacion');
    const linea = corto ? /^El \S+ \d+ de \S+ de \d{4}, de 9:00 a 15:00, con el examen ese mismo día en el PILARES\.$/
      : /^Del \S+ \d+ de \S+ de \d{4} al \S+ \d+ de \S+ de \d{4}, de 9:00 a 15:00\. El viernes, repaso de conocimientos y examen final en el PILARES\.$/;
    comprueba((telefono ? !r.notas.length && r.fechas >= 4 : r.notas.length >= (corto ? 1 : 2) && r.notas.every((x) => x.tam >= 12 && x.cabe) && !r.fechas)
      && linea.test(r.linea) && /^Semana elegida del /.test(r.lector) && !r.chicos.length && !errores.length,
    t(`decisión del 21/10 (C6-10 c): «Grupos» (${curso}) a ${ancho} px, ${telefono ? `lista de ${r.fechas} semanas sin notas en los días` : `notas ${r.notas.map((x) => `«${x.t}» ${x.tam} px${x.cabe ? '' : ' cortada'}`).join(', ')}`} y «${r.linea}»; texto a menos de 12 px: ${r.chicos.join(', ') || 'ninguno'}`));
    await c.close();
  }

  // 10. Decisión de Liber del 21/10: en «Asistencia», el botón que marca «Sí» a todas se llama «Todas asistieron»
  {
    const { c, page } = await nuevo(390, 844);
    await page.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
    await page.waitForSelector('.asistencia-fila');
    const texto = (await page.textContent('[data-todas]')).trim();
    comprueba(texto === 'Todas asistieron', t(`decisión del 21/10: el botón de «Asistencia» dice «${texto}»`));
    await c.close();
  }
}

// D4-01 (auditoría 2026-10-20; decisión 15 b): el archivo de datos que carga cada pantalla no trae la bitácora (ninguna
// pantalla la lee: va aparte, en datos/bitacora-ficticia.json, y no se copia al sitio), se pide con la versión de la página
// (?v=, la de <meta name="sia-version">) y, dentro de la misma versión, la pantalla siguiente no lo vuelve a descargar:
// lo toma de la caché del navegador o lo revalida (304, sólo encabezados). Lo registrado en el navegador de prueba se
// sigue sumando: la persona que entra ve su sesión y sus trámites en la segunda pantalla.
async function pesoDatos(navegador) {
  const t = (m) => `[peso] ${m}`;
  const archivo = join(raiz, 'sitio/datos/ficticios.json');
  const enSitio = JSON.parse(readFileSync(archivo, 'utf8'));
  const tablas = Object.keys(enSitio).filter((k) => Array.isArray(enSitio[k]));
  const kb = Math.round(statSync(archivo).size / 1024);
  comprueba(!('bitacora' in enSitio) && tablas.length >= 18 && ['solicitud', 'cita', 'documento', 'grupo'].every((k) => tablas.includes(k)),
    t(`D4-01: el archivo de datos del sitio no trae la bitácora (${tablas.length} tablas, ${kb} KB)`));
  const aparte = join(raiz, 'datos/bitacora-ficticia.json');
  const bit = existsSync(aparte) ? JSON.parse(readFileSync(aparte, 'utf8')).bitacora : null;
  comprueba(Array.isArray(bit) && bit.length > 0 && !existsSync(join(raiz, 'sitio/datos/bitacora-ficticia.json')),
    t(`D4-01: la bitácora va aparte (datos/bitacora-ficticia.json, ${bit ? bit.length : 0} renglones) y no se copia al sitio`));
  const usan = readdirSync(join(raiz, 'sitio/app')).filter((f) => f.endsWith('.js') && /bitacora/.test(readFileSync(join(raiz, 'sitio/app', f), 'utf8')));
  comprueba(!usan.length, t(`D4-01: ninguna pantalla lee la bitácora${usan.length ? ': ' + usan.join(', ') : ''}`));

  // Sin la ruta de herramientas/sin-google.mjs, que apagaría la caché que aquí se mide; Google se bloquea abajo (P68)
  const c = await navegador.newContextConCache({ timezoneId: ZONA, viewport: { width: 390, height: 844 } });
  await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, CON_ORG.id);
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(String(e)));
  const cdp = await c.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: GOOGLE_BLOQUEO });
  let pedidas = new Map();
  const deDatos = (u) => /\/datos\/ficticios\.json/.test(u);
  cdp.on('Network.requestWillBeSent', (e) => { if (deDatos(e.request.url)) pedidas.set(e.requestId, { url: e.request.url, estado: 0, cache: false, bytes: 0 }); });
  cdp.on('Network.requestServedFromCache', (e) => { const p = pedidas.get(e.requestId); if (p) p.cache = true; });
  cdp.on('Network.responseReceived', (e) => { const p = pedidas.get(e.requestId); if (p) { p.estado = e.response.status; p.cache = p.cache || Boolean(e.response.fromDiskCache || e.response.fromMemoryCache); } });
  cdp.on('Network.loadingFinished', (e) => { const p = pedidas.get(e.requestId); if (p) { p.bytes = e.encodedDataLength; p.fin = true; } });
  const visita = async (ruta, listo) => {
    pedidas = new Map();
    await pg.goto(BASE + ruta);
    await pg.waitForSelector(listo);
    await pg.waitForFunction(() => document.readyState === 'complete');
    // Que la petición de los datos haya terminado (la página ya pintó con ellos; el aviso de la red llega después)
    for (let i = 0; i < 50 && [...pedidas.values()].some((p) => !p.fin); i++) await pg.waitForTimeout(100);
    return [...pedidas.values()];
  };
  const version = async () => pg.evaluate(() => (document.querySelector('meta[name="sia-version"]') || {}).content || '');
  const primera = await visita('tramites.html', '[data-sesion]:not(:empty)');
  const v = await version();
  const describe = (l) => l.map((p) => `${p.url.replace(BASE, '')} ${p.cache ? 'de la caché' : `${p.estado}, ${(p.bytes / 1024).toFixed(1)} KB`}`).join('; ') || 'ninguna';
  comprueba(v && primera.length === 1 && new URL(primera[0].url).search === `?v=${encodeURIComponent(v)}` && primera[0].estado === 200 && primera[0].bytes > 100 * 1024,
    t(`D4-01: la primera pantalla pide los datos con la versión de la página (${v}): ${describe(primera)}`));
  // La pantalla siguiente (y la misma otra vez), de la misma versión: de la caché o revalidado (304), sin el cuerpo
  for (const ruta of ['datos.html', 'tramites.html']) {
    const otra = await visita(ruta, '[data-sesion]:not(:empty)');
    const sinCuerpo = otra.length <= 1 && otra.every((p) => p.cache || p.estado === 304 || p.bytes < 4096);
    comprueba(sinCuerpo && otra.every((p) => p.url === primera[0].url), t(`D4-01: ${ruta} (misma versión) no vuelve a descargar los datos: ${describe(otra)}`));
  }
  // Lo de este navegador se sigue sumando con los datos de la caché: la sesión y el nombre de la persona
  const nombre = await pg.textContent('[data-sesion]');
  comprueba(nombre.includes(CON_ORG.nombre) && !errores.length, t(`D4-01: con los datos de la caché, «Mis trámites» sigue con la sesión de ${CON_ORG.nombre}${errores.length ? '; errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
  await c.close();
}

/* ── Decisiones de la sesión de trabajo del 23/10/2026, parte A (SOLO=sesion23) ──
   Cada bloque prueba una decisión de Liber del 23/10/2026 (docs/DECISIONES.md), en teléfono y en escritorio cuando la
   pantalla cambia entre los dos. */
async function sesion23(navegador) {
  const t = (m) => `[sesión 23/10] ${m}`;
  // Cada bloque sigue aunque otro se detenga: un error se cuenta como falla de ese bloque y se pasa al siguiente
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };

  // Error 7: en «Revisar» → «Resultado de la revisión» el calendario no dejaba elegir la fecha de la cita. El calendario
  // del navegador, al elegir un día, manda primero «input» y después «change»; el acomodo de fechas pegadas (app/apd.js)
  // tomaba ese «input» del <input type="date"> oculto, le escribía «dd/mm/aaaa» (que un campo de fecha no admite), el
  // valor quedaba vacío y el «change» ya no llegaba. Se elige como lo hace el navegador (input y change), con el ratón y
  // con el teclado (Enter en el botón), en teléfono y en escritorio; también en la ficha del grupo y en el cotejo.
  const eligeEnCalendario = (page, campo, iso) => page.locator(`[data-campo="${campo}"] .control-calendario-nativo`).evaluate((n, v) => {
    n.value = v;
    n.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  }, iso);
  const enviada = datos.solicitud.find((s) => s.estado === 'enviada' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && !datos.revision.some((r) => r.solicitud_id === s.id));
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
    for (const modo of ['ratón', 'teclado']) {
      const { c, page, errores } = await nuevo(ancho, alto);
      await page.goto(BASE + `revisar.html?folio=${enviada.folio}`);
      await page.waitForSelector('#formulario:not([hidden])');
      await aceptaTodos(page); // por pasos (24/10/2026): la fecha es el paso «Fecha de la cita»
      await page.waitForSelector('[data-calendario="cita_fecha"]', { state: 'visible' });
      if (modo === 'ratón') await page.click('[data-calendario="cita_fecha"]');
      else { await page.focus('[data-calendario="cita_fecha"]'); await page.keyboard.press('Enter'); }
      const min = await page.getAttribute('[data-campo="cita_fecha"]', 'data-min');
      // Un día hábil (de lunes a viernes) dentro del rango
      let dia = min;
      while ([0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) dia = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      await eligeEnCalendario(page, 'cita_fecha', dia);
      comprueba(await page.inputValue('#cita_fecha') === dma(dia) && !errores.length,
        t(`error 7: ${donde}, ${modo}: el día elegido en el calendario de «Fecha de la cita» de la revisión queda escrito (${await page.inputValue('#cita_fecha') || 'vacío'})`));
      await c.close();
    }
  }

  // Nuevo 6: al corregir documentos, la confirmación es la de una corrección. a) Reenviar con lo corregido (solicitud
  // con observaciones): «Recibimos la corrección de tus documentos», con «Corrección recibida el» y los pasos de una
  // corrección; una solicitud nueva sigue diciendo «Recibimos tu solicitud». b) El documento correcto de una cita en
  // pausa (corregir.html): el mismo título y, como pasos, regresar con quien atiende, que revisa lo corregido.
  await bloque('nuevo 6 a', async () => {
    const obsS = datos.solicitud.find((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda');
    const { c, page, errores } = await nuevo(390, 844, obsS.solicitante_id);
    await page.goto(BASE + `solicitud.html?folio=${obsS.folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    for (const campo of await page.$$eval('[data-campo^="doc_"].doc-observado', (l) => l.map((x) => x.dataset.campo))) {
      await page.setInputFiles(`[data-campo="${campo}"] [data-archivos] > input[type="file"]`, PDF);
      await page.waitForSelector(`[data-campo="${campo}"] .lista-arch li[data-estado="listo"]`);
    }
    await siguiente(page);
    await marcaCasillas(page);
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-acuse]:not([hidden])');
    const acuse = await page.textContent('[data-acuse]');
    comprueba(/Recibimos la corrección de tus documentos/.test(acuse) && !/Recibimos tu solicitud/.test(acuse) && /Corrección recibida el/.test(acuse)
      && /revisa los documentos que corregiste/.test(acuse) && acuse.includes(obsS.folio) && !errores.length,
      t(`nuevo 6: al reenviar ${obsS.folio} con lo corregido, «Recibimos la corrección de tus documentos» y los pasos de una corrección`));
    const html = await page.evaluate(() => fetch('solicitud.html').then((r) => r.text()));
    comprueba(/<h2 class="titulo-paso" tabindex="-1">Recibimos tu solicitud<\/h2>/.test(html), t('nuevo 6: una solicitud nueva sigue diciendo «Recibimos tu solicitud»'));
    await c.close();
  });
  await bloque('nuevo 6 b', async () => {
    const cp = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
    const sp = datos.solicitud.find((x) => x.id === cp.solicitud_id);
    const { c, page, errores } = await nuevo(1280, 900, sp.solicitante_id);
    await page.goto(BASE + `corregir.html?folio=${sp.folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    for (const campo of await page.$$('#formulario [data-campo^="doc_"]')) if (await campo.isVisible()) await (await campo.$('input[type="file"]')).setInputFiles(PDF);
    await page.waitForSelector('#formulario .lista-arch li[data-estado="listo"]');
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    const hecho = await page.textContent('[data-hecho]:not(.pasos-btn)');
    comprueba(/Recibimos la corrección de tus documentos/.test(hecho) && /revisa lo que corregiste/.test(hecho) && !/Listo: ya cargaste/.test(hecho) && !errores.length,
      t(`nuevo 6: en la cita en pausa de ${sp.folio}, «Recibimos la corrección de tus documentos» y que quien atiende revisa lo corregido`));
    await c.close();
  });

  // Persona con sesión y su página, para las pruebas de abajo
  const conSesion = async (persona, url, ancho = 390, alto = 844) => {
    const r = await nuevo(ancho, alto, persona.id);
    await r.page.goto(BASE + url);
    return r;
  };
  const activa = (pred) => datos.solicitante.find((p) => p.estado === 'activa' && pred(p));
  const podasDe = (p) => datos.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === 'poda');
  const tieneSol = (p, tipo) => datos.solicitud.some((x) => x.solicitante_id === p.id && (!tipo || x.tipo_acreditacion === tipo));

  // Nuevos 4 y 5 (P196): «Constancia de situación fiscal» de la persona solicitante, reciente («del mes en curso»,
  // provisional y marcado pendiente sólo para el personal), y de ella se toman nombre, régimen y domicilio fiscal. En la
  // solicitud, el inicio, la revisión y el cotejo. P03: el comprobante de domicilio se pide, sin marca de provisional.
  await bloque('nuevos 4 y 5', async () => {
    const html = await (await fetch(BASE + 'solicitud.html')).text();
    const ayuda = (html.match(/id="ay-doc_poda_nueva_constancia_situacion_fiscal">([^<]*)</) || [])[1] || '';
    const domicilio = (html.match(/id="ay-doc_poda_nueva_comprobante_domicilio">([^<]*)</) || [])[1] || '';
    comprueba(/Constancia de situación fiscal<\/span>/.test(html) && /^Tuya, como persona solicitante, emitida en el mes en curso\. De ella se toman tu nombre, tu régimen y tu domicilio fiscal para la factura del pago\.$/.test(ayuda)
      && !/pendiente/i.test(ayuda) && domicilio && !/pendiente|dejar|provisional/i.test(domicilio),
      t(`nuevos 4 y 5 (P196) y P03: la ayuda de la constancia («${ayuda}») y la del comprobante de domicilio, sin marcas`));
    for (const [pagina, sel] of [['revisar.html', '[data-doc="constancia_situacion_fiscal"]'], ['cotejo.html', '[data-doc="constancia_situacion_fiscal"]']]) {
      const h = await (await fetch(BASE + pagina)).text();
      const bloque = h.slice(h.indexOf(sel.slice(1, -1)), h.indexOf(sel.slice(1, -1)) + 1500);
      comprueba(/Constancia de situación fiscal<\/h[234]>/.test(bloque) && /de la persona solicitante y reciente: del mes en curso <span class="pendiente">\[pendiente P196/.test(bloque) && /nombre, su régimen y su domicilio fiscal/.test(bloque),
        t(`nuevos 4 y 5: en ${pagina}, la constancia dice al personal que es de la persona solicitante, del mes en curso (pendiente P196) y qué se toma de ella`));
    }
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + 'index.html');
    await page.waitForSelector('[data-requisitos] details');
    const req = await page.textContent('[data-requisitos]');
    comprueba(/Constancia de situación fiscal\. Tuya, como persona solicitante/.test(req) && !/\[pendiente/.test(req) && /Comprobante de domicilio\. De luz/.test(req) && !errores.length,
      t('nuevos 4 y 5 y P03: el inicio lista la constancia de la persona solicitante y el comprobante de domicilio, sin marcas'));
    await c.close();
  });

  // Nuevo 2: en la solicitud de poda no se pregunta la situación de la licenciatura; en la de dictaminador sí
  await bloque('nuevo 2', async () => {
    const dos = activa((p) => podasDe(p).some((a) => a.emitida_en === '2024-06-01'));
    // Para poda, una persona nueva que crea su cuenta aquí
    const NUEVO = { nombre: 'Rodrigo', primer_apellido: 'Ejemplo', segundo_apellido: 'Podador', nacimiento: '1990-03-12' };
    NUEVO.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: NUEVO.nombre, primer: NUEVO.primer_apellido, segundo: NUEVO.segundo_apellido }, NUEVO.nacimiento, 'H', 'NE') + '0');
    for (const [persona, tipo, debe] of [[null, 'poda', false], [dos, 'dictaminador', true]]) {
      const { c, page, errores } = persona ? await conSesion(persona, `solicitud.html?tipo=${tipo}`) : await nuevo(390, 844);
      if (!persona) {
        await page.goto(BASE + 'cuenta.html');
        await llenaCuenta(page, NUEVO);
        await pulsaEnviar(page);
        await page.waitForSelector('[data-acuse]:not([hidden])');
        await page.goto(BASE + `solicitud.html?tipo=${tipo}`);
      }
      await page.waitForSelector('#formulario:not([hidden])');
      await page.waitForFunction((t) => document.getElementById('tramite').value === `${t}_nueva`, tipo);
      await page.selectOption('#nivel_estudios', 'licenciatura');
      await page.waitForSelector('[data-campo="carrera"]', { state: 'visible' });
      const ve = await page.isVisible('[data-campo="estatus_estudios"]');
      comprueba(ve === debe && (await page.inputValue('#pedir_situacion')) === (debe ? 'si' : 'no') && !errores.length,
        t(`nuevo 2: en ${tipo}, con licenciatura, ${debe ? 'sí' : 'no'} se pregunta «¿En qué situación está tu licenciatura?»`));
      await c.close();
    }
  });

  // Nuevo 3: dictaminador por primera vez, con la poda al menos 2 años consecutivos. Con 2 años, puede; con menos (las del
  // grupo de septiembre de 2026), no; con un corte (renovó fuera de la ventana), la cuenta empieza otra vez y tampoco. Lo
  // dicen la solicitud, «Mis trámites» y el inicio; el menú de pruebas trae un caso de cada uno.
  await bloque('nuevo 3', async () => {
    const dos = activa((p) => podasDe(p).some((a) => a.emitida_en === '2024-06-01'));
    const menos = activa((p) => podasDe(p).length === 1 && podasDe(p)[0].emitida_en === '2026-09-15' && !tieneSol(p, 'dictaminador'));
    const corte = activa((p) => podasDe(p).some((a) => a.emitida_en === '2023-03-06'));
    for (const [persona, puede, texto] of [[dos, true, null], [menos, false, /dos años consecutivos\. Tienes la tuya sin interrupción desde el 15\/09\/2026: podrás solicitarla a partir del 15\/09\/2028/],
      [corte, false, /sin interrupción desde el 05\/05\/2025: podrás solicitarla a partir del 05\/05\/2027/]]) {
      const { c, page, errores } = await conSesion(persona, 'solicitud.html');
      await page.waitForSelector('#formulario:not([hidden]), [data-sin-opciones]:not([hidden])');
      // Sin nada que pedir, el formulario no se muestra (sólo los motivos)
      const habilitada = await page.isVisible('#formulario') && await page.isEnabled('input[name="tipo"][value="dictaminador"]').catch(() => false);
      const motivo = (await page.textContent('[data-motivo-tipo]').catch(() => '')) + (await page.textContent('[data-sin-opciones-motivos]').catch(() => ''));
      comprueba(habilitada === puede && (puede || texto.test(motivo)) && !errores.length,
        t(`nuevo 3: ${persona.nombre} ${persona.primer_apellido}, ${puede ? 'con la poda desde 2024 sin corte, puede pedir dictaminador' : `no puede pedir dictaminador: «${motivo.trim().slice(0, 150)}»${errores.length ? ` errores: ${errores.join(" | ").slice(0, 300)}` : ""}`}`));
      if (!puede) {
        await page.goto(BASE + 'tramites.html');
        await page.waitForSelector('[data-acreditaciones] .aviso');
        comprueba(texto.test(await page.textContent('[data-acreditaciones] .aviso')), t('nuevo 3: «Mis trámites» dice desde cuándo podrá pedir la de dictaminador'));
      }
      await c.close();
    }
    const casos = globalThis.APD_CASOS_PRUEBA;
    comprueba(['dict-puede', 'dict-menos-dos', 'dict-corte'].every((k) => casos.claves().includes(k)), t('nuevo 3: el menú de pruebas trae los casos «con 2 años», «con menos» y «con un corte»'));
    const { c, page } = await nuevo(1280, 900);
    await page.goto(BASE + 'index.html');
    await page.waitForSelector('[data-requisitos] details');
    comprueba(/de poda y derribo durante al menos 2 años consecutivos, y vigente/.test(await page.textContent('#t-renovar + p, .seccion')) || /durante al menos 2 años consecutivos/.test(await page.textContent('main')),
      t('nuevo 3: el inicio lo explica antes de empezar'));
    await c.close();
  });

  // P138: 18 años cumplidos a la fecha de la solicitud, para las dos acreditaciones. Una persona nacida en 2010 crea su
  // cuenta (la CURP es válida), pero no puede solicitar: la solicitud se lo dice, con el día en que los cumple.
  await bloque('P138', async () => {
    const MENOR = { nombre: 'Noemí', primer_apellido: 'Ejemplo', segundo_apellido: 'Menor', nacimiento: '2010-05-05' };
    MENOR.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: MENOR.nombre, primer: MENOR.primer_apellido, segundo: MENOR.segundo_apellido }, MENOR.nacimiento, 'M', 'NE') + 'A');
    const { c, page, errores } = await nuevo(390, 844);
    await page.goto(BASE + 'cuenta.html');
    await llenaCuenta(page, MENOR);
    await pulsaEnviar(page);
    await page.waitForSelector('[data-acuse]:not([hidden])');
    await page.goto(BASE + 'solicitud.html');
    await page.waitForSelector('[data-sin-opciones]:not([hidden])');
    const motivos = await page.textContent('[data-sin-opciones-motivos]');
    comprueba(/18 años cumplidos para solicitar una acreditación\. Según tu CURP, los cumples el 05\/05\/2028/.test(motivos) && /Poda y derribo/.test(motivos) && /Dictaminador técnico/.test(motivos) && !errores.length,
      t(`P138: con 16 años no se solicita ninguna de las dos («${motivos.trim().slice(0, 120)}…»)`));
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-solicitudes] .vacio');
    comprueba(/los cumples el 05\/05\/2028/.test(await page.textContent('[data-solicitudes] .vacio')), t('P138: «Mis trámites» dice desde cuándo podrá solicitar'));
    await c.close();
  });

  // Nuevo 1: la Universidad Autónoma Chapingo en las instituciones educativas (catálogo, «Crea tu cuenta» y «Mi perfil»)
  await bloque('Chapingo', async () => {
    const { c, page, errores } = await nuevo(390, 844);
    await page.goto(BASE + 'cuenta.html');
    // La adscripción está en el paso «¿Cómo te avisamos?» (24/10/2026)
    for (const [id, v] of [['nombre', NUEVA.nombre], ['primer_apellido', NUEVA.primer_apellido], ['segundo_apellido', NUEVA.segundo_apellido], ['curp', NUEVA.curp]]) await page.fill(`#${id}`, v);
    await sigPaso(page);
    await page.check('input[name="adscrito"][value="si"]', { force: true });
    await page.check('input[name="tipo_adscripcion"][value="educativa"]', { force: true });
    await page.waitForSelector('input[name="institucion_educativa"][value="chapingo"]', { state: 'attached' });
    const etiqueta = await page.textContent('label:has(input[name="institucion_educativa"][value="chapingo"])');
    const mapea = await page.evaluate(() => APD.cargar().then((d) => { const a = APD.adscripcionDe(d, { adscrito: 'si', tipo_adscripcion: 'educativa', institucion_educativa: 'chapingo' }); const o = d.organizacion.find((x) => x.id === a.organizacion_id); return o ? `${o.tipo}:${o.nombre}` : ''; }));
    const html = await (await fetch(BASE + 'datos.html')).text();
    comprueba(/Universidad Autónoma Chapingo/.test(etiqueta) && mapea === 'educativa:Universidad Autónoma Chapingo' && /value="chapingo"/.test(html) && !errores.length,
      t(`nuevo 1: «Crea tu cuenta» y «Mi perfil» ofrecen la Universidad Autónoma Chapingo, del catálogo (${mapea})`));
    await c.close();
  });

  // Horarios (P69, P91, P132): citas de cotejo de 9:30 a 14:30 en la revisión y en el cotejo; el curso de 9:00 a 15:00 (la
  // entrada del grupo y la salida que ve la persona); informes de 9:00 a 15:00 donde se menciona el contacto.
  await bloque('horarios', async () => {
    for (const pagina of ['revisar.html', 'cotejo.html']) {
      const h = await (await fetch(BASE + pagina)).text();
      const horas = [...h.slice(h.indexOf('id="cita_hora"')).split('</select>')[0].matchAll(/<option value="(\d\d:\d\d)">/g)].map((m) => m[1]);
      comprueba(horas.join(' ') === '09:30 10:00 10:30 11:00 11:30 12:00 12:30 13:00 13:30 14:00 14:30' && /de lunes a viernes/.test(h),
        t(`P69: en ${pagina} la hora de la cita va de 09:30 a 14:30 (${horas[0]}–${horas[horas.length - 1]}) y la fecha dice «de lunes a viernes»`));
    }
    for (const pagina of ['grupo.html', 'grupos.html']) {
      const h = await (await fetch(BASE + pagina)).text();
      // La hora del curso es fija (decisión de Liber del 24/10/2026): ningún menú para elegirla
      comprueba(!/id="hora_entrada"/.test(h), t(`P91: en ${pagina} no hay menú de hora de entrada (el curso es de 9:00 a 15:00)`));
    }
    const ins = datos.solicitud.find((x) => x.estado === 'inscrita' && datos.inscripcion.some((i) => i.solicitud_id === x.id && i.activa && (datos.grupo.find((g) => g.id === i.grupo_id) || {}).folio === 'APD-G-2026-003'));
    const persona = datos.solicitante.find((p) => p.id === ins.solicitante_id);
    const { c, page, errores } = await conSesion(persona, 'tramites.html');
    await page.waitForSelector('[data-solicitudes] .ficha-cita');
    const caja = await page.textContent('[data-solicitudes] .ficha-cita');
    comprueba(/De 09:00 a 15:00, todos los días del curso/.test(caja) && /Día 5: repaso de conocimientos y examen final/.test(caja) && !errores.length,
      t('P91 y quinto día: «Mis trámites» dice el horario del curso (de 09:00 a 15:00) y que el día 5 es de repaso de conocimientos y examen final'));
    await c.close();
    const perfil = await (await fetch(BASE + 'datos.html')).text();
    comprueba(/Informes en la Secretaría: de lunes a viernes, de 9:00 a 15:00/.test(perfil) && /P132/.test(perfil), t('P132: «Mi perfil» da el horario de informes (9:00 a 15:00) y el teléfono y el correo siguen pendientes'));
  });

  // P150 y P151: sábados y domingos inhábiles. En la revisión, un sábado como fecha de la cita se dice junto al campo y no
  // se guarda; en «Grupos» (paso 2), el de 5 días se elige por semana (empieza en lunes) y el de un día, de lunes a viernes.
  await bloque('P150 y P151', async () => {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + `revisar.html?folio=${enviada.folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    await aceptaTodos(page);
    await page.waitForSelector('#cita_fecha', { state: 'visible' });
    await page.fill('#cita_fecha', '17/10/2026');
    await page.selectOption('#cita_hora', '10:00');
    await page.click('[data-accion="enviar"]');
    await page.waitForFunction(() => /lunes a viernes/.test((document.querySelector('[data-campo="cita_fecha"] .err') || {}).textContent || ''));
    comprueba(await page.isHidden('[data-hecho]:not(.pasos-btn)') && !errores.length, t('P150: el sábado 17/10/2026 como fecha de la cita se rechaza: «Las citas de cotejo son de lunes a viernes»'));
    await c.close();
    for (const [curso, ok] of [['poda-nueva', (d) => d === 1], ['poda-renovacion', (d) => d >= 1 && d <= 5]]) {
      const r = await nuevo(1280, 900);
      await r.page.goto(BASE + `grupos.html?curso=${curso}&paso=2`);
      await r.page.waitForSelector('#paso-semana:not([hidden]) .arm-semana-elegir');
      // Los días en que puede empezar el curso: el lunes de cada semana libre (5 días) o los días de la semana elegida (1 día)
      const dias = curso === 'poda-nueva' ? await r.page.$$eval('.arm-semana-elegir', (l) => l.map((b) => ({ d: b.dataset.lunes, no: '' })))
        : await r.page.$$eval('.arm-dia-curso', (l) => l.map((b) => ({ d: b.dataset.fecha, no: b.getAttribute('aria-disabled') ? 'no' : '' })));
      // Y la regla de la base que lo decide (APD_PERSONAL.razonNoInicio): un sábado o un martes para el de cinco días, no
      const regla = await r.page.evaluate((k) => APD.cargar().then((d) => ['2026-11-07', '2026-11-10'].map((f) => (APD_PERSONAL.razonNoInicio(d, ...APD_PERSONAL.deClave(k), f) || {}).clave || '')), curso);
      const malos = dias.filter((x) => !ok(new Date(`${x.d}T12:00:00Z`).getUTCDay()));
      comprueba(!malos.length && dias.some((x) => !x.no) && regla[0] === 'fin_de_semana' && (curso === 'poda-nueva' ? regla[1] === 'fin_de_semana' : regla[1] === '') && !r.errores.length,
        t(`P151: en «Grupos» ${curso} sólo ${curso === 'poda-nueva' ? 'los lunes' : 'de lunes a viernes'} se puede empezar (${regla.join(', ')})${malos.length ? `; no cumplen: ${malos.slice(0, 3).map((x) => x.d).join(', ')}` : ''}`));
      await r.c.close();
    }
    comprueba(datos.grupo.filter((g) => g.fecha_inicio).every((g) => {
      const dur = datos.curso.find((x) => x.tipo_acreditacion === g.tipo_acreditacion && x.modalidad === g.modalidad).dias_duracion;
      for (let k = 0; k < dur; k++) { const w = new Date(Date.parse(`${g.fecha_inicio}T12:00:00Z`) + k * 86400000).getUTCDay(); if (w === 0 || w === 6) return false; }
      return true;
    }), t('P151: ningún grupo ficticio tiene clase en sábado ni domingo'));
  });

  // Quinto día (curso de primera vez): «Repaso de conocimientos y examen final» para el personal (asistencia, ficha del
  // grupo) y para la persona («Mis trámites», arriba). Renovación (un día): «curso y examen», como estaba.
  await bloque('quinto día', async () => {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
    await page.waitForSelector('.asistencia-fila');
    const tira = await page.textContent('main');
    await page.goto(BASE + 'grupo.html?folio=APD-G-2026-003');
    // Acomodo de escritorio (25/10/2026): en computadora «Asistencia por día» va en una pestaña (oculta al abrir)
    await page.waitForSelector('[data-conc-encabezado] th', { state: 'attached' });
    const encabezado = await page.textContent('[data-conc-encabezado]');
    const datosG = await page.textContent('[data-datos]');
    comprueba(/16\/10\/2026 · repaso de conocimientos y examen final/.test(encabezado) && /Último día \(repaso de conocimientos y examen final\)/.test(datosG) && /Hora de salida\s*15:00/.test(datosG) && !errores.length,
      t('quinto día: la ficha del grupo dice «repaso de conocimientos y examen final» en el último día y la salida a las 15:00'));
    comprueba(/Día 5 · 16\/10\/2026 · repaso de conocimientos y examen final/.test(tira), t('quinto día: en «Asistencia», el día 5 dice «repaso de conocimientos y examen final»'));
    const renov = await page.evaluate(() => APD.cargar().then((d) => [APD.diaFinal(APD.curso(d, 'poda', 'renovacion')), APD.diaFinal(APD.curso(d, 'poda', 'nueva'))]));
    comprueba(renov[0] === 'Examen' && renov[1] === 'Repaso de conocimientos y examen final', t('quinto día: sólo en el curso de primera vez; la renovación queda como estaba'));
    await c.close();
  });

  // P149, P143 y gobierno en bloque: como máximo 2 grupos al mismo tiempo (la pantalla, como la base); la espera es
  // prioritaria desde 15 días y la persona lee que se asigna grupo en 15 días si se completa el cupo mínimo; sólo las
  // instituciones de gobierno local y federal se agrupan en bloque.
  await bloque('P149, P143 y bloques', async () => {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
    await page.waitForSelector('#paso-personas:not([hidden]) [data-personas] .plan-persona');
    const r = await page.evaluate(() => APD.cargar().then((d) => {
      const P = APD_PERSONAL;
      const lunes = '2026-10-26';
      const uno = P.razonNoInicio(d, 'dictaminador', 'nueva', lunes);
      const g = Object.assign({}, d.grupo.find((x) => x.folio === 'APD-G-2026-005'), { id: 'otro-de-prueba', folio: 'APD-G-2026-090', tipo_acreditacion: 'poda', modalidad: 'renovacion', fecha_inicio: '2026-10-28', estado: 'confirmado' });
      d.grupo.push(g);
      const dos = P.razonNoInicio(d, 'dictaminador', 'nueva', lunes);
      const renovJueves = P.razonNoInicio(d, 'dictaminador', 'renovacion', '2026-10-29');
      // Bloques: dos de la misma alcaldía, juntas; dos de la misma empresa, cada una por su lado
      const alc = d.organizacion.find((o) => o.tipo === 'alcaldia');
      const emp = d.organizacion.find((o) => o.tipo === 'privada');
      const x = (folio, o, gob) => ({ s: { folio, organizacion_id: o.id }, organizacion: o.nombre, gobierno: gob });
      const bloques = P.bloquesEspera([x('A', alc, true), x('B', emp, false), x('C', alc, true), x('D', emp, false)]);
      return { uno: uno && uno.clave, dos: dos && dos.clave, texto: dos && dos.texto, renovJueves: renovJueves && renovJueves.clave,
        bloques: bloques.map((b) => `${b.junta ? 'junta' : 'sola'}:${b.xs.map((y) => y.s.folio).join('')}`).join(' ') };
    }));
    comprueba(r.uno === null && r.dos === 'simultaneos' && /como máximo hay 2 al mismo tiempo/.test(r.texto) && r.renovJueves === null,
      t(`P149: con un grupo esa semana se puede programar otro; con dos, un tercero no («${r.texto}»); otro día de la semana sin dos grupos, sí`));
    comprueba(r.bloques === 'junta:AC sola:B sola:D', t(`gobierno en bloque: dos de la misma alcaldía van juntas y dos de la misma empresa, una por una (${r.bloques})`));
    const privada = datos.organizacion.find((o) => o.tipo === 'privada' && datos.solicitud.filter((x) => x.estado === 'lista_para_curso' && x.tipo_acreditacion === 'poda' && x.modalidad === 'nueva' && x.organizacion_id === o.id).length > 1);
    comprueba(!(await page.$$eval('.plan-bloque-nombre', (l) => l.map((n) => n.textContent))).some((n) => n.startsWith(privada.nombre)) && !errores.length,
      t(`gobierno en bloque: en «Grupos», las de ${privada.nombre} ya no van en un bloque`));
    comprueba(/\d+ esperan? 15 días o más/.test(await page.textContent('[data-espera-curso="poda-nueva"]')), t('P143: «Grupos» (paso 1) cuenta como prioritarias las que esperan 15 días o más'));
    await c.close();
    const espera = datos.solicitud.find((x) => x.estado === 'lista_para_curso' && x.modalidad === 'nueva' && x.tipo_acreditacion === 'poda');
    const persona = datos.solicitante.find((p) => p.id === espera.solicitante_id);
    const r2 = await conSesion(persona, 'tramites.html');
    await r2.page.waitForSelector('[data-solicitudes] .ficha');
    const ficha = await r2.page.textContent('[data-solicitudes]');
    comprueba(/te asigna un grupo del curso en un plazo de 15 días, siempre que se reúnan al menos 5 personas para abrirlo/.test(ficha) && /de lunes a viernes, de 9:00 a 15:00/.test(ficha) && /repaso de conocimientos y examen final/.test(ficha) && !r2.errores.length,
      t('P143: la persona en espera lee que se le asigna grupo en 15 días si se reúne el cupo mínimo, el horario del curso y el quinto día'));
    await r2.c.close();
  });
}

/* ── Cancelación de una acreditación (P120, P49; sesión de trabajo del 23/10/2026, parte B; SOLO=cancelacion) ──
   Los instructores y la Dirección cancelan una acreditación vigente desde su ficha («Acreditaciones»), con motivo y
   fundamento en un diálogo de confirmación (foco en el motivo, de usted); el perfil de revisión y cotejo no puede.
   «Verificar» la muestra «Cancelada» (gris, sin el motivo); la persona la ve en «Mis trámites» cancelada, con el motivo,
   de tú, y sin «Renovar»; una renovación en trámite se cancela. La credencial ya no menciona huella ni antigüedad (P49). */
async function cancelacion(navegador) {
  const t = (m) => `[cancelación] ${m}`;
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  const sesionDe = (page, id) => page.evaluate((x) => localStorage.setItem('apd.sesion', JSON.stringify({ id: x })), id);
  const cancelada = datos.acreditacion.find((a) => a.cancelada_en);
  const vigente = datos.acreditacion.find((a) => a.numero === 'PD-2025-K100');
  const conRenovacion = datos.acreditacion.find((a) => datos.solicitud.some((s) => s.acreditacion_anterior_id === a.id && s.estado === 'enviada') && ['vigente', 'por_vencer'].includes(datos.estado_acreditacion[a.numero]));
  const vencida = datos.acreditacion.find((a) => datos.estado_acreditacion[a.numero] === 'vencida_no_renovable');
  const verifica = async (page, numero) => {
    await page.goto(BASE + 'verificar.html');
    await page.fill('#numero', numero);
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-verificacion]:not([hidden])');
    return { texto: await page.textContent('[data-verificacion]'), tono: await page.getAttribute('[data-verificacion]', 'data-tono') };
  };

  comprueba(datos.estado_acreditacion[cancelada.numero] === 'cancelada' && datos.verificacion_publica.find((v) => v.numero === cancelada.numero).situacion === 'Cancelada'
    && !('cancelacion_motivo' in datos.verificacion_publica[0]), t(`ficticios: ${cancelada.numero} cancelada por un instructor; la vista pública dice «Cancelada» y no trae el motivo`));

  // «Verificar»: «Cancelada» en gris (familia terminado, como «Vencida»), con su día y sin el motivo ni el fundamento
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
    await bloque(`verificar ${donde}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      const v = await verifica(page, cancelada.numero);
      comprueba(/^Cancelada/.test(v.texto.trim()) && v.tono === 'terminado' && /Cancelada el\s*08\/10\/2026/.test(v.texto) && /no se puede trabajar/.test(v.texto)
        && !v.texto.includes(cancelada.cancelacion_motivo.slice(0, 30)) && !/Vigente|Fundamento|Motivo/.test(v.texto) && !errores.length,
        t(`${donde}: «Verificar» muestra ${cancelada.numero} «Cancelada», en gris, con su día y sin el motivo`));
      await sinDesborde(page, t(`verificar cancelada en ${donde}`));
      await c.close();
    });
  }

  // «Mis trámites» de la persona: cancelada, con el motivo y el fundamento, de tú, sin «Renovar» ni reposición
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
    await bloque(`mis trámites ${donde}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto, cancelada.solicitante_id);
      await page.goto(BASE + 'tramites.html');
      await page.waitForSelector('[data-acreditaciones] .ficha');
      const ficha = page.locator('[data-acreditaciones] .ficha', { hasText: cancelada.numero });
      const txt = await ficha.textContent();
      comprueba(await ficha.locator('.estado-terminado', { hasText: 'Cancelada' }).count() === 1 && txt.includes(cancelada.cancelacion_motivo) && /\[Art\. __, fracc\. __\]/.test(txt)
        && !/pendiente P120/.test(txt) && /ya no puedes trabajar con ella y no se puede renovar/.test(txt) && /Cancelada el\s*08\/10\/2026/.test(txt)
        && await ficha.locator('a', { hasText: /Renovar|reposición/ }).count() === 0 && !errores.length,
        t(`${donde}: «Mis trámites» muestra la acreditación cancelada, con el motivo y el fundamento, de tú, sin «Renovar» ni reposición`));
      await sinDesborde(page, t(`mis trámites cancelada en ${donde}`));
      await c.close();
    });
  }

  // Sin permiso: el perfil de revisión y cotejo (el de la prueba por omisión) no ve «Cancelar acreditación»; en una vencida
  // nadie lo ve
  await bloque('sin permiso', async () => {
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + `acreditacion.html?numero=${vigente.numero}`);
    await page.waitForSelector('[data-situacion] .estado');
    comprueba(await page.locator('button', { hasText: 'Cancelar acreditación' }).count() === 0 && /Sólo los instructores y la Dirección pueden cancelar una acreditación/.test(await page.textContent('[data-acciones]')) && !errores.length,
      t('perfil de revisión y cotejo: no ve «Cancelar acreditación» y la ficha dice quién puede'));
    await page.goto(BASE + `acreditacion.html?numero=${vencida.numero}&perfil=instructor`);
    await page.waitForSelector('[data-situacion] .estado');
    comprueba(await page.locator('button', { hasText: 'Cancelar acreditación' }).count() === 0, t(`instructor: una vencida (${vencida.numero}) no se cancela`));
    await page.goto(BASE + `acreditacion.html?numero=${cancelada.numero}&perfil=administracion`);
    await page.waitForSelector('[data-situacion] .estado');
    const ficha = await page.textContent('main');
    comprueba(await page.locator('button', { hasText: 'Cancelar acreditación' }).count() === 0 && /Cancelación/.test(ficha) && /Laura Ejemplo Instructora/.test(ficha) && ficha.includes(cancelada.cancelacion_motivo),
      t('Dirección: la cancelada muestra cuándo, quién, el motivo y el fundamento, y ya no se cancela otra vez'));
    await c.close();
  });

  // Un instructor cancela una vigente: diálogo del estándar, foco en el motivo, motivo y fundamento obligatorios, de usted;
  // luego «Verificar», la ficha y «Mis trámites» la muestran cancelada
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
    await bloque(`instructor cancela ${donde}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      await page.goto(BASE + 'acreditaciones.html?perfil=instructor');
      await page.waitForSelector('[data-filas] tr');
      await page.fill('#buscar', vigente.numero);
      await page.waitForFunction((n) => [...document.querySelectorAll('[data-filas] tr')].filter((x) => !x.hidden).length === 1 && document.querySelector('[data-filas] tr:not([hidden])').dataset.numero === n, vigente.numero);
      await page.click(`[data-filas] tr[data-numero="${vigente.numero}"] a`);
      await page.waitForURL(/acreditacion\.html\?numero=.*perfil=instructor/);
      const boton = page.locator('button', { hasText: 'Cancelar acreditación' });
      await boton.click();
      await page.waitForSelector('#dlg-cancelar[open]');
      const dlg = await page.textContent('#dlg-cancelar');
      comprueba(await page.evaluate(() => document.activeElement && document.activeElement.id === 'motivo-cancelar') && /¿Cancelar la acreditación PD-2025-K100/.test(dlg)
        && /«Verificar» la muestra como «Cancelada», sin el motivo/.test(dlg) && /No se puede deshacer/.test(dlg) && /Volver sin cambios/.test(dlg) && /Sí, cancelar la acreditación/.test(dlg),
        t(`${donde}: «Cancelar acreditación» abre el diálogo de confirmación con sus consecuencias y el foco en el motivo`));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('dlg-cancelar').open);
      comprueba(await page.evaluate(() => document.activeElement && document.activeElement.textContent === 'Cancelar acreditación'), t(`${donde}: Escape cierra el diálogo sin cambios y el foco regresa al botón`));
      await boton.click();
      await page.waitForSelector('#dlg-cancelar[open]');
      await page.click('#dlg-cancelar [data-accion="enviar"]');
      await page.waitForSelector('#motivo-cancelar[aria-invalid="true"]');
      comprueba(await page.getAttribute('#fundamento-cancelar', 'aria-invalid') === 'true' && await page.isVisible('#dlg-cancelar[open]'), t(`${donde}: sin motivo ni fundamento no se cancela y los dos se marcan`));
      await page.fill('#motivo-cancelar', 'Corto');
      await page.fill('#fundamento-cancelar', '[Art. __, fracc. __]');
      await page.click('#dlg-cancelar [data-accion="enviar"]');
      await page.waitForTimeout(300);
      comprueba(await page.getAttribute('#motivo-cancelar', 'aria-invalid') === 'true' && await page.isVisible('#dlg-cancelar[open]'), t(`${donde}: un motivo de menos de 10 caracteres no se acepta`));
      await page.fill('#motivo-cancelar', 'Podó sin autorización en la visita de prueba.');
      await page.click('#dlg-cancelar [data-accion="enviar"]');
      await page.waitForURL(/acreditacion\.html\?numero=PD-2025-K100/);
      await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
      const ficha = await page.textContent('main');
      comprueba(/Acreditación cancelada/.test(ficha) && await page.locator('[data-situacion] .estado-terminado', { hasText: 'Cancelada' }).count() === 1 && /Laura Ejemplo Instructora/.test(ficha)
        && /Podó sin autorización/.test(ficha) && await page.locator('button', { hasText: 'Cancelar acreditación' }).count() === 0 && !errores.length,
        t(`${donde}: cancelada por el instructor; la ficha dice «Cancelada», quién y el motivo`));
      const v = await verifica(page, vigente.numero);
      comprueba(/^Cancelada/.test(v.texto.trim()) && v.tono === 'terminado' && !/Podó sin autorización/.test(v.texto), t(`${donde}: «Verificar» ya la muestra «Cancelada», sin el motivo`));
      // Su titular la ve cancelada en «Mis trámites» (en la prueba, el mismo navegador)
      const titular = datos.solicitante.find((p) => p.id === vigente.solicitante_id);
      if (titular.estado === 'activa') {
        await sesionDe(page, titular.id);
        await page.goto(BASE + 'tramites.html');
        await page.waitForSelector('[data-acreditaciones] .ficha');
        comprueba(/Podó sin autorización/.test(await page.textContent('[data-acreditaciones]')), t(`${donde}: la persona la ve cancelada en «Mis trámites», con el motivo`));
      }
      await c.close();
    });
  }

  // La Dirección cancela una acreditación con su renovación en trámite: el diálogo lo dice y la renovación se cancela; la
  // persona no puede renovarla
  await bloque('dirección y renovación', async () => {
    const { c, page, errores } = await nuevo(1280, 900);
    const renov = datos.solicitud.find((s) => s.acreditacion_anterior_id === conRenovacion.id && s.estado === 'enviada');
    await page.goto(BASE + `acreditacion.html?numero=${conRenovacion.numero}&perfil=administracion`);
    await page.click('button:has-text("Cancelar acreditación")');
    await page.waitForSelector('#dlg-cancelar[open]');
    comprueba(new RegExp(`Su renovación en trámite \\(folio ${renov.folio}\\) se cancela`).test(await page.textContent('#dlg-cancelar')), t(`Dirección: el diálogo avisa que la renovación ${renov.folio} se cancela`));
    await page.fill('#motivo-cancelar', 'Motivo de la prueba de la Dirección.');
    await page.fill('#fundamento-cancelar', '[Art. __, fracc. __]');
    await page.click('#dlg-cancelar [data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(/Rosa Ejemplo Directora/.test(await page.textContent('main')), t('Dirección (perfil administración): cancela, y la ficha la registra a su nombre'));
    await page.goto(BASE + 'revision.html');
    await page.waitForLoadState('networkidle');
    comprueba(!(await page.textContent('main')).includes(renov.folio), t(`la renovación ${renov.folio} ya no está por revisar`));
    const p = datos.solicitante.find((x) => x.id === conRenovacion.solicitante_id);
    if (p.estado === 'activa') {
      await sesionDe(page, p.id);
      await page.goto(BASE + 'tramites.html');
      await page.waitForSelector('[data-acreditaciones] .ficha');
      const txt = await page.textContent('main');
      comprueba(/que se renovaba fue cancelada/.test(txt) && await page.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).count() === 0, t('la persona ve su renovación cancelada, con el motivo, y no puede renovar la cancelada'));
    }
    comprueba(!errores.length, t(`Dirección: sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
  });

  // P49: la credencial dice que puede ser cancelada conforme a los lineamientos y ya no menciona huella ni antigüedad
  await bloque('P49', async () => {
    const { c, page } = await nuevo(390, 844);
    await page.goto(BASE + 'index.html');
    comprueba(/puede ser cancelada conforme a los lineamientos/.test(await page.textContent('main')), t('P49: el inicio dice que la credencial puede ser cancelada conforme a los lineamientos'));
    await c.close();
    const sitio = join(raiz, 'sitio');
    const archivos = readdirSync(sitio).filter((f) => f.endsWith('.html')).map((f) => join(sitio, f)).concat(readdirSync(join(sitio, 'app')).filter((f) => f.endsWith('.js')).map((f) => join(sitio, 'app', f)));
    const con = archivos.filter((f) => /huella digital|huella dactilar|antigüedad consecutiva|años de antigüedad/i.test(readFileSync(f, 'utf8')));
    comprueba(!con.length, t(`P49: ninguna pantalla menciona huella digital ni antigüedad de la credencial${con.length ? ': ' + con.join(', ') : ''}`));
  });
}

/* ── Reposición de la credencial (P140; sesión de trabajo del 23/10/2026, parte B; SOLO=reposicion) ──
   La persona con su acreditación vigente pide la reposición desde «Mis trámites» con el acta (PDF o foto, de hasta 5 MB,
   con el módulo de archivos del estándar); el personal revisa el acta en la ficha de la acreditación (observaciones o la
   acepta) y, en el Vivero, valida la factura de la cuota y marca la credencial repuesta: mismo número y misma vigencia. */
async function reposicionCredencial(navegador) {
  const t = (m) => `[reposición] ${m}`;
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  const enEstado = (e) => { const r = datos.reposicion.find((x) => x.estado === e); return datos.acreditacion.find((a) => a.id === r.acreditacion_id); };
  const repuesta = enEstado('repuesta');
  const persona = (a) => datos.solicitante.find((p) => p.id === a.solicitante_id);
  const fichaDe = (page, numero) => page.locator('[data-acreditaciones] .ficha', { hasText: numero });

  comprueba(['solicitada', 'con_observaciones', 'acta_aceptada', 'repuesta'].every((e) => datos.reposicion.some((r) => r.estado === e))
    && datos.cuota.find((c) => c.clave === 'reposicion_credencial').monto === 88 && /pendiente P140/.test(datos.cuota[0].fundamento),
    t('ficticios: una reposición en cada paso y la cuota ficticia de $88.00 marcada por confirmar con Finanzas'));
  const claves = APD_CASOS_PRUEBA.claves();
  comprueba(['repos-puede', 'repos-solicitada', 'repos-observada', 'repos-aceptada', 'repos-repuesta', 'acred-cancelada', 'personal-acreditaciones', 'personal-cancelar-instructor', 'personal-cancelar-direccion'].every((k) => claves.includes(k)),
    t('menú de pruebas: casos de la reposición (pidió, acta en revisión, con observaciones, aceptada, repuesta), de la cancelada y del personal'));

  // Los ficticios, en «Mis trámites», en teléfono y en escritorio: cada paso con su etiqueta, de tú
  const PASOS = [['solicitada', 'Reposición: acta en revisión', 'estado-proceso', /La Secretaría revisa tu acta/],
    ['con_observaciones', 'Reposición: corrige tu acta', 'estado-atencion', /Tu acta: el acta no trae el sello/],
    ['acta_aceptada', 'Reposición: recoge tu credencial', 'estado-atencion', /Paga la cuota de reposición: \$88\.00/]];
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
    for (const [e, etiqueta, clase, texto] of PASOS) {
      await bloque(`${e} ${donde}`, async () => {
        const a = enEstado(e);
        const { c, page, errores } = await nuevo(ancho, alto, a.solicitante_id);
        await page.goto(BASE + 'tramites.html');
        await page.waitForSelector('[data-acreditaciones] .ficha');
        const f = fichaDe(page, a.numero);
        comprueba(await f.locator(`.${clase}`, { hasText: etiqueta }).count() === 1 && texto.test(await f.textContent()) && !errores.length,
          t(`${donde}: «${etiqueta}» en la ficha de ${a.numero}`));
        if (e === 'con_observaciones') comprueba(await f.locator('a.btn-primario', { hasText: 'Cargar el acta corregida' }).count() === 1, t(`${donde}: con observaciones, «Cargar el acta corregida» es la acción principal`));
        if (e === 'acta_aceptada') comprueba(await page.isVisible('[data-mapa-sede]') && /la entrega de tu credencial/i.test(await page.textContent('[data-mapa-sede]')), t(`${donde}: con el acta aceptada, «Dónde es» dice dónde recoger la credencial`));
        comprueba(await f.locator('a', { hasText: 'Pedir la reposición' }).count() === 0, t(`${donde}: con una reposición abierta no se pide otra para ${a.numero}`));
        await sinDesborde(page, t(`mis trámites ${e} en ${donde}`));
        await c.close();
      });
    }
  }

  // Recorrido completo, en teléfono la persona y en escritorio el personal, en el mismo navegador
  await bloque('recorrido', async () => {
    const p = persona(repuesta);
    const antes = { ...repuesta };
    const tel = await nuevo(390, 844, p.id);
    const { page } = tel;
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-acreditaciones] .ficha');
    comprueba(/Credencial repuesta el\s*02\/10\/2026/.test(await fichaDe(page, repuesta.numero).textContent()), t('la credencial repuesta en los ficticios dice cuándo se repuso'));
    await fichaDe(page, repuesta.numero).locator('a', { hasText: 'Pedir la reposición de tu credencial' }).click();
    await page.waitForURL(/reposicion\.html\?numero=/);
    await page.waitForSelector('#formulario:not([hidden])');
    const form = await page.textContent('#formulario');
    comprueba(/Pide la reposición de tu credencial/.test(form) && /\$88\.00/.test(form) && /mismo número y la misma vigencia/.test(form) && /En PDF o en foto \(JPG o PNG\), de hasta 5 MB/.test(form),
      t('teléfono: la reposición dice la cuota, que la nueva lleva el mismo número y vigencia, y los formatos del acta'));
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[aria-invalid="true"]');
    comprueba(await page.locator('[data-campo="motivo"] .err').count() > 0 && /obligatori|Elige|Selecciona|Carga/i.test(await page.textContent('[data-campo="acta"]')), t('teléfono: sin motivo ni acta no se pide'));
    // Un acta de más de 5 MB se rechaza en la zona de carga (módulo de archivos del estándar)
    await page.setInputFiles('[data-campo="acta"] [data-archivos] > input[type="file"]', { name: 'acta-grande.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([PDF.buffer, Buffer.alloc(5.5 * 1024 * 1024, 32)]) });
    await page.waitForSelector('[data-campo="acta"] [data-rechazos] *');
    comprueba(/pasa del máximo de 5 MB/.test(await page.textContent('[data-campo="acta"] [data-rechazos]')), t('teléfono: un acta de más de 5 MB se rechaza'));
    // En foto (PNG) también se acepta; se queda la última
    await page.setInputFiles('[data-campo="acta"] [data-archivos] > input[type="file"]', FOTO);
    await page.waitForSelector('[data-campo="acta"] .lista-arch li[data-estado="listo"]');
    comprueba(true, t('teléfono: el acta en foto (PNG) se acepta'));
    await marcar(page, 'input[name="motivo"][value="robo"]');
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(/Recibimos tu solicitud de reposición/.test(await page.textContent('[data-hecho]:not(.pasos-btn)')) && /La Secretaría revisa tu acta/.test(await page.textContent('[data-hecho]:not(.pasos-btn)')), t('teléfono: «Recibimos tu solicitud de reposición», con qué sigue'));
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-acreditaciones] .ficha');
    comprueba(/Reposición: acta en revisión/.test(await fichaDe(page, repuesta.numero).textContent()) && /por robo/.test(await fichaDe(page, repuesta.numero).textContent()), t('teléfono: «Mis trámites» la muestra con el acta en revisión'));

    // El personal, en escritorio (otra pestaña del mismo navegador): observaciones al acta
    const esc = await tel.c.newPage();
    await esc.setViewportSize({ width: 1280, height: 900 });
    const errEsc = [];
    esc.on('pageerror', (e) => errEsc.push(String(e)));
    await esc.goto(BASE + 'acreditaciones.html');
    await esc.waitForSelector(`[data-filas-reposiciones] tr[data-numero="${repuesta.numero}"]`);
    comprueba(/Acta por revisar/.test(await esc.textContent(`[data-filas-reposiciones] tr[data-numero="${repuesta.numero}"]`)), t('escritorio: «Reposiciones por atender» la lista con el acta por revisar'));
    await esc.click(`[data-filas-reposiciones] tr[data-numero="${repuesta.numero}"] a`);
    await esc.waitForSelector('#acta:not([hidden])');
    comprueba(/blob:/.test(await esc.getAttribute('[data-ver-acta]', 'href') || '') || await esc.waitForFunction(() => /^blob:/.test(document.querySelector('[data-ver-acta]').href)).then(() => true, () => false),
      t('escritorio: «Ver el acta» abre la que cargó la persona en este navegador'));
    await esc.click('#acta [data-accion="enviar"]');
    await esc.waitForSelector('#acta [aria-invalid="true"]');
    await marcar(esc, '#acta input[name="decision"][value="con_observaciones"]');
    await esc.fill('#observacion', 'El acta no se lee completa: falta la hoja de firmas.');
    await esc.click('#acta [data-accion="enviar"]');
    await esc.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(/Observaciones del acta registradas/.test(await esc.textContent('[data-hecho]:not(.pasos-btn)')), t('escritorio: sin decidir no se registra; con observaciones, sí'));

    // La persona corrige el acta
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-acreditaciones] .ficha');
    const f = fichaDe(page, repuesta.numero);
    comprueba(/Tu acta: el acta no se lee completa: falta la hoja de firmas/.test(await f.textContent()), t('teléfono: la persona lee la observación de su acta, de tú'));
    await f.locator('a', { hasText: 'Cargar el acta corregida' }).click();
    await page.waitForSelector('#formulario:not([hidden])');
    comprueba(/Carga tu acta corregida/.test(await page.textContent('#formulario')) && await page.isChecked('input[name="motivo"][value="robo"]'), t('teléfono: «Carga tu acta corregida», con su motivo'));
    await page.setInputFiles('[data-campo="acta"] [data-archivos] > input[type="file"]', PDF);
    await page.waitForSelector('[data-campo="acta"] .lista-arch li[data-estado="listo"]');
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(/Recibimos tu acta corregida/.test(await page.textContent('[data-hecho]:not(.pasos-btn)')), t('teléfono: «Recibimos tu acta corregida»'));

    // El personal la acepta: se fija la cuota vigente
    await esc.goto(BASE + `acreditacion.html?numero=${repuesta.numero}`);
    await esc.waitForSelector('#acta:not([hidden])');
    await marcar(esc, '#acta input[name="decision"][value="acta_aceptada"]');
    await esc.click('#acta [data-accion="enviar"]');
    await esc.waitForFunction(() => /Acta aceptada/.test((document.querySelector('[data-hecho]:not(.pasos-btn):not([hidden])') || {}).textContent || ''));
    await esc.waitForSelector('#entrega:not([hidden])');
    comprueba(/Acta aceptada/.test(await esc.textContent('[data-hecho]:not(.pasos-btn)')) && /Cuota de reposición indicada\s*\$88\.00/.test(await esc.textContent('[data-reposicion-datos]')), t('escritorio: acta aceptada con la cuota de $88.00'));
    await page.goto(BASE + 'tramites.html');
    await page.waitForSelector('[data-acreditaciones] .ficha');
    comprueba(/Reposición: recoge tu credencial/.test(await fichaDe(page, repuesta.numero).textContent()) && /\$88\.00/.test(await fichaDe(page, repuesta.numero).textContent()), t('teléfono: la persona ve cuánto pagar y dónde recoger su credencial'));

    // En el Vivero: la factura (RFC inválido, folio fiscal repetido de una solicitud, y la buena) y la credencial repuesta
    await esc.fill('#factura_rfc', 'XXXX');
    await esc.fill('#factura_razon_social', APD_NOMBRE(p));
    await esc.fill('#factura_folio_fiscal', datos.solicitud.find((s) => s.factura_folio_fiscal).factura_folio_fiscal);
    await esc.click('#entrega [data-accion="enviar"]');
    await esc.waitForSelector('#factura_rfc[aria-invalid="true"]');
    await esc.fill('#factura_rfc', `${p.curp.slice(0, 10)}AB1`);
    await esc.click('#entrega [data-accion="enviar"]');
    await esc.waitForSelector('#factura_folio_fiscal[aria-invalid="true"]');
    comprueba(/ya está registrado/.test(await esc.textContent('[data-campo="factura_folio_fiscal"]')), t('escritorio: un RFC inválido y un folio fiscal ya registrado no se aceptan'));
    await esc.fill('#factura_folio_fiscal', '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D');
    await esc.click('#entrega [data-accion="enviar"]');
    // La página se vuelve a abrir con su aviso: se espera el de la entrega (el de «Acta aceptada» ya estaba a la vista)
    await esc.waitForFunction(() => /Credencial repuesta/.test((document.querySelector('[data-hecho]:not(.pasos-btn):not([hidden])') || {}).textContent || '') && document.querySelector('[data-reposicion-datos] dl'));
    const ficha = await esc.textContent('main');
    comprueba(/Credencial repuesta/.test(await esc.textContent('[data-hecho]:not(.pasos-btn)')) && /Credencial repuesta el\s*14\/10\/2026/.test(ficha) && /0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D/.test(ficha)
      && ficha.includes(`Número de acreditación${antes.numero}`) && ficha.includes(`Emitida el${dma(antes.emitida_en)}`) && ficha.includes(`Vence el${dma(antes.vence_en)}`) && !errEsc.length,
      t(`escritorio: credencial repuesta con la factura; la acreditación conserva su número, su emisión y su vigencia${errEsc.length ? ': ' + errEsc.join(' | ') : ''}`));
    await page.goto(BASE + 'verificar.html');
    await page.fill('#numero', antes.numero);
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-verificacion]:not([hidden])');
    comprueba(new RegExp(`Vigente hasta el ${dma(antes.vence_en)}`).test(await page.textContent('[data-verificacion]')), t('«Verificar» la sigue mostrando vigente hasta la misma fecha'));
    comprueba(!tel.errores.length, t(`recorrido sin errores en la consola${tel.errores.length ? ': ' + tel.errores.join(' | ') : ''}`));
    await tel.c.close();
  });

  // Cancelar una acreditación con su reposición abierta la cancela también (sale de «Reposiciones por atender»)
  await bloque('cancelar con reposición', async () => {
    const a = enEstado('acta_aceptada');
    const { c, page, errores } = await nuevo(1280, 900);
    await page.goto(BASE + `acreditacion.html?numero=${a.numero}&perfil=instructor`);
    await page.click('button:has-text("Cancelar acreditación")');
    await page.waitForSelector('#dlg-cancelar[open]');
    comprueba(/La reposición de su credencial que está en trámite se cancela/.test(await page.textContent('#dlg-cancelar')), t('el diálogo avisa que la reposición en trámite se cancela'));
    await page.fill('#motivo-cancelar', 'Motivo de la prueba con reposición.');
    await page.fill('#fundamento-cancelar', '[Art. __, fracc. __]');
    await page.click('#dlg-cancelar [data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    comprueba(/Reposición cancelada/.test(await page.textContent('[data-reposicion-situacion]')) && await page.isHidden('#entrega'), t('la reposición queda cancelada y ya no se entrega'));
    await page.goto(BASE + 'acreditaciones.html');
    await page.waitForSelector('[data-cuenta-reposiciones]');
    await page.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-cuenta-reposiciones]').textContent));
    comprueba(await page.locator(`[data-filas-reposiciones] tr[data-numero="${a.numero}"]`).count() === 0 && !errores.length, t('ya no está en «Reposiciones por atender»'));
    await c.close();
  });

  // Una credencial del sistema todavía no entregada no se repone; la de una cancelada, tampoco
  await bloque('no se repone', async () => {
    const sinEntrega = datos.acreditacion.find((a) => a.origen === 'sistema' && !a.entregada_en && persona(a).estado === 'activa');
    const { c, page } = await nuevo(390, 844, sinEntrega.solicitante_id);
    await page.goto(BASE + `reposicion.html?numero=${sinEntrega.numero}`);
    await page.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-cargando]').textContent));
    comprueba(/todavía no se te entrega/.test(await page.textContent('[data-cargando]')) && await page.isHidden('#formulario'), t('una credencial que todavía no se entrega no se repone: se recoge'));
    await c.close();
    const canc = datos.acreditacion.find((a) => a.cancelada_en);
    const r2 = await nuevo(390, 844, canc.solicitante_id);
    await r2.page.goto(BASE + `reposicion.html?numero=${canc.numero}`);
    await r2.page.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-cargando]').textContent));
    comprueba(/no está vigente/.test(await r2.page.textContent('[data-cargando]')), t('la credencial de una acreditación cancelada no se repone'));
    await r2.c.close();
  });
}

/* ── Asistencia día por día hasta el pase de lista del último día (reporte de Liber del 24/10/2026; SOLO=asistencia5) ──
   «Después de que guardo la asistencia del día 4 debería pasar a la asistencia del día 5 y no pasa; además, en el examen,
   que es el mismo día, debería pasar asistencia en el salón de cómputo». Al guardar un día, el aviso trae un botón
   principal con lo que sigue y el foco va a él: el día siguiente o, si el siguiente es el último, «Aplicar el examen»,
   donde el primer paso es el pase de lista de ese día; el pase de lista cuenta como la asistencia del último día en
   «Asistencia» y en la ficha del grupo. Fuera de la prueba, un día que no ha llegado dice cuándo se captura. La
   renovación (curso de un día) va directo a «Aplicar». A 390 y 1280 px, con axe. */
async function asistenciaDia5(navegador) {
  const t = (m) => `[asistencia día 5] ${m}`;
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  if (!axe) console.log('OMITIDO  asistencia día 5: axe (falta AXE=<ruta a axe.min.js del estándar>)');
  const nuevo = async (ancho, alto) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  const conRuta = (page, cambia) => page.route('**/datos/ficticios.json*', async (r) => { const res = await r.fetch(); const j = await res.json(); cambia(j); await r.fulfill({ response: res, json: j }); });
  const texto = async (page, sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const enFoco = (page) => page.evaluate(() => (document.activeElement ? document.activeElement.textContent.replace(/\s+/g, ' ').trim() : ''));
  const revisaAxe = async (page, donde) => {
    await sinDesborde(page, t(donde));
    if (!axe) return;
    await page.evaluate(() => window.scrollTo(0, 0));
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axe);
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 140)).join(' || ')}`));
    comprueba(!v.length, t(`${donde}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
  };
  const sinErr = (errores, donde) => comprueba(!errores.length, t(`${donde}: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
  // Guarda el día en pantalla con «Todas asistieron»
  const guarda = async (page) => {
    await page.waitForSelector('[data-todas]');
    await page.click('[data-todas]');
    const llega = page.waitForURL(/hecho=asistencia/);
    await page.click('[data-guardar]');
    await llega;
    await page.waitForSelector('[data-hecho]:not(.pasos-btn) .aviso');
  };
  const G3 = 'APD-G-2026-003'; // en curso: empezó el lunes 12/10; la fecha simulada (14/10) es su día 3
  const ordenAntes = (page, a, b) => page.evaluate(([x, y]) => {
    const p = document.querySelector(x); const q = document.querySelector(y);
    return Boolean(p && q && (p.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING));
  }, [a, b]);

  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    // Día 1 → «Seguir con el día 2», con el foco en el botón, y lleva a ese día; «Corregir otro día» sigue
    await bloque(`día 1 a ${ancho}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      await page.goto(BASE + `asistencia.html?folio=${G3}&dia=1`);
      await guarda(page);
      const boton = page.locator('[data-hecho]:not(.pasos-btn) .aviso a.btn.btn-primario');
      comprueba(await boton.count() === 1 && /^Seguir con el día 2\b/.test((await boton.textContent()).trim()) && /guardada/.test(await texto(page, '[data-hecho]:not(.pasos-btn)')),
        t(`${ancho}: al guardar el día 1, el aviso de éxito trae un solo botón principal, «Seguir con el día 2» («${(await texto(page, '[data-hecho]:not(.pasos-btn)')).slice(0, 140)}»)`));
      comprueba(/^Seguir con el día 2\b/.test(await enFoco(page)), t(`${ancho}: el foco va al botón «Seguir con el día 2» («${await enFoco(page)}»)`));
      comprueba(await page.locator('[data-otro-dia]:not([hidden]) summary', { hasText: 'Corregir otro día' }).count() === 1, t(`${ancho}: «Corregir otro día» se mantiene`));
      await revisaAxe(page, `${ancho}: aviso del día 1 guardado`);
      await Promise.all([page.waitForNavigation(), boton.click()]);
      await page.waitForSelector('.asistencia-fila');
      comprueba(/\bdía 2 de 5\b/i.test(await texto(page, '[data-titulo-dia]')) && /[?&]dia=2\b/.test(page.url()), t(`${ancho}: «Seguir con el día 2» lleva a la lista del día 2 («${await texto(page, '[data-titulo-dia]')}»)`));
      sinErr(errores, `${ancho}: día 1 → día 2`);
      await c.close();
    });

    // Día 4 → «Ir al día 5: pase de lista en el salón de cómputo» → «Aplicar el examen», con el pase de lista primero;
    // pasar lista cuenta como la asistencia del día 5 en «Asistencia» y en la ficha del grupo
    await bloque(`día 4 a ${ancho}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      await page.goto(BASE + `asistencia.html?folio=${G3}&dia=4`);
      await guarda(page);
      const boton = page.locator('[data-hecho]:not(.pasos-btn) .aviso a.btn.btn-primario');
      comprueba(await boton.count() === 1 && (await boton.textContent()).trim() === 'Ir al día 5: pase de lista en el salón de cómputo' && /aplicar\.html\?folio=APD-G-2026-003$/.test(await boton.getAttribute('href')),
        t(`${ancho}: al guardar el día 4, el botón principal es «Ir al día 5: pase de lista en el salón de cómputo» y lleva a «Aplicar el examen»`));
      comprueba(await enFoco(page) === 'Ir al día 5: pase de lista en el salón de cómputo', t(`${ancho}: el foco va a «Ir al día 5…» («${await enFoco(page)}»)`));
      await revisaAxe(page, `${ancho}: aviso del día 4 guardado`);
      await Promise.all([page.waitForNavigation(), boton.click()]);
      await page.waitForSelector('[data-con-grupo]:not([hidden]) [data-filas] tr');
      const primero = await page.evaluate(() => { const h = document.querySelector('[data-con-grupo] h3'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; });
      comprueba(primero === 'Día 5 de 5 · Pase de lista en el salón de cómputo', t(`${ancho}: en «Aplicar el examen», el primer paso es «Día 5 de 5 · Pase de lista en el salón de cómputo» («${primero}»)`));
      const lista = await texto(page, '[data-lista-texto]');
      comprueba(/asistencia del día 5/.test(lista) && /Repaso de conocimientos y examen final/.test(lista), t(`${ancho}: el pase de lista dice que es la asistencia del día 5, el de repaso y examen final («${lista.slice(0, 160)}»)`));
      // Acomodo de escritorio (25/10/2026): desde 1024 px «Imprimir los códigos» va en la franja del pase de lista, arriba
      comprueba(await ordenAntes(page, '#t-pase-lista', '[data-tabla]') && await ordenAntes(page, '[data-tabla]', '#t-el-examen')
        && (ancho >= 1024 ? Boolean(await page.$('[data-franja-accion] [data-imprimir]')) : await ordenAntes(page, '#t-el-examen', '[data-imprimir]')),
        t(`${ancho}: primero el pase de lista (con su lista), después el examen (códigos y pantalla del examen; en computadora, «Imprimir los códigos» en la franja del pase de lista)`));
      await revisaAxe(page, `${ancho}: «Aplicar el examen»`);
      // Pasar lista: una presente y otra que no llegó
      const ins = await page.$$eval('[data-filas] [data-accion="presente"]', (l) => l.map((b) => b.dataset.ins));
      const nombreDe = (id) => page.textContent(`[data-filas] tr[data-ins="${id}"] .examen-nombre`);
      const [si, no] = [ins[0], ins[1]];
      const [nombreSi, nombreNo] = [await nombreDe(si), await nombreDe(no)];
      await page.click(`[data-filas] [data-accion="presente"][data-ins="${si}"]`);
      await page.waitForSelector(`[data-filas] tr[data-ins="${si}"] .examen-codigo`);
      await page.click(`[data-filas] [data-accion="ausente"][data-ins="${no}"]`);
      await page.waitForFunction((id) => /No llegó al examen/.test(document.querySelector(`[data-filas] tr[data-ins="${id}"]`).textContent), no);
      // En «Asistencia»: el día 5 cuenta con el pase de lista
      await page.goto(BASE + `asistencia.html?folio=${G3}`);
      await page.waitForSelector('.asistencia-fila');
      const ult = await texto(page, '[data-ultimo-dia]');
      comprueba(await page.isVisible('[data-ultimo-dia]') && /Día 5/.test(ult) && /1 presente/.test(ult) && /1 no llegó/.test(ult) && /asistencia/.test(ult),
        t(`${ancho}: en «Asistencia», el pase de lista cuenta como la asistencia del día 5 («${ult}»)`));
      // En la ficha del grupo: la columna del último día
      await page.goto(BASE + `grupo.html?folio=${G3}`);
      await page.waitForSelector('[data-conc-filas] tr', { state: 'attached' });
      // Acomodo de escritorio (25/10/2026): en computadora «Asistencia por día» es una pestaña; se abre para verla
      if (await page.locator('#pt-asistencia').count()) await page.click('#pt-asistencia');
      await page.waitForSelector('[data-conc-filas] tr');
      const celda = (nombre) => page.evaluate((n) => {
        const tr = [...document.querySelectorAll('[data-conc-filas] tr')].find((r) => r.cells[0].textContent.trim() === n.trim());
        return tr ? tr.cells[5].textContent.trim() : '';
      }, nombre);
      const [cSi, cNo] = [await celda(nombreSi), await celda(nombreNo)];
      comprueba(/Presente/.test(cSi) && /No llegó/.test(cNo), t(`${ancho}: en la ficha del grupo, el día 5 dice «Presente» y «No llegó» según el pase de lista («${cSi}» · «${cNo}»)`));
      sinErr(errores, `${ancho}: día 4 → aplicar`);
      await c.close();
    });
  }

  // Renovación (curso de un día): el único día es el del examen; «Asistencia» lleva directo a «Aplicar»
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    await bloque(`renovación a ${ancho}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      await conRuta(page, (j) => { const g = j.grupo.find((x) => x.folio === G3); g.modalidad = 'renovacion'; g.fecha_inicio = j.fecha_corte; });
      await page.goto(BASE + `asistencia.html?folio=${G3}`);
      await page.waitForSelector('[data-con-grupo]:not([hidden])');
      const boton = page.locator('[data-ir-aplicar] a.btn.btn-primario');
      comprueba(await boton.count() === 1 && /^Ir al pase de lista en el salón de cómputo/.test((await boton.textContent()).trim()) && /aplicar\.html\?folio=APD-G-2026-003$/.test(await boton.getAttribute('href'))
        && await page.locator('main .btn-primario:visible').count() === 1,
        t(`${ancho}: renovación: «Asistencia» trae un solo botón principal, «Ir al pase de lista en el salón de cómputo» («${await texto(page, '[data-con-grupo]')}»)`.slice(0, 400)));
      await revisaAxe(page, `${ancho}: renovación en «Asistencia»`);
      await Promise.all([page.waitForNavigation(), boton.click()]);
      await page.waitForSelector('[data-con-grupo]:not([hidden]) [data-filas] tr');
      const primero = await page.evaluate(() => document.querySelector('[data-con-grupo] h3').textContent.replace(/\s+/g, ' ').trim());
      comprueba(primero === 'Día 1 de 1 · Pase de lista en el salón de cómputo' && /asistencia del día del curso/.test(await texto(page, '[data-lista-texto]')),
        t(`${ancho}: renovación: en «Aplicar», primero el pase de lista del único día («${primero}» · «${await texto(page, '[data-lista-texto]')}»)`));
      sinErr(errores, `${ancho}: renovación`);
      await c.close();
    });
  }

  // Fuera de la prueba (sin fecha simulada; el reloj del navegador en el miércoles 14/10/2026): el día siguiente que no ha
  // llegado dice cuándo se captura, sin botón; «Aplicar» otro día dice que hoy no hay que pasar lista
  await bloque('fuera de la prueba', async () => {
    const { c, page, errores } = await nuevo(390, 844);
    await c.clock.setFixedTime(new Date('2026-10-14T17:00:00Z'));
    await conRuta(page, (j) => { delete j.fecha_corte; });
    await page.goto(BASE + `asistencia.html?folio=${G3}`);
    await guarda(page);
    const hecho = await texto(page, '[data-hecho]:not(.pasos-btn)');
    comprueba(/El día 4 se captura el jueves 15 de octubre de 2026/.test(hecho) && await page.locator('[data-hecho]:not(.pasos-btn) a.btn, [data-hecho]:not(.pasos-btn) button').count() === 0,
      t(`fuera de la prueba: al guardar el día 3, el aviso dice «El día 4 se captura el jueves 15 de octubre de 2026», sin botón («${hecho.slice(0, 160)}»)`));
    await page.goto(BASE + `aplicar.html?folio=${G3}`);
    await page.waitForSelector('[data-con-grupo]:not([hidden])');
    const lista = await texto(page, '[data-lista-texto]');
    comprueba(/^Hoy no hay que pasar lista/.test(lista) && /viernes 16 de octubre de 2026/.test(lista), t(`fuera de la prueba: «Aplicar» antes del día 5 dice que hoy no hay que pasar lista («${lista}»)`));
    sinErr(errores, 'fuera de la prueba');
    await c.close();
  });
}
/* ── Ajustes del equipo, 25/10/2026 (SOLO=ajustes25) ──
   1 · El grupo propio de una organización, sólo de una institución de gobierno: en el paso 3 de «Grupos» la opción no se
       ofrece donde no aplica y una línea dice por qué; la simulación de la base no crea uno de una empresa.
   2 · Perfil «capacitación»: en el menú de pruebas; su inicio con los grupos que esperan persona instructora o confirmación,
       del más próximo al más lejano; en la ficha asigna o cambia a la persona instructora (sólo las libres esas fechas),
       también durante el curso, y confirma; quien arma los grupos ya no.
   3 · Máximo dos oportunidades para corregir: «Te quedan 2 oportunidades para corregir» y «Esta es tu última oportunidad
       para corregir» en «Mis trámites» y al corregir; lo del cotejo no cuenta; en la revisión de la segunda corrección, el
       aviso desde el inicio y «Cerrar la solicitud» con confirmación y motivo; la persona ve el cierre y una sola acción
       principal, «Iniciar una solicitud nueva», que sí puede usar. Sin desborde y con axe en teléfono y escritorio. */
async function ajustes25(navegador) {
  const t = (m) => `[ajustes 25/10] ${m}`;
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  const nuevo = async (ancho = 1280, alto = 900, cambia = null) => {
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto } });
    if (cambia) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(cambia(structuredClone(datos))) }));
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    pg.on('dialog', (d) => d.accept().catch(() => {}));
    return { c, pg, errores };
  };
  const texto = async (pg, sel) => ((await pg.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const conAxe = async (pg, donde) => {
    if (!axe) { console.log(`OMITIDO  [ajustes 25/10] axe en ${donde}: falta AXE=<ruta a axe.min.js del estándar>`); return; }
    if (!(await pg.evaluate(() => Boolean(window.axe)))) await pg.evaluate(axe);
    const v = await pg.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((m) => m.html.slice(0, 100)).join(' || ')}`));
    comprueba(!v.length, t(`${donde}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
  };
  const como = (pg, id) => pg.evaluate((x) => localStorage.setItem('apd.sesion', JSON.stringify({ id: x })), id);
  const obsDe = (s) => datos.revision.filter((r) => r.solicitud_id === s.id && r.resultado === 'con_observaciones').length;
  const org = (id) => datos.organizacion.find((o) => o.id === id) || {};

  // ── 1 · Grupo propio sólo de gobierno (paso 3 de «Grupos») ──
  {
    const espera = datos.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva');
    const empresa = espera.filter((s) => org(s.organizacion_id).tipo === 'privada').map((s) => s.folio);
    const gobierno = espera.filter((s) => ['alcaldia', 'dependencia_cdmx', 'dependencia_federal'].includes(org(s.organizacion_id).tipo));
    const indep = espera.filter((s) => !s.organizacion_id).map((s) => s.folio);
    comprueba(empresa.length >= 1 && gobierno.length >= 1 && indep.length >= 1, t(`ficticios: en la espera de poda nueva hay gente de una empresa (${empresa.length}), de gobierno (${gobierno.length}) e independiente (${indep.length})`));
    for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
      const { c, pg, errores } = await nuevo(ancho, alto);
      await pg.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
      await listoGrupos(pg);
      await soloA(pg, [empresa[0]]);
      const nombreEmpresa = org(datos.solicitud.find((s) => s.folio === empresa[0]).organizacion_id).nombre;
      comprueba(await pg.isHidden('[data-opcion-especifico]') && await pg.isVisible('[data-sin-grupo-propio]') && (await texto(pg, '[data-sin-grupo-propio]')).startsWith(`${nombreEmpresa} no es una institución de gobierno`)
        && /Sólo las dependencias de la Ciudad, las Alcaldías y las dependencias federales tienen grupo propio/.test(await texto(pg, '[data-sin-grupo-propio]')) && await pg.isChecked('input[name="integracion"][value="combinado"]'),
        t(`${ancho} px: con gente de una empresa, sin la opción de grupo propio y una línea que dice por qué; el grupo queda combinado`));
      await sinDesborde(pg, t(`${ancho} px: paso 3 con la línea de por qué`));
      await conAxe(pg, `${ancho} px: paso 3 con la línea de por qué`);
      await soloA(pg, [gobierno[0].folio]);
      const nombreGob = org(gobierno[0].organizacion_id).nombre;
      comprueba(await pg.isVisible('[data-opcion-especifico]') && (await texto(pg, '[data-especifico-de]')) === `Sólo de ${nombreGob}` && await pg.isHidden('[data-sin-grupo-propio]'),
        t(`${ancho} px: con gente de una institución de gobierno (${nombreGob}), la opción de grupo propio sí se ofrece`));
      await soloA(pg, [gobierno[0].folio, indep[0]]);
      comprueba(await pg.isHidden('[data-opcion-especifico]') && /varias organizaciones o independientes/.test(await texto(pg, '[data-sin-grupo-propio]')),
        t(`${ancho} px: mezcladas (gobierno e independiente), el grupo es combinado y se dice por qué`));
      comprueba(!errores.length, t(`${ancho} px: grupos sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
      await c.close();
    }
    // La simulación, como la base (grupo_propio_sin_gobierno): un «crear» de grupo propio de una empresa no se aplica
    const { c, pg } = await nuevo();
    await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
    await listoGrupos(pg);
    const empresaId = datos.solicitud.find((s) => s.folio === empresa[0]).organizacion_id;
    const creado = await pg.evaluate(([oid, f]) => APD.cargar().then((d) => { const folio = APD_PERSONAL.siguienteFolioGrupo(d);
      return APD_PERSONAL.guardaGrupo({ tipo: 'crear', grupo_id: `prueba-grupo:${folio}:empresa`, folio, tipo_acreditacion: 'poda', modalidad: 'nueva', integracion: 'especifico', organizacion_id: oid, folios: [f], por: 'revision.prueba' })
        .then(() => APD.cargar()).then((d2) => d2.grupo.some((g) => g.folio === folio)); }), [empresaId, empresa[0]]);
    comprueba(creado === false, t('la simulación de la base no crea un grupo propio de una empresa (grupo_propio_sin_gobierno)'));
    await c.close();
  }

  // ── 2 · Perfil «capacitación» ──
  {
    const { c, pg, errores } = await nuevo(1280, 900);
    // El menú de pruebas: «Personal de la Secretaría» → «Capacitación: asignar instructores y confirmar»
    await pg.goto(BASE + 'revision.html');
    await pg.waitForSelector('.menu-pruebas-boton');
    await pg.click('.menu-pruebas-boton');
    await pg.selectOption('#menu-pruebas-perfil', 'personal');
    const opciones = await pg.$$eval('#menu-pruebas-persona option', (l) => l.map((o) => o.value));
    await pg.selectOption('#menu-pruebas-persona', 'personal-capacitacion');
    await Promise.all([pg.waitForURL(/capacitacion\.html\?perfil=capacitacion/), pg.click('dialog.menu-pruebas >> button:text-is("Entrar")')]);
    await pg.waitForSelector('[data-por-confirmar] tbody tr');
    comprueba(opciones.includes('personal-capacitacion') && /Perfil: capacitación/.test(await texto(pg, '[data-sesion-personal]'))
      && (await pg.getAttribute('[data-sesion-personal] a[href="capacitacion.html"]', 'aria-current')) === 'page',
      t('menú de pruebas: «Capacitación» entra a su inicio, «Grupos por asignar y confirmar», con el perfil capacitación'));
    // Del más próximo al más lejano: se agregan dos grupos por confirmar con semana (el 16/11 y el 02/11)
    await pg.evaluate(() => APD.cargar().then(async (d) => {
      for (const inicio of ['2026-11-16', '2026-11-02']) {
        const d1 = await APD.cargar();
        const folio = APD_PERSONAL.siguienteFolioGrupo(d1);
        const id = `prueba-grupo:${folio}:orden`;
        await APD_PERSONAL.guardaGrupo({ tipo: 'crear', grupo_id: id, folio, tipo_acreditacion: 'poda', modalidad: 'nueva', integracion: 'combinado', organizacion_id: null, folios: [], por: 'revision.prueba' });
        await APD_PERSONAL.guardaGrupo({ tipo: 'proponer', grupo_id: id, fecha_inicio: inicio, hora_entrada: '09:00', por: 'revision.prueba', perfil: 'revision_cotejo' });
      }
      return d;
    }));
    await pg.reload();
    await pg.waitForSelector('[data-por-confirmar] tbody tr');
    const orden = await pg.$$eval('[data-por-confirmar] tbody tr', (l) => l.map((x) => x.dataset.grupo));
    comprueba(orden.join() === 'APD-G-2026-005,APD-G-2026-008,APD-G-2026-007,APD-G-2026-004',
      t(`inicio: los grupos que esperan, del más próximo al más lejano y los que no tienen semana al final (${orden.join(', ')})`));
    const confirmados = await pg.$$eval('[data-confirmados] tbody tr', (l) => l.map((x) => x.dataset.grupo));
    comprueba(confirmados.join() === 'APD-G-2026-006,APD-G-2026-003' && /Cambiar la persona instructora/.test(await texto(pg, '[data-confirmados]')),
      t('inicio: los confirmados y en curso, para cambiar a la persona instructora'));
    await sinDesborde(pg, t('inicio de Capacitación a 1280 px'));
    await conAxe(pg, 'inicio de Capacitación a 1280 px');
    await pg.setViewportSize({ width: 390, height: 844 });
    await sinDesborde(pg, t('inicio de Capacitación a 390 px'));
    await conAxe(pg, 'inicio de Capacitación a 390 px');
    await pg.setViewportSize({ width: 1280, height: 900 });

    // Un grupo completo con su semana: Capacitación le asigna la persona instructora (sin confirmar) y luego lo confirma
    const cinco = datos.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva').slice(0, 5).map((s) => s.folio);
    await pg.evaluate((fs) => APD.cargar().then((d) => APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: d.grupo.find((g) => g.folio === 'APD-G-2026-008').id, folios: fs, por: 'revision.prueba' })), cinco);
    await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-008&perfil=capacitacion');
    await pg.waitForSelector('#confirmar:not([hidden])');
    const ops = await pg.$$eval('#instructor option', (l) => l.filter((o) => o.value).map((o) => [o.value, o.disabled]));
    comprueba((await texto(pg, '#confirmar [data-accion="enviar"]')) === 'Asignar y confirmar el grupo' && await pg.isVisible('[data-asignar="solo"]') && ops.every(([, dis]) => !dis)
      && /Grupos por asignar y confirmar/.test(await texto(pg, '.btn-atras')),
      t('ficha (Capacitación): con su semana y el mínimo, «Asignar y confirmar el grupo» y «Sólo asignar, sin confirmar»; las dos personas instructoras libres esas fechas'));
    await sinDesborde(pg, t('ficha del grupo de Capacitación a 1280 px'));
    await conAxe(pg, 'ficha del grupo de Capacitación a 1280 px');
    await pg.selectOption('#instructor', 'instructor2.ficticio');
    const llegaI = pg.waitForURL(/hecho=instructor/);
    await pg.click('[data-asignar="solo"]');
    await llegaI;
    await pg.waitForSelector('[data-hecho] .aviso');
    comprueba(/Persona instructora asignada/.test(await texto(pg, '[data-hecho]')) && /Por confirmar/.test(await texto(pg, '[data-situacion]')) && /Instructor Ejemplo Dos/.test(await texto(pg, '[data-datos]')),
      t('«Sólo asignar, sin confirmar»: la persona instructora queda asignada y el grupo sigue por confirmar'));
    await pg.goto(BASE + 'capacitacion.html');
    await pg.waitForSelector('[data-por-confirmar] tbody tr');
    const fila8 = await texto(pg, '[data-por-confirmar] tr[data-grupo="APD-G-2026-008"]');
    comprueba(/Lista para confirmar/.test(fila8) && /Confirmar el grupo/.test(fila8) && /Instructor Ejemplo Dos/.test(fila8), t(`inicio: el grupo con todo dice «Lista para confirmar» («${fila8}»)`));
    await pg.click('[data-por-confirmar] tr[data-grupo="APD-G-2026-008"] a');
    await pg.waitForSelector('#confirmar:not([hidden])');
    comprueba((await texto(pg, '#confirmar [data-accion="enviar"]')) === 'Confirmar el grupo' && (await pg.inputValue('#instructor')) === 'instructor2.ficticio', t('ficha: con la persona instructora ya asignada, «Confirmar el grupo»'));
    const llegaC = pg.waitForURL(/hecho=confirmado/);
    await pg.click('#confirmar [data-accion="enviar"]');
    await llegaC;
    await pg.waitForSelector('[data-situacion] .estado');
    const g8 = await pg.evaluate(() => APD.cargar().then((d) => { const g = d.grupo.find((x) => x.folio === 'APD-G-2026-008'); return `${g.estado} ${g.instructor} ${APD.hhmm(g.hora_entrada)}`; }));
    comprueba(g8 === 'confirmado instructor2.ficticio 09:00' && /Confirmado/.test(await texto(pg, '[data-situacion]')), t(`Capacitación confirma el grupo (${g8})`));
    // Cambiar la persona instructora durante el curso (APD-G-2026-003, en curso): sólo Capacitación
    await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-003&perfil=capacitacion#t-confirmar');
    await pg.waitForSelector('#confirmar:not([hidden])');
    comprueba((await texto(pg, '[data-confirmar-titulo]')) === 'Persona instructora' && /durante el curso: el cambio queda en la bitácora/.test(await texto(pg, '[data-confirmar-bajada]')) && (await texto(pg, '#confirmar [data-accion="enviar"]')) === 'Cambiar la persona instructora',
      t('ficha de un grupo en curso (Capacitación): «Cambiar la persona instructora», con el cambio en la bitácora'));
    await pg.selectOption('#instructor', 'instructor2.ficticio');
    const llegaX = pg.waitForURL(/hecho=instructor_cambiado/);
    await pg.click('#confirmar [data-accion="enviar"]');
    await llegaX;
    await pg.waitForSelector('[data-hecho] .aviso');
    const g3 = await pg.evaluate(() => APD.cargar().then((d) => { const g = d.grupo.find((x) => x.folio === 'APD-G-2026-003'); return `${g.estado} ${g.instructor}`; }));
    comprueba(/Persona instructora cambiada/.test(await texto(pg, '[data-hecho]')) && g3 === 'en_curso instructor2.ficticio', t(`durante el curso, Capacitación cambia a la persona instructora (${g3})`));
    // Quien arma los grupos ya no asigna ni confirma: en la ficha ve lo que falta y quién lo hace, sin formulario
    await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005');
    await pg.waitForSelector('[data-confirmar]:not([hidden])');
    comprueba(await pg.isHidden('#confirmar') && /Para confirmar el grupo/.test(await texto(pg, '[data-confirmar]')) && /lo confirma el área de Instructores y Capacitación/.test(await texto(pg, '[data-confirmar]')),
      t('ficha (quien arma los grupos): sin formulario de persona instructora ni de confirmar; dice que lo hace el área de Instructores y Capacitación'));
    await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-003');
    await pg.waitForSelector('[data-situacion] .estado');
    comprueba(await pg.isHidden('[data-confirmar]'), t('ficha de un grupo en curso (quien arma los grupos): no cambia a la persona instructora'));
    // La simulación, como la base: un «confirmar» o un cambio de persona instructora sin el perfil se ignora
    const sinPerfil = await pg.evaluate(() => APD.cargar().then((d) => { const g = d.grupo.find((x) => x.folio === 'APD-G-2026-005');
      return APD_PERSONAL.guardaGrupo({ tipo: 'instructor', grupo_id: g.id, instructor: 'instructor2.ficticio', perfil: 'revision_cotejo', por: 'revision.prueba' })
        .then(() => APD.cargar()).then((d2) => d2.grupo.find((x) => x.folio === 'APD-G-2026-005').instructor); }));
    comprueba(sinPerfil === 'instructor.ficticio', t(`la simulación de la base no deja a quien arma los grupos cambiar la persona instructora (instructor_sin_permiso; sigue ${sinPerfil})`));
    comprueba(!errores.length, t(`Capacitación sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
    // La ficha de Capacitación en teléfono
    const t2 = await nuevo(390, 844);
    await t2.pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005&perfil=capacitacion');
    await t2.pg.waitForSelector('#confirmar:not([hidden])');
    await sinDesborde(t2.pg, t('ficha del grupo de Capacitación a 390 px'));
    await conAxe(t2.pg, 'ficha del grupo de Capacitación a 390 px');
    await t2.c.close();
  }

  // ── 3 · Máximo dos oportunidades para corregir ──
  const conObs1 = datos.solicitud.find((s) => s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda' && obsDe(s) === 1);
  const ultima = datos.solicitud.find((s) => s.estado === 'con_observaciones' && obsDe(s) === 2);
  const segunda = datos.solicitud.find((s) => s.estado === 'enviada' && obsDe(s) === 2);
  const agotada = datos.solicitud.find((s) => s.estado === 'concluida_sin_atender' && /^Se agotaron las oportunidades de corrección/.test(s.motivo_cierre || ''));
  comprueba(Boolean(conObs1 && ultima && segunda && agotada) && obsDe(agotada) === 3,
    t(`ficticios: con observaciones una vez (${conObs1 && conObs1.folio}) y dos (${ultima && ultima.folio}), reenviada con su segunda corrección (${segunda && segunda.folio}) y cerrada al agotarlas (${agotada && agotada.folio})`));
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    const { c, pg, errores } = await nuevo(ancho, alto);
    await pg.goto(BASE + 'index.html');
    // «Mis trámites»: cuántas oportunidades le quedan
    await como(pg, conObs1.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-solicitudes] .ficha [data-oportunidades]');
    comprueba((await texto(pg, '[data-solicitudes] [data-oportunidades]')) === 'Te quedan 2 oportunidades para corregir.', t(`${ancho} px: «Mis trámites» con observaciones por primera vez: «Te quedan 2 oportunidades para corregir»`));
    await como(pg, ultima.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-solicitudes] .ficha [data-oportunidades]');
    comprueba(/^Esta es tu última oportunidad para corregir\. Si en la revisión siguen las observaciones, tu solicitud se cierra/.test(await texto(pg, '[data-solicitudes] [data-oportunidades]')),
      t(`${ancho} px: «Mis trámites» con observaciones por segunda vez: «Esta es tu última oportunidad para corregir»`));
    await sinDesborde(pg, t(`${ancho} px: «Mis trámites» en su última oportunidad`));
    await conAxe(pg, `${ancho} px: «Mis trámites» en su última oportunidad`);
    // «Corregir documentos» (la solicitud con observaciones): lo mismo, en el aviso de lo que debe corregir
    await pg.goto(BASE + `solicitud.html?folio=${ultima.folio}`);
    await pg.waitForSelector('[data-observaciones]:not([hidden]) [data-oportunidades]');
    comprueba((await texto(pg, '[data-observaciones] [data-oportunidades]')).startsWith('Esta es tu última oportunidad para corregir.'), t(`${ancho} px: al corregir, «Esta es tu última oportunidad para corregir»`));
    await como(pg, conObs1.solicitante_id);
    await pg.goto(BASE + `solicitud.html?folio=${conObs1.folio}`);
    await pg.waitForSelector('[data-observaciones]:not([hidden]) [data-oportunidades]');
    comprueba((await texto(pg, '[data-observaciones] [data-oportunidades]')) === 'Te quedan 2 oportunidades para corregir.', t(`${ancho} px: al corregir, «Te quedan 2 oportunidades para corregir»`));
    // Cerrada al agotarlas (ficticio): el motivo y una sola acción principal, «Iniciar una solicitud nueva»
    await como(pg, agotada.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-anteriores] .ficha');
    const ficha = await texto(pg, '[data-anteriores] .ficha');
    const principales = await pg.$$eval('main .btn-primario', (l) => l.filter((b) => b.checkVisibility()).map((b) => [b.textContent.trim(), b.getAttribute('href')]));
    comprueba(/Cerrada: se agotaron tus oportunidades para corregir/.test(ficha) && /Motivo del cierre\s*Se agotaron las oportunidades de corrección/.test(ficha)
      && principales.length === 1 && principales[0][0] === 'Iniciar una solicitud nueva' && principales[0][1] === 'solicitud.html?tipo=poda' && await pg.isHidden('[data-nueva]'),
      t(`${ancho} px: cerrada al agotar las oportunidades, ve el motivo y una sola acción principal, «Iniciar una solicitud nueva» (${JSON.stringify(principales)})`));
    await sinDesborde(pg, t(`${ancho} px: «Mis trámites» cerrada al agotar las oportunidades`));
    await conAxe(pg, `${ancho} px: «Mis trámites» cerrada al agotar las oportunidades`);
    await Promise.all([pg.waitForURL(/solicitud\.html\?tipo=poda/), pg.click('main .btn-primario:has-text("Iniciar una solicitud nueva")')]);
    await pg.waitForSelector('input[name="tipo"][value="poda"]', { state: 'attached' });
    await pg.waitForFunction(() => document.querySelector('input[name="tipo"][value="poda"]').checked);
    comprueba(!(await pg.isDisabled('input[name="tipo"][value="poda"]')) && !/Ya tienes un trámite en curso/.test(await texto(pg, 'main')),
      t(`${ancho} px: «Iniciar una solicitud nueva» abre la solicitud de poda y ninguna regla de «una solicitud activa» lo impide`));
    comprueba(!errores.length, t(`${ancho} px: la persona sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
  }
  // Lo que no coincidió en el cotejo no cuenta: se dice
  {
    const conCitaP = datos.solicitud.find((s) => s.estado === 'validada_en_linea' && s.cita_en && obsDe(s) === 0);
    const { c, pg, errores } = await nuevo(1280, 900, (d) => {
      const s = d.solicitud.find((x) => x.id === conCitaP.id);
      Object.assign(s, { estado: 'con_observaciones', estado_desde: `${d.fecha_corte}T11:00:00-06:00` });
      const doc = d.documento.find((x) => x.solicitud_id === s.id && x.vigente && x.requisito === 'curp');
      Object.assign(doc, { estado: 'con_observacion', observacion: 'La CURP original no coincide con la cargada.' });
      d.cita = d.cita.filter((x) => x.solicitud_id !== s.id).concat([{ solicitud_id: s.id, programada_en: `${d.fecha_corte}T10:00:00-06:00`, resultado: 'con_observaciones', atendida_en: `${d.fecha_corte}T11:00:00-06:00`, observacion: 'CURP: no coincide.' }]);
      return d;
    });
    await pg.goto(BASE + 'index.html');
    await como(pg, conCitaP.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-solicitudes] .ficha [data-oportunidades]');
    comprueba((await texto(pg, '[data-solicitudes] [data-oportunidades]')) === 'Corregir lo que no coincidió en tu cita de cotejo no cuenta entre tus oportunidades para corregir.' && !errores.length,
      t('lo que no coincidió en el cotejo no cuenta entre las oportunidades para corregir, y se dice'));
    await c.close();
  }
  // El personal: la revisión de la segunda corrección
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    const { c, pg, errores } = await nuevo(ancho, alto);
    await pg.goto(BASE + `revisar.html?folio=${segunda.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    comprueba(await pg.isVisible('[data-ultima-oportunidad] .aviso') && /Es la revisión de la segunda corrección: la última oportunidad/.test(await texto(pg, '[data-ultima-oportunidad]'))
      && /Si algo sigue con observación, la solicitud se cierra \(«Se agotaron las oportunidades de corrección»\)/.test(await texto(pg, '[data-ultima-oportunidad]')),
      t(`${ancho} px: «Revisar» avisa desde el inicio que es la revisión de la segunda corrección, la última oportunidad`));
    await conAxe(pg, `${ancho} px: «Revisar» con el aviso de la última oportunidad`);
    const k = (await docsRevision(pg)).find((x) => !(datos.documento.find((d) => d.solicitud_id === segunda.id && d.vigente && d.requisito === x) || {}).estado || (datos.documento.find((d) => d.solicitud_id === segunda.id && d.vigente && d.requisito === x) || {}).estado === 'pendiente');
    for (const x of await docsRevision(pg)) if (x !== k && await pg.evaluate((n) => document.getElementById(`decidir_${n}`).value === 'si', x)) await decideDoc(pg, x, 'aceptado');
    await decideDoc(pg, k, 'con_observacion', 'Sigue vencida: carga una identificación vigente.');
    await alPaso(pg, 'Resultado');
    const boton = await pg.$eval('#formulario [data-accion="enviar"]', (b) => [b.textContent.trim(), b.className, b.checkVisibility()]);
    comprueba(boton[0] === 'Cerrar la solicitud' && /btn-peligro-contorno/.test(boton[1]) && boton[2] && await pg.isVisible('[data-cierre]') && /Motivo: «Se agotaron las oportunidades de corrección»/.test(await texto(pg, '[data-cierre]'))
      && !/Enviar las observaciones/.test(await texto(pg, '#formulario section[data-paso]:not([hidden])')),
      t(`${ancho} px: con algo observado, la acción principal del resultado es «Cerrar la solicitud» (con su motivo), no regresar con observaciones`));
    await sinDesborde(pg, t(`${ancho} px: «Revisar», resultado que cierra`));
    await conAxe(pg, `${ancho} px: «Revisar», resultado que cierra`);
    await pg.click('#formulario [data-accion="enviar"]');
    await pg.waitForSelector('dialog.dialogo-confirma[open]');
    const dlg = await texto(pg, 'dialog.dialogo-confirma[open]');
    comprueba(dlg.includes(`¿Cerrar la solicitud ${segunda.folio}?`) && /Motivo: Se agotaron las oportunidades de corrección/.test(dlg) && /iniciar una solicitud nueva de inmediato/.test(dlg) && /Sí, cerrar la solicitud/.test(dlg),
      t(`${ancho} px: «Cerrar la solicitud» pide confirmación, con el motivo ya escrito`));
    await pg.click('dialog.dialogo-confirma[open] [data-r="si"]');
    await pg.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    const despues = await pg.evaluate((f) => APD.cargar().then((d) => { const s = d.solicitud.find((x) => x.folio === f); return `${s.estado} · ${s.motivo_cierre}`; }), segunda.folio);
    comprueba(/Solicitud cerrada: se agotaron las oportunidades de corrección/.test(await texto(pg, '[data-hecho]:not(.pasos-btn)')) && /Cerrada: sin más oportunidades de corrección/.test(await texto(pg, '[data-estado]'))
      && despues === 'concluida_sin_atender · Se agotaron las oportunidades de corrección', t(`${ancho} px: la solicitud queda cerrada con su motivo, como en la base (${despues})`));
    // La persona ve el cierre y puede iniciar otra
    await como(pg, segunda.solicitante_id);
    await pg.goto(BASE + 'tramites.html');
    await pg.waitForSelector('[data-anteriores] .ficha');
    comprueba(/Motivo del cierre\s*Se agotaron las oportunidades de corrección/.test(await texto(pg, '[data-anteriores] .ficha')) && await pg.locator('main .btn-primario:has-text("Iniciar una solicitud nueva")').count() === 1,
      t(`${ancho} px: la persona ve el cierre con su motivo y «Iniciar una solicitud nueva»`));
    comprueba(!errores.length, t(`${ancho} px: revisión de la segunda corrección sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
    await c.close();
  }
  // Una revisión que no es la última: sin el aviso y con «Enviar las observaciones a la persona»
  {
    const { c, pg } = await nuevo();
    await pg.goto(BASE + `revisar.html?folio=${reenviada.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    // El documento que se vuelve a decidir (el corregido; lo aceptado antes no se decide otra vez)
    const k = (await docsRevision(pg)).find((x) => x) && await pg.evaluate(() => [...document.querySelectorAll('input[id^="decidir_"]')].find((i) => i.value === 'si').id.slice('decidir_'.length));
    await decideDoc(pg, k, 'con_observacion', 'Corrige el documento.');
    await alPaso(pg, 'Resultado');
    comprueba(await pg.isHidden('[data-ultima-oportunidad]') && (await texto(pg, '#formulario [data-accion="enviar"]')) === 'Enviar las observaciones a la persona' && await pg.isHidden('[data-cierre]'),
      t('la segunda revisión (le queda una oportunidad) no avisa del cierre y regresa con observaciones, como siempre'));
    await c.close();
  }
}

/* ── Acomodo de escritorio, parte B (decisión de Liber del 25/10/2026; docs/diseno-escritorio/DIAGNOSTICO.md 4.3 y 4.4;
   SOLO=escritorio-b) ──
   Inicio del personal (bandeja) y «Grupos» (sus cuatro pasos) a 1366 × 768, 1440 × 900 y 1920 × 1080:
     · lo que queda a la vista sin bajar (criterio de aceptación: en el estado inicial, lo que identifica el caso y la acción
       principal; en la bandeja, los indicadores, las pestañas, la búsqueda y el encabezado de la tabla; en «Grupos», el
       panel «Tu grupo» con el curso y su «Siguiente», y el cupo desde «Quiénes van»);
     · lo fijo: las barras (lo fijo a lo ancho, como el encabezado de la tabla) suman 25 % del alto o menos, arriba y a media
       página (criterio de P177); un lateral fijo (el panel) cabe completo en la ventana;
     · sin desborde horizontal y axe sin violaciones;
   y a 390 × 844, que el orden y el alto sigan como antes (versión 0.70, medidos el 25/10/2026) o mejor: sin indicadores,
   sin lista de pestañas ni panel lateral, y las secciones una debajo de otra en el orden de antes. Además, las pestañas con
   el teclado y desde un enlace, la paginación, «Quitar» del panel (que anuncia «n de 25») y sus botones. */
async function escritorioB(navegador) {
  const t = (m) => `[escritorio B] ${m}`;
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  if (!axe) console.log('OMITIDO  [escritorio B] axe: falta AXE=<ruta a axe.min.js del estándar>');
  const revisaAxe = async (page, que) => {
    if (!axe) return;
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axe);
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 140)).join(' || ')}`));
    comprueba(!v.length, t(`${que}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
  };
  // Lo fijo en la ventana: las barras (unión de sus franjas de alto) y los laterales (angostos y altos), sin el menú de pruebas
  const fijo = (page) => page.evaluate(() => {
    const H = innerHeight, W = innerWidth;
    const franjas = [];
    const laterales = [];
    for (const e of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(e).position;
      if (pos !== 'sticky' && pos !== 'fixed') continue;
      if (e.closest('.menu-pruebas-boton, .menu-pruebas, dialog, #version-sia') || !e.checkVisibility()) continue;
      const r = e.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= H || !r.width || !r.height) continue;
      if (r.width <= W * 0.4 && r.height > H * 0.25) laterales.push({ arriba: Math.round(r.top), abajo: Math.round(r.bottom), pegado: Math.abs(r.top - parseFloat(getComputedStyle(e).top)) < 1 });
      else franjas.push([Math.max(0, r.top), Math.min(H, r.bottom)]);
    }
    franjas.sort((a, b) => a[0] - b[0]);
    let suma = 0, fin = -1;
    for (const [a, b] of franjas) { if (b <= fin) continue; suma += b - Math.max(a, fin); fin = b; }
    return { barras: suma / H, laterales, H };
  });
  const enVentana = (page, sel) => page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.checkVisibility());
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 0.5 ? true : `${Math.round(r.top)}–${Math.round(r.bottom)} de ${innerHeight}`;
  }, sel);
  const alto = (page) => page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
  const PANEL = ['#t-tu-grupo', '[data-panel-datos] dd', '[data-panel-siguiente]'];
  const PANTALLAS = [
    // Con la cabecera compacta de la parte A (integración), también la primera fila con su «Revisar», a 1366 × 768
    // A 390 px, 5.16 pantallas desde el 26/10/2026 (antes 6.201): sin registro asistido ya no están sus dos entradas ni la
    // lista de avisos por teléfono; queda la entrada «Consultar un trámite»
    ['bandeja', 'revision.html', '[data-filas] tr', ['[data-indicadores]', '[role="tablist"]', '#buscar', '.tabla-bandeja thead', '[data-filas] tr:first-child .btn'], 5.16],
    ['grupos · 1 El curso', 'grupos.html?curso=poda-nueva&paso=1', '#paso-curso:not([hidden])', PANEL, 4.517],
    ['grupos · 2 La semana', 'grupos.html?curso=poda-nueva&paso=2', '#paso-semana:not([hidden]) .arm-semana', PANEL, 5.675],
    ['grupos · 3 Quiénes van', 'grupos.html?curso=poda-nueva&paso=3', '#paso-personas:not([hidden]) .plan-persona', [...PANEL, '[data-panel-cupo]'], 5.224],
    ['grupos · 4 Confirmar', 'grupos.html?curso=poda-nueva&paso=4', '#paso-confirmar:not([hidden]) [data-resumen] .datos', [...PANEL, '[data-panel-cupo]'], 5.161]
  ];
  for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const ctx = await navegador.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: ZONA });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    for (const [nombre, url, listo, aLaVista] of PANTALLAS) {
      const d = `${nombre} a ${w} × ${h}`;
      await page.goto(BASE + url);
      await page.waitForSelector(listo);
      await page.waitForTimeout(150);
      const fuera = [];
      for (const sel of aLaVista) { const r = await enVentana(page, sel); if (r !== true) fuera.push(`${sel}: ${r === null ? 'no se ve' : r}`); }
      comprueba(!fuera.length, t(`${d}: a la vista sin bajar (${aLaVista.join(', ')})${fuera.length ? ' · fuera: ' + fuera.join('; ') : ''}`));
      for (const [donde, y] of [['arriba', 0], ['a media página', 0.5]]) {
        await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), y);
        await page.waitForTimeout(50);
        const f = await fijo(page);
        // Un lateral mide a lo más el alto de la ventana; ya pegado arriba, cabe completo
        const mal = f.laterales.filter((l) => l.abajo - l.arriba > f.H + 0.5 || (l.pegado && (l.arriba < 0 || l.abajo > f.H + 0.5)));
        comprueba(f.barras <= 0.25 && !mal.length, t(`${d}, ${donde}: lo fijo a lo ancho ocupa ${Math.round(f.barras * 100)} % del alto (25 % o menos) y el lateral fijo cabe en la ventana${mal.length ? ': ' + JSON.stringify(mal) : ''}`));
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sinDesborde(page, t(d));
      await revisaAxe(page, d);
    }
    // Las pestañas: con el teclado (flechas) y desde un indicador que lleva a otra pestaña; la página 1 de la bandeja
    if (w === 1440) {
      await page.goto(BASE + 'revision.html');
      await page.waitForSelector('[data-filas] tr');
      await page.focus('#pe-solicitudes');
      await page.keyboard.press('ArrowRight');
      // Sin registro asistido (decisión del 26/10/2026): dos pestañas, la bandeja y «Consultar un trámite»
      comprueba(await page.evaluate(() => document.activeElement.id === 'pe-consulta' && document.getElementById('pe-consulta').getAttribute('aria-selected') === 'true'
        && document.getElementById('panel-solicitudes').hidden && !document.getElementById('panel-consulta').hidden
        && document.querySelectorAll('[data-pestanas] [role="tab"]').length === 2),
      t('bandeja: la flecha derecha pasa a «Consultar un trámite» y muestra su panel (módulo pestanas del estándar); son dos pestañas'));
      await revisaAxe(page, 'bandeja con la pestaña «Consultar un trámite»');
      comprueba(await page.getAttribute('#panel-consulta .menu-opcion', 'href') === 'ventanilla.html', t('bandeja: «Consultar un trámite» lleva a la búsqueda (ventanilla.html)'));
      await page.keyboard.press('Home');
      comprueba(await page.isVisible('#panel-solicitudes') && !(await page.isVisible('#panel-consulta')), t('bandeja: Inicio regresa a «Solicitudes por revisar»'));
      await page.click('#pe-solicitudes');
      const ind = (await page.textContent('[data-indicadores]')).replace(/\s+/g, ' ').trim();
      const enviadas = datos.solicitud.filter((x) => x.estado === 'enviada').length;
      comprueba(new RegExp(`^Por revisar ${enviadas} `).test(ind) && /Citas de hoy \d+ /.test(ind) && !/Avisos por teléfono/.test(ind) && /En espera de grupo \d+ en \d curso/.test(ind)
        && (await page.textContent('#pe-solicitudes')) === `Solicitudes por revisar (${enviadas})`,
      t(`bandeja: los indicadores («${ind}») y la cuenta de la pestaña`));
      comprueba((await page.$$('.indicador-inicio')).length === 3, t('bandeja: tres indicadores (sin «Avisos por teléfono»)'));
      await page.goto(BASE + 'revision.html#t-consulta');
      await page.waitForSelector('#panel-consulta .menu-opcion');
      comprueba(await page.isVisible('#panel-consulta .menu-opcion') && (await page.getAttribute('#pe-consulta', 'aria-selected')) === 'true',
        t('bandeja: revision.html#t-consulta abre la pestaña «Consultar un trámite»'));
      comprueba(await page.isHidden('[data-paginacion]'), t('bandeja: con 25 solicitudes o menos no hay paginación'));
      // «Grupos»: «Quitar» del panel desmarca, anuncia «n de 25» y deja el foco en la siguiente; los botones del panel
      await page.goto(BASE + 'grupos.html?curso=poda-nueva&paso=3');
      await page.waitForSelector('#paso-personas:not([hidden]) .plan-persona');
      const antes = await page.$$eval('[data-quitar]', (l) => l.length);
      const folio = await page.getAttribute('[data-quitar]', 'data-quitar');
      await page.click('[data-quitar]');
      await page.waitForFunction(() => /de 25 lugares/.test((document.querySelector('[data-anuncios]') || {}).textContent || ''));
      const anuncio = await page.textContent('[data-anuncios]');
      comprueba(!(await page.isChecked(`.plan-casilla[value="${folio}"]`)) && (await page.$$eval('[data-quitar]', (l) => l.length)) === antes - 1
        && new RegExp(`^${antes - 1} de 25 lugares`).test(anuncio.trim()) && (await page.evaluate(() => document.activeElement.matches('[data-quitar]'))),
      t(`grupos: «Quitar» en el panel desmarca a la persona, anuncia «${anuncio.trim().slice(0, 30)}…» y deja el foco en la siguiente`));
      await page.evaluate(() => { document.querySelector('[data-anuncios]').textContent = ''; });
      await page.check(`.plan-casilla[value="${folio}"]`);
      await page.waitForFunction((n) => (document.querySelector('[data-anuncios]').textContent || '').trim().startsWith(`${n} de 25 lugares`), antes).catch(() => {});
      comprueba((await page.textContent('[data-anuncios]')).trim().startsWith(`${antes} de 25 lugares`), t('grupos: marcar en la lista sigue anunciando «n de 25»'));
      await page.click('[data-panel-siguiente]');
      await page.waitForSelector('#paso-confirmar:not([hidden])');
      comprueba(await page.evaluate(() => document.activeElement.matches('#paso-confirmar .titulo-paso')) && (await page.textContent('[data-panel-siguiente]')) === 'Crear el grupo'
        && (await page.getAttribute('[data-barra] [aria-current="step"]', 'aria-current')) === 'step',
      t('grupos: «Siguiente» del panel avanza al paso 4 con el foco en su título; el panel ofrece «Crear el grupo»'));
      await page.click('[data-panel-atras]');
      await page.waitForSelector('#paso-personas:not([hidden])');
      bien(t('grupos: «Atrás» del panel regresa al paso 3'));
      // Filtro por organización: deja sólo las filas y bloques de esa organización
      const org = await page.$eval('#filtro_org option:nth-child(2)', (o) => o.value);
      await page.selectOption('#filtro_org', org);
      comprueba(await page.$$eval('[data-personas] li[data-org]', (l, o) => l.filter((x) => x.checkVisibility()).every((x) => x.dataset.org === o) && l.some((x) => x.checkVisibility()), org),
        t(`grupos: el filtro por organización deja sólo «${org}»`));
      await page.click('#pe-programados');
      comprueba(await page.isVisible('[data-programados] table') && await page.isHidden('#panel-armar'), t('grupos: la pestaña «Grupos programados» muestra sus tablas'));
      await page.click('#pe-terminados');
      comprueba(await page.isVisible('[data-terminados-lista] li'), t('grupos: la pestaña «Ya terminaron» se ve abierta'));
    }
    comprueba(!errores.length, t(`${w} × ${h}: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
    await ctx.close();
  }
  // Teléfono: como antes (orden y alto de la versión 0.70, o mejor)
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', timezoneId: ZONA, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  for (const [nombre, url, listo, , antes] of PANTALLAS) {
    await page.goto(BASE + url);
    await page.waitForSelector(listo);
    await page.waitForTimeout(150);
    const a = await alto(page);
    const orden = await page.evaluate(() => {
      const y = (s) => { const e = document.querySelector(s); return e && e.checkVisibility() ? e.getBoundingClientRect().top + scrollY : null; };
      const sinEscritorio = ['[data-indicadores]', '.pestanas-lista', '[data-panel-grupo]', '.espera-cabeza', '[data-filtro-org]'].every((s) => y(s) === null);
      if (document.querySelector('#panel-solicitudes')) return sinEscritorio && y('#panel-solicitudes') < y('#panel-consulta .menu-opcion');
      const paso = [...document.querySelectorAll('#armar [data-paso]')].findIndex((s) => !s.hidden) + 1;
      return sinEscritorio && y('#panel-armar') < y('#programados') && y('#programados') < y('[data-terminados] summary') && (paso === 1 || y('[data-eleccion]') < y('#armar'));
    });
    comprueba(a <= antes + 0.02 && orden, t(`${nombre} a 390 px: mide ${a.toFixed(2)} pantallas (antes ${antes}) y conserva su orden, sin lo de escritorio`));
    await sinDesborde(page, t(`${nombre} a 390 px`));
    await revisaAxe(page, `${nombre} a 390 px`);
  }
  await ctx.close();
}

/* ── Decisiones de Liber del 26/10/2026 (SOLO=consulta, SOLO=ayuda, SOLO=directivo, SOLO=cita20) ──
   Sin registro asistido: la ventanilla queda como «Consultar un trámite», consulta general del personal de revisión y
   cotejo; letreros de ayuda para la persona solicitante; perfil «Directivo» (P201) y la cita de cotejo dentro de 20 días
   hábiles (P205). En teléfono (390 px) y computadora (1280 px), con axe, sin desborde y sin errores en la consola. */
const axeDel26 = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
function revisaAxe26(t) {
  return async (page, que) => {
    if (!axeDel26) return;
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axeDel26);
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 160)).join(' || ')}`));
    comprueba(!v.length, t(`${que}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
  };
}
async function contexto26(navegador, ancho, alto, sesion) {
  const movil = ancho < 600;
  const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
  if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
  const page = await c.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  return { c, page, errores };
}
const texto26 = async (page, sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

/* «Consultar un trámite» (ventanilla.html): busca por CURP, nombre, folio o expediente; dice en qué va y qué sigue, de tú y
   con lo de «Mis trámites»; sin cuentas asistidas, avisos por teléfono ni carga por el personal. Y que las piezas del
   registro asistido ya no están. */
async function consultaTramite(navegador) {
  const t = (m) => `[consultar un trámite] ${m}`;
  const revisaAxe = revisaAxe26(t);
  const conObsP = datos.solicitante.find((p) => p.estado === 'activa' && datos.solicitud.some((s) => s.solicitante_id === p.id && s.estado === 'con_observaciones'));
  const sObs = datos.solicitud.find((s) => s.solicitante_id === conObsP.id && s.estado === 'con_observaciones');
  const conCitaP = datos.solicitante.find((p) => datos.solicitud.some((s) => s.solicitante_id === p.id && s.estado === 'validada_en_linea' && citaSencilla(s)));
  const migrada = datos.solicitante.find((p) => p.estado === 'sin_activar');
  comprueba(Boolean(conObsP && sObs && conCitaP && migrada) && !datos.solicitante.some((p) => 'registro_asistido_en' in p || 'activada_en' in p)
    && !('aviso_telefono' in datos) && !datos.solicitud.some((s) => 'capturada_por' in s) && datos.solicitante.every((p) => p.correo),
    t('los ficticios ya no traen cuentas asistidas, avisos por teléfono ni solicitudes capturadas por el personal; toda cuenta tiene correo'));
  for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'computadora']]) {
    const { c, page, errores } = await contexto26(navegador, ancho, alto);
    try {
      // Las piezas del registro asistido ya no existen
      const r = await page.goto(BASE + 'asistido.html');
      comprueba(r && r.status() === 404, t(`${donde}: asistido.html ya no existe (${r && r.status()})`));
      errores.length = 0; // el 404 de esa página no es un error de las pantallas
      await page.goto(BASE + 'ventanilla.html');
      await page.waitForSelector('[data-sesion-personal] a');
      comprueba(await page.title() === 'Consultar un trámite · Personal · Acreditaciones de arbolado urbano' && await texto26(page, '#t-ventanilla') === 'Consultar un trámite'
        && !/asistid|ventanilla/i.test(await texto26(page, 'main')),
        t(`${donde}: la página se llama «Consultar un trámite» y no dice «asistido» ni «ventanilla»`));
      comprueba(await page.getAttribute('[data-sesion-personal] a[href="ventanilla.html"]', 'aria-current') === 'page'
        && await texto26(page, '[data-sesion-personal] a[href="ventanilla.html"]') === 'Consultar un trámite',
        t(`${donde}: la cabecera del personal lleva a «Consultar un trámite» y la marca como la página actual`));
      await revisaAxe(page, `${donde}, sin búsqueda`);
      // Por CURP, por nombre y por folio
      for (const [que, q] of [['CURP', conObsP.curp], ['nombre', `${conObsP.nombre} ${conObsP.primer_apellido}`], ['folio', sObs.folio]]) {
        await page.fill('#buscar', q);
        await page.waitForFunction((n) => [...document.querySelectorAll('[data-resultados] .ficha-titulo')].some((h) => h.textContent.includes(n)), conObsP.nombre);
        bien(t(`${donde}: encuentra a la persona por ${que}`));
      }
      await page.click('[data-resultados] .ficha .btn');
      await page.waitForSelector('[data-ficha]:not([hidden])');
      const f = await texto26(page, '[data-ficha]');
      comprueba(/Cuenta en línea/.test(f) && /Qué decirle:/.test(f) && /Corrígelos en línea, en «Mis trámites», y vuelve a enviar tu solicitud/.test(f) && f.includes(conObsP.correo),
        t(`${donde}: la ficha dice qué falta y que se corrige en línea, en «Mis trámites» (de tú), con el correo de la persona`));
      comprueba(!/teléfono pendiente|avisos? por teléfono|Registro asistido|en el Vivero/i.test(f) && !(await page.$('[data-ficha] a[href*="asistida"], [data-ficha] .ficha-acciones')),
        t(`${donde}: sin avisos por teléfono, sin «registro asistido» y sin acciones para cargar por la persona`));
      comprueba(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-ficha-nombre]')), t(`${donde}: «Ver su trámite» lleva el foco al nombre de la persona`));
      await revisaAxe(page, `${donde}, con la ficha`);
      await sinDesborde(page, t(`${donde}, con la ficha`));
      // Con cita y del registro anterior
      await page.goto(BASE + `ventanilla.html?persona=${encodeURIComponent(conCitaP.id)}`);
      await page.waitForSelector('[data-ficha]:not([hidden])');
      comprueba(/Tu cita de cotejo es el/.test(await texto26(page, '[data-ficha-tramites]')), t(`${donde}: con su cita, dice cuándo es y qué llevar`));
      await page.goto(BASE + `ventanilla.html?persona=${encodeURIComponent(migrada.id)}`);
      await page.waitForSelector('[data-ficha]:not([hidden])');
      comprueba(/Registro anterior · sin cuenta en línea/.test(await texto26(page, '[data-ficha-datos]')), t(`${donde}: la persona del registro anterior sin activar se dice así`));
      // Su entrada en el inicio del personal
      await page.goto(BASE + 'revision.html');
      await page.waitForSelector('[data-filas] tr');
      comprueba(await page.isVisible('#panel-consulta .menu-opcion[href="ventanilla.html"]') || (ancho >= 1024 && await page.isVisible('#pe-consulta')),
        t(`${donde}: el inicio del personal tiene la entrada «Consultar un trámite»`));
      comprueba(!/asistid|avisos? por teléfono/i.test(await texto26(page, 'main')), t(`${donde}: el inicio del personal ya no habla del registro asistido ni de avisos por teléfono`));
      comprueba(!errores.length, t(`${donde}: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 2).join(' | ') : ''}`));
    } finally { await c.close(); }
  }
  // La solicitud ya no tiene modo asistido: ni el auxiliar ni la marca de lectura ni la hoja del acuse
  const sol = readFileSync(join(raiz, 'sitio/solicitud.html'), 'utf8');
  comprueba(!/asistid|lectura_aceptada|hoja-acuse/.test(sol), t('solicitud.html ya no tiene el modo asistido, la marca de lectura ni el acuse impreso'));
}

// ── Ajustes del equipo de la Dirección (25/10/2026): carrera que no aparece en el catálogo y duración del curso ──
async function ajustesEquipo(navegador) {
  const t = (m) => `[ajustes del equipo 25/10] ${m}`;
  // Cada bloque sigue aunque otro se detenga: un error se cuenta como falla de ese bloque y se pasa al siguiente
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const nuevo = async (ancho, alto, sesion) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil });
    if (sesion) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('prueba.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('prueba.sesion', '1'); } } catch (e) { /* sin almacenamiento */ } }, sesion);
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };

  // Carrera que no aparece en el catálogo: la ayuda y el renglón del combo dicen que se puede escribir completa, como viene
  // en el título o la cédula, y que la Secretaría la revisa. De punta a punta: la persona (en teléfono) la escribe y envía;
  // en «Revisión documental» y en «Revisar una solicitud» (en computadora) llega como «carrera por clasificar», quien
  // revisa la clasifica y la clasificación queda en el catálogo y en el perfil de la solicitud. El acuse dice la duración
  // del curso (punto del quinto día).
  await bloque('carrera escrita', async () => {
    const CARRERA = 'Ingeniería en Arboricultura y Paisaje Urbano';
    const { c, page, errores } = await nuevo(390, 844, paraDictaminador.id);
    await page.goto(BASE + 'solicitud.html?tipo=dictaminador');
    await page.waitForFunction(() => document.getElementById('tramite').value === 'dictaminador_nueva');
    const fuera = await page.evaluate((x) => { const cat = (window.FORMKIT_CATALOGOS || {}).carreras || []; const filas = Array.isArray(cat) ? cat : cat.filas || []; return filas.length > 0 && !filas.some((o) => APD_PERFIL_ACADEMICO.normaliza(o.nombre || o) === APD_PERFIL_ACADEMICO.normaliza(x)); }, CARRERA);
    comprueba(fuera, t('la carrera de la prueba no está en el catálogo de carreras'));
    await page.selectOption('#nivel_estudios', 'licenciatura');
    await page.waitForSelector('#carrera', { state: 'visible' });
    const ayuda = (await page.textContent('[data-campo="carrera"] .ayuda')).replace(/\s+/g, ' ');
    comprueba(/Si la tuya no aparece, escríbela completa, como viene en tu título o cédula: la Secretaría la revisa\./.test(ayuda), t(`la ayuda de «¿Qué carrera estudiaste?» dice que se puede escribir completa y que la Secretaría la revisa («${ayuda.trim()}»)`));
    await page.click('#carrera');
    await page.keyboard.type(CARRERA);
    const renglon = await page.waitForSelector('[data-campo="carrera"] .combo-lista:not([hidden]) .combo-vacio').then((n) => n.textContent(), () => '');
    comprueba(renglon === 'No está en la lista: puedes dejarla así. Escríbela completa, como aparece en tu título o cédula; la Secretaría la revisa.',
      t(`el combo, con una carrera que no está en la lista, dice que puede dejarla así y que la Secretaría la revisa («${renglon}»)`));
    await captura(page, 'ajustes-carrera-escrita-telefono');
    await page.keyboard.press('Escape');
    await page.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
    comprueba(/la Secretaría revisará tu carrera/.test(await page.textContent('[data-experiencia-minima]')), t('con la carrera escrita, la experiencia dice que la Secretaría revisará la carrera'));
    await page.fill('#anios_experiencia', '6');
    await siguiente(page);
    comprueba(await page.inputValue('#carrera') === CARRERA && await tituloPaso(page) !== '' && !(await page.isVisible('[data-campo="carrera"] .err:not(:empty)')), t('la carrera escrita se acepta y el formulario avanza'));
    await cargaObligatorios(page);
    await siguiente(page);
    await marcaCasillas(page);
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-acuse]:not([hidden])');
    const folio = (await page.textContent('[data-acuse-folio]')).trim();
    const acuse = (await page.textContent('[data-acuse] .secuencia')).replace(/\s+/g, ' ');
    comprueba(/El curso es de 5 días, de lunes a viernes; el día 5 es de repaso de conocimientos y examen final\./.test(acuse), t(`quinto día: el acuse de una solicitud nueva dice que el curso es de 5 días, de lunes a viernes, y qué es el día 5 («${acuse.trim().slice(-140)}»)`));
    // Quien revisa, en computadora
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BASE + 'revision.html');
    await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
    comprueba(/Carrera por clasificar/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t(`«Revisión documental»: ${folio}, con la carrera escrita, dice «Carrera por clasificar»`));
    await page.goto(BASE + `revisar.html?folio=${folio}`);
    await page.waitForSelector('#formulario:not([hidden])');
    comprueba(await page.isVisible('[data-si="perfil_revision=por_clasificar"]') && (await page.textContent('[data-carrera-nombre]')).trim() === `«${CARRERA}»`,
      t('«Revisar una solicitud»: la carrera escrita llega por clasificar, con su nombre como la escribió la persona'));
    await page.check('input[name="clasificacion"][value="afin"]', { force: true });
    comprueba(/2 años/.test(await page.textContent('[data-minimo]')), t('al clasificarla como afín se piden 2 años'));
    await aceptaTodos(page);
    await page.waitForSelector('[data-campo="cita_fecha"]', { state: 'visible' });
    let dia = await page.getAttribute('[data-campo="cita_fecha"]', 'data-min');
    while ([0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) dia = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    await page.fill('#cita_fecha', dma(dia));
    await page.selectOption('#cita_hora', '10:00');
    await page.focus('[data-accion="enviar"]');
    await page.click('[data-accion="enviar"]');
    await page.waitForSelector('[data-hecho]:not(.pasos-btn):not([hidden])');
    const r = await page.evaluate(async (F) => {
      const d = await APD.cargar();
      const s = d.solicitud.find((x) => x.folio === F);
      const car = d.carrera.find((x) => x.nombre_normalizado === APD_PERFIL_ACADEMICO.normaliza(s.carrera));
      return { estado: s.estado, carrera: s.carrera, perfil: s.perfil_academico, minimo: Number(s.experiencia_minima), grupo: car && car.grupo };
    }, folio);
    comprueba(r.estado === 'validada_en_linea' && r.carrera === CARRERA && r.perfil === 'licenciatura_afin' && r.minimo === 2 && r.grupo === 'afin',
      t(`quien revisa clasifica la carrera escrita: queda en el catálogo como afín y la solicitud con su perfil (${JSON.stringify(r)})`));
    comprueba(!errores.length, t(`carrera escrita sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`));
    await c.close();
  });

  // Quinto día: la duración (cinco días, de lunes a viernes) y el día 5 de repaso de conocimientos y examen final en el
  // inicio, «Mis trámites» con grupo asignado, la ficha del grupo y la asistencia (el acuse, arriba)
  await bloque('quinto día', async () => {
    const con = datos.solicitud.find((s) => s.folio === 'APD-S-2026-00021');
    for (const [ancho, alto, donde] of [[390, 844, 'teléfono'], [1280, 900, 'escritorio']]) {
      const { c, page, errores } = await nuevo(ancho, alto, con.solicitante_id);
      await page.goto(BASE + 'index.html');
      const inicio = (await page.locator('li', { has: page.locator('[data-duraciones]') }).textContent()).replace(/\s+/g, ' ');
      comprueba(/de 5 días la primera vez/.test(inicio) && /de lunes a viernes/.test(inicio) && /el quinto día es de repaso de conocimientos y examen final/.test(inicio), t(`${donde}: el inicio dice 5 días, de lunes a viernes, y el quinto de repaso y examen final`));
      await page.goto(BASE + 'tramites.html');
      await page.waitForSelector('[data-solicitudes] .ficha');
      const tram = (await page.textContent('[data-solicitudes]')).replace(/\s+/g, ' ');
      comprueba(/Tu curso dura 5 días, de lunes a viernes\./.test(tram) && /Día 5: repaso de conocimientos y examen final/.test(tram), t(`${donde}: «Mis trámites» con grupo asignado dice 5 días, de lunes a viernes, y el día 5`));
      await page.goto(BASE + 'grupo.html?folio=APD-G-2026-003');
      await page.waitForSelector('[data-sesion-personal] a');
      const ficha = (await page.textContent('main')).replace(/\s+/g, ' ');
      comprueba(/Duración\s?5 días, de lunes a viernes/.test(ficha) && /Último día \(repaso de conocimientos y examen final\)/.test(ficha), t(`${donde}: la ficha del grupo dice «Duración: 5 días, de lunes a viernes» y el último día de repaso y examen final`));
      await page.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
      await page.waitForSelector('[data-bajada] .grupo-bajada-datos');
      const bajada = (await page.textContent('[data-bajada]')).replace(/\s+/g, ' ');
      comprueba(/5 días, de lunes a viernes · del 12\/10\/2026 al 16\/10\/2026/.test(bajada) && /repaso de conocimientos y examen final/i.test(await page.textContent('main')),
        t(`${donde}: la asistencia dice 5 días, de lunes a viernes, y el día 5 de repaso y examen final («${bajada.trim()}»)`));
      await sinDesborde(page, t(`${donde}: asistencia con la duración`));
      comprueba(!errores.length, t(`${donde}: quinto día sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`));
      await c.close();
    }
  });
}

/* ── Escritorio, lo común de las partes A, B y C (integración del 25/10/2026; SOLO=escritorio) ──
   En todas las pantallas del personal, a 1024 × 768, 1366 × 768, 1440 × 900 y 1920 × 1080, al abrir, a media página y al
   final: (1) un solo criterio para el botón «Menú de pruebas»: en computadora, abajo a la izquierda (en teléfono, donde
   estaba: a la derecha, y a la izquierda en «Asistencia», F3 B11); (2) el botón no tapa nada fijo (franja, barra de pasos,
   visor, columna lateral, barra de acciones, encabezado de tabla); (3) lo fijo que va a lo ancho, sumado, no pasa del 25 %
   del alto, y lo fijo que va al lado cabe en la ventana. Las mediciones son las reales, con la cabecera compacta. */
async function escritorioComun(navegador) {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const salida = join(mkdtempSync(join(tmpdir(), 'apd-escritorio-')), 'volumen.json');
  execFileSync('node', [join(raiz, 'herramientas/escenario-volumen.mjs'), join(raiz, 'sitio/datos/ficticios.json'), salida]);
  const vol = readFileSync(salida);
  const dict = porClasificar;
  const enCurso = datos.grupo.find((g) => g.estado === 'en_curso').folio;
  const conPrimer = (datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio) || {}).folio;
  // [nombre, dirección, lo que hay que esperar, con el escenario de volumen]
  const PANTALLAS = [
    ['inicio del personal', 'revision.html', '[data-filas] tr', false],
    ['inicio del personal con volumen', 'revision.html', '[data-filas] tr', true],
    ['revisar (poda)', `revisar.html?folio=${enviadas.find((s) => s.tipo_acreditacion === 'poda').folio}`, '#formulario:not([hidden])', false],
    ['revisar (dictaminador, 10 pasos)', `revisar.html?folio=${dict.folio}`, '#formulario:not([hidden])', false],
    ['cita de cotejo', `cotejo.html?folio=${conCita.folio}`, 'cotejo', false],
    ['citas de cotejo', 'citas.html', '[data-filas] tr', false],
    ['grupos, paso 1', 'grupos.html', 'section[data-paso]:not([hidden])', false],
    ['grupos, paso 3 con volumen', 'grupos.html?curso=poda-nueva&paso=3', '#paso-personas:not([hidden]) .plan-persona', true],
    ['grupos, paso 4', 'grupos.html?curso=poda-nueva&paso=4', 'section[data-paso]:not([hidden])', false],
    ['asistencia (25)', 'asistencia.html?folio=APD-G-2026-020', '.asistencia-fila', true],
    ['aplicar el examen (25)', 'aplicar.html?folio=APD-G-2026-020', '[data-filas] tr', true],
    ['ficha del grupo (25)', 'grupo.html?folio=APD-G-2026-020', '[data-filas] tr', true],
    ['ficha del grupo (capacitación)', `grupo.html?folio=${conPrimer}&perfil=capacitacion`, '[data-filas] tr', false],
    ['ficha del grupo en curso', `grupo.html?folio=${enCurso}`, '[data-filas] tr', false],
    ['capacitación', 'capacitacion.html?perfil=capacitacion', '[data-sesion-personal] a', false],
    ['acreditaciones', 'acreditaciones.html', '[data-sesion-personal] a', false],
    ['material del personal', 'material-personal.html', '[data-sesion-personal] a', false],
    ['consultar un trámite', 'ventanilla.html', '[data-sesion-personal] a', false]
  ];
  /* Lo fijo es lo que en ese momento está pegado: fixed, o sticky en su lugar de pegado (una pieza sticky que todavía va con
     la página, como la columna de la persona al abrir la cita, es contenido, y para el contenido la página reserva el lugar
     del botón con scroll-padding, B1-03). El botón «tapa» una pieza si cae sobre lo que ella muestra (texto, controles,
     imágenes, el documento del visor), no sobre su relleno: la barra de acciones le reserva su lugar a la izquierda. Lo
     fijo «a lo ancho» es lo que pasa del 60 % del ancho y las piezas bajas (≤ 25 % del alto) que forman banda, como las
     celdas de la franja del pase de lista o del encabezado de una tabla; lo angosto y alto es una columna lateral. */
  const mide = (pg) => pg.evaluate(() => {
    const boton = document.querySelector('.menu-pruebas-boton');
    const rb = boton ? boton.getBoundingClientRect() : null;
    const pegada = (e) => {
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed') return true;
      if (cs.position !== 'sticky') return false;
      const b = e.getBoundingClientRect();
      return (cs.top !== 'auto' && Math.abs(b.top - parseFloat(cs.top)) < 1.5) || (cs.bottom !== 'auto' && Math.abs(innerHeight - b.bottom - parseFloat(cs.bottom)) < 1.5);
    };
    const piezas = [...document.querySelectorAll('body *')].filter((e) => {
      if (e.closest('.menu-pruebas-boton') || !e.checkVisibility() || !pegada(e)) return false;
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
    }).filter((e, _, l) => !l.some((o) => o !== e && o.contains(e)));
    const nombre = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
    const cruza = (r) => rb && r.width > 0 && r.height > 0 && r.left < rb.right - 1 && rb.left < r.right - 1 && r.top < rb.bottom - 1 && rb.top < r.bottom - 1;
    const tapa = piezas.filter((e) => {
      const hojas = [...e.querySelectorAll('*')].filter((x) => (!x.children.length || x.matches('button, a, input, select, textarea, img, svg, canvas, iframe, embed, object, label')) && x.checkVisibility());
      return hojas.length ? hojas.some((x) => cruza(x.getBoundingClientRect())) : cruza(e.getBoundingClientRect());
    }).map(nombre);
    const banda = (e) => { const b = e.getBoundingClientRect(); return b.width > innerWidth * 0.6 || b.height <= innerHeight * 0.25; };
    const tramos = piezas.filter(banda).map((e) => { const b = e.getBoundingClientRect(); return [Math.max(0, b.top), Math.min(innerHeight, b.bottom)]; }).sort((a, b) => a[0] - b[0]);
    let suma = 0; let fin = -1;
    for (const [a, b] of tramos) { if (b <= fin) continue; suma += b - Math.max(a, fin); fin = b; }
    const altas = piezas.filter((e) => !banda(e) && e.getBoundingClientRect().height > innerHeight + 1).map(nombre);
    return { boton: rb ? { izquierda: rb.left < innerWidth / 2, fijo: getComputedStyle(boton).position === 'fixed' } : null, tapa, suma: Math.round(suma), alto: innerHeight, altas, piezas: piezas.map(nombre).slice(0, 8) };
  });
  for (const [ancho, alto] of [[1024, 768], [1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
    const t = (m) => `[escritorio ${ancho}×${alto}] ${m}`;
    const movil = ancho < 600;
    const malas = { lugar: [], tapa: [], fijo: [], alto: [] };
    let revisadas = 0;
    const errores = [];
    for (const [nombre, url, listo, conVol] of PANTALLAS) {
      const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
      if (conVol) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: vol, contentType: 'application/json' }));
      const pg = await c.newPage();
      pg.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
      if (listo === 'cotejo') await abreCotejo(pg, conCita.folio);
      else { await pg.goto(BASE + url); await pg.waitForSelector(listo, { state: 'attached', timeout: 15000 }); }
      await pg.waitForSelector('.menu-pruebas-boton');
      await pg.waitForTimeout(400);
      for (const donde of ['al abrir', 'a media página', 'al final']) {
        await pg.evaluate((d) => window.scrollTo(0, d === 'al abrir' ? 0 : d === 'al final' ? document.documentElement.scrollHeight : (document.documentElement.scrollHeight - innerHeight) / 2), donde);
        await dosCuadros(pg);
        const m = await mide(pg);
        revisadas += 1;
        // En teléfono, donde estaba: a la izquierda sólo en «Asistencia» (F3 B11)
        const izquierda = movil ? nombre.startsWith('asistencia') : true;
        if (!m.boton || !m.boton.fijo || m.boton.izquierda !== izquierda) malas.lugar.push(`${nombre} (${donde}): ${JSON.stringify(m.boton)}`);
        if (!movil && m.tapa.length) malas.tapa.push(`${nombre} (${donde}): tapa ${m.tapa.join(', ')}`);
        if (!movil && m.suma > m.alto * 0.25) malas.fijo.push(`${nombre} (${donde}): ${m.suma} de ${m.alto} px [${m.piezas.join(', ')}]`);
        if (!movil && m.altas.length) malas.alto.push(`${nombre} (${donde}): ${m.altas.join(', ')}`);
      }
      await c.close();
    }
    const lugar = movil ? 'a la derecha, como antes (a la izquierda en «Asistencia», F3 B11)' : 'abajo a la izquierda';
    comprueba(!malas.lugar.length, t(`el botón «Menú de pruebas» va ${lugar} en las ${PANTALLAS.length} pantallas del personal (${revisadas} posiciones)${malas.lugar.length ? ': ' + malas.lugar.slice(0, 3).join(' · ') : ''}`));
    if (movil) { comprueba(!errores.length, t(`sin errores${errores.length ? ': ' + errores.slice(0, 2).join(' | ') : ''}`)); continue; }
    comprueba(!malas.tapa.length, t(`el botón «Menú de pruebas» no tapa nada fijo, al abrir, a media página ni al final${malas.tapa.length ? ': ' + malas.tapa.slice(0, 3).join(' · ') : ''}`));
    comprueba(!malas.fijo.length, t(`lo fijo que va a lo ancho, sumado, no pasa del 25 % del alto (${Math.round(alto * 0.25)} px) en ninguna pantalla ni posición${malas.fijo.length ? ': ' + malas.fijo.slice(0, 3).join(' · ') : ''}`));
    comprueba(!malas.alto.length && !errores.length, t(`lo fijo que va al lado cabe en la ventana${malas.alto.length ? ': ' + malas.alto.slice(0, 3).join(' · ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
  }
}

/* ── Escritorio, parte A (decisión de Liber del 25/10/2026; docs/diseno-escritorio/DIAGNOSTICO.md, regla general 2, 4.1 y
   4.2; SOLO=escritorio-a) ──
   La cabecera compacta del personal, «Revisar una solicitud» y «Cita de cotejo» en 1366 × 768, 1440 × 900 y 1920 × 1080:
   en el estado inicial de cada paso la franja (o la columna de la persona) y el botón principal se ven sin bajar; lo fijo
   que ocupa el ancho no pasa del 25 % del alto; sin desborde a lo ancho; el visor queda debajo de la franja y no 32 px
   debajo de una barra (E4); el foco va al título del paso y no queda tapado; axe sin violaciones. A 390 px, el orden y el
   alto son los de la versión 0.70 (si una pantalla crece a propósito, se actualiza ALTO_390 con la razón).
   Excepción conocida: el paso «Perfil» de un dictaminador con la carrera por clasificar (dato, aviso y tres opciones con su
   descripción) mide 1.1 a 1.4 pantallas; ahí se comprueba que la franja y la pregunta empiezan en la primera. */
async function escritorioA(navegador) {
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  if (!axe) console.log('OMITIDO  [escritorio A] axe: falta AXE=<ruta a axe.min.js del estándar>');
  const poda = enviadas.find((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'renovacion' && !datos.revision.some((r) => r.solicitud_id === s.id));
  const dict = porClasificar;
  const reenviada = enviadas.find((s) => datos.revision.some((r) => r.solicitud_id === s.id));
  // Alto de la página a 390 px en la versión 0.70 (antes del acomodo de escritorio): no debe crecer
  // Altos medidos en la 0.70 en esta máquina. En la verificación de GitHub la tipografía mide distinto (hasta ≈ 9 % más),
  // así que se admite un 10 %: lo que asegura que a 390 px nada de escritorio se aplica es la revisión de piezas y orden.
  const ALTO_390 = { [poda.folio]: 2589, [dict.folio]: 2810, [reenviada.folio]: 3114, cotejo: 1999 };
  const TOLERANCIA_390 = 1.10;
  const nuevo = async (ancho, alto) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, pg, errores };
  };
  // Lo que se ve sin bajar en el estado del paso, lo fijo que ocupa el ancho y el desborde
  const mide = (pg) => pg.evaluate(() => {
    const vis = (e) => e && e.checkVisibility() && e.getBoundingClientRect().width > 0;
    const paso = document.querySelector('#formulario section[data-paso]:not([hidden])');
    const boton = paso && [...paso.querySelectorAll('.acciones .btn-primario, .acciones .btn-peligro-contorno')].find(vis);
    const franja = document.querySelector('[data-franja]');
    const rf = franja.getBoundingClientRect();
    const bandas = [...document.querySelectorAll('body *')].filter((e) => vis(e) && /sticky|fixed/.test(getComputedStyle(e).position) && e.getBoundingClientRect().width > innerWidth / 2);
    const visor = document.querySelector('[data-visor]');
    return {
      paso: paso ? paso.dataset.titulo : '', boton: boton ? Math.round(boton.getBoundingClientRect().bottom) : null, botonTexto: boton ? boton.textContent.trim() : '',
      franja: { arriba: Math.round(rf.top), abajo: Math.round(rf.bottom), alto: Math.round(rf.height), texto: franja.textContent.replace(/\s+/g, ' ') },
      fijo: Math.round(bandas.reduce((s, e) => s + e.getBoundingClientRect().height, 0)), alto: innerHeight,
      desborde: document.documentElement.scrollWidth > innerWidth + 1,
      visor: visor && visor.open ? Math.round(visor.getBoundingClientRect().top) : null,
      lateral: (() => { const a = document.querySelector('[data-resumen-lateral]'); return a && vis(a) ? a.querySelectorAll('li').length : 0; })()
    };
  });
  const axeSin = async (pg) => {
    if (!axe) return [];
    if (!(await pg.evaluate(() => Boolean(window.axe)))) await pg.evaluate(axe);
    return pg.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  };
  const siguiente = async (pg) => {
    const antes = await tituloPaso(pg);
    await pg.click(`${pasoVisible} [data-accion="siguiente"]`);
    await pg.waitForFunction((a) => { const p = document.querySelector('#formulario section[data-paso]:not([hidden])'); return p && p.dataset.titulo !== a; }, antes, { timeout: 5000 });
    await dosCuadros(pg);
  };

  for (const [ancho, alto] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const t = (m) => `[escritorio A ${ancho}×${alto}] ${m}`;
    // 1 · Cabecera compacta en todas las pantallas del personal
    {
      const { c, pg, errores } = await nuevo(ancho, alto);
      const malas = [];
      for (const url of ['revision.html', 'revisar.html?folio=' + poda.folio, 'citas.html', 'cotejo.html?folio=' + conCita.folio, 'grupos.html', `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}`,
        'asistencia.html', 'aplicar.html', 'capacitacion.html', 'acreditaciones.html', 'acreditacion.html?numero=PD-2025-K100', 'material-personal.html', 'ventanilla.html']) {
        await pg.goto(BASE + url);
        await pg.waitForSelector('[data-sesion-personal] a');
        const m = await pg.evaluate(() => {
          const r = (q) => document.querySelector(q).getBoundingClientRect();
          const cab = r('.cabecera'); const ses = r('[data-sesion-personal]'); const tit = r('.cabecera-titulo'); const logo = r('.cabecera-logo');
          const franjas = [...document.querySelectorAll('.entorno-pruebas, .ubicacion-prueba')].map((e) => Math.round(e.getBoundingClientRect().height));
          return { cab: Math.round(cab.height), dentro: ses.top >= cab.top - 1 && ses.bottom <= cab.bottom + 1 && logo.bottom <= cab.bottom && tit.bottom <= cab.bottom,
            choca: tit.right > ses.left && tit.bottom > ses.top, franjas, desborde: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        if (m.cab > 88 || !m.dentro || m.choca || m.desborde || m.franjas.some((h) => h > 30)) malas.push(`${url}: ${JSON.stringify(m)}`);
      }
      comprueba(!malas.length && !errores.length, t(`cabecera compacta en 14 pantallas del personal: logotipo, título, sesión y secciones en una banda de 88 px o menos, sin encimarse, y cada franja de prueba en un renglón${malas.length ? ': ' + malas.slice(0, 3).join(' · ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
      await c.close();
    }

    // 2 · Revisar una solicitud: cada paso de una renovación de poda y los documentos de un dictaminador
    for (const s of [poda, dict]) {
      const { c, pg, errores } = await nuevo(ancho, alto);
      await pg.goto(BASE + `revisar.html?folio=${s.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      await dosCuadros(pg);
      const persona = APD_NOMBRE(datos.solicitante.find((p) => p.id === s.solicitante_id));
      const fuera = [];
      for (let i = 0; i < 12; i++) {
        const m = await mide(pg);
        const exento = m.paso === 'Perfil' && s.perfil_academico === 'por_clasificar';
        const enVista = m.franja.arriba >= 0 && m.franja.abajo <= alto && m.franja.alto <= 80 && m.franja.texto.includes(persona) && m.franja.texto.includes(s.folio);
        const botonVisto = m.boton !== null && m.boton <= alto;
        if (!enVista || (!botonVisto && !exento) || m.fijo > alto * 0.25 || m.desborde) fuera.push(`${m.paso}: ${JSON.stringify({ franja: m.franja.abajo, boton: m.boton, fijo: m.fijo, desborde: m.desborde })}`);
        if (exento) {
          const pregunta = await pg.evaluate(() => Math.round(document.querySelector('[data-campo="clasificacion"]').getBoundingClientRect().top));
          if (pregunta > alto) fuera.push(`Perfil: la pregunta empieza en ${pregunta}`);
        }
        // Visor debajo de la franja (E4) y con el documento del paso
        if (m.visor !== null && m.visor < m.franja.abajo) fuera.push(`${m.paso}: el visor (${m.visor}) bajo la franja (${m.franja.abajo})`);
        if (['Resultado', 'Fecha de la cita'].includes(m.paso) && m.lateral < 1) fuera.push(`${m.paso}: sin «Así queda la revisión» al lado`);
        // Lo que pide el paso, para avanzar por el camino feliz
        for (const r of await pg.$$(`${pasoVisible} input[value="aceptado"], ${pasoVisible} input[name="clasificacion"][value="afin"]`)) if (await r.isVisible()) await r.check({ force: true });
        if (m.paso === 'Fecha de la cita' || !(await pg.isVisible(`${pasoVisible} [data-accion="siguiente"]`))) break;
        await siguiente(pg);
        const foco = await pg.evaluate(ocultoPorFijo);
        const enTitulo = await pg.evaluate(() => document.activeElement.matches('.titulo-paso'));
        if (!enTitulo || (foco && foco.tapados)) fuera.push(`${await tituloPaso(pg)}: foco ${enTitulo ? 'tapado' : 'fuera del título'}`);
      }
      comprueba(!fuera.length && !errores.length, t(`Revisar ${s.tipo_acreditacion} ${s.folio}: en cada paso la franja (≤ 80 px, con nombre y folio) y el botón principal a la vista sin bajar, lo fijo ≤ 25 %, sin desborde, el visor debajo de la franja, el foco en el título sin tapar y el resumen al lado en «Resultado» y «Fecha de la cita»${fuera.length ? ': ' + fuera.slice(0, 3).join(' · ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
      await c.close();
    }
    // Pasos verticales desde 1280, la franja fija al bajar, «Datos de la persona», «Revisiones anteriores» en la columna de la decisión y axe
    {
      const { c, pg, errores } = await nuevo(ancho, alto);
      await pg.goto(BASE + `revisar.html?folio=${reenviada.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      await dosCuadros(pg);
      const r = await pg.evaluate(() => {
        const pasos = [...document.querySelectorAll('[data-barra] .pasos-btn')].map((b) => b.getBoundingClientRect());
        const ant = document.querySelector('[data-anteriores]').getBoundingClientRect(); const form = document.getElementById('formulario').getBoundingClientRect();
        return { vertical: pasos.length > 1 && pasos[1].top > pasos[0].bottom - 1 && Math.abs(pasos[1].left - pasos[0].left) < 2, actual: document.querySelectorAll('[data-barra] [aria-current="step"]').length,
          anterioresEnDecision: Math.abs(ant.left - form.left) < 2 && ant.bottom <= form.top + 1 };
      });
      // Se baja lo que pide la franja para pegarse arriba más un poco: el visor sigue debajo de ella (al final del área de
      // trabajo el visor sube con la página, como todo lo fijo)
      await pg.evaluate(() => window.scrollTo(0, document.querySelector('[data-franja]').getBoundingClientRect().top + scrollY + 40));
      await dosCuadros(pg);
      const fija = await pg.evaluate(() => {
        const f = document.querySelector('[data-franja]').getBoundingClientRect(); const v = document.querySelector('[data-visor]').getBoundingClientRect(); const a = document.querySelector('[data-area-trabajo]').getBoundingClientRect();
        return { franja: Math.round(f.top), visor: Math.round(v.top), bajo: Math.round(f.bottom), alFinal: Math.abs(v.bottom - a.bottom) < 2,
          // Lo que pide la hoja: el visor se pega debajo de la franja, no a 12 px del borde (E4)
          pegado: parseFloat(getComputedStyle(document.querySelector('[data-visor]')).top) >= f.height };
      });
      await pg.evaluate(() => window.scrollTo(0, 0));
      const resumen = await pg.locator('.franja-datos > summary').textContent();
      const cerrado = await pg.isHidden('.franja-datos-panel');
      await pg.click('.franja-datos > summary');
      const abierto = await pg.isVisible('.franja-datos-panel') && /Número de expediente/.test(await pg.textContent('.franja-datos-panel'));
      await pg.keyboard.press('Escape');
      const v = await axeSin(pg);
      comprueba(r.vertical && r.actual === 1 && r.anterioresEnDecision && fija.franja === 0 && fija.pegado && (fija.visor >= fija.bajo || fija.alFinal) && resumen === 'Datos de la persona' && cerrado && abierto && await pg.isHidden('.franja-datos-panel') && !v.length && !errores.length,
        t(`Revisar: pasos en barra vertical con aria-current="step", «Revisiones anteriores» en la columna de la decisión, al bajar la franja queda arriba y el visor debajo (${fija.visor} ≥ ${fija.bajo}), «Datos de la persona» se abre y Escape lo cierra, axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
      await c.close();
    }

    // 3 · Cita de cotejo: los cuatro pasos por el camino feliz
    {
      const { c, pg, errores } = await nuevo(ancho, alto);
      await abreCotejo(pg, conCita.folio);
      await pg.evaluate(() => window.scrollTo(0, 0));
      await dosCuadros(pg);
      const persona = APD_NOMBRE(datos.solicitante.find((p) => p.id === conCita.solicitante_id));
      const fuera = [];
      const columna = await pg.evaluate(() => { const f = document.querySelector('.franja-contexto .perfil-foto').getBoundingClientRect(); const b = document.querySelector('[data-franja] [data-barra]'); return { ancho: Math.round(f.width), alto: Math.round(f.height), barra: Boolean(b) }; });
      for (let i = 0; i < 4; i++) {
        const m = await mide(pg);
        const caso = m.franja.arriba >= 0 && m.franja.arriba < alto / 2 && m.franja.texto.includes(persona) && m.franja.texto.includes(conCita.folio);
        if (!caso || m.boton === null || m.boton > alto || m.fijo > alto * 0.25 || m.desborde) fuera.push(`${m.paso}: ${JSON.stringify({ franja: m.franja.arriba, boton: m.boton, fijo: m.fijo, desborde: m.desborde })}`);
        if (m.paso === '¿Es la persona?') { await pg.check('input[name="se_presento"][value="si"]', { force: true }); await pg.check('input[name="identidad"][value="misma"]', { force: true }); }
        if (m.paso === 'Documentos originales') {
          // Tabla compacta: una fila por documento; cada grupo de opciones conserva su nombre; «No es igual» abre la observación debajo de su fila
          const docs = await pg.locator(`${pasoVisible} [data-doc]:visible`).count();
          const grupos = await pg.getByRole('group', { name: '¿El original es igual al que cargó?' }).count();
          // Alto de cada fila sin la nota que algunos documentos llevan debajo (la constancia de situación fiscal)
          const filas = await pg.evaluate(() => [...document.querySelectorAll('#formulario section[data-paso]:not([hidden]) [data-doc]')].filter((a) => a.checkVisibility())
            .map((a) => { const n = a.querySelector(':scope > .ayuda'); return Math.round(a.getBoundingClientRect().height - (n ? n.getBoundingClientRect().height + 8 : 0)); }));
          const k = await pg.evaluate(() => document.querySelectorAll('#formulario section[data-paso]:not([hidden]) [data-doc]')[1].dataset.doc);
          await pg.check(`input[name="coincide_${k}"][value="no"]`, { force: true });
          const debajo = await pg.evaluate((q) => { const a = document.querySelector(`[data-doc="${q}"]`); const g = a.querySelector('.grupo').getBoundingClientRect(); const d = document.getElementById(`diferencia_${q}`).getBoundingClientRect(); const sig = a.parentElement.nextElementSibling.getBoundingClientRect(); return d.top > g.bottom && d.bottom < sig.top; }, k);
          if (grupos !== docs || filas.some((h) => h > 100) || !debajo) fuera.push(`documentos: ${JSON.stringify({ docs, grupos, filas, debajo })}`);
          await pg.check(`input[name="coincide_${k}"][value="si"]`, { force: true });
          for (const r of await pg.$$(`${pasoVisible} input[name^="coincide_"][value="si"]`)) if (await r.isVisible()) await r.check({ force: true });
        }
        if (m.paso === 'Pago y factura') {
          await pg.check('input[name="pago"][value="si"]', { force: true });
          await pg.waitForSelector('#factura_rfc', { state: 'visible' });
          const p3 = await pg.evaluate(() => { const l = document.querySelector('[data-pago-linea] .linea-datos'); const a = document.getElementById('factura_rfc').getBoundingClientRect(); const b = document.getElementById('factura_razon_social').getBoundingClientRect(); return { items: l && l.checkVisibility() ? l.querySelectorAll('.linea-datos-item').length : 0, ficha: document.querySelector('[data-pago-datos]').checkVisibility(), fila: Math.abs(a.top - b.top) < 2 && b.left > a.right }; });
          if (p3.items !== 3 || p3.ficha || !p3.fila) fuera.push(`pago: ${JSON.stringify(p3)}`);
          await pg.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', PDF);
          await pg.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
          await pg.fill('#factura_rfc', 'XAXX010101000');
          await pg.fill('#factura_razon_social', 'Prueba Ejemplo');
          await pg.fill('#factura_folio_fiscal', '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f');
        }
        if (m.paso === 'Resultado') break;
        await siguiente(pg);
        const foco = await pg.evaluate(ocultoPorFijo);
        if (!(await pg.evaluate(() => document.activeElement.matches('.titulo-paso'))) || (foco && foco.tapados)) fuera.push(`${await tituloPaso(pg)}: foco`);
      }
      const v = await axeSin(pg);
      const columnaBien = ancho < 1280 || (columna.ancho >= 120 && columna.alto >= 150 && columna.barra);
      comprueba(!fuera.length && columnaBien && !v.length && !errores.length, t(`Cita de cotejo: en cada paso la persona (nombre y folio) y el botón principal a la vista, lo fijo ≤ 25 %, sin desborde; documentos en filas de 100 px o menos con su grupo nombrado y la observación debajo de su fila; el pago en una línea de datos y RFC | nombre en un renglón${ancho >= 1280 ? `; fotografía de la cuenta de ${columna.ancho} × ${columna.alto} px y la barra de pasos en la columna de la persona` : ''}; axe${fuera.length ? ': ' + fuera.slice(0, 3).join(' · ') : ''}${v.length ? ' · axe: ' + v.join(', ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
      await c.close();
    }
  }

  // 4 · De 1024 a 1279 px: la franja arriba, decisión | visor y la barra de pasos horizontal sin quedar fija (cotejo incluido)
  {
    const t = (m) => `[escritorio A 1024×768] ${m}`;
    const { c, pg, errores } = await nuevo(1024, 768);
    await pg.goto(BASE + `revisar.html?folio=${poda.folio}`);
    await pg.waitForSelector('#formulario:not([hidden])');
    await dosCuadros(pg);
    const r = await mide(pg);
    const h = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-barra] .pasos-btn')].map((x) => Math.round(x.getBoundingClientRect().top)); return { horizontal: new Set(b).size === 1, fija: getComputedStyle(document.querySelector('[data-con-formulario]')).position }; });
    await abreCotejo(pg, conCita.folio);
    await pg.evaluate(() => window.scrollTo(0, 0));
    const m = await mide(pg);
    // A 1024 px el botón principal puede quedar un poco abajo (la barra de pasos horizontal ocupa su renglón): se anota, no se exige
    comprueba(r.franja.alto <= 80 && h.horizontal && h.fija === 'static' && !r.desborde && m.franja.alto <= 80 && m.boton <= 768 && !m.desborde && !errores.length,
      t(`Revisar y cita de cotejo: franja de ${r.franja.alto} y ${m.franja.alto} px, barra de pasos horizontal y no fija, sin desborde; botón principal de Revisar en ${r.boton} px y del cotejo en ${m.boton} px${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
    await c.close();
  }

  // 5 · A 390 px, como en la versión 0.70: mismo orden, mismo alto, nada fijo nuevo, lo de escritorio no se ve
  {
    const t = (m) => `[escritorio A 390×844] ${m}`;
    const { c, pg, errores } = await nuevo(390, 844);
    const malas = [];
    const revisa = (clave) => pg.evaluate(() => {
      const visibles = [...document.querySelectorAll('.franja-quien, .franja-caso, .franja-etiqueta, .franja-datos, .resumen-lateral, .cotejo-docs-cabeza, .pago-linea')].filter((e) => e.checkVisibility());
      const orden = ['[data-cabeza]', '[data-con-formulario]', '#formulario'].map((q) => document.querySelector(q).getBoundingClientRect().top);
      const ficha = document.querySelector('[data-cabeza] .persona-con-foto .datos');
      return { alto: document.documentElement.scrollHeight, visibles: visibles.map((e) => e.className), orden: orden[0] < orden[1] && orden[1] < orden[2],
        ficha: Boolean(ficha && ficha.checkVisibility()), franjaFija: getComputedStyle(document.querySelector('[data-franja]')).position !== 'static' };
    }).then((x) => ({ clave, ...x }));
    for (const s of [poda, dict, reenviada]) {
      await pg.goto(BASE + `revisar.html?folio=${s.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      await pg.waitForTimeout(800);
      const x = await revisa(s.folio);
      if (x.alto > ALTO_390[s.folio] * TOLERANCIA_390 || x.visibles.length || !x.orden || !x.ficha || x.franjaFija) malas.push(JSON.stringify(x));
    }
    await abreCotejo(pg, conCita.folio);
    await pg.waitForTimeout(800);
    const x = await revisa('cotejo');
    if (x.alto > ALTO_390.cotejo * TOLERANCIA_390 || x.visibles.length || !x.orden || !x.ficha || x.franjaFija) malas.push(JSON.stringify(x));
    const cab = await pg.evaluate(() => { const s = document.querySelector('[data-sesion-personal]').getBoundingClientRect(); return s.top >= document.querySelector('.cabecera').getBoundingClientRect().bottom; });
    comprueba(!malas.length && cab && !errores.length, t(`Revisar (3 solicitudes) y cita de cotejo como en la 0.70: mismo alto o menos, la cabeza antes de la barra de pasos y del formulario, la ficha en la cabeza, sin franja fija ni piezas de escritorio, y la sesión debajo de la cabecera${malas.length ? ': ' + malas.join(' · ') : ''}${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
    await c.close();
  }

  // 6 · «Contacto»: el correo y el teléfono. Con el registro asistido (25/10/2026) había cuentas sin correo y decía «null · …»
  // (visto por la parte A al integrar el acomodo de escritorio); sin registro asistido (26/10/2026) toda cuenta tiene correo.
  // En teléfono y en computadora.
  const sinCorreo = enviadas.find((s) => { const p = datos.solicitante.find((x) => x.id === s.solicitante_id); return p && !p.correo && p.telefono; });
  const conCorreo = poda;
  for (const [ancho, alto] of [[390, 844], [1440, 900]]) {
    const t = (m) => `[escritorio A ${ancho}×${alto}] ${m}`;
    const { c, pg, errores } = await nuevo(ancho, alto);
    const contacto = async (s) => {
      await pg.goto(BASE + `revisar.html?folio=${s.folio}`);
      await pg.waitForSelector('#formulario:not([hidden])');
      // En computadora la ficha va en «Datos de la persona», bajo la franja; en teléfono, en la cabeza
      return pg.evaluate(() => { const par = [...document.querySelectorAll('.datos-par')].find((x) => x.querySelector('dt').textContent.trim() === 'Contacto'); return par ? par.querySelector('.datos-valor, dd').textContent.trim() : null; });
    };
    const ps = (s) => datos.solicitante.find((x) => x.id === s.solicitante_id);
    comprueba(!sinCorreo, t(`sin registro asistido, ninguna solicitud por revisar es de una persona sin correo${sinCorreo ? ` (${sinCorreo.folio})` : ''}`));
    const b = await contacto(conCorreo);
    comprueba(b === `${ps(conCorreo).correo} · ${ps(conCorreo).telefono}` && !errores.length, t(`con correo: «Contacto» sigue diciendo el correo y el teléfono («${b}»)${errores.length ? ' · errores: ' + errores.slice(0, 2).join(' | ') : ''}`));
    await c.close();
  }
}
/* ── Acomodo de escritorio, parte C (decisión de Liber del 25/10/2026; SOLO=escritorio-c) ──
   Asistencia, Aplicar el examen y la ficha del grupo (docs/diseno-escritorio/DIAGNOSTICO.md, 4.5, 4.6 y 4.9), con el
   escenario de volumen del proyecto (un grupo de 25 en su día 3) y, para el pase de lista, ese mismo grupo en su día 5.
   A 1366 × 768, 1440 × 900 y 1920 × 1080 comprueba: lo que queda a la vista sin bajar (los datos que identifican el caso y
   la acción principal), que lo fijo no pase del 25 % del alto, que no haya desborde horizontal y axe; y lo propio de cada
   pantalla (asistencia en renglones compactos, barra fija con «Guardar», franja fija con la cuenta e «Imprimir los códigos», una
   persona por renglón con su fotografía de 96 px, pestañas del estándar, panel lateral). A 390 px, que nada de eso aplique:
   el orden y la altura de antes. A 1440 × 650, que nada quede fijo (sólo desde 700 px de alto).
   «A la vista» se mide en la posición real, con la cabecera compacta del personal (parte A) y las dos franjas de la versión
   de prueba; lo fijo, tal cual. */
async function escritorioC(navegador) {
  const t = (m) => `[escritorio C] ${m}`;
  const bloque = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo (${String(e.message).split('\n')[0]})`)); } };
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
  if (!axe) console.log('OMITIDO  [escritorio C] axe: falta AXE=<ruta a axe.min.js del estándar>');
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const salida = join(mkdtempSync(join(tmpdir(), 'apd-escritorio-c-')), 'volumen.json');
  execFileSync('node', [join(raiz, 'herramientas/escenario-volumen.mjs'), join(raiz, 'sitio/datos/ficticios.json'), salida]);
  const vol = JSON.parse(readFileSync(salida, 'utf8'));
  const G25 = 'APD-G-2026-020';
  const g25 = vol.grupo.find((g) => g.folio === G25);
  // El mismo grupo en su día 5: el corte pasa al viernes y los días 3 y 4 quedan capturados (asistieron)
  const examen = JSON.parse(JSON.stringify(vol));
  examen.fecha_corte = APD_SUMA_DIAS(g25.fecha_inicio, 4);
  for (const i of examen.inscripcion.filter((x) => x.grupo_id === g25.id && x.activa)) {
    for (const dia of [3, 4]) examen.asistencia.push({ dia, asistio: true, capturada_en: `${APD_SUMA_DIAS(g25.fecha_inicio, dia - 1)}T18:30:00-06:00`, capturada_por: g25.instructor, inscripcion_id: i.id });
  }
  const CAPACITACION = (datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio) || {}).folio;
  const nuevo = async (ancho, alto, cuerpo) => {
    const movil = ancho < 600;
    const c = await navegador.newContext({ timezoneId: ZONA, locale: 'es-MX', viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'reduce' });
    if (cuerpo) await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(cuerpo), contentType: 'application/json' }));
    const page = await c.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { c, page, errores };
  };
  const sinErr = (errores, donde) => comprueba(!errores.length, t(`${donde}: sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
  const revisaAxe = async (page, donde) => {
    if (!axe) return;
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axe);
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 140)).join(' || ')}`));
    comprueba(!v.length, t(`${donde}: axe sin violaciones${v.length ? ': ' + v.join(', ') : ''}`));
  };
  /* Posición real de cada selector al abrir, sin desplazar la página: [selector, fin, inicio] en la ventana. Desde la
     integración de las partes A, B y C (25/10/2026) la cabecera compacta del personal es la de verdad; antes, en la rama de
     la parte C, se tomaba desde el final de la sesión como si la cabecera midiera 88 px. */
  const aLaVista = (page, selectores) => page.evaluate((sels) => {
    window.scrollTo(0, 0);
    return sels.map((s) => {
      const e = document.querySelector(s);
      if (!e || !e.getClientRects().length) return [s, null];
      const b = e.getBoundingClientRect();
      return [s, Math.round(b.bottom), Math.round(b.top)];
    });
  }, selectores);
  const revisaVista = async (page, selectores, donde) => {
    const alto = page.viewportSize().height;
    for (const [s, fin, inicio] of await aLaVista(page, selectores)) comprueba(fin !== null && inicio >= 0 && fin <= alto, t(`${donde}: «${s}» a la vista sin bajar (${inicio}–${fin} de ${alto} px)`));
  };
  // Lo fijo que está en la ventana (sin el botón del menú de pruebas): suma de altos y si cada pieza cabe
  const fijo = (page) => page.evaluate(() => {
    const piezas = [...document.querySelectorAll('body *')].filter((e) => {
      const p = getComputedStyle(e).position;
      if (!['sticky', 'fixed'].includes(p) || e.closest('.menu-pruebas-boton, dialog')) return false;
      const b = e.getBoundingClientRect();
      return b.height > 0 && b.bottom > 0 && b.top < innerHeight;
    }).filter((e, _, l) => !l.some((o) => o !== e && o.contains(e)));
    // Las piezas de una misma banda (celdas de la misma fila) cuentan una vez: se suma la unión de sus intervalos verticales
    const tramos = piezas.map((e) => { const b = e.getBoundingClientRect(); return [Math.max(0, b.top), Math.min(innerHeight, b.bottom)]; }).sort((a, b) => a[0] - b[0]);
    let suma = 0; let fin = -1;
    for (const [a, b] of tramos) { if (b <= fin) continue; suma += b - Math.max(a, fin); fin = b; }
    return { suma: Math.round(suma), alto: innerHeight, piezas: piezas.map((e) => e.className || e.tagName).slice(0, 6) };
  });
  const revisaFijo = async (page, donde, minimo = 0) => {
    const f = await fijo(page);
    comprueba(f.suma <= f.alto * 0.25 && f.suma >= minimo, t(`${donde}: lo fijo mide ${f.suma} px de ${f.alto} (≤ 25 %${minimo ? `, y está` : ''}) [${f.piezas.join(', ')}]`));
  };
  const enVentana = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.height > 0 && b.top >= 0 && b.bottom <= innerHeight; }, sel);
  const aMitad = (page) => page.evaluate(() => { window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2); });
  const pantallas = (page) => page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(2));
  const encima = (page, a, b) => page.evaluate(([a, b]) => {
    const x = document.querySelector(a); if (!x) return false;
    const r = x.getBoundingClientRect();
    return [...document.querySelectorAll(b)].some((y) => { const q = y.getBoundingClientRect(); return q.width && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; });
  }, [a, b]);

  for (const [ancho, alto] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const d = `${ancho}×${alto}`;
    /* ── Asistencia: grupo de 25 en su día 3 ── */
    await bloque(`asistencia ${d}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto, vol);
      await page.goto(BASE + `asistencia.html?folio=${G25}`);
      await page.waitForSelector('.asistencia-fila img[src^="blob:"], .asistencia-fila img[src^="data:image"]', { state: 'attached' }).catch(() => null);
      await page.waitForTimeout(300);
      // La franja: el día, el grupo, la regla y la leyenda en dos renglones (alto de una sola pieza)
      const franja = await page.evaluate(() => { const f = document.querySelector('.franja-dia'); const r = f.getBoundingClientRect(); const h = document.querySelector('[data-titulo-dia]').getBoundingClientRect(); const reg = document.querySelector('[data-regla]').getBoundingClientRect(); return { alto: Math.round(r.height), juntos: Math.abs(h.top - reg.top) < h.height }; });
      comprueba(franja.juntos && franja.alto <= 120, t(`${d}: la franja del día lleva el día, el grupo, la regla y la leyenda en dos o tres renglones (${franja.alto} px; la regla junto al día)`));
      await revisaVista(page, ['[data-titulo-dia]', '[data-guardar]', '[data-todas]', '[data-totales]'], `asistencia ${d}`);
      // Una persona por renglón, como el pase de lista (cambio de Liber del 25/10/2026, 14:54: ya no en rejilla), en orden
      // alfabético; renglón compacto con la fotografía de 64 × 80 y «¿Asistió? Sí / No» a la derecha, en el mismo renglón
      const filas = await page.evaluate(() => {
        const f = [...document.querySelectorAll('.asistencia-fila')];
        const cajas = f.map((x) => x.getBoundingClientRect());
        const unaColumna = cajas.every((b, i) => !i || (b.top >= cajas[i - 1].bottom - 1 && Math.abs(b.left - cajas[0].left) < 1));
        const derecha = f.every((x) => { const q = x.querySelector('.asis-quien').getBoundingClientRect(); const o = x.querySelector('.asis-opciones').getBoundingClientRect(); return o.left >= q.right && o.top < q.bottom && q.top < o.bottom; });
        const foto = document.querySelector('.asistencia-foto').getBoundingClientRect();
        return { n: f.length, unaColumna, derecha, alto: Math.max(...cajas.map((b) => Math.round(b.height))), foto: [Math.round(foto.width), Math.round(foto.height)] };
      });
      comprueba(filas.n === 25 && filas.unaColumna, t(`${d}: las 25 personas hacia abajo, una por renglón, en una sola columna`));
      comprueba(filas.foto[0] === 64 && filas.foto[1] === 80 && filas.alto <= 100, t(`${d}: renglón compacto (${filas.alto} px como máximo) con la fotografía de 64 × 80 (${filas.foto.join(' × ')})`));
      comprueba(filas.derecha, t(`${d}: «¿Asistió? Sí / No» a la derecha de cada persona, en su mismo renglón`));
      // «¿Asistió? Sí / No» conserva sus controles y su nombre accesible
      const primera = (await page.textContent('.asistencia-fila .asis-nombre')).trim();
      comprueba(await page.getByRole('group', { name: `${primera}, día 3: ¿Asistió?` }).count() === 1 && await page.getByRole('radio', { name: 'Sí' }).count() === 25,
        t(`${d}: «¿Asistió?» sigue siendo el grupo de Sí y No de cada persona, con su nombre («${primera}, día 3: ¿Asistió?»)`));
      const pantallasAsis = await pantallas(page);
      console.log(`INFO  [escritorio C] ${d}: asistencia de 25 mide ${pantallasAsis} pantallas (antes 3.75 a 1440 × 900)`);
      // Barra fija abajo: totales y los dos botones siempre a la vista, también a media lista; el menú de pruebas no la tapa
      await aMitad(page);
      comprueba(await enVentana(page, '[data-guardar]') && await enVentana(page, '[data-todas]') && await enVentana(page, '[data-totales]'),
        t(`${d}: a media lista, «Guardar la asistencia del día 3», «Todas asistieron» y los totales siguen a la vista (barra fija abajo)`));
      await revisaFijo(page, `asistencia ${d}, a media lista`, 40);
      comprueba(!(await encima(page, '.menu-pruebas-boton', '.barra-acciones-fija .asis-totales, .barra-acciones-fija .btn')), t(`${d}: el botón «Menú de pruebas» no tapa los totales ni los botones de la barra`));
      // Marcar a una persona actualiza los totales de la barra
      await page.locator('.asistencia-fila').nth(10).locator('input[value="no"]').check({ force: true });
      comprueba(/^0 asistieron · 1 faltó · 24 sin marcar$/.test((await page.textContent('[data-totales]')).trim()), t(`${d}: los totales de la barra cambian al marcar («${(await page.textContent('[data-totales]')).trim()}»)`));
      await sinDesborde(page, t(`asistencia ${d}`));
      await page.evaluate(() => window.scrollTo(0, 0));
      await revisaAxe(page, `asistencia ${d}`);
      sinErr(errores, `asistencia ${d}`);
      await c.close();
    });

    /* ── Aplicar el examen: el mismo grupo en su día 5 ── */
    await bloque(`aplicar ${d}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto, examen);
      await page.goto(BASE + `aplicar.html?folio=${G25}`);
      await page.waitForSelector('[data-filas] tr .examen-foto-boton img');
      await page.waitForTimeout(300);
      comprueba(await page.locator('[data-grupo] .aviso').count() === 0, t(`${d}: el día del examen, con los días capturados, no hay avisos del grupo`));
      // Los datos del grupo en una línea de datos (uno o dos renglones), no en cinco
      const datosAlto = await page.evaluate(() => Math.round(document.querySelector('.grupo-en-linea > .datos').getBoundingClientRect().height));
      comprueba(datosAlto <= 80, t(`${d}: los cinco datos del grupo en una línea de datos (${datosAlto} px; antes ≈ 240)`));
      // Franja: título, cuenta corta e «Imprimir los códigos» juntos y a la vista
      await revisaVista(page, ['#t-pase-lista', '[data-cuenta-corta]', '[data-imprimir]'], `aplicar ${d}`);
      comprueba(await page.evaluate(() => Boolean(document.querySelector('[data-franja-accion] [data-imprimir]'))), t(`${d}: «Imprimir los códigos» va en la franja de arriba`));
      const corta = async () => (await page.textContent('[data-cuenta-corta]')).replace(/\s+/g, ' ').trim();
      comprueba(/^0 presentes · 0 no llegaron · \d+ por pasar lista · de \d+ con derecho$/.test(await corta()), t(`${d}: la cuenta corta de la franja («${await corta()}»)`));
      // Una persona por renglón, con su fotografía de 96 px (no más chica: es la verificación de identidad)
      const filas = await page.evaluate(() => {
        const f = [...document.querySelectorAll('[data-filas] tr')];
        const tops = f.map((x) => Math.round(x.getBoundingClientRect().top));
        const fotos = [...document.querySelectorAll('[data-filas] .examen-foto-lista')].map((x) => Math.round(x.getBoundingClientRect().width));
        const altos = f.map((x) => Math.round(x.getBoundingClientRect().height));
        return { n: f.length, unoPorRenglon: new Set(tops).size === f.length, fotoMin: Math.min(...fotos), altoMax: Math.max(...altos) };
      });
      comprueba(filas.n === 25 && filas.unoPorRenglon, t(`${d}: las 25 personas una por renglón, en una sola columna`));
      comprueba(filas.fotoMin >= 96 && filas.altoMax <= 150, t(`${d}: renglones compactos (${filas.altoMax} px como máximo; antes ≈ 160) con la fotografía de ${filas.fotoMin} px`));
      comprueba(await page.locator('[data-filas] tr', { hasText: 'Sin derecho a examen' }).count() > 0, t(`${d}: «Sin derecho a examen» se ve en su renglón`));
      // Presente: el código grande en su renglón y la cuenta corta lo cuenta
      for (const n of [1, 2]) {
        await page.locator('[data-filas] [data-accion="presente"]').first().click();
        await page.waitForFunction((k) => document.querySelectorAll('[data-filas] .examen-codigo').length === k, n);
      }
      const codigo = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-filas] .examen-codigo')).fontSize));
      comprueba(codigo >= 20, t(`${d}: ya presente, su código va grande (${codigo} px)`));
      comprueba(/^2 presentes · /.test(await corta()), t(`${d}: la cuenta corta cuenta a las presentes («${await corta()}»)`));
      console.log(`INFO  [escritorio C] ${d}: aplicar el examen con 25 mide ${await pantallas(page)} pantallas (antes 6.47 a 1440 × 900)`);
      // A media lista la franja sigue arriba, y no pasa del 25 %
      await aMitad(page);
      comprueba(await enVentana(page, '#t-pase-lista') && await enVentana(page, '[data-cuenta-corta]') && await enVentana(page, '[data-imprimir]'),
        t(`${d}: a media lista, el título, la cuenta e «Imprimir los códigos» siguen a la vista (franja fija arriba)`));
      await revisaFijo(page, `aplicar ${d}, a media lista`, 40);
      await sinDesborde(page, t(`aplicar ${d}`));
      await page.evaluate(() => window.scrollTo(0, 0));
      await revisaAxe(page, `aplicar ${d}`);
      sinErr(errores, `aplicar ${d}`);
      await c.close();
    });

    /* ── Aplicar el examen fuera de su día: los dos avisos en una sola fila ── */
    await bloque(`aplicar con avisos ${d}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto, vol);
      await page.goto(BASE + `aplicar.html?folio=${G25}`);
      await page.waitForSelector('[data-grupo] .aviso');
      const tops = await page.$$eval('.avisos-grupo > .aviso', (l) => l.map((x) => Math.round(x.getBoundingClientRect().top)));
      comprueba(tops.length === 2 && tops[0] === tops[1], t(`${d}: los dos avisos del grupo en una sola fila`));
      await sinDesborde(page, t(`aplicar con avisos ${d}`));
      sinErr(errores, `aplicar con avisos ${d}`);
      await c.close();
    });

    /* ── Ficha del grupo en curso (25 personas) ── */
    await bloque(`ficha del grupo ${d}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto, vol);
      await page.goto(BASE + `grupo.html?folio=${G25}`);
      await page.waitForSelector('[data-pestanas][data-listo]');
      await revisaVista(page, ['#t-grupo', '[data-situacion] .estado', '[data-cupo-texto]', '[role="tab"]'], `ficha ${d}`);
      const cab = await page.evaluate(() => {
        const ti = document.querySelector('#t-grupo').getBoundingClientRect();
        const cu = document.querySelector('[data-cupo]').getBoundingClientRect();
        const pares = [...document.querySelectorAll('[data-datos] .datos-par')].map((x) => Math.round(x.getBoundingClientRect().top));
        return { derecha: cu.left > ti.right && cu.top < ti.bottom, columnas: pares.filter((v) => v === pares[0]).length };
      });
      comprueba(cab.derecha, t(`${d}: el cupo va a la derecha de la cabeza`));
      comprueba(cab.columnas === 3, t(`${d}: los datos del curso en una rejilla de 3 columnas (${cab.columnas})`));
      // Pestañas del estándar: «Personas del grupo» abierta; «Asistencia por día» con el teclado (flecha derecha)
      const tabs = page.getByRole('tab');
      comprueba(await tabs.count() === 2 && (await tabs.nth(0).textContent()).trim() === 'Personas del grupo' && (await tabs.nth(1).textContent()).trim() === 'Asistencia por día'
        && await tabs.nth(0).getAttribute('aria-selected') === 'true' && await page.isVisible('[data-filas] tr') && !(await page.isVisible('[data-conc-filas] tr')),
        t(`${d}: «Personas del grupo» y «Asistencia por día» como pestañas; abre en «Personas del grupo»`));
      await tabs.nth(0).focus();
      await page.keyboard.press('ArrowRight');
      comprueba(await tabs.nth(1).getAttribute('aria-selected') === 'true' && await page.isVisible('[data-conc-filas] tr') && !(await page.isVisible('[data-filas] tr'))
        && await page.evaluate(() => document.activeElement && document.activeElement.id === 'pt-asistencia'),
        t(`${d}: con la flecha derecha se abre «Asistencia por día», con el foco en su pestaña`));
      comprueba(await page.locator('[data-conc-filas] tr').count() === 25 && await page.locator('[data-filas] tr').count() === 25, t(`${d}: las dos vistas conservan a las 25 personas`));
      console.log(`INFO  [escritorio C] ${d}: ficha del grupo de 25 mide ${await pantallas(page)} pantallas (antes 4.19 a 1440 × 900)`);
      await revisaFijo(page, `ficha ${d}`);
      await sinDesborde(page, t(`ficha ${d}`));
      await revisaAxe(page, `ficha ${d}`);
      sinErr(errores, `ficha ${d}`);
      await c.close();
    });

    /* ── Ficha del grupo con el perfil de Capacitación: el panel en una columna lateral ── */
    await bloque(`ficha de capacitación ${d}`, async () => {
      const { c, page, errores } = await nuevo(ancho, alto);
      await page.goto(BASE + `grupo.html?folio=${CAPACITACION}&perfil=capacitacion`);
      await page.waitForSelector('#confirmar[data-formkit="listo"]');
      const lado = await page.evaluate(() => {
        const g = document.querySelector('section[aria-labelledby="t-grupo"]').getBoundingClientRect();
        const p = document.querySelector('[data-confirmar]').getBoundingClientRect();
        return p.left >= g.right && Math.abs(p.top - g.top) < 2;
      });
      comprueba(lado, t(`${d}: «Persona instructora y confirmación» va en una columna lateral, junto a la ficha`));
      await revisaVista(page, ['#t-grupo', '#t-confirmar', '[data-asignar="principal"]'], `ficha de capacitación ${d}`);
      await sinDesborde(page, t(`ficha de capacitación ${d}`));
      await revisaAxe(page, `ficha de capacitación ${d}`);
      sinErr(errores, `ficha de capacitación ${d}`);
      await c.close();
    });
  }

  /* ── Menos de 700 px de alto: nada fijo ── */
  await bloque('1440 × 650', async () => {
    for (const [url, cuerpo, sel] of [[`asistencia.html?folio=${G25}`, vol, '.asistencia-fila'], [`aplicar.html?folio=${G25}`, examen, '[data-filas] tr']]) {
      const { c, page } = await nuevo(1440, 650, cuerpo);
      await page.goto(BASE + url);
      await page.waitForSelector(sel);
      await aMitad(page);
      const f = await fijo(page);
      comprueba(f.suma === 0, t(`1440 × 650, ${url.split('?')[0]}: con menos de 700 px de alto nada queda fijo (${f.suma} px)`));
      await c.close();
    }
  });

  /* ── Teléfono (390 px): nada del acomodo de escritorio; el orden y el alto de antes ── */
  await bloque('390 px', async () => {
    const { c, page, errores } = await nuevo(390, 844, vol);
    await page.goto(BASE + `asistencia.html?folio=${G25}`);
    await page.waitForSelector('.asistencia-fila');
    const asis = await page.evaluate(() => ({
      rejilla: getComputedStyle(document.querySelector('.personas-renglon')).display, barra: getComputedStyle(document.querySelector('.barra-acciones-fija')).position,
      franja: getComputedStyle(document.querySelector('.franja-dia')).display, foto: Math.round(document.querySelector('.asistencia-foto').getBoundingClientRect().width),
      orden: ['[data-titulo-dia]', '[data-bajada]', '[data-regla]', '[data-leyenda]', '.asistencia-fila', '[data-guardar]'].map((s) => document.querySelector(s).getBoundingClientRect().top)
    }));
    comprueba(asis.rejilla === 'block' && asis.barra === 'static' && asis.franja === 'block' && asis.foto === 44 && asis.orden.every((v, i) => !i || v > asis.orden[i - 1]),
      t('390 px: «Asistencia» como antes (lista de una columna con la fotografía de 44 px, sin barra fija; día, grupo, regla, leyenda, lista y «Guardar» en ese orden)'));
    comprueba(await pantallas(page) <= 6.7 * 1.10, t(`390 px: «Asistencia» con 25 no crece (${await pantallas(page)} pantallas; antes 6.7, con 10 % de margen por la tipografía de cada máquina)`));
    await page.goto(BASE + `aplicar.html?folio=${G25}`);
    await page.waitForSelector('[data-filas] tr');
    const apl = await page.evaluate(() => ({
      imprimir: Boolean(document.querySelector('.examen-herramientas [data-imprimir]')), corta: getComputedStyle(document.querySelector('[data-cuenta-corta]')).display,
      sticky: getComputedStyle(document.querySelector('#t-pase-lista')).position, datos: getComputedStyle(document.querySelector('.grupo-en-linea > .datos')).display
    }));
    comprueba(apl.imprimir && apl.corta === 'none' && apl.sticky === 'static' && apl.datos === 'grid', t('390 px: «Aplicar el examen» como antes («Imprimir los códigos» después de los pasos del examen, sin franja fija ni cuenta corta, datos en ficha)'));
    comprueba(await pantallas(page) <= 15.43 * 1.10, t(`390 px: «Aplicar el examen» con 25 no crece (${await pantallas(page)} pantallas; antes 15.43, con 10 % de margen por la tipografía de cada máquina)`));
    await page.goto(BASE + `grupo.html?folio=${G25}`);
    await page.waitForSelector('[data-conc-filas] tr');
    comprueba(await page.locator('[data-pestanas]').count() === 0 && await page.isVisible('[data-filas] tr') && await page.isVisible('[data-conc-filas] tr'),
      t('390 px: la ficha del grupo sin pestañas, con «Personas del grupo» y «Asistencia por día» una debajo de otra'));
    comprueba(await pantallas(page) <= 15.11 * 1.10, t(`390 px: la ficha del grupo con 25 no crece (${await pantallas(page)} pantallas; antes 15.11, con 10 % de margen por la tipografía de cada máquina)`));
    await revisaAxe(page, '390 px: ficha del grupo');
    sinErr(errores, '390 px');
    await c.close();
  });
}
// Fecha ISO más n días (sin depender de la zona de la máquina)
function APD_SUMA_DIAS(iso, n) { const f = new Date(`${iso}T12:00:00Z`); f.setUTCDate(f.getUTCDate() + n); return f.toISOString().slice(0, 10); }

const APD_NOMBRE = (p) => [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').toUpperCase();

// El mapa de Google de «Mis trámites» (P68) se contesta con una página mínima: herramientas/sin-google.mjs
const navegador = navegadorSinGoogle(await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}));
// Cada parte corre aunque otra se detenga (auditoría 2026-10-19, A1-02): antes, la primera parte que se detenía
// terminaba la batería y las siguientes no corrían. La parte detenida cuenta como falla.
const detenidas = [];
async function parte(nombre, fn) {
  try { await fn(); } catch (e) {
    detenidas.push(nombre);
    mal(`[${nombre}] la parte se detuvo: ${String(e.message || e).split('\n')[0]}`);
    if (process.env.PILA) console.error(e.stack);
  }
}
// SOLO=guardado corre sólo el recorrido guardado y los caminos del cotejo; SOLO=grupos, sólo grupos y asistencia (para depurar)
const solo = process.env.SOLO || '';
const toca = (...nombres) => !solo || nombres.includes(solo);
try {
  if (toca('limpieza')) await parte('limpieza', () => limpieza(navegador));
  if (toca('limpieza', 'licencias')) await parte('licencias', () => licencias());
  if (toca('csp')) await parte('política de contenido', () => politicaContenido(navegador));
  if (toca('peso')) await parte('peso de los datos', () => pesoDatos(navegador));
  if (toca('mapa')) await parte('mapa de la sede', () => mapaSede(navegador));
  // SOLO=principal: sólo los recorridos de la persona y del personal (para depurar)
  if (!solo || solo === 'principal') {
    await parte('recorrido en teléfono', () => recorrido(navegador, 390, 844, 'telefono'));
    await parte('recorrido en escritorio', () => recorrido(navegador, 1280, 900, 'escritorio'));
    await parte('personal en teléfono', () => personal(navegador, 390, 844, 'telefono'));
    await parte('personal en escritorio', () => personal(navegador, 1440, 900, 'escritorio'));
  }
  if (toca('solicitud')) {
    await parte('solicitud: regresos en teléfono', () => solicitudRegresos(navegador, 390, 844, 'telefono'));
    await parte('solicitud: regresos en escritorio', () => solicitudRegresos(navegador, 1280, 900, 'escritorio'));
  }
  if (toca('guardado')) {
    await parte('recorrido guardado', () => recorridoGuardado(navegador));
    await parte('caminos del cotejo', () => caminosCotejo(navegador));
  }
  // «Grupos» paso a paso (decisión del 24/10/2026): los cuatro pasos con el teclado, el calendario, crear, completar, la
  // dirección y axe, a 320, 390 y 1280 px (SOLO=grupos con lo demás de grupos; SOLO=pasoapaso, sólo esto)
  if (toca('grupos', 'pasoapaso')) {
    await parte('grupos paso a paso a 320 px', () => grupoPasoAPaso(navegador, 320, 700, '320'));
    await parte('grupos paso a paso a 390 px', () => grupoPasoAPaso(navegador, 390, 844, '390'));
    await parte('grupos paso a paso a 1280 px', () => grupoPasoAPaso(navegador, 1280, 900, '1280'));
  }
  if (toca('grupos')) {
    await parte('grupos en teléfono', () => caminosGrupos(navegador, 390, 844, 'telefono'));
    await parte('grupos en escritorio', () => caminosGrupos(navegador, 1280, 900, 'escritorio'));
    await parte('programar en teléfono', () => caminosProgramar(navegador, 390, 844, 'telefono'));
    await parte('programar en escritorio', () => caminosProgramar(navegador, 1440, 900, 'escritorio'));
  }
  if (toca('material')) {
    await parte('material en teléfono', () => materialEstudio(navegador, 390, 844, 'telefono'));
    await parte('material en escritorio', () => materialEstudio(navegador, 1280, 900, 'escritorio'));
  }
  if (toca('persistencia')) await parte('persistencia', () => persistenciaPrueba(navegador));
  if (toca('romper')) await parte('romper', () => romper(navegador));
  if (toca('romper', 'romper2')) await parte('romper 2', () => romperDos(navegador));
  if (toca('romper', 'romper3')) await parte('romper 3', () => romperTres(navegador));
  if (toca('fechas')) await parte('fechas', () => fechas(navegador));
  if (toca('fechas')) await parte('formas de fecha', () => formatosFecha(navegador));
  if (toca('estandar')) {
    await parte('estándar en teléfono', () => estandarPantallas(navegador, 390, 844, 'telefono'));
    await parte('estándar en escritorio', () => estandarPantallas(navegador, 1280, 900, 'escritorio'));
  }
  if (toca('foco')) await parte('foco y accesibilidad', () => focoAccesibilidad(navegador));
  if (toca('continuidad')) await parte('mensajes y continuidad', () => continuidad(navegador));
  if (toca('tareas')) await parte('tareas y estados del personal', () => tareasPersonal(navegador));
  if (toca('visual')) await parte('sistema visual', () => sistemaVisual(navegador));
  if (toca('sesion23')) await parte('sesión del 23/10', () => sesion23(navegador));
  // Ajustes del equipo de la Dirección (25/10/2026): carrera escrita de punta a punta y duración del curso
  if (toca('ajustes')) await parte('ajustes del equipo', () => ajustesEquipo(navegador));
  if (toca('cancelacion')) await parte('cancelación de acreditaciones', () => cancelacion(navegador));
  if (toca('reposicion')) await parte('reposición de credenciales', () => reposicionCredencial(navegador));
  if (toca('pasos')) await parte('tareas por pasos', () => pasosTareas(navegador));
  // Asistencia día por día hasta el pase de lista del último día (reporte de Liber del 24/10/2026)
  if (toca('asistencia5')) await parte('asistencia hasta el día 5', () => asistenciaDia5(navegador));
  // Ajustes del equipo, 25/10/2026: grupo propio sólo de gobierno, perfil Capacitación y dos oportunidades para corregir
  if (toca('ajustes25')) await parte('ajustes del equipo 25/10', () => ajustes25(navegador));
  // Decisiones de Liber del 26/10/2026: sin registro asistido («Consultar un trámite»), letreros de ayuda, perfil
  // «Directivo» y la cita de cotejo dentro de 20 días hábiles
  if (toca('consulta')) await parte('consultar un trámite', () => consultaTramite(navegador));
  // Acomodo de escritorio, lo común de las tres partes (integración del 25/10/2026): el botón «Menú de pruebas» y lo fijo
  if (toca('escritorio')) await parte('escritorio, lo común', () => escritorioComun(navegador));
  // Acomodo de escritorio, parte A (decisión de Liber del 25/10/2026): cabecera compacta, Revisar y Cita de cotejo
  if (toca('escritorio-a')) await parte('escritorio, parte A', () => escritorioA(navegador));
  // Acomodo de escritorio, parte B (decisión de Liber del 25/10/2026): inicio del personal y «Grupos»
  if (toca('escritorio-b')) await parte('escritorio, parte B', () => escritorioB(navegador));
  // Acomodo de escritorio, parte C (25/10/2026): asistencia, aplicar el examen y ficha del grupo desde 1024 px
  if (toca('escritorio-c')) await parte('escritorio C', () => escritorioC(navegador));
  if (toca('accesibilidad')) {
    await parte('accesibilidad en teléfono', () => accesibilidad(navegador, 390, 844));
    await parte('accesibilidad en escritorio', () => accesibilidad(navegador, 1280, 900));
  }
} finally {
  await navegador.close();
}
console.log(`\n${total} comprobaciones${detenidas.length ? `; partes detenidas: ${detenidas.join(', ')}` : ''}.`);
console.log(fallas ? `${fallas} comprobación(es) fallida(s).` : 'Todas las comprobaciones correctas.');
process.exit(fallas ? 1 : 0);
