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
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
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
// Con poda vigente y sin dictaminador: puede pedir dictaminador nueva
const paraDictaminador = datos.solicitante.find((p) => {
  const poda = ultimaDe(p, 'poda');
  return p.estado === 'activa' && poda && datos.estado_acreditacion[poda.numero] === 'vigente' && !ultimaDe(p, 'dictaminador') && !tieneActiva(p, 'dictaminador');
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
async function llenaCuenta(page, p, curp = p.curp) {
  await page.fill('#nombre', p.nombre);
  await page.fill('#primer_apellido', p.primer_apellido);
  await page.fill('#segundo_apellido', p.segundo_apellido || '');
  await page.fill('#fecha_nacimiento', dma(p.nacimiento || nacimientoDe(p)));
  await page.fill('#curp', curp);
  // Un correo, una cuenta: cada persona de la prueba, el suyo
  await page.fill('#correo', `${curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#correo2', `${curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#telefono', '0000000077');
  await page.fill('#contrasena', 'una frase larga de prueba');
  await page.fill('#contrasena2', 'una frase larga de prueba');
  await page.check('input[name="adscrito"][value="no"]', { force: true });
  await cargaFoto(page);
  await marcaCasillas(page);
}
async function marcaCasillas(page) {
  for (const n of ['protesta', 'aviso', 'humano']) if (await page.$(`input[name="${n}"]`)) await page.check(`input[name="${n}"]`, { force: true });
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

  // Cuenta nueva
  await page.goto(BASE + 'cuenta.html');
  await page.click('[data-accion="enviar"]');
  comprueba(await page.locator('.resumen-errores, [aria-invalid="true"]').count() > 0, t('cuenta: enviar vacío muestra los errores'));
  comprueba(((await page.textContent('[data-campo="foto"] .err')) || '').length > 0, t('cuenta: sin fotografía de frente no se crea la cuenta'));
  comprueba(await page.getAttribute('[data-campo="foto"] [data-entrada-camara]', 'capture') === 'user', t('cuenta: en el teléfono la cámara que se abre es la frontal'));
  await page.fill('#nombre', ''); await page.type('#nombre', 'maría josé');
  await page.fill('#primer_apellido', 'peña'); await page.fill('#curp', 'xaxx');
  await page.fill('#correo', 'Nadia@Ejemplo.local');
  comprueba(await page.inputValue('#nombre') === 'MARÍA JOSÉ' && await page.inputValue('#primer_apellido') === 'PEÑA' && await page.inputValue('#curp') === 'XAXX',
    t('cuenta: nombre, apellidos y CURP se escriben en mayúsculas al momento'));
  comprueba(await page.inputValue('#correo') === 'Nadia@Ejemplo.local', t('cuenta: el correo no se pasa a mayúsculas'));
  await page.fill('#curp', NUEVA.curp); await page.press('#curp', 'Tab');
  // El sexo se toma de la CURP y se ve como un dato más, sin el recuadro de dato interno (decisión 2026-10-18)
  comprueba(['Mujer', 'Hombre'].includes(await page.inputValue('#sexo')) && await page.isVisible('#sexo')
    && await page.locator('[data-campo="sexo"] .nota-interna').count() === 0 && !(await page.$eval('[data-campo="sexo"]', (c) => c.hasAttribute('data-interno'))),
    t(`cuenta: el sexo se toma de la CURP y se ve como dato normal, sin recuadro de dato interno (${await page.inputValue('#sexo')})`));
  // Adscripción: cada respuesta abre sólo su pregunta, y al cambiarla se oculta lo que dependía de ella
  comprueba(!(await page.isVisible('[data-campo="tipo_adscripcion"]')), t('adscripción: el tipo no se pregunta hasta responder «Sí»'));
  comprueba(/independiente/.test(await page.textContent('[data-campo="adscrito"]')), t('adscripción: «No, soy independiente» es una respuesta explícita'));
  await page.check('input[name="adscrito"][value="si"]', { force: true });
  await page.check('input[name="tipo_adscripcion"][value="dependencia_cdmx"]', { force: true });
  await page.check('input[name="dependencia_cdmx"][value="sedema"]', { force: true });
  comprueba(await page.isVisible('[data-campo="direccion_sedema"]') && !(await page.isVisible('[data-campo="alcaldia"]')),
    t('adscripción: SEDEMA pregunta su Dirección General y nada más'));
  comprueba(await page.locator('input[name="direccion_sedema"][value="otro"]').count() === 0, t('adscripción: la Dirección General es una lista cerrada (sin «otra área»)'));
  comprueba(/^Confirma tu contraseña/.test(await page.textContent('label[for="contrasena2"]')), t('cuenta: la segunda contraseña dice «Confirma tu contraseña»'));
  // «Mostrar» deja ver la contraseña y «Ocultar» la vuelve a tapar (2026-10-17)
  await page.fill('#contrasena', 'una frase larga de prueba');
  await page.click('[data-ver-contrasena][aria-controls="contrasena"]');
  const visible = await page.getAttribute('#contrasena', 'type');
  await page.click('[data-ver-contrasena][aria-controls="contrasena"]');
  comprueba(visible === 'text' && await page.getAttribute('#contrasena', 'type') === 'password' && await page.inputValue('#contrasena') === 'una frase larga de prueba',
    t('cuenta: «Mostrar» deja ver la contraseña y «Ocultar» la tapa'));
  if (ancho >= 760) comprueba(await page.evaluate(() => Math.abs(document.getElementById('contrasena').getBoundingClientRect().top - document.getElementById('contrasena2').getBoundingClientRect().top) < 2),
    t('cuenta: contraseña y confirmación quedan a la misma altura'));
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
  await page.click('[data-accion="enviar"]');
  comprueba(await page.locator('[data-campo="direccion_sedema"] .err:not(:empty)').count() > 0, t('adscripción: sin Dirección General no se crea la cuenta'));
  await page.check('input[name="tipo_adscripcion"][value="alcaldia"]', { force: true });
  comprueba(await page.isVisible('[data-campo="alcaldia"]') && !(await page.isVisible('[data-campo="direccion_sedema"]')),
    t('adscripción: al cambiar a alcaldía se oculta la Dirección General y aparece la lista de alcaldías'));
  await page.check('input[name="adscrito"][value="no"]', { force: true });
  comprueba(!(await page.isVisible('[data-campo="alcaldia"]')) && !(await page.isVisible('[data-campo="tipo_adscripcion"]')),
    t('adscripción: con «No» se oculta todo lo que dependía de ella'));
  await page.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', PDF);
  comprueba(await page.locator('[data-campo="foto"] [data-rechazos] *').count() > 0, t('cuenta: una fotografía en PDF se rechaza con su motivo'));
  // CURP escrita antes que la fecha: al cambiar la fecha se vuelve a comprobar (caso que reportó Liber)
  await page.goto(BASE + 'cuenta.html');
  await page.fill('#nombre', NUEVA.nombre);
  await page.fill('#primer_apellido', NUEVA.primer_apellido);
  await page.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await page.fill('#curp', NUEVA.curp);
  await page.press('#curp', 'Tab');
  await page.fill('#fecha_nacimiento', '31/12/1999');
  await page.press('#fecha_nacimiento', 'Tab');
  comprueba(/fecha de nacimiento no coincide/.test(await page.textContent('[data-campo="curp"] .err')), t('cuenta: con la CURP ya escrita, una fecha distinta se marca al momento'));
  // La fecha se escribe sin calendario, como día/mes/año; ocho dígitos seguidos se acomodan (decisión 2026-10-16)
  comprueba(await page.getAttribute('#fecha_nacimiento', 'type') === 'text', t('cuenta: la fecha de nacimiento se escribe, sin calendario'));
  await page.fill('#fecha_nacimiento', '30121999');
  await page.press('#fecha_nacimiento', 'Tab');
  comprueba(await page.inputValue('#fecha_nacimiento') === '30/12/1999' && !/fecha de nacimiento no coincide/.test(await page.textContent('[data-campo="curp"] .err')),
    t('cuenta: «30121999» queda como 30/12/1999 y coincide con la CURP'));
  await page.fill('#fecha_nacimiento', '31/02/1999');
  await page.press('#fecha_nacimiento', 'Tab');
  comprueba(/fecha real/.test(await page.textContent('[data-campo="fecha_nacimiento"] .err')), t('cuenta: una fecha que no existe se rechaza'));
  // Escritura guiada: al teclear pasa sola al mes y al año, como el campo de fecha del navegador
  await page.fill('#fecha_nacimiento', '');
  await page.locator('#fecha_nacimiento').pressSequentially('3012');
  const aMedias = await page.inputValue('#fecha_nacimiento');
  await page.locator('#fecha_nacimiento').pressSequentially('1999');
  comprueba(aMedias === '30/12/' && await page.inputValue('#fecha_nacimiento') === '30/12/1999', t('cuenta: al teclear la fecha, las diagonales se ponen solas (30/12/1999)'));
  await page.fill('#fecha_nacimiento', '');
  await page.locator('#fecha_nacimiento').pressSequentially('4');
  comprueba(await page.inputValue('#fecha_nacimiento') === '04/', t('cuenta: un día que empieza con 4 pasa solo al mes (04/)'));
  await page.press('#fecha_nacimiento', 'Backspace');
  await page.press('#fecha_nacimiento', 'Backspace');
  comprueba(await page.inputValue('#fecha_nacimiento') === '0', t('cuenta: al borrar no se reacomoda la fecha'));
  await page.goto(BASE + 'cuenta.html');
  // CURP con dígito incorrecto: el formulario la rechaza, igual que la base
  await llenaCuenta(page, NUEVA, otroDigito(NUEVA.curp));
  await page.click('[data-accion="enviar"]');
  comprueba(await page.getAttribute('#curp', 'aria-invalid') === 'true', t('cuenta: CURP con dígito verificador incorrecto se rechaza'));
  // CURP ajena (de otra persona ficticia) con el nombre propio: no corresponde
  const ajena = datos.solicitante.find((p) => p.estado === 'activa');
  await page.fill('#curp', ajena.curp);
  await page.click('[data-accion="enviar"]');
  comprueba(await page.getAttribute('#curp', 'aria-invalid') === 'true' && /no corresponde|no coincide/.test(await page.textContent('[data-campo="curp"] .err')),
    t('cuenta: una CURP ajena no corresponde con el nombre y se rechaza'));
  // Segundo apellido vacío con una CURP que sí lo tiene: se le dice que lo escriba (sin preguntarlo)
  await page.fill('#curp', NUEVA.curp);
  await page.fill('#segundo_apellido', '');
  await page.press('#segundo_apellido', 'Tab');
  await page.click('[data-accion="enviar"]');
  comprueba(/segundo apellido/.test(await page.textContent('[data-campo="curp"] .err')), t('cuenta: segundo apellido vacío con una CURP que sí lo tiene se rechaza con su motivo'));
  await page.fill('#segundo_apellido', NUEVA.segundo_apellido);
  // Nombre correcto pero otra fecha de nacimiento
  await page.fill('#curp', NUEVA.curp);
  await page.fill('#fecha_nacimiento', '31/12/1999');
  await page.click('[data-accion="enviar"]');
  comprueba(await page.locator('[aria-invalid="true"]').count() > 0, t('cuenta: la fecha de nacimiento distinta a la de la CURP se rechaza'));
  await page.fill('#fecha_nacimiento', dma(NUEVA.nacimiento));
  await page.fill('#curp', NUEVA.curp);
  // Un correo, una cuenta (decisión 2026-10-17): el de otra cuenta activa se marca en el campo de correo
  const ajeno = datos.solicitante.find((p) => p.estado === 'activa').correo;
  await page.fill('#correo', ajeno);
  await page.fill('#correo2', ajeno);
  await page.click('[data-accion="enviar"]');
  await page.waitForFunction(() => /ya está registrado/.test(document.querySelector('[data-campo="correo"] .err').textContent));
  comprueba(await page.getAttribute('#correo', 'aria-invalid') === 'true' && /ya está registrado/.test(await page.textContent('[data-estado-envio]')),
    t('cuenta: un correo de otra cuenta se marca en su campo y en el aviso del envío'));
  await page.fill('#correo', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await page.fill('#correo2', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await captura(page, `02-cuenta-${sufijo}`);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('cuenta nueva: acuse visible'));
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
  comprueba(await page.isVisible('[data-campo="carrera"]') && await page.isVisible('[data-campo="estatus_estudios"]') && !(await page.isVisible('[data-campo="anios_experiencia"]')),
    t('poda: con licenciatura pregunta carrera y su situación, sin experiencia'));
  await page.fill('#carrera', 'Arquitectura de Paisaje');
  await page.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
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
  comprueba(await page.isVisible(zonaCurp) && /Un archivo de hasta 5 MB/.test(await page.textContent(`${zonaCurp} [data-limite-texto]`)),
    t('documentos: al quitarlo vuelve «Elegir archivo», con «Un archivo de hasta 5 MB»'));
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
  await page.click('[data-accion="enviar"]');
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
  await page.click('[data-accion="enviar"]');
  await page.waitForFunction(() => /no coincide con el que tiene la Secretaría/.test(document.body.textContent));
  comprueba(await page.isHidden('[data-acuse]') && (await page.getAttribute('#nombre', 'aria-invalid')) === 'true', t('cuenta del padrón migrado: con dos letras distintas en el nombre no se activa y lo marca junto al nombre'));
  await page.fill('#nombre', cambia(renovable.nombre, 1));
  await page.click('[data-accion="enviar"]');
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
  await page.waitForFunction(() => document.querySelector('[data-verificacion]').dataset.tono === 'error');
  bien(t(`verificar: ${noVigente.numero} no vigente (segunda consulta sin recargar)`));
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
  await page.click('[data-accion="enviar"]');
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
  const opcionesCasos = [];
  for (const perfil of perfilesMenu) {
    await page.selectOption('#menu-pruebas-perfil', perfil);
    opcionesCasos.push(...await page.locator('#menu-pruebas-persona option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean)));
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
  await page.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  comprueba(await page.isVisible('[data-cuenta-historial]'), t('menú de pruebas: crea la cuenta de alguien del registro anterior con su CURP'));
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + 'cuenta.html');
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=Llenar con datos ficticios');
  await page.click('dialog.menu-pruebas >> text=Cerrar');
  await page.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
  await page.click('[data-accion="enviar"]');
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
      && /Examen\s*\d{2}\/\d{2}\/\d{4}/.test(f) && /Lugar del curso/.test(f) && !/Duración|Inicia el/.test(f),
      t(`mis solicitudes: con grupo, dice ${empezo ? 'en qué día del curso va' : 'cuándo presentarse'}, la fecha del examen y dónde`));
    comprueba(/identificación oficial/.test(f) && /examen/.test(f) && /al menos \d\.\d/.test(f) && await ficha.locator('ol.secuencia > li').count() >= 4,
      t('mis solicitudes: con grupo, «Qué sigue» dice que lleve la identificación, cuándo es el examen y la calificación mínima'));
    comprueba(/a las \d{2}:\d{2}/.test(f) && await ficha.locator('.datos-por-confirmar', { hasText: 'hora de entrada' }).count() === 0, t('mis solicitudes: con grupo confirmado, dice la hora de entrada (apd.grupo.hora_entrada)'));
    await page.click('[data-sesion] button');
  }
  const conCita = personaCon('validada_en_linea', citaSencilla);
  if (conCita) {
    await entra(page, conCita.curp);
    comprueba(await page.locator('[data-solicitudes] .datos-por-confirmar').count() === 4,
      t('mis solicitudes: concepto, monto y referencia del pago, y la dirección de la sede, se marcan en amarillo, por confirmar'));
    comprueba(/Lugar de la cita\s*Vivero Nezahualcóyotl/.test(await page.textContent('[data-solicitudes]')), t('mis solicitudes: la cita es en el Vivero Nezahualcóyotl'));
    // D4 (auditoría 2026-10-18): fecha, hora y lugar al principio de la ficha, antes de los datos de pago; el paso con su fecha
    const cita = await page.$eval('[data-solicitudes] .ficha', (fi) => {
      const c = fi.querySelector('.ficha-cita'); const pago = Array.from(fi.querySelectorAll('.aviso')).find((x) => /Datos para tu pago/.test(x.textContent));
      return { antes: Boolean(c && pago && (c.compareDocumentPosition(pago) & Node.DOCUMENT_POSITION_FOLLOWING)), paso: (fi.querySelector('ol.secuencia') || {}).textContent || '' };
    });
    comprueba(cita.antes && /Acude a tu cita el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}/.test(cita.paso), t('mis solicitudes: la cita va antes de los datos de pago y «Acude a tu cita» dice cuándo'));
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
  await page.click('[data-accion="enviar"]');
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
  const docs = await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).length);
  comprueba(docs === campos.length, t(`la revisión muestra los ${campos.length} documentos que se cargaron`));
  await page.waitForSelector('[data-persona] .perfil-imagen');
  comprueba(await page.evaluate(() => { const i = document.querySelector('[data-persona] .perfil-imagen'); return i.complete && i.naturalWidth > 0; }),
    t('la revisión muestra la fotografía que cargó la persona'));
  // 5 · El personal observa un documento y acepta los demás; la confirmación queda a la vista, sin el visor
  const [primero, ...resto] = campos.map((c) => c.replace(/^doc_poda_nueva_/, ''));
  await page.check(`input[name="decision_${primero}"][value="con_observacion"]`);
  await page.fill(`#observacion_${primero}`, 'No se lee completo: vuelve a escanearlo.');
  for (const k of resto) await page.check(`input[name="decision_${k}"][value="aceptado"]`);
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(!(await page.evaluate(() => document.querySelector('[data-visor]').open)) && await page.evaluate(() => document.querySelector('[data-hecho]').getBoundingClientRect().top < window.innerHeight),
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
  comprueba(await page.isVisible(`input[name="decision_${primero}"]`) && resto.every(Boolean)
    && (await Promise.all(resto.map((k) => page.isHidden(`input[name="decision_${k}"]`)))).every(Boolean)
    && await page.locator('[data-doc-previo]:not([hidden])').count() === resto.length,
    t('2.ª vuelta: sólo se decide el documento corregido; los aceptados antes no se vuelven a revisar'));
  await page.check(`input[name="decision_${primero}"][value="aceptado"]`);
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
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  bien(t('la segunda revisión la valida con su cita'));
  // 8 · Cita de cotejo: aparece en la agenda de su día; un documento no coincide y la cita queda en pausa
  await page.goto(BASE + `citas.html?dia=${dia}`);
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(/Por atender/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t('la cita aparece en la agenda de su día, por atender'));
  await page.fill('#buscar', P.curp);
  comprueba(await page.isVisible(`[data-filas] tr[data-folio="${folio}"]`) && /todos los días/.test(await page.textContent('[data-dia]')), t('la búsqueda por CURP la encuentra en todos los días'));
  await abreCotejo(page, folio);
  await page.check('input[name="se_presento"][value="si"]');
  await page.check('input[name="identidad"][value="misma"]');
  const aCotejar = await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
  comprueba(aCotejar.length === campos.length, t(`el cotejo pide los ${campos.length} documentos`));
  const [distinto, ...iguales] = aCotejar;
  for (const k of iguales) await page.check(`input[name="coincide_${k}"][value="si"]`);
  await page.check(`input[name="coincide_${distinto}"][value="no"]`);
  await page.fill(`#diferencia_${distinto}`, 'Trae una versión distinta de la que cargó.');
  comprueba(!(await page.isVisible('[data-campo="pago"]')), t('con un documento que no coincide no se pregunta por el pago'));
  await page.check('input[name="hoy_documento"][value="si"]');
  comprueba((await page.textContent('[data-accion="enviar"]')).trim() === 'Poner la cita en pausa', t('el botón dice «Poner la cita en pausa»'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])', { timeout: 8000 }).catch(async (e) => {
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
  await page.waitForSelector('[data-hecho]:not([hidden])');
  await page.goto(BASE + `citas.html?dia=${dia}`);
  await page.waitForSelector(`[data-filas] tr[data-folio="${folio}"]`);
  comprueba(/Documento cargado/.test(await page.textContent(`[data-filas] tr[data-folio="${folio}"]`)), t('la agenda dice «Documento cargado · retomar»'));
  // 10 · Retoma: sólo ese documento; con el pago y la factura, el cotejo termina y se abre el expediente
  await abreCotejo(page, folio);
  comprueba(!(await page.isVisible('[data-campo="se_presento"]')) && !(await page.isVisible('[data-campo="identidad"]'))
    && await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).length) === 1, t('al retomar sólo se coteja el documento que no coincidió'));
  await page.check(`input[name="coincide_${distinto}"][value="si"]`);
  await page.check('input[name="pago"][value="si"]');
  await page.setInputFiles('[data-campo="factura_pago"] [data-archivos] > input[type="file"]', real);
  await page.waitForSelector('[data-campo="factura_pago"] .lista-arch li[data-estado="listo"]');
  await page.fill('#factura_rfc', 'XAXX010101000');
  await page.fill('#factura_razon_social', 'Rocío Guardado Ejemplo');
  comprueba(/UUID/.test(await page.textContent('[data-campo="factura_folio_fiscal"] .ayuda')), t('cotejo: la ayuda del folio fiscal dice que también se llama UUID'));
  await page.fill('#factura_folio_fiscal', '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f');
  // El número lo da el sistema al terminar, no se anticipa al abrir (auditoría «intentar romperlo», F2 A4)
  comprueba(/se abre su expediente físico/.test(await page.textContent('[data-resumen]')) && !(await page.textContent('[data-resumen]')).includes('EXP-'),
    t('el resultado anuncia que se abre el expediente, sin anticipar un número que puede tomar otra ventanilla'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  const exp = (await page.textContent('[data-hecho]')).match(/EXP-\d{4}-\d{4}/);
  comprueba(Boolean(exp), t(`el cotejo terminado muestra el expediente${exp ? ' ' + exp[0] : ''}`));
  const pasos = await page.$$eval('[data-hecho] ol.secuencia > li', (l) => l.map((x) => x.textContent));
  comprueba(pasos.length === 3 && /expediente físico/.test(pasos[0]) && /grupo/.test(pasos[1]) && /Qué sigue/.test(await page.textContent('[data-hecho]')),
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
  const registra = async (pg) => { await pg.click('[data-accion="enviar"]'); await pg.waitForSelector('[data-hecho]:not([hidden])'); };

  // B2-01 (decisión 7 de la auditoría del 2026-10-19): el encabezado de cada día de la agenda desglosa por resultado de la
  // cita (apd.cita.resultado), como lo contaría la base: «8 citas: 7 atendidas, 1 no se presentó»
  {
    const { c, pg } = await nuevo();
    const diaMX = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA });
    const porDia = {};
    for (const x of datos.cita) {
      const d = diaMX(x.programada_en);
      const abierta = ['pendiente', 'en_pausa'].includes(x.resultado);
      const k = x.resultado === 'en_pausa' && d < datos.fecha_corte ? 'pausa_vencida' : abierta ? 'pendiente' : x.resultado;
      (porDia[d] ||= {})[k] = (porDia[d][k] || 0) + 1;
    }
    const ORDEN = [['atendida', 'atendida', 'atendidas'], ['no_se_presento', 'no se presentó', 'no se presentaron'], ['sin_pago', 'sin pago', 'sin pago'],
      ['pausa_vencida', 'pausa vencida', 'pausas vencidas'], ['cancelada', 'cancelada', 'canceladas'], ['pendiente', 'por atender', 'por atender']];
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
  await pg.check('input[name="se_presento"][value="no"]');
  comprueba(!(await pg.isVisible('[data-campo="identidad"]')) && await pg.isVisible('#cita_fecha'), t('si no se presentó sólo se pide la cita nueva'));
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
  await pg.check('input[name="se_presento"][value="no"]');
  comprueba((await pg.textContent('[data-accion="enviar"]')).trim() === 'Cerrar la solicitud', t('a la segunda inasistencia el botón es «Cerrar la solicitud»'));
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('dialog[open] .btn-peligro, .modal [data-si], dialog[open]');
  await pg.click('dialog[open] .btn-peligro');
  await pg.waitForSelector('[data-hecho]:not([hidden])');
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
  await pg.check('input[name="se_presento"][value="si"]');
  await pg.check('input[name="identidad"][value="misma"]');
  for (const k of await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await pg.check(`input[name="coincide_${k}"][value="si"]`);
  await pg.check('input[name="pago"][value="no"]');
  comprueba(!(await pg.isVisible('[data-campo="factura_rfc"]')) && (await pg.textContent('[data-accion="enviar"]')).trim() === 'Darle otra cita', t('sin pago no se pide factura y el botón es «Darle otra cita»'));
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
  await pg.check('input[name="se_presento"][value="si"]');
  await pg.check('input[name="identidad"][value="misma"]');
  const ks = await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
  await pg.check(`input[name="coincide_${ks[0]}"][value="no"]`);
  await pg.fill(`#diferencia_${ks[0]}`, 'El original tiene otra fecha de expedición.');
  for (const k of ks.slice(1)) await pg.check(`input[name="coincide_${k}"][value="si"]`);
  await pg.check('input[name="hoy_documento"][value="no"]');
  await registra(pg);
  await entra(pg, p1.curp);
  const fPago = await pg.locator('[data-solicitudes] .ficha', { hasText: s1.folio }).textContent();
  comprueba(/Corrige y reenvía/.test(fPago) && /cita de cotejo/.test(fPago) && /otra fecha de expedición/.test(fPago), t('la persona ve que en su cotejo un documento no coincidió'));
  await c.close();

  // No es la persona: no se atiende, se confirma y la cuenta queda bloqueada
  ({ c, pg, errores } = await nuevo());
  await abre(pg, s1.folio);
  await pg.check('input[name="se_presento"][value="si"]');
  await pg.check('input[name="identidad"][value="no_es"]');
  comprueba(!(await pg.isVisible('article.doc-revision')), t('si no es la persona no se cotejan documentos'));
  await pg.fill('#nota_identidad', 'La identificación muestra a otra persona distinta de la fotografía.');
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('dialog[open] .btn-peligro');
  await pg.click('dialog[open] .btn-peligro');
  await pg.waitForSelector('[data-hecho]:not([hidden])');
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
  comprueba((await visibles()).join() === reenviada.folio, t('filtra las reenviadas'));
  await sinDesborde(page, t('bandeja'));
  await captura(page, `40-personal-bandeja-${sufijo}`);

  // Carrera por clasificar: afín → todo aceptado → validar con cita
  await page.goto(BASE + `revisar.html?folio=${porClasificar.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  // Visor (decisión 2026-10-16): todas las hojas; en computadora, fijo a la derecha y abierto de entrada con el comprobante
  // de estudios cuando hay que decidir el perfil; en pantalla chica, a pantalla completa al pedirlo
  const hojasDe = { comprobante_estudios: 2, comprobantes_experiencia: 5, curp: 1 };
  if (ancho >= 1024) {
    await page.waitForSelector('.visor-lienzo');
    comprueba(await page.isVisible('[data-visor]') && await page.textContent('[data-visor-titulo]') === 'Comprobante de estudios'
      && await page.locator('.visor-lienzo').count() === hojasDe.comprobante_estudios, t('el visor abre el comprobante de estudios con todas sus hojas'));
    comprueba(await page.evaluate(() => document.activeElement === document.body), t('abrir el visor no quita el foco'));
    await page.click('[data-ver="comprobantes_experiencia"]');
    await page.waitForFunction((n) => document.querySelectorAll('.visor-lienzo').length === n, hojasDe.comprobantes_experiencia);
    comprueba(await page.textContent('[data-visor-pagina]') === 'Hoja 1 de 5', t('el visor dice en qué hoja va'));
    // El visor del estándar (P67) vuelve a dibujar cada hoja al tamaño del acercamiento: el lienzo crece
    const anchoAntes = await page.evaluate(() => document.querySelector('.visor-lienzo').width);
    await page.click('[data-visor-accion="acercar"]');
    await page.waitForFunction(() => document.querySelector('[data-visor-zoom]').textContent === '125 %');
    await page.waitForFunction((a) => { const l = document.querySelector('.visor-lienzo'); return l && l.width > a * 1.2; }, anchoAntes, { timeout: 5000 }).catch(() => {});
    comprueba(await page.evaluate((a) => document.querySelector('.visor-lienzo').width > a * 1.2, anchoAntes), t('el visor acerca'));
    await captura(page, `43-personal-visor-${sufijo}`);
  } else {
    comprueba(!(await page.isVisible('[data-visor]')), t('en pantalla chica el visor no ocupa lugar hasta pedirlo'));
    await page.click('[data-ver="curp"]');
    await page.waitForSelector('.visor-lienzo');
    comprueba(await page.evaluate(() => document.querySelector('[data-visor]').matches(':modal')), t('en pantalla chica el visor se abre a pantalla completa'));
    await captura(page, `43-personal-visor-${sufijo}`);
    await page.keyboard.press('Escape');
    comprueba(await page.evaluate(() => document.activeElement.dataset.ver === 'curp'), t('al cerrar el visor, el foco vuelve a «Ver documento»'));
  }
  await page.click('[data-accion="enviar"]');
  comprueba(await page.locator('[aria-invalid="true"]').count() > 0, t('registrar sin decidir muestra lo que falta'));
  await page.check('input[name="clasificacion"][value="afin"]');
  comprueba(/2 años/.test(await page.textContent('[data-minimo]')), t('al clasificar como afín se piden 2 años'));
  // Al aceptar un documento se pasa al siguiente sin decidir: en computadora, el visor lo muestra (decisión 2026-10-16)
  await page.check('input[name="decision_comprobante_estudios"][value="aceptado"]');
  if (ancho >= 1024) {
    await page.waitForFunction(() => document.querySelector('[data-visor-titulo]').textContent === 'Currículum vitae');
    comprueba(await page.locator('[data-doc="curriculum_vitae"][data-viendo]').count() === 1, t('al aceptar, el visor pasa al siguiente documento sin decidir'));
    // Al observar: «Listo, ir al siguiente» pide la observación escrita y luego avanza (decisión 2026-10-17)
    await page.check('input[name="decision_curriculum_vitae"][value="con_observacion"]');
    await page.click('[data-seguir="curriculum_vitae"]');
    comprueba(await page.evaluate(() => document.activeElement.id === 'observacion_curriculum_vitae'), t('al observar, sin escribir qué corregir no avanza'));
    await page.fill('#observacion_curriculum_vitae', 'Falta la última página del currículum.');
    await page.click('[data-seguir="curriculum_vitae"]');
    await page.waitForFunction(() => document.querySelector('[data-visor-titulo]').textContent !== 'Currículum vitae');
    bien(t('con la observación escrita, «Listo, ir al siguiente» pasa al siguiente documento'));
  }
  for (const d of datos.documento.filter((x) => x.solicitud_id === porClasificar.id && x.vigente)) await page.check(`input[name="decision_${d.requisito}"][value="aceptado"]`);
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Validar y asignar la cita', t('con todo aceptado, la acción es validar'));
  await page.fill('#cita_fecha', '21/10/2026'); await page.selectOption('#cita_hora', '10:00');
  await captura(page, `41-personal-validar-${sufijo}`);
  // Tras una captura de página completa, Chromium sin ventana desplaza la página al enfocar: se enfoca antes de pulsar
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(/Validada: cita el/.test(await page.textContent('[data-hecho] .resultado-titulo')) && await page.$eval('[data-hecho]', (x) => x.classList.contains('resultado-ok'))
    && /Quedó guardado a las \d{2}:\d{2} · /.test(await page.textContent('[data-hecho] .resultado-meta')),
    t('valida y asigna la cita: resultado del estándar en verde, con «Quedó guardado a las HH:MM · quien»'));

  // Perfil que no cumple, opción C: el comprobante muestra otro grado → se observa el comprobante
  await page.goto(BASE + `revisar.html?folio=${noCumple.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  await page.check('input[name="comprobante_confirma"][value="no"]');
  comprueba(await page.isChecked('input[name="decision_comprobante_estudios"][value="con_observacion"]') && (await page.inputValue('#observacion_comprobante_estudios')).length > 20,
    t('si el comprobante muestra otro grado, se observa el comprobante con un texto propuesto'));
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Enviar observaciones a la persona', t('con una observación, la acción es enviar observaciones'));
  // … o lo confirma → rechazo con motivo y confirmación
  await page.check('input[name="comprobante_confirma"][value="si"]');
  comprueba(await page.textContent('[data-accion="enviar"]') === 'Rechazar la solicitud' && !(await page.isVisible('input[name="decision_curp"]')),
    t('si el comprobante lo confirma, se rechaza sin revisar los documentos'));
  comprueba(/licenciatura trunca|preparatoria|secundaria|primaria/i.test(await page.inputValue('#motivo_rechazo')), t('el motivo del rechazo viene propuesto'));
  await captura(page, `42-personal-rechazo-${sufijo}`);
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('dialog[role="alertdialog"]');
  await page.click('dialog [data-r="no"]');
  comprueba(await page.isVisible('#formulario'), t('cancelar la confirmación no rechaza'));
  await page.click('[data-accion="enviar"]');
  await page.click('dialog [data-r="si"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(/Rechazada/.test(await page.textContent('[data-hecho] .resultado-titulo')) && await page.$eval('[data-hecho]', (x) => x.classList.contains('resultado-rechazo'))
    && (await page.locator('[data-hecho] .resultado-motivo').count()) === 1, t('rechaza al confirmar: resultado en rojo con el motivo citado, distinto de la validación'));

  // Reenviada: vueltas anteriores y documento corregido
  await page.goto(BASE + `revisar.html?folio=${reenviada.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  comprueba(await page.isVisible('[data-anteriores]') && await page.locator('.doc-corregido').count() >= 1, t('la reenviada muestra la revisión anterior y lo corregido'));
  comprueba(!(await page.isVisible('[data-perfil]')), t('en poda no hay bloque de perfil'));
  // La CURP se aceptó en la 1.ª vuelta: para observarla hay que reabrirla
  comprueba(await page.isHidden('input[name="decision_curp"]') && /Aceptado antes/.test(await page.textContent('[data-doc="curp"] .estado')), t('la reenviada no vuelve a pedir la CURP aceptada antes'));
  await page.click('[data-reabrir="curp"]');
  await page.check('input[name="decision_curp"][value="con_observacion"]');
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
   días, hora de entrada de la lista, instructor) y se da de baja a una persona (regresa a integración con su fecha); un
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

  // ── «Grupos» como planeador por curso (propuesta A, 2026-10-18) ──
  const g005 = datos.grupo.find((g) => g.estado === 'en_integracion' && g.fecha_inicio);
  await pg.goto(BASE + 'grupos.html');
  await pg.waitForSelector('.plan-grupo');
  const pulsados = await pg.$$eval('.plan-curso', (l) => l.map((b) => b.getAttribute('aria-pressed')));
  comprueba(pulsados.length === 4 && pulsados.filter((x) => x === 'true').length === 1 && pulsados[0] === 'true', t('cuatro cursos con aria-pressed; sin ?curso= se elige el primero'));
  comprueba(/1 vencida/.test(await texto('.plan-curso[data-curso="poda-renovacion"]')), t('el curso de renovación dice cuántas tienen la acreditación vencida'));
  await pg.click('.plan-curso[data-curso="poda-renovacion"]');
  comprueba(/curso=poda-renovacion/.test(pg.url()) && /En espera · 3/.test(await texto('#t-espera')), t('elegir un curso cambia la espera y queda en la dirección (?curso=)'));
  await pg.reload();
  await pg.waitForSelector('.plan-semana');
  comprueba((await pg.getAttribute('.plan-curso[data-curso="poda-renovacion"]', 'aria-pressed')) === 'true', t('al recargar se conserva el curso elegido'));
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-grupo');
  const tarjeta003 = pg.locator('.plan-grupo[data-grupo="APD-G-2026-003"]');
  comprueba((await tarjeta003.locator('.grupo-nombre').textContent()) === 'Poda nueva · del 13 al 17 de octubre · Iztapalapa' && (await tarjeta003.locator('.grupo-folio').textContent()) === 'APD-G-2026-003',
    t('nombre calculado del grupo («Poda nueva · del 13 al 17 de octubre · Iztapalapa») con el folio en chico debajo'));
  comprueba(/Día 2 de 5/.test(await tarjeta003.textContent()) && /examen hoy/.test(await texto('.plan-grupo[data-grupo="APD-G-2026-006"]')), t('esta semana: los grupos en curso con «Día X de Y» y «examen hoy»'));
  comprueba((await pg.$$('.plan-semana')).length >= 7 && /Sin fecha/.test(await texto('[data-semanas]')), t('esta semana, al menos seis más y «Sin fecha»'));
  comprueba(/ya no se puede/.test(await texto('.plan-semana[data-semana="2026-10-19"]')) && (await pg.$$('.plan-programar-semana[href*="semana="]')).length > 0,
    t('la semana que ya no se puede se explica en una línea; las libres llevan «Programar un curso esta semana»'));
  const enEsperaPoda = (await pg.$$('.plan-persona input')).length;
  await sinDesborde(pg, t('planeador'));
  await captura(pg, `grupos-${sufijo}`);
  // Sin elegir a nadie: el error junto a los botones, con el foco ahí
  await pg.click(`[data-destinos] button:has-text("26 al 30")`);
  comprueba(/No se agregó a nadie/.test(await texto('[data-error-eleccion]')) && await pg.evaluate(() => document.activeElement && document.activeElement.closest('[data-error-eleccion]') !== null)
    && (await pg.$$('.plan-persona.falta-marcar')).length > 0, t('sin elegir a nadie: el error sale junto a los botones, con el foco ahí, y se señalan las personas'));
  // Agregar a la que más espera al grupo del 26 al 30 de octubre
  const primeraEspera = await pg.getAttribute('.plan-persona input', 'value');
  await pg.check(`.plan-persona input[value="${primeraEspera}"]`);
  comprueba(/1 elegida/.test(await texto('[data-elegidas]')), t('la barra lleva la cuenta de elegidas'));
  const llegaA = pg.waitForURL(/hecho=agregadas/);
  await pg.click(`[data-destinos] button:has-text("26 al 30")`);
  await llegaA;
  await pg.waitForSelector('[data-hecho] .aviso');
  comprueba(/Se agregó 1 persona a «Poda nueva · del 26 al 30 de octubre»/.test(await texto('[data-hecho]')) && (await pg.$$('.plan-persona input')).length === enEsperaPoda - 1
    && /2 de 25/.test(await texto(`.plan-grupo[data-grupo="${g005.folio}"]`)), t('agregar a un grupo desde la espera: aviso, la persona sale de la espera y el grupo suma'));
  // Completar con las que más esperan y confirmar ahí mismo (ya tiene fecha, hora e instructor)
  const completar = pg.locator(`.plan-grupo[data-grupo="${g005.folio}"] button:has-text("Completar con las 3 que más esperan")`);
  comprueba(await completar.count() === 1, t('«Completar con las 3 que más esperan» dice cuántas faltan para el mínimo'));
  const llegaB = pg.waitForURL(/hecho=agregadas/);
  await completar.click();
  await llegaB;
  await pg.waitForSelector(`.plan-grupo[data-grupo="${g005.folio}"]`);
  comprueba(/5 de 25/.test(await texto(`.plan-grupo[data-grupo="${g005.folio}"]`)), t('completar llena el grupo hasta el mínimo con las que más esperan'));
  await pg.click(`.plan-grupo[data-grupo="${g005.folio}"] button:has-text("Confirmar el grupo")`);
  await pg.waitForSelector('dialog.dialogo-confirma[open]');
  comprueba(/¿Confirmar «Poda nueva · del 26 al 30 de octubre»\?/.test(await texto('dialog.dialogo-confirma[open]')), t('confirmar desde el planeador pide confirmación con el nombre del grupo'));
  const llegaC = pg.waitForURL(/hecho=confirmado/);
  await pg.click('dialog.dialogo-confirma[open] [data-r="si"]');
  await llegaC;
  await pg.waitForSelector(`.plan-grupo[data-grupo="${g005.folio}"]`);
  comprueba(/Confirmado/.test(await texto(`.plan-grupo[data-grupo="${g005.folio}"] .plan-grupo-cabeza`)) && /Grupo confirmado/.test(await texto('[data-hecho]')), t('el grupo queda confirmado desde el planeador'));
  // La persona ve su grupo por su nombre y su folio en «Mis trámites»
  const solA = datos.solicitud.find((x) => x.folio === primeraEspera);
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), solA.solicitante_id);
  await pg.goto(BASE + 'tramites.html');
  await pg.waitForSelector('[data-solicitudes] .ficha');
  const tramA = await texto('main');
  comprueba(/Poda nueva · del 26 al 30 de octubre/.test(tramA) && tramA.includes(g005.folio) && tramA.includes('26/10/2026'), t('«Mis trámites»: el grupo confirmado por su nombre calculado, con su folio y su primer día'));
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));

  // ── Desde la ficha de un grupo: «Agregar personas de la espera», con el botón de la ficha (auditoría 2026-10-19,
  // R4-14: antes se entraba por espera.html y el enlace real no se recorría) ──
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}`);
  const agregar = pg.locator('[data-acciones] a', { hasText: /^Agregar personas de la espera \(\d+ en espera\)$/ });
  await agregar.waitFor();
  await Promise.all([pg.waitForURL(/grupos\.html/), agregar.click()]);
  await pg.waitForSelector('.plan-persona input');
  comprueba(pg.url() === `${BASE}grupos.html?curso=poda-nueva&grupo=${integracion.folio}` && /Agregando personas a «Poda nueva · sin fecha»/.test(await texto('[data-modo-grupo]'))
    && (await pg.$$('[data-destinos] button')).length === 1, t('R4-14: «Agregar personas de la espera» de la ficha lleva a Grupos con el curso y el grupo; sólo ese grupo recibe'));
  // La dirección vieja (espera.html) lleva al mismo lugar
  await pg.goto(BASE + `espera.html?curso=poda-nueva&grupo=${integracion.folio}`);
  await pg.waitForURL(/grupos\.html\?curso=poda-nueva&grupo=/);
  await pg.waitForSelector('.plan-persona input');
  comprueba(pg.url() === `${BASE}grupos.html?curso=poda-nueva&grupo=${integracion.folio}`, t('espera.html lleva a la misma dirección de Grupos'));
  const primero = await pg.getAttribute('.plan-persona input', 'value');
  await pg.check(`.plan-persona input[value="${primero}"]`);
  await pg.click('[data-destinos] button');
  await pg.waitForURL(/grupo\.html.*hecho=agregadas/);
  await pg.waitForSelector('[data-filas] tr');
  comprueba(await pg.isVisible(`[data-filas] tr[data-folio="${primero}"]`), t('la persona elegida queda en el grupo'));
  comprueba(/Poda nueva · sin fecha/.test(await texto('#t-grupo .grupo-nombre')) && (await texto('#t-grupo .grupo-folio')) === integracion.folio, t('la ficha del grupo se titula con su nombre calculado y su folio en chico'));

  // Confirmar: la fecha debe dar 7 días de anticipación
  // Día/mes/año: el primer día del curso usa el formato «fecha-dma» del estándar (D9)
  const fechaMas = (n) => { const d = new Date(`${datos.fecha_corte}T12:00:00-06:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10).split('-').reverse().join('/'); };
  await pg.fill('#fecha_inicio', fechaMas(3));
  await pg.selectOption('#hora_entrada', '09:00');
  await pg.selectOption('#instructor', 'instructor.ficticio');
  await pg.click('#confirmar [data-accion="enviar"]');
  await pg.waitForTimeout(300);
  comprueba(!/hecho=confirmado/.test(pg.url()) && (await pg.getAttribute('#fecha_inicio', 'aria-invalid')) === 'true', t('confirmar con menos de 7 días de anticipación marca el error junto a la fecha'));
  const msjFecha = await pg.evaluate(() => { const c = document.querySelector('[data-campo="fecha_inicio"] .error, [data-campo="fecha_inicio"] [id^="err-"]'); return c ? c.textContent : ''; });
  comprueba(/anterior al \d{2}\/\d{2}\/\d{4}/.test(msjFecha) && !/\b(Escribe|Revisa|Elige)\b/.test(msjFecha), t(`el límite de la fecha se dice en día/mes/año y en usted («${msjFecha.trim()}»)`));
  await captura(pg, `grupos-confirmar-error-${sufijo}`);
  await pg.fill('#fecha_inicio', fechaMas(19));
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega1 = pg.waitForURL(/hecho=confirmado/);
  await pg.click('#confirmar [data-accion="enviar"]');
  await llega1;
  await pg.waitForSelector('[data-situacion] .estado');
  comprueba(/Confirmado/.test(await texto('[data-situacion]')) && /09:00/.test(await texto('[data-datos]')), t('el grupo queda confirmado con su hora de entrada'));
  await sinDesborde(pg, t('grupo confirmado'));
  await captura(pg, `grupos-confirmado-${sufijo}`);

  // La persona ve su grupo con fecha y hora en «Mis trámites»
  const sol = datos.solicitud.find((x) => x.folio === primero);
  await pg.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sol.solicitante_id);
  await pg.goto(BASE + 'tramites.html');
  await pg.waitForSelector('[data-solicitudes] .ficha');
  const tram = await texto('main');
  comprueba(tram.includes(APDfecha(fechaMas(19))) && /09:00/.test(tram), t('«Mis trámites»: la persona ve el primer día del curso y la hora de entrada'));
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));

  // Baja: el grupo queda por debajo del mínimo y regresa a integración
  await pg.goto(BASE + `grupo.html?folio=${integracion.folio}`);
  await pg.waitForSelector('[data-filas] tr');
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

  // Programar un grupo de renovación con toda la espera, guardarlo sin confirmar y cancelarlo
  await pg.goto(BASE + 'programar.html?curso=poda-renovacion');
  await pg.waitForSelector('.cal-dia');
  const enEspera = (await pg.$$('[data-personas] .plan-persona input:checked')).length;
  await pg.click('[data-programar="guardar"]');
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/Grupo guardado sin confirmar: Poda renovación · \d+ de [a-z]+/.test(await texto('[data-resultado]')), t('«Guardar sin confirmar» deja el grupo de renovación por confirmar, con su nombre calculado'));
  await pg.click('[data-ir-grupo]');
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
  await pg.goto(BASE + 'grupos.html?curso=poda-renovacion');
  await pg.waitForSelector('.plan-persona input');
  comprueba((await pg.$$('.plan-persona input')).length === enEspera, t('al cancelar, las personas regresan a la espera'));

  // Asistencia del instructor: no guarda con alguien sin marcar; guarda el día y avisa a quien ya no tiene derecho
  // Hay dos grupos en curso (el del caso «aprobó hoy» termina en la fecha de corte): se abre el que sigue en clases
  const grupoClases = datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13');
  // El último día (examen) no se captura aquí: pedirlo con ?dia=5 no abre su lista (auditoría A 7.1: la comprobación
  // anterior miraba «Corregir otro día», que nunca lo lista)
  await pg.goto(BASE + `asistencia.html?folio=${grupoClases.folio}&dia=5`);
  await pg.waitForSelector('.asistencia-fila');
  const tituloDia5 = await texto('[data-titulo-dia]');
  await pg.goto(BASE + `asistencia.html?folio=${grupoClases.folio}`);
  await pg.waitForSelector('.asistencia-fila');
  // Propuesta A (2026-10-18): la lista del día de hoy; el último día (examen) no se ofrece para capturar
  comprueba(/^Día 2 de 5/.test(await texto('[data-titulo-dia]')) && !/^Día 5\b/.test(tituloDia5) && (await pg.$$('[data-dias] a[href*="dia=5"]')).length === 0
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
  comprueba(/guardada/.test(await texto('[data-hecho]')), t('la asistencia del día se guarda'));
  comprueba(/^Día 3 de 5/.test(await texto('[data-titulo-dia]')) && /Sigue el día 3/.test(await texto('[data-hecho]')), t('en la versión de prueba, guardar lleva al día siguiente del curso'));
  comprueba(Boolean(falto) && /Sin derecho a examen/.test(await texto(`.asistencia-fila[data-ins="${faltaDia1.inscripcion_id}"]`)), t('quien faltó dos días se marca sin derecho a examen'));
  await sinDesborde(pg, t('asistencia'));
  await captura(pg, `asistencia-guardada-${sufijo}`);
  // La ficha de un grupo concluido conserva la asistencia de conjunto
  await pg.goto(BASE + `grupo.html?folio=${datos.grupo.find((g) => g.estado === 'concluido').folio}`);
  await pg.waitForSelector('[data-conc-filas] tr');
  comprueba(/Sin derecho/.test(await texto('[data-concentrado]')), t('la ficha de un grupo concluido muestra la asistencia por día y quién se quedó sin derecho'));
  await sinDesborde(pg, t('grupo concluido con su concentrado'));
  comprueba(enCurso && errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // R4-04 y RI-07 (auditoría 2026-10-19): una propuesta vencida (APD-G-2026-005 al 28/09) y un grupo confirmado cuya semana
  // pasó sin iniciar (APD-G-2026-004 al 05/10) no van en «Sin fecha»: van en «Su fecha ya pasó», con «Elegir otra semana»
  const pasados = JSON.parse(JSON.stringify(datos));
  for (const g of pasados.grupo) {
    if (g.folio === 'APD-G-2026-005') g.fecha_inicio = '2026-09-28';
    if (g.folio === 'APD-G-2026-004') Object.assign(g, { estado: 'confirmado', fecha_inicio: '2026-10-05', hora_entrada: '09:00:00', instructor: 'instructor2.ficticio' });
  }
  const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  await c2.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(pasados), contentType: 'application/json' }));
  const p2 = await c2.newPage();
  await p2.goto(BASE + 'grupos.html?curso=poda-nueva');
  await p2.waitForSelector('.plan-semana');
  const enSin = await p2.$$eval('.plan-semana[data-semana=""] .plan-grupo', (l) => l.map((x) => x.dataset.grupo));
  const enPasada = await p2.$$eval('.plan-semana[data-semana="pasada"] .plan-grupo', (l) => l.map((x) => x.dataset.grupo));
  const t005 = (await p2.textContent('.plan-grupo[data-grupo="APD-G-2026-005"]')) || '';
  comprueba(!enSin.length && enPasada.join() === 'APD-G-2026-005,APD-G-2026-004' && /Su fecha ya pasó/.test(await p2.textContent('[data-semanas]')),
    t('un grupo con fecha pasada no va en «Sin fecha»: va en «Su fecha ya pasó»'));
  comprueba(/Propuesta vencida/.test(t005) && !/examen el/.test(t005) && (await p2.getAttribute('.plan-grupo[data-grupo="APD-G-2026-005"] a:has-text("Elegir otra semana")', 'href')) === 'programar.html?curso=poda-nueva&grupo=APD-G-2026-005'
    && /no inició/.test(await p2.textContent('.plan-grupo[data-grupo="APD-G-2026-004"]')), t('la propuesta vencida lo dice, sin examen por venir, y lleva a «Elegir otra semana»; el confirmado dice que no inició'));
  await sinDesborde(p2, t('su fecha ya pasó'));
  await c2.close();
}
const APDfecha = (iso) => iso.split('-').reverse().join('/');

/* ── «Programar un curso» en 3 pasos (propuesta B) y «Mis grupos de hoy» (propuesta D), 2026-10-18 ──
   Desde Grupos con cinco personas elegidas («A un curso nuevo…»): error con menos de 5; el calendario no deja empezar
   con otro curso igual esas fechas ni con menos de 7 días, se maneja con el teclado y llena el primer día; crear y
   confirmar. Después, programar un grupo sin fecha que ya existe («Elegir semana»). El instructor ve «Mis grupos de hoy»
   en «Asistencia» y en «Aplicar el examen». */
async function caminosProgramar(navegador, ancho, alto, sufijo) {
  const t = (m) => `[programar ${sufijo}] ${m}`;
  const c = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const texto = async (sel) => (await pg.textContent(sel)) || '';
  const sinFecha = datos.grupo.find((g) => g.estado === 'en_integracion' && !g.fecha_inicio);

  // E1-02 (auditoría 2026-10-19): ?grupo= con texto libre no se repite en pantalla; un folio con forma de folio, sí
  await pg.goto(BASE + `programar.html?grupo=${encodeURIComponent('APD-G-2026-999. Llame al 0000000000 para confirmar')}`);
  await pg.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-bajada]').textContent));
  const reflejo = await pg.evaluate(() => document.body.innerText);
  await pg.goto(BASE + 'programar.html?grupo=APD-G-2026-999');
  await pg.waitForFunction(() => !/Cargando/.test(document.querySelector('[data-bajada]').textContent));
  comprueba(!/Llame al|0000000000/.test(reflejo) && /No se encontró ese grupo/.test(reflejo) && /No se encontró el grupo APD-G-2026-999\./.test(await texto('[data-bajada]')),
    t('E1-02: el texto libre de ?grupo= no se repite en pantalla; un folio válido que no existe, sí'));

  // B5-02 (auditoría 2026-10-19): salir con cambios lo advierte el navegador; recargar, «Atrás» y «Adelante» conservan la
  // semana elegida (va en la dirección)
  {
    const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    const p2 = await c2.newPage();
    const dialogos = [];
    p2.on('dialog', (d) => { dialogos.push(d.type()); d.accept(); });
    await p2.goto(BASE + 'programar.html?curso=poda-nueva');
    await p2.waitForSelector('.cal-dia');
    const sinCambios = await p2.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
    await p2.click('.cal-dia[data-fecha="2026-11-16"]');
    await p2.selectOption('#hora_entrada', '07:00');
    await p2.reload();
    await p2.waitForSelector('.cal-dia');
    comprueba(!sinCambios && dialogos.includes('beforeunload') && (await p2.inputValue('#fecha_inicio')) === '16/11/2026' && /semana=2026-11-16/.test(p2.url()),
      t('B5-02: recargar con cambios lo advierte y conserva la semana elegida; sin cambios no advierte'));
    await p2.goto(BASE + 'grupos.html?curso=poda-nueva');
    await p2.waitForSelector('.plan-persona input');
    await p2.goto(BASE + 'programar.html?curso=poda-nueva');
    await p2.waitForSelector('.cal-dia');
    await p2.click('.cal-dia[data-fecha="2026-11-23"]');
    await p2.goBack();
    await p2.waitForURL(/grupos\.html/);
    await p2.goForward();
    await p2.waitForSelector('.cal-dia');
    comprueba((await p2.inputValue('#fecha_inicio')) === '23/11/2026', t('B5-02: «Atrás» y «Adelante» conservan la semana elegida'));
    await c2.close();
  }
  // R4-15 (auditoría 2026-10-19): el calendario del curso no lleva el atributo del botón de calendario de los campos de
  // fecha, y su leyenda dice los días de anticipación del parámetro (aquí 10)
  {
    const diez = JSON.parse(JSON.stringify(datos));
    diez.parametro.find((p) => p.clave === 'dias_anticipacion_grupo').valor = '10';
    const c2 = await navegador.newContext({ timezoneId: ZONA, viewport: { width: ancho, height: alto } });
    await c2.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: JSON.stringify(diez), contentType: 'application/json' }));
    const p2 = await c2.newPage();
    await p2.goto(BASE + 'programar.html?curso=poda-nueva');
    await p2.waitForSelector('.cal-dia');
    comprueba(!(await p2.evaluate(() => Boolean(document.querySelector('.cal-dia').closest('[data-calendario]')))) && /menos de 10 días/.test(await p2.textContent('[data-leyenda-no]')),
      t('R4-15: el calendario del curso no es un [data-calendario] y su leyenda toma los días del parámetro'));
    await c2.close();
  }

  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-persona input');
  const cinco = (await pg.$$eval('.plan-persona input', (l) => l.map((i) => i.value))).slice(0, 5);
  for (const f of cinco) await pg.check(`.plan-persona input[value="${f}"]`);
  await pg.click('[data-destinos] a:has-text("A un curso nuevo")');
  await pg.waitForURL(/programar\.html\?curso=poda-nueva&personas=/);
  await pg.waitForSelector('.cal-dia');
  const marcadas = await pg.$$eval('[data-personas] .plan-persona input:checked', (l) => l.map((i) => i.value));
  comprueba(marcadas.length === 5 && cinco.every((f) => marcadas.includes(f)), t('«A un curso nuevo…» lleva a Programar con las cinco elegidas'));
  // Paso 1: la propuesta es el primer lunes que se puede; el del 26 de octubre lo ocupa otro curso igual
  comprueba((await pg.getAttribute('.cal-dia[aria-pressed="true"]', 'data-fecha')) === '2026-11-02' && (await pg.$$('.cal-dia[data-rango]')).length === 5
    && (await pg.inputValue('#fecha_inicio')) === '02/11/2026', t('paso 1: propone el primer lunes posible y resalta los 5 días del curso, con el primer día escrito'));
  await pg.click('[data-mes="-1"]');
  const d26 = '.cal-dia[data-fecha="2026-10-26"]';
  comprueba((await pg.getAttribute(d26, 'aria-disabled')) === 'true' && /ya hay un curso de poda nueva/.test(await pg.getAttribute(d26, 'aria-label'))
    && (await pg.getAttribute('.cal-dia[data-fecha="2026-10-20"]', 'data-no')) === 'anticipacion', t('días que no se pueden: otro curso igual esas fechas y menos de 7 días, con la razón en su nombre'));
  // aria-disabled: Playwright no lo «presiona» por su cuenta; la persona sí puede tocarlo y lee por qué
  await pg.click(d26, { force: true });
  comprueba(/no se puede/.test(await texto('[data-cal-estado]')) && (await pg.inputValue('#fecha_inicio')) === '02/11/2026', t('tocar un día que no se puede dice por qué y no cambia la fecha'));
  await pg.click('[data-mes="1"]');
  await pg.click('.cal-dia[data-fecha="2026-11-09"]');
  comprueba((await pg.getAttribute('.cal-dia[data-fecha="2026-11-09"]', 'aria-pressed')) === 'true' && (await pg.inputValue('#fecha_inicio')) === '09/11/2026', t('tocar un lunes lo elige y escribe el primer día'));
  // Con el teclado: flecha abajo = una semana después; Intro la elige
  await pg.focus('.cal-dia[data-fecha="2026-11-09"]');
  await pg.keyboard.press('ArrowDown');
  comprueba(await pg.evaluate(() => document.activeElement && document.activeElement.dataset.fecha) === '2026-11-16', t('el calendario se recorre con las flechas'));
  await pg.keyboard.press('Enter');
  comprueba((await pg.inputValue('#fecha_inicio')) === '16/11/2026' && /del 16 al 20 de noviembre/.test(await texto('[data-resumen-nombre]')), t('Intro elige el día y «Así quedaría» muestra el nombre calculado'));
  // Paso 2: instructor propuesto (libre esas fechas) y hora de entrada
  comprueba(/libre esas fechas/.test(await pg.$eval('#instructor', (s) => s.selectedOptions[0].textContent)), t('paso 2: el instructor propuesto está libre esas fechas'));
  await pg.selectOption('#hora_entrada', '08:30');
  // Paso 3: con menos de 5 no se crea ni se confirma, y se dice qué falta
  for (const f of cinco.slice(2)) await pg.uncheck(`[data-personas] input[value="${f}"]`);
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForSelector('[data-falta] .aviso');
  comprueba(/No se creó el grupo/.test(await texto('[data-falta]')) && /3 personas más/.test(await texto('[data-falta]')) && await pg.isHidden('[data-resultado]')
    && await pg.evaluate(() => document.activeElement && document.activeElement.closest('[data-falta]') !== null), t('crear y confirmar con 2 personas: no se crea, y el error dice cuántas faltan, junto a los botones'));
  await sinDesborde(pg, t('programar'));
  await captura(pg, `programar-error-${sufijo}`);
  for (const f of cinco.slice(2)) await pg.check(`[data-personas] input[value="${f}"]`);
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/Grupo confirmado: Poda nueva · del 16 al 20 de noviembre/.test(await texto('[data-resultado]')) && /APD-G-2026-007 · 5 personas · entrada a las 08:30/.test(await texto('[data-resultado]'))
    && /Qué sigue/.test(await texto('[data-resultado]')), t('crear y confirmar: resultado con el nombre calculado, el folio y «Qué sigue»'));
  await captura(pg, `programar-hecho-${sufijo}`);
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-grupo[data-grupo="APD-G-2026-007"]');
  comprueba(/Confirmado/.test(await texto('.plan-grupo[data-grupo="APD-G-2026-007"]')) && /2026-11-16/.test(await pg.getAttribute('.plan-semana:has([data-grupo="APD-G-2026-007"])', 'data-semana')),
    t('al recargar Grupos, el grupo nuevo está confirmado en su semana'));
  // Un grupo sin fecha que ya existe: «Elegir semana» lo programa (sus personas ya están; se agregan más de la espera)
  await pg.click(`.plan-grupo[data-grupo="${sinFecha.folio}"] a:has-text("Elegir semana")`);
  await pg.waitForURL(/programar\.html\?curso=poda-nueva&grupo=/);
  await pg.waitForSelector('.cal-dia');
  comprueba(/Ya están en el grupo \(4\)/.test(await texto('[data-ya-estan]')) && await pg.isHidden('[data-campo="integracion"]'), t('programar un grupo que existe: muestra a quienes ya están y no cambia su tipo'));
  await pg.click('.cal-dia[data-fecha="2026-11-23"]');
  await pg.selectOption('#instructor', 'instructor2.ficticio');
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForSelector('[data-falta] .aviso');
  comprueba(/una persona más/i.test(await texto('[data-falta]')), t('con 4 personas el grupo no se confirma: falta una'));
  await pg.check('[data-personas] .plan-persona input');
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(new RegExp(`Grupo confirmado: Poda nueva · del 23 al 27 de noviembre`).test(await texto('[data-resultado]')) && (await texto('[data-resultado]')).includes(sinFecha.folio), t('el grupo sin fecha queda programado y confirmado, con su mismo folio'));

  // «Mis grupos de hoy» del instructor: Asistencia y Aplicar el examen sin ?folio=
  for (const [pagina, nombre] of [['asistencia.html', 'Asistencia'], ['aplicar.html', 'Aplicar el examen']]) {
    await pg.goto(BASE + pagina);
    await pg.waitForSelector('.hoy-grupo');
    const tarjetas = await pg.$$eval('.hoy-grupo', (l) => l.map((x) => ({ nombre: x.querySelector('.grupo-nombre').textContent, accion: x.querySelector('a.btn').getAttribute('href'), texto: x.textContent })));
    comprueba(/Mis grupos de hoy/.test(await texto('#t-mis-grupos, #t-sin-grupo')) && tarjetas.length === 2
      && tarjetas.some((x) => x.nombre === 'Poda nueva · del 10 al 14 de octubre' && /aplicar\.html\?folio=APD-G-2026-006/.test(x.accion) && /Pasar lista y aplicar/.test(x.texto))
      && tarjetas.some((x) => x.nombre === 'Poda nueva · del 13 al 17 de octubre · Iztapalapa' && /asistencia\.html\?folio=APD-G-2026-003/.test(x.accion) && /Pasar asistencia/.test(x.texto)),
    t(`${nombre} sin folio: «Mis grupos de hoy» con dos tarjetas por su nombre calculado y la acción del día`));
    comprueba(/Próximos/.test(await texto('main')) && /del 16 al 20 de noviembre/.test(await texto('.hoy-proximos')), t(`${nombre}: «Próximos» con los grupos que vienen`));
    await sinDesborde(pg, t(`${nombre} sin folio`));
    await captura(pg, `mis-grupos-${pagina.replace('.html', '')}-${sufijo}`);
  }
  await pg.click('.hoy-grupo a:has-text("Pasar lista y aplicar")');
  await pg.waitForURL(/aplicar\.html\?folio=APD-G-2026-006/);
  await pg.waitForSelector('[data-grupo] .grupo-nombre');
  comprueba(/Poda nueva · del 10 al 14 de octubre/.test(await texto('[data-grupo] .grupo-nombre')), t('«Aplicar el examen» abre el grupo de la tarjeta, con su nombre calculado'));
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
  await pg.waitForSelector('.asistencia-fila');
  comprueba((await texto('[data-bajada] .grupo-nombre')) === 'Poda nueva · del 13 al 17 de octubre · Iztapalapa' && (await texto('[data-bajada] .grupo-folio')) === 'APD-G-2026-003',
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
  await pg.waitForSelector('[data-hecho]:not([hidden])');
  await pg.goto(BASE + `citas.html?dia=${datos.fecha_corte}`);
  await pg.waitForSelector('main tr');
  const fila = await pg.locator('tr', { hasText: sp.folio }).first().innerText();
  comprueba(/Documento cargado/.test(fila), t(`C1: la corrección de la cita en pausa de ${sp.folio} llega a la agenda («Documento cargado · retomar»)`));
  // C2: dos reenvíos de una solicitud con observaciones conservan la revisión de en medio
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
    await APD_PERSONAL.guardaGrupo({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: APD.sumaDias(d.fecha_corte, 8), hora_entrada: '09:00', instructor: 'instructor.ficticio', por: 'revision.prueba' });
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
  await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
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
  for (const k of await pg.$$eval('article.doc-revision[data-doc]', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) {
    await pg.check(`input[name="decision_${k}"][value="aceptado"]`, { force: true });
  }
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
  comprueba(/sábado y domingo/.test(await pg.textContent('#ay-cita-hora')), t('F2 M4: la ayuda dice que los días de atención los define el área (P69, P151)'));
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
  await pg.waitForSelector('article[data-grupo="APD-G-2026-004"]');
  const lleno = await pg.textContent('article[data-grupo="APD-G-2026-004"]');
  comprueba(/Confirmar el grupo/.test(lleno) && /Elegir semana/.test(lleno) && /lleno/.test(lleno), t('F3 M3: el grupo por confirmar lleno ofrece «Confirmar el grupo» y «Elegir semana», con su cupo'));
  await pg.unroute('**/datos/ficticios.json*');
  // M4 · en un grupo de una organización (o si todas son de la misma) se completa con las que caben, una por una
  const m4 = await pg.evaluate(() => {
    const xs = Array.from({ length: 13 }, (_, i) => ({ s: { folio: `F${i}`, organizacion_id: 'org-1' }, organizacion: 'Org' }));
    return [APD_PERSONAL.lasQueMasEsperan(xs, 2, (y) => y.s.organizacion_id === 'org-1').length, APD_PERSONAL.lasQueMasEsperan(xs, 2).length];
  });
  comprueba(m4[0] === 2 && m4[1] === 2, t(`F3 M4: con 13 de la misma organización y 2 lugares se proponen 2 (${m4.join(', ')})`));
  // B5 · el aviso de un grupo sin fecha dice su folio
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&hecho=agregadas&a=APD-G-2026-004&n=1');
  await pg.waitForSelector('[data-hecho] .aviso');
  comprueba(/APD-G-2026-004/.test(await pg.textContent('[data-hecho]')), t('F3 B5: el aviso de un grupo sin fecha lleva su folio'));
  // B6 · un enlace a un grupo que ya no recibe lo dice
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva&grupo=APD-G-2026-001');
  await pg.waitForSelector('[data-personas]');
  comprueba(await pg.isVisible('[data-modo-grupo]') && /ya no recibe/.test(await pg.textContent('[data-modo-grupo]')), t('F3 B6: «Ese grupo ya no recibe personas», con su ficha'));
  // B7 · las elegidas se conservan al cambiar de curso y volver
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('[data-personas] input.plan-casilla[value]');
  const casillas = pg.locator('[data-personas] input.plan-casilla[value]');
  await casillas.nth(0).check();
  await casillas.nth(1).check();
  await pg.click('[data-curso="poda-renovacion"]');
  await pg.click('[data-curso="poda-nueva"]');
  comprueba(await pg.locator('[data-personas] input.plan-casilla[value]:checked').count() === 2, t('F3 B7: las 2 elegidas siguen marcadas al volver al curso'));
  sinErrores(errores, 'F3 grupos');
  await c.close();

  ({ c, pg, errores } = await contexto());
  // M5 · con ?personas= que ya tienen grupo no se marca a nadie y se dice
  const inscritaF = datos.solicitud.find((x) => x.estado === 'inscrita' && x.tipo_acreditacion === 'poda' && x.modalidad === 'nueva');
  await pg.goto(BASE + `programar.html?curso=poda-nueva&personas=${inscritaF.folio}`);
  await pg.waitForSelector('[data-propuesta]');
  comprueba(await pg.locator('[data-personas] input:checked').count() === 0 && /ya no está en espera/.test(await pg.textContent('[data-propuesta]')),
    t('F3 M5: si las elegidas ya tienen grupo, no se propone a otras y se dice'));
  // B2 · una fecha imposible en la dirección se ignora
  await pg.goto(BASE + 'programar.html?curso=poda-nueva&semana=2026-13-45');
  await pg.waitForSelector('.cal-dia');
  comprueba(await pg.isVisible('#programar') && !/No se pudo/.test(await pg.textContent('[data-bajada]')), t('F3 B2: con ?semana=2026-13-45 se propone la primera semana posible'));
  // B3 · una fecha escrita que no existe se dice al momento
  await pg.fill('#fecha_inicio', '29/02/2027');
  await pg.waitForTimeout(150);
  comprueba(/Sin elegir/.test(await pg.textContent('[data-resumen]')) && /no es una fecha real/.test(await pg.textContent('[data-cal-estado]')), t('F3 B3: 29/02/2027 deja el resumen «Sin elegir» y lo dice'));
  // B4 · el año en «Así quedaría» cuando el curso cruza de año
  await pg.goto(BASE + 'programar.html?curso=poda-nueva&semana=2026-12-28');
  await pg.waitForSelector('[data-resumen] .datos');
  comprueba(/2027/.test(await pg.textContent('[data-resumen]')), t('F3 B4: «Así quedaría» lleva el año cuando el curso cruza de año'));
  // B9 · «tiene propuesto» para un grupo por confirmar
  await pg.goto(BASE + 'programar.html?curso=dictaminador-nueva&semana=2026-10-26');
  await pg.waitForSelector('#instructor');
  await pg.selectOption('#instructor', 'instructor.ficticio');
  comprueba(/tiene propuesto/.test(await pg.textContent('[data-ayuda-instructor]')) && !/ya da/.test(await pg.textContent('[data-ayuda-instructor]')), t('F3 B9: el instructor «tiene propuesto» un grupo por confirmar, no «ya da»'));
  // M5 · al guardar, recargar no reabre el formulario de un grupo nuevo
  await pg.goto(BASE + 'programar.html?curso=poda-nueva');
  await pg.waitForSelector('[data-programar="guardar"]');
  await pg.click('[data-programar="guardar"]');
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/grupo\.html\?folio=APD-G-/.test(pg.url()), t(`F3 M5: después de guardar, la dirección es la ficha del grupo (${pg.url().split('/').pop()})`));
  // M7 · la propuesta no dice que el grupo estuvo confirmado
  await pg.goto(BASE + 'grupo.html?folio=APD-G-2026-005');
  await pg.waitForSelector('[data-datos] .datos');
  comprueba(/propuestos, todavía sin confirmar/.test(await pg.textContent('[data-datos]')) && !/dejó de estar confirmado/.test(await pg.textContent('[data-datos]')), t('F3 M7: la fecha propuesta se dice «todavía sin confirmar»'));
  sinErrores(errores, 'F3 programar');
  await c.close();

  ({ c, pg, errores } = await contexto(390, 844));
  // M8 · quien ya presentó el examen tiene su fila cerrada
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-006&dia=1');
  await pg.waitForSelector('[data-personas] .asistencia-fila');
  const filas6 = await pg.locator('[data-personas] .asistencia-fila').count();
  comprueba(filas6 > 0 && await pg.locator('[data-personas] .asis-opcion-input:disabled').count() === filas6 * 2 && await pg.locator('.asis-cerrada').count() === filas6,
    t('F3 M8: con la calificación registrada, la asistencia no se puede cambiar y la fila lo dice'));
  // B1 · al corregir un día anterior se vuelve al de hoy, sin «(simulado)»
  await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003&dia=1');
  await pg.waitForSelector('[data-todas]');
  // B11 · el botón del menú de pruebas no tapa «Asistió» ni «Faltó»
  const tapa = await pg.evaluate(() => {
    const b = document.querySelector('.menu-pruebas-boton').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.asis-opcion')).some((o) => { const r = o.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom); });
  });
  comprueba(!tapa, t('F3 B11: en teléfono, el botón del menú de pruebas no tapa «Asistió» ni «Faltó»'));
  await pg.click('[data-todas]');
  await Promise.all([pg.waitForNavigation(), pg.click('[data-guardar]')]);
  await pg.waitForSelector('[data-hecho] .aviso');
  const hecho1 = await pg.textContent('[data-hecho]');
  comprueba(!/simulado/.test(hecho1) && /día de hoy/.test(hecho1) && !/[?&]dia=/.test(pg.url()), t(`F3 B1: al corregir un día anterior vuelve al de hoy, sin «(simulado)» («${hecho1.trim().slice(0, 120)}»)`));
  // B8 · todas ya presentaron
  await pg.goto(BASE + 'aplicar.html?folio=APD-G-2026-006');
  await pg.waitForSelector('[data-cuenta]');
  await pg.waitForFunction(() => /inscritas/.test(document.querySelector('[data-cuenta]').textContent));
  comprueba(/ya presentaron el examen/.test(await pg.textContent('[data-cuenta]')) && !/0 con derecho/.test(await pg.textContent('[data-cuenta]')), t('F3 B8: «las 5 ya presentaron el examen», no «0 con derecho»'));
  sinErrores(errores, 'F3 asistencia');
  await c.close();
  // M9 · el único grupo de hoy tiene examen: «Mis grupos de hoy» con «Pasar lista y aplicar»
  ({ c, pg, errores } = await contexto());
  await conRuta(pg, (j) => { j.grupo.find((x) => x.folio === 'APD-G-2026-003').instructor = 'instructor2.ficticio'; });
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
  for (const [pagina, sel] of [['grupos.html?curso=poda-nueva', '.plan-grupo'], ['programar.html?curso=poda-nueva', '.cal-dia'], ['aplicar.html?folio=APD-G-2026-003', '[data-con-grupo]:not([hidden])'], ['asistencia.html?folio=APD-G-2026-003', '.asistencia-fila']]) {
    await pg.goto(BASE + pagina);
    cargaron.push(await pg.waitForSelector(sel, { timeout: 8000 }).then(() => true, () => false) && !/No se pud/.test(await pg.textContent('main')));
  }
  comprueba(cargaron.every(Boolean), t(`B5-04: con un grupo y una inscripción null en los datos, Grupos, Programar, Aplicar y Asistencia cargan (${cargaron.join(', ')})`));
  sinErrores(errores, 'B5-04');
  await c.close();
  // B5-01 (ya corregido en 0.58, F3 B2): sin las tablas de grupos, «Programar» no deja el formulario a medias ni lo envía
  ({ c, pg, errores } = await contexto());
  await conRuta(pg, (j) => { delete j.grupo; delete j.inscripcion; });
  await pg.goto(BASE + 'programar.html?curso=poda-nueva');
  await pg.waitForFunction(() => /No se pudo cargar/.test(document.querySelector('[data-bajada]').textContent));
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(300);
  comprueba(await pg.isHidden('#programar') && !(await pg.$$eval('[data-programar]', (l) => l.filter((b) => b.offsetParent).length)) && /programar\.html\?curso=poda-nueva$/.test(pg.url()),
    t('B5-01: sin datos de grupos, «Programar» oculta el formulario y sus botones, y no envía nada'));
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
    await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
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
    comprueba(!r.acuse && /Tu sesión se cerró en otra pestaña/.test(r.aviso) && sinPersona === 0, t(`F1 2: sin sesión no se envía la solicitud («${r.aviso.slice(0, 80)}», ${sinPersona} creadas)`));
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
  const docsDe = (pg) => pg.$$eval('article.doc-revision[data-doc]', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
  const abreRevision = async (pg) => { await pg.goto(BASE + `revisar.html?folio=${podaEnviada.folio}`); await pg.waitForSelector('#formulario:not([hidden])'); };
  const valida = async (pg) => {
    for (const k of await docsDe(pg)) await pg.check(`input[name="decision_${k}"][value="aceptado"]`, { force: true });
    await pg.waitForSelector('#cita_fecha', { state: 'visible' });
    await pg.fill('#cita_fecha', dma(await pg.getAttribute('[data-campo="cita_fecha"]', 'data-min')));
    await pg.selectOption('#cita_hora', '10:00');
  };
  const observa = async (pg) => {
    const [k, ...resto] = await docsDe(pg);
    await pg.check(`input[name="decision_${k}"][value="con_observacion"]`, { force: true });
    await pg.fill(`#observacion_${k}`, 'El documento no se lee bien: cárgalo otra vez, completo.');
    for (const x of resto) await pg.check(`input[name="decision_${x}"][value="aceptado"]`, { force: true });
    return k;
  };
  const registraRev = async (pg) => {
    await pg.click('[data-accion="enviar"]');
    await pg.waitForSelector('[data-hecho]:not([hidden]) .resultado, [data-hecho]:not(:empty), [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
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
    await pg.click('[data-accion="enviar"]');
    await pg.waitForSelector('#formulario[hidden], [data-estado-envio]:not([hidden]), .resumen-errores', { timeout: 8000 }).catch(() => null);
    return { hecho: await pg.isHidden('#formulario'), aviso: await aviso(pg), texto: (await pg.textContent('[data-hecho]')) || '' };
  };
  const terminaCotejo = async (pg, folioFiscal) => {
    await pg.check('input[name="se_presento"][value="si"]');
    await pg.check('input[name="identidad"][value="misma"]');
    for (const k of await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await pg.check(`input[name="coincide_${k}"][value="si"]`);
    await pg.check('input[name="pago"][value="si"]');
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
    await ca.check('input[name="se_presento"][value="no"]');
    await ca.fill('#cita_fecha', '22/10/2026');
    await ca.selectOption('#cita_hora', '09:00');
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
    await ca.check('input[name="se_presento"][value="si"]');
    await ca.check('input[name="identidad"][value="misma"]');
    const [kNo, ...kSi] = await ca.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc));
    for (const k of kSi) await ca.check(`input[name="coincide_${k}"][value="si"]`);
    await ca.check(`input[name="coincide_${kNo}"][value="no"]`);
    await ca.fill(`#diferencia_${kNo}`, 'Trae una versión distinta de la que cargó.');
    await ca.check('input[name="hoy_documento"][value="si"]');
    await registraCita(ca);
    await cb.check('input[name="se_presento"][value="no"]');
    await cb.fill('#cita_fecha', '23/10/2026');
    await cb.selectOption('#cita_hora', '09:00');
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

  /* ── F3 A1 y M6 · dos pestañas de «Programar un curso» y doble clic en «Guardar sin confirmar» ── */
  const eventosG = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('apd.personal.grupos') || '[]'));
  const gruposPrueba = (pg) => pg.evaluate(() => APD.cargar().then((d) => d.grupo.filter((g) => g.de_prueba).map((g) => ({ folio: g.folio, inicio: g.fecha_inicio, instructor: g.instructor, hora: g.hora_entrada }))));
  await parte('F3 A1', async ({ pagina }) => {
    const pa = await pagina('programar.html?curso=poda-nueva');
    const pb = await pagina('programar.html?curso=poda-nueva');
    for (const pg of [pa, pb]) await pg.waitForSelector('[data-programar="guardar"]');
    await pa.selectOption('#instructor', 'instructor.ficticio');
    await pb.selectOption('#instructor', 'instructor2.ficticio');
    await pb.selectOption('#hora_entrada', '07:00');
    await pa.click('[data-programar="guardar"]');
    await pa.waitForSelector('[data-resultado]:not([hidden])');
    const deA = (await gruposPrueba(pa))[0];
    await pb.click('[data-programar="guardar"]');
    await pb.waitForSelector('[data-resultado]:not([hidden]), [data-estado-envio]:not([hidden])');
    const gs = await gruposPrueba(pa);
    const aDespues = gs.find((g) => g.folio === deA.folio);
    const textoB = (await pb.textContent('[data-resultado]')) || '';
    comprueba(gs.length === 2 && new Set(gs.map((g) => g.folio)).size === 2 && JSON.stringify(aDespues) === JSON.stringify(deA) && !textoB.includes(deA.folio),
      t(`F3 A1: la segunda pestaña de «Programar» crea su propio grupo y no sobrescribe el de la primera (${gs.map((g) => `${g.folio} ${g.instructor} ${g.hora}`).join('; ')})`));
    // La mezcla, como la base (grupo_folio_uk): un «crear» con el folio de otro grupo no se aplica, ni lo que lo acompaña
    const mA1 = await pa.evaluate(async () => {
      const en = new Date().toISOString();
      const l = JSON.parse(localStorage.getItem('apd.personal.grupos') || '[]');
      l.push({ tipo: 'crear', grupo_id: 'prueba-grupo:otro', folio: 'APD-G-2026-004', tipo_acreditacion: 'poda', modalidad: 'nueva', integracion: 'combinado', folios: [], por: 'x', en });
      l.push({ tipo: 'proponer', grupo_id: 'prueba-grupo:otro', fecha_inicio: '2026-12-07', hora_entrada: '07:00', instructor: 'instructor2.ficticio', por: 'x', en });
      localStorage.setItem('apd.personal.grupos', JSON.stringify(l));
      const d = await APD.cargar();
      return d.grupo.filter((g) => g.folio === 'APD-G-2026-004').map((g) => g.fecha_inicio);
  });
  comprueba(mA1.length === 1 && mA1[0] === null, t(`F3 A1: la mezcla ignora un «crear» con un folio que ya existe y sus eventos (${JSON.stringify(mA1)})`));
  });
  await parte('F3 M6', async ({ pagina }) => {
    const pd = await pagina('programar.html?curso=poda-nueva');
    await pd.waitForSelector('[data-programar="guardar"]');
    await pd.dblclick('[data-programar="guardar"]');
    await pd.waitForSelector('[data-resultado]:not([hidden])');
    await pd.waitForTimeout(600);
    const crear = (await eventosG(pd)).filter((e) => e.tipo === 'crear').length;
    comprueba(crear === 1, t(`F3 M6: doble clic en «Guardar sin confirmar» crea un solo grupo (${crear} creaciones)`));
  });

  /* ── F3 M1 y B10 · agregar desde dos pestañas y doble clic en «Completar» ── */
  await parte('F3 M1', async ({ pagina }) => {
    const ga = await pagina('grupos.html?curso=poda-nueva');
    const gb = await pagina('grupos.html?curso=poda-nueva');
    for (const pg of [ga, gb]) await pg.waitForSelector('[data-personas] input.plan-casilla[value]');
    const folioX = await ga.getAttribute('[data-personas] input.plan-casilla[value]', 'value');
    for (const pg of [ga, gb]) await pg.check(`[data-personas] input.plan-casilla[value="${folioX}"]`);
    await Promise.all([ga.waitForNavigation(), ga.click('[data-destinos] button:has-text("APD-G-2026-004")')]);
    await gb.click('[data-destinos] button:has-text("26 al 30")');
    await gb.waitForSelector('[data-error-eleccion]:not([hidden]) .aviso, [data-hecho] .aviso', { timeout: 8000 }).catch(() => null);
    const m1g = await aviso(gb, '[data-error-eleccion]');
    const en005 = await gb.evaluate(() => APD.cargar().then((d) => d.inscripcion.filter((i) => i.activa && i.grupo_id === d.grupo.find((g) => g.folio === 'APD-G-2026-005').id).length));
    comprueba(/No se agregó a nadie/.test(m1g) && /ya está en/.test(m1g) && /grupos\.html\?curso=poda-nueva$/.test(gb.url()) && en005 === 1,
      t(`F3 M1: si la persona ya tiene grupo, no dice «Se agregó 1 persona»: dice quién no entró y por qué («${m1g.slice(0, 90)}»)`));
  });
  await parte('F3 B10', async ({ pagina }) => {
    const gc = await pagina('grupos.html?curso=poda-nueva');
    const completar = 'article[data-grupo="APD-G-2026-005"] button:has-text("Completar")';
    await gc.waitForSelector(completar);
    await Promise.all([gc.waitForNavigation(), gc.dblclick(completar)]);
    await gc.waitForSelector('[data-hecho] .aviso');
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
    const g0 = await pagina('grupos.html?curso=poda-nueva');
    await g0.waitForSelector('[data-personas] input.plan-casilla[value]');
    const folioY = await g0.getAttribute('[data-personas] input.plan-casilla[value]', 'value');
    await g0.evaluate((f) => APD.cargar().then((d) => APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: d.grupo.find((g) => g.folio === 'APD-G-2026-004').id, folios: [f], por: 'revision.prueba' })), folioY);
    const fa = await pagina('grupo.html?folio=APD-G-2026-004');
    const fb = await pagina('grupo.html?folio=APD-G-2026-004');
    for (const pg of [fa, fb]) await pg.waitForSelector('#confirmar:not([hidden]) #fecha_inicio');
    await fb.click('[data-filas] button:has-text("Dar de baja")');
    await fb.fill('#motivo-baja', 'Pidió cambiar de fecha por trabajo.');
    await Promise.all([fb.waitForNavigation(), fb.click('#baja [data-accion="enviar"]')]);
    await fa.fill('#fecha_inicio', dma(sumaDiasIso(datos.fecha_corte, 14)));
    await fa.selectOption('#hora_entrada', '09:00');
    await fa.selectOption('#instructor', 'instructor.ficticio');
    await fa.click('#confirmar [data-accion="enviar"]');
    await fa.waitForSelector('#confirmar [data-estado-envio]:not([hidden])', { timeout: 8000 }).catch(() => null);
    const m2 = await aviso(fa, '#confirmar [data-estado-envio]');
    const g004 = await fa.evaluate(() => APD.cargar().then((d) => d.grupo.find((g) => g.folio === 'APD-G-2026-004').estado));
    comprueba(/No se confirmó el grupo/.test(m2) && /4 personas y el mínimo es 5/.test(m2) && g004 === 'en_integracion' && /folio=APD-G-2026-004$/.test(fa.url()) && await fa.inputValue('#fecha_inicio') !== '',
      t(`F3 M2: no dice «Grupo confirmado» si no se confirmó; dice por qué y conserva lo escrito («${m2.slice(0, 90)}»)`));
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
    await pg.check('input[name="estatus_estudios"][value="titulado"]', { force: true });
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
    for (const k of await pg.$$eval('article.doc-revision[data-doc]', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) {
      await pg.check(`input[name="decision_${k}"][value="aceptado"]`, { force: true });
    }
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
    await pg.click('[data-accion="enviar"]');
    await pg.waitForSelector('#formulario[hidden], [data-estado-envio]:not([hidden]), .resumen-errores', { timeout: 8000 }).catch(() => null);
    return { hecho: await pg.isHidden('#formulario'), aviso: await texto(pg, '[data-estado-envio]') };
  };
  await parte('A3 localStorage lleno', [HOSTIL.cuotaLs()], async ({ pagina }) => {
    const pg = await pagina();
    await abreCotejo(pg, conCita.folio);
    await pg.check('input[name="se_presento"][value="no"]');
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
    await pg.check('input[name="se_presento"][value="si"]');
    await pg.check('input[name="identidad"][value="misma"]');
    for (const k of await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await pg.check(`input[name="coincide_${k}"][value="si"]`);
    await pg.check('input[name="pago"][value="si"]');
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
    const r = await envia(pg, '[data-hecho]:not([hidden])');
    comprueba(!r.listo && /Este navegador no permitió guardar tu documento de prueba/.test(r.aviso),
      t(`A4: el documento que no se guardó no dice «Listo: ya cargaste el documento» («${r.aviso.slice(0, 90)}»)`));
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
  const aceptaTodo = async (pg) => {
    for (const n of await pg.$$eval('input[value="aceptado"][name^="decision_"]', (l) => [...new Set(l.filter((i) => i.closest('article').offsetParent !== null).map((i) => i.name))])) await pg.check(`input[name="${n}"][value="aceptado"]`);
  };
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
  await pg.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(/cita el 02\/11\/2026 a las 10:00/.test(await pg.textContent('[data-hecho]')) && (await anioImposible(pg)).length === 0, t('revisar: la cita queda el 02/11/2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`revisar sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 2 · Cotejo: la cita nueva (no se presentó), insertada de golpe
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + `cotejo.html?folio=${conCita.folio}`);
  // La cita es de otro día: en la prueba se atiende «como si fuera su día» (romper F2 A6)
  await pg.waitForSelector('[data-atender-simulada]:not([hidden]), #formulario:not([hidden])');
  if (await pg.isVisible('[data-atender-simulada]')) await pg.click('[data-atender-simulada]');
  await pg.waitForSelector('#formulario:not([hidden])');
  await pg.check('input[name="se_presento"][value="no"]');
  comprueba(await inserta(pg, '#cita_fecha', '2026-11-02') === '02/11/2026', t('cotejo: «2026-11-02» insertado de golpe en la cita nueva deja 02/11/2026'));
  comprueba(await pega(pg, '#cita_fecha', '02.11.2026') === '02/11/2026' && await inserta(pg, '#cita_fecha', '02-11-2026') === '02/11/2026', t('cotejo: dd.mm.aaaa y dd-mm-aaaa también quedan en 02/11/2026'));
  await pg.selectOption('#cita_hora', '09:30');
  await pg.click('[data-accion="enviar"]');
  await pg.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(/02\/11\/2026/.test(await pg.textContent('[data-hecho]')) && (await anioImposible(pg)).length === 0, t('cotejo: la cita nueva queda el 02/11/2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`cotejo sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 3 · Programar: primer día pegado; fecha a más de un año, escrita o en ?semana=
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'programar.html?curso=poda-nueva');
  await pg.waitForSelector('.cal-dia');
  comprueba(await pega(pg, '#fecha_inicio', ' 2026-11-09 ') === '09/11/2026' && (await pg.getAttribute('.cal-dia[aria-pressed="true"]', 'data-fecha')) === '2026-11-09',
    t('programar: pegar « 2026-11-09 » deja 09/11/2026 y el calendario marca ese lunes'));
  comprueba(await pega(pg, '#fecha_inicio', '2026-11-02') === '02/11/2026' && /del 2 al 6 de noviembre/.test(await pg.textContent('[data-resumen-nombre]')), t('programar: pegar «2026-11-02» deja 02/11/2026 y «Así quedaría» dice del 2 al 6 de noviembre'));
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForSelector('[data-resultado]:not([hidden])');
  comprueba(/Grupo confirmado: Poda nueva · del 2 al 6 de noviembre/.test(await pg.textContent('[data-resultado]')) && (await anioImposible(pg)).length === 0,
    t('programar: el grupo se confirma del 2 al 6 de noviembre, sin años imposibles'));
  await c.close();
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'programar.html?curso=poda-nueva');
  await pg.waitForSelector('.cal-dia');
  const gruposAntes = await pg.evaluate(() => APD.cargar().then((d) => d.grupo.length));
  comprueba((await pg.getAttribute('[data-campo="fecha_inicio"]', 'data-max')) === `${Number(corte.slice(0, 4)) + 1}${corte.slice(4)}` && (await pg.textContent('[data-ayuda-semana]')).includes(`hasta el ${unAnio}`),
    t(`programar: el primer día tiene máximo un año después de hoy (${unAnio}), y la ayuda lo dice`));
  await pg.fill('#fecha_inicio', '01/01/2099'); await pg.press('#fecha_inicio', 'Tab');
  comprueba((await errorDe(pg, 'fecha_inicio')).includes(`posterior al ${unAnio}`) && !/2099/.test(await pg.textContent('[data-mes-nombre]')),
    t(`programar: 01/01/2099 escrito da el error «…posterior al ${unAnio}» y el calendario no salta a 2099`));
  await pg.click('[data-programar="confirmar"]');
  await pg.waitForTimeout(500);
  comprueba(await pg.isHidden('[data-resultado]') && await pg.evaluate(() => APD.cargar().then((d) => d.grupo.length)) === gruposAntes, t('programar: con 01/01/2099 no se crea ningún grupo'));
  await pg.goto(BASE + 'programar.html?curso=poda-nueva&semana=2099-01-05');
  await pg.waitForSelector('.cal-dia');
  comprueba(await pg.inputValue('#fecha_inicio') === '' && await pg.locator('.cal-dia[aria-pressed="true"]').count() === 0 && /falta más de un año/.test(await pg.textContent('[data-cal-estado]'))
    && !/2099/.test(await pg.textContent('[data-mes-nombre]')), t('programar: ?semana=2099-01-05 no se acepta y dice por qué'));
  comprueba(errores.length === 0, t(`programar sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 4 · Ficha del grupo: confirmar con el primer día insertado de golpe; 01/01/2099 da error
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-grupo');
  const g4 = datos.grupo.find((g) => g.folio === 'APD-G-2026-004');
  await pg.evaluate((id) => APD_PERSONAL.guardaGrupo({ tipo: 'agregar', grupo_id: id, folios: ['APD-S-2026-00037'], por: APD_PERSONAL.REVISORA.usuario }), g4.id);
  await pg.goto(BASE + `grupo.html?folio=${g4.folio}`);
  await pg.waitForSelector('#confirmar:not([hidden])');
  await pg.fill('#fecha_inicio', '01/01/2099'); await pg.press('#fecha_inicio', 'Tab');
  comprueba((await errorDe(pg, 'fecha_inicio')).includes(`posterior al ${unAnio}`), t(`grupo: 01/01/2099 da el error «…posterior al ${unAnio}»`));
  comprueba(await inserta(pg, '#fecha_inicio', '2026-11-02') === '02/11/2026', t('grupo: «2026-11-02» insertado de golpe deja 02/11/2026'));
  await pg.selectOption('#hora_entrada', '09:00');
  await pg.selectOption('#instructor', 'instructor2.ficticio');
  await pg.click('#confirmar [data-accion="enviar"]');
  await pg.waitForURL(/hecho=confirmado|folio=APD-G-2026-004$/);
  await pg.waitForLoadState('networkidle');
  await pg.waitForSelector('[data-situacion] .estado');
  comprueba(await pg.evaluate((f) => APD.cargar().then((d) => { const g = d.grupo.find((x) => x.folio === f); return `${g.estado} ${g.fecha_inicio}`; }), g4.folio) === 'confirmado 2026-11-02'
    && (await anioImposible(pg)).length === 0, t('grupo: queda confirmado el 02/11/2026, sin años imposibles'));
  comprueba(errores.length === 0, t(`grupo sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await c.close();

  // 5 · Crea tu cuenta: la fecha de nacimiento pegada como AAAA-MM-DD
  ({ c, pg, errores } = await nuevo());
  await pg.goto(BASE + 'cuenta.html');
  await pg.waitForSelector('#fecha_nacimiento');
  comprueba(await pega(pg, '#fecha_nacimiento', '1985-07-23') === '23/07/1985' && !(await errorDe(pg, 'fecha_nacimiento')), t('cuenta: pegar «1985-07-23» en la fecha de nacimiento deja 23/07/1985'));
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
    ['grupos.html'], ['grupos.html?curso=poda-renovacion'], ['programar.html?curso=poda-nueva'], ['programar.html?curso=poda-nueva', 'sin personas'], ['asistencia.html'], ['aplicar.html'], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_integracion').folio}`], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}`],
    [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13').folio}`], [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13').folio}`, 'sin marcar'],
    ['material.html'], ['material-personal.html'], ['citas.html'], [`cotejo.html?folio=${conCita.folio}`], [`cotejo.html?folio=${conCita.folio}`, 'cita futura'], [`cotejo.html?folio=${conCita.folio}`, 'con errores'], [`cotejo.html?folio=${conCita.folio}`, 'factura'],
    ['solicitud.html', 'menú de pruebas'], ['cuenta.html', 'menú de pruebas'], ['entrar.html', 'menú de pruebas']];
  // «Cargar el documento correcto» de una cita en pausa, con la sesión de su persona (al final: cambia la sesión)
  const pausaHoy = datos.cita.find((x) => x.resultado === 'en_pausa' && x.programada_en.startsWith(datos.fecha_corte));
  const sCorregir = datos.solicitud.find((x) => x.id === pausaHoy.solicitud_id);
  pantallas.push([`corregir.html?folio=${sCorregir.folio}`], [`corregir.html?folio=${sCorregir.folio}`, 'con errores']);
  for (const [url, estado] of pantallas) {
    if (url.startsWith('corregir.html')) await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sCorregir.solicitante_id);
    await page.goto(BASE + url);
    if (url.startsWith('corregir.html')) await page.waitForSelector('#formulario:not([hidden])');
    await page.waitForLoadState('networkidle');
    // La cita futura se atiende «como si fuera su día» (F2 A6), salvo cuando se revisa su aviso
    if (url.startsWith('cotejo.html') && estado !== 'cita futura' && await page.isVisible('[data-atender-simulada]')) await page.click('[data-atender-simulada]');
    if (estado === 'rechazo') await page.check('input[name="comprobante_confirma"][value="si"]');
    else if (estado === 'menú de pruebas') { await page.click('.menu-pruebas-boton'); await page.waitForSelector('dialog.menu-pruebas[open] [data-guardado]'); }
    else if (estado === 'factura') {
      await page.check('input[name="se_presento"][value="si"]');
      await page.check('input[name="identidad"][value="misma"]');
      for (const k of await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await page.check(`input[name="coincide_${k}"][value="si"]`);
      await page.check('input[name="pago"][value="si"]');
    } else if (estado === 'sin marcar') await page.click('[data-guardar]');
    else if (estado === 'sin personas') {
      for (const k of await page.$$('[data-personas] input:checked')) await k.uncheck();
      await page.click('[data-programar="confirmar"]');
      await page.waitForSelector('[data-falta] .aviso');
    }
    else if (estado === 'visor') { await page.click('[data-ver="curriculum_vitae"]'); await page.waitForSelector('.visor-lienzo'); }
    else if (estado === 'cita futura') await page.waitForSelector('[data-futura]:not([hidden])');
    else if (estado) await page.click(url.startsWith('solicitud') ? `${pasoVisible} [data-accion="siguiente"]` : '[data-accion="enviar"]');
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.evaluate(axe); // por el protocolo del navegador: la política de contenido no deja scripts en línea
    // Cada violación con el marcado del elemento, para saber cuál es sin volver a correr
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.html.slice(0, 200)).join(' || ')}`));
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
  comprueba(paginas.length === 21 && !malas.length, t(`las ${paginas.length} páginas declaran la política y el referente justo después de charset${malas.length ? '; faltan: ' + malas.join(', ') : ''}`));
  const csp = [...politicas][0] || '';
  comprueba(politicas.size === 1 && /script-src 'self';/.test(csp) && /style-src 'self';/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && !/unsafe/.test(csp),
    t(`una sola política, estricta, en todas: «${csp}»`));
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
  await pg.click('[data-ver="curriculum_vitae"]');
  await pg.waitForSelector('.visor-lienzo');
  await pg.waitForTimeout(500);
  await revisa('revisar con el visor de PDF abierto');
  // La foto de la cuenta: vista previa (blob:) y recodificación en lienzo
  await pg.evaluate(() => localStorage.removeItem('apd.sesion'));
  await pg.goto(BASE + 'cuenta.html');
  await cargaFoto(pg);
  await revisa('cuenta con la fotografía cargada');
  await c.close();
}

/* ── Limpieza del código (auditoría 2026-10-19, R4-07, A4-01 y R4-08) ──
   Sin clases de apd.css que nada usa, sin nombres exportados por APD y APD_PERSONAL que nadie usa fuera de su archivo
   (salvo los que se usan dentro), y las horas y los instructores de grupo.html y programar.html iguales. */
async function limpieza(navegador) {
  const t = (m) => `[limpieza] ${m}`;
  const leer = (r) => readFileSync(join(raiz, r), 'utf8');
  const app = readdirSync(join(raiz, 'sitio/app')).filter((f) => f.endsWith('.js')).map((f) => `sitio/app/${f}`);
  const paginas = readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html')).map((f) => `sitio/${f}`);
  // Las pantallas, el código del proyecto y el del estándar (que arma parte del marcado), sin vendor
  const estandar = (d) => readdirSync(join(raiz, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'vendor' ? [] : estandar(`${d}/${e.name}`)) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));
  const fuentes = [...app, ...paginas, ...estandar('sitio/formkit')].map(leer).join('\n');
  // Clases: las que se arman con una plantilla (asis-opcion-${v}) se buscan por su prefijo
  const css = leer('sitio/app/apd.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const clases = [...new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))];
  const usada = (c) => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(fuentes) || /^asis-opcion-(si|no)$/.test(c) && fuentes.includes('asis-opcion-${');
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
  // son las mismas en la ficha del grupo y en «Programar», y los instructores, los de APD_PERSONAL
  const c = await navegador.newContext({ timezoneId: ZONA });
  const pg = await c.newPage();
  const listas = [];
  for (const [url, sel] of [['programar.html?curso=poda-nueva', '.cal-dia'], ['grupo.html?folio=APD-G-2026-005', '#confirmar']]) {
    await pg.goto(BASE + url);
    await pg.waitForSelector(sel, { state: 'attached' });
    // «Programar» agrega al nombre del instructor si está libre esas fechas: se comparan los valores
    listas.push(JSON.stringify(await pg.evaluate(() => ['#instructor', '#hora_entrada'].map((s) => [...document.querySelectorAll(`${s} option`)].map((o) => o.value)))));
  }
  const nombresIguales = await pg.$$eval('#instructor option', (l) => l.filter((o) => o.value).every((o) => APD_PERSONAL.nombreInstructor(o.value) === o.textContent) && l.length > 1);
  comprueba(listas[0] === listas[1] && /instructor2\.ficticio/.test(listas[0]) && /"07:00"/.test(listas[0]) && nombresIguales,
    t('horas de entrada e instructores: la misma lista en la ficha del grupo y en «Programar», con los instructores de APD_PERSONAL'));
  comprueba(!/const MESES = \[/.test(leer('sitio/app/programar.js')) && !/nombreCurso/.test(fuentes), t('sin copias de MESES ni de nombreCurso (APD.MESES, APD.cursoLargo)'));
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
  await pg.waitForSelector('.plan-grupo .estado');
  await etiquetaLarga('.plan-grupo .estado', '«Grupos»');
  await captura(pg, `151-grupos-etiqueta-larga-${sufijo}`);
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-persona');
  // «En espera» ya es la espera del planeador; si nadie trae etiqueta, se le pone una a la primera fila
  await pg.evaluate(() => { const f = document.querySelector('.plan-persona'); if (f && !f.querySelector('.estado')) f.querySelector('.plan-persona-nombre, span').after(APD.estado('Prioritaria', 'pend')); });
  await etiquetaLarga('.plan-persona .estado', '«En espera» (la espera del planeador)');
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
  await pg.waitForSelector('[data-bajada] .linea-datos');
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
  // P129: el RFC conserva la Ñ (en la página y en lo que se envía)
  await marcar(pg, 'input[name="se_presento"][value="si"]');
  await marcar(pg, 'input[name="identidad"][value="misma"]');
  for (const k of await pg.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await marcar(pg, `input[name="coincide_${k}"][value="si"]`);
  await marcar(pg, 'input[name="pago"][value="si"]');
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
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
  await pg.waitForSelector('.plan-grupo .linea-datos');
  await lineas('«Grupos»');
  await captura(pg, `151-grupos-${sufijo}`);

  // P131: avisos con pasos (secuencia numerada) y con enlace, en div.aviso-texto, con el icono de su tono
  const aviso = (sel) => pg.$eval(sel, (a) => ({ cuerpo: a.querySelector('.aviso-texto') && a.querySelector('.aviso-texto').tagName, icono: Boolean(a.querySelector(':scope > svg.icono')),
    pasos: a.querySelectorAll('ol.secuencia > li.secuencia-item').length, enlaces: a.querySelectorAll('.aviso-texto a').length, titulo: (a.querySelector('.aviso-titulo') || {}).textContent }));
  const enIntegracion = datos.grupo.find((g) => g.estado === 'en_integracion');
  await pg.goto(BASE + `grupos.html?curso=${enIntegracion.tipo_acreditacion}-${enIntegracion.modalidad}&grupo=${enIntegracion.folio}`);
  await pg.waitForSelector('[data-modo-grupo] .aviso');
  const conEnlace = await aviso('[data-modo-grupo] .aviso');
  comprueba(conEnlace.cuerpo === 'DIV' && conEnlace.icono && conEnlace.enlaces === 1, t(`P131: el aviso «Agregando personas a …» lleva su enlace en div.aviso-texto, con icono (${JSON.stringify(conEnlace)})`));
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
  await pg.goto(BASE + 'cuenta.html');
  await pg.fill('#nombre', NUEVA.nombre);
  await pg.fill('#primer_apellido', NUEVA.primer_apellido);
  await pg.fill('#segundo_apellido', NUEVA.segundo_apellido);
  await pg.fill('#fecha_nacimiento', dma(NUEVA.nacimiento));
  await pg.fill('#curp', NUEVA.curp);
  await pg.fill('#correo', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await pg.fill('#correo2', `${NUEVA.curp.toLowerCase()}@ejemplo.local`);
  await pg.fill('#telefono', '0000000077');
  await pg.fill('#contrasena', 'una frase larga de prueba');
  await pg.fill('#contrasena2', 'una frase larga de prueba');
  await marcar(pg, 'input[name="adscrito"][value="no"]');
  await pg.setInputFiles('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])', foto);
  const agregada = await pg.waitForSelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]', { timeout: 8000 }).then(() => true, () => false);
  await captura(pg, `151-cuenta-foto-con-gps-${sufijo}`);
  await marcaCasillas(pg);
  await pg.click('[data-accion="enviar"]');
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

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
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
  if (!solo) {
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
  if (toca('estandar')) {
    await parte('estándar en teléfono', () => estandarPantallas(navegador, 390, 844, 'telefono'));
    await parte('estándar en escritorio', () => estandarPantallas(navegador, 1280, 900, 'escritorio'));
  }
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
