// PRUEBAS DEL SITIO (etapa 1, pantallas de la persona solicitante) con Playwright, en teléfono (390 px) y
// escritorio (1280 px). Recorre los caminos principales sobre los datos ficticios y falla si:
//   · hay errores en la consola o excepciones en la página;
//   · la página se desborda a lo ancho;
//   · una pantalla no muestra lo que debe (acuse, estados, observaciones, resultado de verificación).
//
// Uso:  node herramientas/probar-sitio.mjs <url-base> [carpeta-de-capturas]
//   p. ej. con el sitio servido localmente:  (cd sitio && python3 -m http.server 8765) &
//          node herramientas/probar-sitio.mjs http://localhost:8765/ verificacion/capturas
// Requiere `npm install` (Playwright como dependencia de desarrollo) y un Chromium de Playwright.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] ? join(raiz, process.argv[3]) : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
await import('../sitio/app/curp-nombre.js'); // la misma regla nombre ↔ CURP del formulario
await import('../sitio/app/casos-prueba.js'); // los casos de prueba del menú (se comprueba que todos encuentran persona)
const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
// Persona nueva ficticia, con CURP coherente con su nombre y su fecha de nacimiento
const NUEVA = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', nacimiento: '1999-12-30' };
NUEVA.curp = conDigito(globalThis.APD_CURP.prefijo({ nombre: NUEVA.nombre, primer: NUEVA.primer_apellido, segundo: NUEVA.segundo_apellido }, NUEVA.nacimiento, 'M', 'NE') + '0');
const otroDigito = (c) => c.slice(0, 17) + String((Number(c[17]) + 1) % 10);
// Fecha de nacimiento de una persona ficticia: está en su CURP (homoclave 0 = nacida antes de 2000)
const dma = (iso) => iso.split('-').reverse().join('/'); // la fecha se escribe día/mes/año (decisión 2026-10-16)
const nacimientoDe = (p) => `19${p.curp.slice(4, 6)}-${p.curp.slice(6, 8)}-${p.curp.slice(8, 10)}`;
const CONTRASENA = 'Prueba-ficticia-2026';
const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'];

// ── Personas para cada camino, elegidas de los datos (no fijadas a mano) ──
const persona = (id) => datos.solicitante.find((p) => p.id === id);
// Persona con cuenta activa y adscrita a una empresa: para «Mis datos»
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
const bien = (m) => console.log(`BIEN  ${m}`);
const mal = (m) => { fallas++; console.log(`MAL   ${m}`); };
const comprueba = (cond, m) => (cond ? bien(m) : mal(m));

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
  await page.fill('#correo', 'nadia@ejemplo.local');
  await page.fill('#correo2', 'nadia@ejemplo.local');
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
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
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
  comprueba(['Mujer', 'Hombre'].includes(await page.inputValue('#sexo')), t(`cuenta: el sexo se toma de la CURP (${await page.inputValue('#sexo')})`));
  // Datos internos: en la versión de prueba se ven en amarillo con su nota; sin el modo de prueba, no se ven
  comprueba(await page.isVisible('[data-campo="sexo"] .nota-interna'), t('datos internos: en la versión de prueba el sexo se ve con su nota'));
  comprueba(!(await page.isVisible('[data-campo="sin_segundo_apellido"] .nota-interna')), t('datos internos: lo que no se guarda en la base (sin segundo apellido) no se muestra'));
  const ocultoEnProduccion = await page.evaluate(() => {
    document.documentElement.classList.remove('modo-pruebas');
    const r = getComputedStyle(document.querySelector('[data-campo="sexo"]')).display === 'none';
    document.documentElement.classList.add('modo-pruebas');
    return r;
  });
  comprueba(ocultoEnProduccion, t('datos internos: sin el modo de prueba (producción) el sexo no se muestra'));
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
  await captura(page, `02-cuenta-${sufijo}`);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  bien(t('cuenta nueva: acuse visible'));
  await sinDesborde(page, t('cuenta acuse'));
  await page.click('[data-acuse] a[href="tramites.html"]');
  await page.waitForSelector('[data-solicitudes] .vacio');
  comprueba(await page.isVisible('[data-nueva] a'), t('cuenta nueva: «Iniciar una solicitud» disponible'));

  // Persona nueva: sólo puede pedir poda nueva; dictaminador deshabilitado con su motivo
  await page.click('[data-nueva] a');
  await page.waitForFunction(() => document.querySelector('input[name="tipo"][value="poda"]').checked);
  comprueba(await page.isDisabled('input[name="tipo"][value="dictaminador"]'), t('solicitud: dictaminador deshabilitado sin poda vigente, con su motivo'));
  comprueba(/solicitud nueva/.test(await page.textContent('[data-modalidad-texto]')), t('solicitud: informa que le corresponde una solicitud nueva (no lo pregunta)'));
  comprueba(/Independiente/.test(await page.textContent('[data-adscripcion-texto]')),
    t('solicitud: muestra la adscripción de la persona con la que se enviará (se cambia en «Mis datos»)'));
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
  await captura(page, `05-solicitud-acuse-${sufijo}`);
  await page.goto(BASE + 'tramites.html');
  await page.waitForSelector('[data-solicitudes] .ficha');
  comprueba((await page.textContent('[data-solicitudes]')).includes(folio), t('mis trámites: aparece la solicitud enviada, «En revisión documental»'));
  await page.click('[data-sesion] button');
  await page.waitForURL(/index\.html/);

  // Persona sin segundo apellido: crea su cuenta sin quedar atrapada
  const SIN = { nombre: 'Uriel', primer_apellido: 'Ejemplo', segundo_apellido: '', nacimiento: '1988-04-09' };
  SIN.curp = conDigito(globalThis.APD_CURP.prefijo({ nombre: SIN.nombre, primer: SIN.primer_apellido, segundo: '' }, SIN.nacimiento, 'H', 'NE') + '0');
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
  comprueba((await page.textContent('[data-vista="adscripcion"]')).trim() === 'Eres independiente.', t('mi perfil: la adscripción independiente se dice directo, «Eres independiente.»'));
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
  await llenaCuenta(page, renovable);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  comprueba(await page.isVisible('[data-cuenta-historial]'), t('cuenta del padrón migrado: avisa que encontró acreditaciones anteriores'));
  await page.click('[data-acuse] a[href="tramites.html"]');
  await page.waitForSelector('[data-acreditaciones] .ficha');
  await captura(page, `06-tramites-renovacion-${sufijo}`);
  await sinDesborde(page, t('mis trámites'));
  comprueba(await page.locator('[data-acreditaciones] .ficha').evaluateAll((fs) => fs.every((f) => /Para vencer\s*(Faltan [\d,]+ días|Falta 1 día|Vence hoy|Venció hace [\d,]+ días?)/.test(f.textContent))),
    t('mis trámites: cada acreditación dice cuántos días faltan para vencer (o hace cuántos venció)'));
  comprueba(await page.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).count() >= 1, t('mis trámites: botón «Renovar» en la acreditación renovable'));
  await page.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).first().click();
  await page.waitForFunction(() => document.getElementById('tramite').value === 'poda_renovacion');
  comprueba(/^PD-/.test(await page.inputValue('#anterior')), t('solicitud renovación: acreditación anterior en sólo lectura'));
  comprueba(/renovación de tu acreditación PD-/.test(await page.textContent('[data-modalidad-texto]')), t('solicitud renovación: informa qué acreditación renueva'));
  await siguiente(page);
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
  await siguiente(page);
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
  await captura(page, `08-entrar-${sufijo}`);

  // Verificación pública, dos consultas seguidas
  await page.goto(BASE + 'verificar.html');
  await page.fill('#numero', vigente.numero);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-resultado]:not([hidden])');
  comprueba((await page.getAttribute('[data-resultado]', 'data-tono')) === 'ok', t(`verificar: ${vigente.numero} vigente`));
  // Días para vencer, contados desde hoy (en la prueba, la fecha simulada) (decisión 2026-10-17)
  const faltan = Math.round((new Date(`${vigente.vence_en}T12:00:00-06:00`) - new Date(`${datos.fecha_corte}T12:00:00-06:00`)) / 86400000);
  const esperado = faltan > 1 ? `Faltan ${faltan.toLocaleString('es-MX')} días` : faltan === 1 ? 'Falta 1 día' : faltan === 0 ? 'Vence hoy' : `Venció hace ${-faltan}`;
  comprueba((await page.textContent('[data-resultado]')).includes(esperado), t(`verificar: dice cuánto falta para vencer (${esperado})`));
  await page.fill('#numero', noVigente.numero);
  await page.click('[data-accion="enviar"]');
  await page.waitForFunction(() => document.querySelector('[data-resultado]').dataset.tono === 'error');
  bien(t(`verificar: ${noVigente.numero} no vigente (segunda consulta sin recargar)`));
  await captura(page, `09-verificar-${sufijo}`);
  await sinDesborde(page, t('verificar'));

  // Mi perfil: lo registrado se ve escrito; «Editar» abre las preguntas de esa parte; guarda y se conserva
  await page.evaluate(() => localStorage.clear());
  await entra(page, CON_ORG.curp);
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(/Mi perfil/.test(await page.textContent('h2')) && /Sexo/.test(await page.textContent('[data-identidad]')) && await page.$('#curp') === null,
    t('mi perfil: muestra CURP y sexo sin dejarlos cambiar'));
  comprueba(await page.locator('form.perfil-form:not([hidden])').count() === 0 && /@/.test(await page.textContent('[data-vista="contacto"]'))
    && /^Empresa, consultoría o particular: /.test(await page.textContent('[data-vista="adscripcion"]')),
    t('mi perfil: se ve lo registrado, escrito, sin preguntas a la vista'));
  comprueba(/^[A-ZÁÉÍÓÚÑ]{2}$/.test((await page.textContent('[data-perfil-iniciales]')).trim()), t('mi perfil: sin imagen, la persona ficticia se ve con sus iniciales'));
  await page.click('[data-editar="contacto"]');
  comprueba(await page.isVisible('#form-contacto') && await page.inputValue('#correo') !== '', t('mi perfil: «Editar» abre el contacto con lo vigente'));
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
  comprueba(/Fase 1 de 7: Cuenta y solicitud/.test(await page.textContent('.menu-pruebas-fase')) && await page.locator('.menu-pruebas-fase a[target="_blank"]').count() === 1,
    t('menú de pruebas: dice en qué fase del trámite está la pantalla y enlaza al mapa del trámite'));
  comprueba(await page.locator('dialog.menu-pruebas h3').allTextContents().then((l) => l.join('|')) === 'En esta pantalla|Entrar como|Ir a otra pantalla|Ajustes de la prueba',
    t('menú de pruebas: bloques en orden (en esta pantalla, entrar como, ir a otra pantalla, ajustes)'));
  const opcionesCasos = await page.locator('#menu-pruebas-persona option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  comprueba(APD_CASOS_PRUEBA.claves().every((k) => opcionesCasos.includes(k)), t(`menú de pruebas: los ${APD_CASOS_PRUEBA.claves().length} casos encuentran persona en los ficticios`));
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
  comprueba(/con observaciones/i.test(await page.textContent('[data-solicitudes]')), t('menú de pruebas: en «Entrar», un caso llena CURP y contraseña y entra'));
  // Personal: «Entrar como» lleva a la bandeja; ahí no hay «En esta pantalla» (los filtros no se llenan ni se envían)
  await page.click('.menu-pruebas-boton');
  await page.selectOption('#menu-pruebas-persona', 'personal');
  await page.click('dialog.menu-pruebas >> button:text-is("Entrar")');
  await page.waitForURL(/revision\.html/);
  await page.click('.menu-pruebas-boton');
  const bloquesPersonal = await page.locator('dialog.menu-pruebas h3').allTextContents();
  comprueba(!bloquesPersonal.includes('En esta pantalla') && /personal/.test(await page.textContent('.menu-pruebas-ahora')),
    t('menú de pruebas: en la bandeja del personal no ofrece llenar ni simular el envío'));
  await page.click('dialog.menu-pruebas >> text=Empezar de cero');
  await page.waitForURL(/index\.html|\/$/);
  comprueba(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('apd.')).length === 0
    && APD_ARCHIVOS_PRUEBA.guardado().then((g) => !g.cuentas && !g.envios && !g.fotos)), t('menú de pruebas: «Empezar de cero» limpia la sesión y lo guardado'));
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
  const fichaDe = (texto) => page.locator('[data-solicitudes] .ficha', { hasText: texto }).first();
  const emitida = personaCon('acreditada', (x) => datos.acreditacion.some((a) => a.solicitud_id === x.id));
  if (emitida) {
    await entra(page, emitida.curp);
    const f = await fichaDe('Acreditación emitida').textContent();
    comprueba(/Inicio de vigencia/.test(f) && /Fin de vigencia/.test(f) && /Número de acreditación/.test(f) && !/Sede|Calificación|Asistencia|Duración/.test(f),
      t('mis solicitudes: la acreditación emitida muestra su folio y vigencia, sin los datos del curso'));
    await page.click('[data-sesion] button');
  }
  const conGrupo = personaCon('inscrita', (x) => datos.inscripcion.some((i) => i.solicitud_id === x.id && i.activa && datos.grupo.find((g) => g.id === i.grupo_id).fecha_inicio));
  if (conGrupo) {
    await entra(page, conGrupo.curp);
    const ficha = fichaDe('Con grupo asignado');
    const f = await ficha.textContent();
    comprueba(/Preséntate el/.test(f) && /El curso termina el/.test(f) && /Sede/.test(f) && !/Duración|Inicia el/.test(f),
      t('mis solicitudes: con grupo, dice cuándo presentarse, cuándo termina el curso y dónde'));
    comprueba(await ficha.locator('.datos-por-confirmar', { hasText: 'hora de entrada' }).count() === 1, t('mis solicitudes: la hora de entrada se marca por confirmar'));
    await page.click('[data-sesion] button');
  }
  const conCita = personaCon('validada_en_linea');
  if (conCita) {
    await entra(page, conCita.curp);
    comprueba(await page.locator('[data-solicitudes] .datos-por-confirmar').count() === 4,
      t('mis solicitudes: concepto, monto y referencia del pago, y la dirección de la sede, se marcan en amarillo, por confirmar'));
    comprueba(/Lugar de la cita\s*Vivero Nezahualcóyotl/.test(await page.textContent('[data-solicitudes]')), t('mis solicitudes: la cita es en el Vivero Nezahualcóyotl'));
    await page.click('[data-sesion] button');
  }
  comprueba(Boolean(emitida && conGrupo && conCita), t('mis solicitudes: hay ficticios para revisar las tres fichas'));

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
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const t = (m) => `[guardado] ${m}`;
  const errores = [];
  const vigila = (page) => { page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`)); return page; };
  const real = { name: 'escaneado.pdf', mimeType: 'application/pdf', buffer: readFileSync(new URL('../datos/documentos/identificacion_oficial.pdf', import.meta.url)) };
  const P = { nombre: 'Rocío', primer_apellido: 'Guardado', segundo_apellido: 'Ejemplo', nacimiento: '1987-03-15' };
  P.curp = conDigito(globalThis.APD_CURP.prefijo({ nombre: P.nombre, primer: P.primer_apellido, segundo: P.segundo_apellido }, P.nacimiento, 'M', 'NE') + '0');
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
  comprueba(/con observaciones/i.test(ficha) && /vuelve a escanearlo/.test(ficha), t('la persona ve «Con observaciones» y qué corregir'));
  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();
}

async function personal(navegador, ancho, alto, sufijo) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
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
    await page.click('[data-visor-accion="acercar"]');
    await page.waitForFunction(() => document.querySelector('[data-visor-zoom]').textContent === '125 %');
    comprueba(await page.getAttribute('[data-visor-hojas]', 'data-zoom') === '125', t('el visor acerca'));
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
  await page.fill('#cita_fecha', '2026-10-21'); await page.fill('#cita_hora', '10:00');
  await captura(page, `41-personal-validar-${sufijo}`);
  // Tras una captura de página completa, Chromium sin ventana desplaza la página al enfocar: se enfoca antes de pulsar
  await page.focus('[data-accion="enviar"]');
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-hecho]:not([hidden])');
  comprueba(/validada/.test(await page.textContent('[data-hecho-titulo]')), t('valida y asigna la cita'));

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
  comprueba(/rechazada/.test(await page.textContent('[data-hecho-titulo]')), t('rechaza al confirmar'));

  // Reenviada: vueltas anteriores y documento corregido
  await page.goto(BASE + `revisar.html?folio=${reenviada.folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
  comprueba(await page.isVisible('[data-anteriores]') && await page.locator('.doc-corregido').count() >= 1, t('la reenviada muestra la revisión anterior y lo corregido'));
  comprueba(!(await page.isVisible('[data-perfil]')), t('en poda no hay bloque de perfil'));
  await page.check('input[name="decision_curp"][value="con_observacion"]');
  await page.click('[data-campo="observacion_curp"] [data-sugerencia]');
  comprueba(/\.$/.test(await page.inputValue('#observacion_curp')), t('un motivo frecuente se agrega a la observación'));
  await sinDesborde(page, t('revisión'));

  // La bandeja ya no muestra lo revisado en la prueba
  await page.goto(BASE + 'revision.html');
  await page.waitForSelector('[data-revisadas]:not([hidden])');
  comprueba(!(await visibles()).includes(porClasificar.folio), t('lo revisado sale de la bandeja en esta pestaña'));

  // La persona ve el rechazo con su motivo
  const pR = datos.solicitante.find((x) => x.id === rechazada.solicitante_id);
  await entra(page, pR.curp);
  const f = await page.locator('[data-solicitudes] .ficha', { hasText: 'Rechazada' }).textContent();
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
  comprueba(/se cargó en este navegador/.test(await page.textContent('[data-visor-nota]')) && /constancia-escaneada\.pdf/.test(await page.textContent('[data-doc="curp"] [data-doc-archivo]')),
    t('el visor muestra el archivo real que se cargó, con sus tres hojas'));
  await captura(page, `44-personal-archivo-real-${sufijo}`);

  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`));
  await contexto.close();
}

// CHROMIUM: ruta a un Chromium ya instalado, si no coincide con la versión que espera Playwright
// Accesibilidad con axe-core (el del Estándar: AXE=<ruta>/vendor/axe-core/axe.min.js). Sin AXE, se omite y se dice.
async function accesibilidad(navegador) {
  if (!process.env.AXE) { console.log('OMITIDO  accesibilidad: falta AXE=<ruta a axe.min.js del estándar>'); return; }
  const axe = readFileSync(process.env.AXE, 'utf8');
  const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + 'index.html');
  await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), paraDictaminador.id);
  const pantallas = [['index.html'], ['cuenta.html'], ['cuenta.html', 'con errores'], ['entrar.html'], ['tramites.html'], ['datos.html'], ['solicitud.html?tipo=dictaminador'], ['solicitud.html?tipo=dictaminador', 'con errores'], ['verificar.html'],
    ['revision.html'], [`revisar.html?folio=${porClasificar.folio}`], [`revisar.html?folio=${porClasificar.folio}`, 'con errores'], [`revisar.html?folio=${noCumple.folio}`, 'rechazo'], [`revisar.html?folio=${porClasificar.folio}`, 'visor'],
    ['solicitud.html', 'menú de pruebas'], ['cuenta.html', 'menú de pruebas'], ['entrar.html', 'menú de pruebas']];
  for (const [url, estado] of pantallas) {
    await page.goto(BASE + url);
    await page.waitForLoadState('networkidle');
    if (estado === 'rechazo') await page.check('input[name="comprobante_confirma"][value="si"]');
    else if (estado === 'menú de pruebas') { await page.click('.menu-pruebas-boton'); await page.waitForSelector('dialog.menu-pruebas[open] [data-guardado]'); }
    else if (estado === 'visor') { await page.click('[data-ver="curriculum_vitae"]'); await page.waitForSelector('.visor-lienzo'); }
    else if (estado) await page.click(url.startsWith('solicitud') ? `${pasoVisible} [data-accion="siguiente"]` : '[data-accion="enviar"]');
    await page.addScriptTag({ content: axe });
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.map((x) => `${x.id} (${x.nodes.length})`));
    comprueba(v.length === 0, `[accesibilidad] ${url}${estado ? ' ' + estado : ''}${v.length ? ': ' + v.join(', ') : ''}`);
  }
  await page.close();
}

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  await recorrido(navegador, 390, 844, 'telefono');
  await recorrido(navegador, 1280, 900, 'escritorio');
  await personal(navegador, 390, 844, 'telefono');
  await personal(navegador, 1440, 900, 'escritorio');
  await recorridoGuardado(navegador);
  await accesibilidad(navegador);
} catch (e) {
  mal(`El recorrido se detuvo: ${e.message.split('\n')[0]}`);
} finally {
  await navegador.close();
}
console.log(fallas ? `\n${fallas} comprobación(es) fallida(s).` : '\nTodas las comprobaciones correctas.');
process.exit(fallas ? 1 : 0);
