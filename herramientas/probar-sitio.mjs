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
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
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
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const page = await contexto.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`${page.url()} · ${m.text()}`); });
  page.on('pageerror', (e) => errores.push(`${page.url()} · ${e.message}`));
  const t = (m) => `[solicitud ${sufijo}] ${m}`;
  const llega = (re) => page.waitForURL(re, { timeout: 5000 }).then(() => true, () => false);
  const tituloPaso = () => page.$eval(`${pasoVisible} .titulo-paso`, (e) => e.textContent).catch(() => '');
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
  await page.click('[data-borrador="recuperar"]');
  const recuperados = await page.waitForFunction(() => document.querySelectorAll('[data-archivos] .lista-arch li[data-estado="listo"]').length === 2, null, { timeout: 5000 }).then(() => true, () => false);
  comprueba(recuperados && await enPaso('Carga tus documentos') && await page.inputValue('#carrera_tecnica') === 'Técnico en jardinería',
    t('B2: «Seguir donde ibas» recupera el paso, lo escrito y los 2 documentos cargados'));
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
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
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
  await page.goto(BASE + `cotejo.html?folio=${folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
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
  await page.goto(BASE + `cotejo.html?folio=${folio}`);
  await page.waitForSelector('#formulario:not([hidden])');
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
  comprueba((await page.textContent('[data-resumen]')).includes('EXP-'), t('el resultado anuncia el número de expediente que se abre'));
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
    const c = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
    const pg = await c.newPage();
    const errores = [];
    pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'warning' && /no se pudo aplicar lo guardado/.test(m.text())) errores.push(m.text()); });
    return { c, pg, errores };
  };
  const abre = async (pg, folio) => { await pg.goto(BASE + `cotejo.html?folio=${folio}`); await pg.waitForSelector('#formulario:not([hidden])'); };
  const registra = async (pg) => { await pg.click('[data-accion="enviar"]'); await pg.waitForSelector('[data-hecho]:not([hidden])'); };
  // Día/mes/año: la fecha de la cita nueva usa el formato «fecha-dma» del estándar (D9)
  const manana = (() => { const d = new Date(`${datos.fecha_corte}T12:00:00-06:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10).split('-').reverse().join('/'); })();

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
/* ── Etapa 2 · grupos y asistencia (bloque 53; maqueta aprobada y decisiones del 2026-10-17) ──
   Completa el grupo en integración con una persona de la espera, lo confirma (fecha a 7 días, hora de entrada de la
   lista, instructor), da de baja a una persona (el grupo regresa a integración con su fecha), crea un grupo combinado
   de renovación y lo cancela; la persona ve su grupo en «Mis trámites». El instructor captura un día de asistencia. */
async function caminosGrupos(navegador, ancho, alto, sufijo) {
  const t = (m) => `[grupos ${sufijo}] ${m}`;
  const c = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const pg = await c.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /no se pudo aplicar/.test(m.text()))) errores.push(m.text()); });
  const texto = async (sel) => (await pg.textContent(sel)) || '';
  const integracion = datos.grupo.find((g) => g.estado === 'en_integracion');
  const enCurso = datos.grupo.find((g) => g.estado === 'en_curso');

  await pg.goto(BASE + 'grupos.html');
  await pg.waitForSelector('[data-filas] tr');
  comprueba((await pg.$$('.curso')).length === 4, t('la espera se muestra por cada uno de los cuatro cursos'));
  comprueba((await pg.$$('[data-filas] tr')).length === datos.grupo.length, t('la lista muestra todos los grupos'));
  comprueba(/la acreditación vencida/.test(await texto('[data-cursos]')), t('renovación: avisa de quien espera con la acreditación vencida'));
  await sinDesborde(pg, t('grupos'));
  await captura(pg, `grupos-${sufijo}`);

  // Completar el grupo en integración con la persona que más espera
  await pg.goto(BASE + 'espera.html?curso=poda-nueva');
  await pg.waitForSelector('.bloque-adscripcion tr[data-folio]');
  const primero = await pg.getAttribute('.bloque-adscripcion tr[data-folio]', 'data-folio');
  // Agrupada por adscripción: un bloque por adscripción, con cuántas son y si alcanzan para un grupo propio
  const bloques = await pg.$$eval('.bloque-adscripcion', (bs) => bs.map((b) => ({ nombre: b.querySelector('.adscripcion-nombre').textContent,
    n: b.querySelectorAll('tr[data-folio]').length, cuenta: b.querySelector('.adscripcion-cuenta').textContent })));
  comprueba(bloques.length > 1 && new Set(bloques.map((b) => b.nombre)).size === bloques.length
    && bloques.every((b) => b.cuenta === (b.n === 1 ? '1 persona' : `${b.n} personas`)), t('espera agrupada por adscripción, una vez cada una, con su cuenta'));
  comprueba((await pg.$$eval('[data-tabla] .estado', (l) => l.map((e) => e.textContent))).every((x) => !/^\s*-\d/.test(x)), t('la espera nunca sale en días negativos'));
  const varias = await pg.$('.bloque-adscripcion:has(tr[data-folio] + tr[data-folio])');
  if (varias) {
    await (await varias.$('.fila-adscripcion input')).check();
    const marcadas = await varias.$$eval('tr[data-folio] input', (l) => l.every((i) => i.checked));
    comprueba(marcadas && /personas elegidas/.test(await texto('[data-elegidas]')), t('la casilla de la adscripción elige a todas sus personas'));
    await (await varias.$('.fila-adscripcion input')).uncheck();
  }
  await pg.click(`[data-destinos] button:has-text("${integracion.folio}")`);
  comprueba(/No se agregó a nadie/.test(await texto('[data-error-eleccion]')) && await pg.evaluate(() => document.activeElement && document.activeElement.closest('[data-error-eleccion]') !== null)
    && (await pg.$$('.elegir.falta-marcar')).length > 0, t('sin elegir a nadie: el error sale junto a los botones, con el foco ahí, y se señalan las casillas'));
  await pg.check(`tr[data-folio="${primero}"] input`);
  await sinDesborde(pg, t('espera'));
  await captura(pg, `grupos-espera-${sufijo}`);
  await pg.click(`[data-destinos] button:has-text("${integracion.folio}")`);
  await pg.waitForURL(/grupo\.html.*hecho=agregadas/);
  await pg.waitForSelector('[data-filas] tr');
  comprueba(await pg.isVisible(`[data-filas] tr[data-folio="${primero}"]`), t('la persona elegida queda en el grupo'));

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
  await pg.fill('#fecha_inicio', fechaMas(12));
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
  comprueba(tram.includes(APDfecha(fechaMas(12))) && /09:00/.test(tram), t('«Mis trámites»: la persona ve el primer día del curso y la hora de entrada'));
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

  // Crear un grupo combinado de renovación con toda la espera y cancelarlo
  await pg.goto(BASE + 'espera.html?curso=poda-renovacion');
  await pg.waitForSelector('.bloque-adscripcion tr[data-folio]');
  const enEspera = (await pg.$$('.bloque-adscripcion tr[data-folio]')).length;
  for (const k of await pg.$$('.bloque-adscripcion tr[data-folio] input')) await k.check();
  await pg.click('[data-destinos] button:has-text("Crear un grupo")');
  await pg.waitForSelector('dialog[open]');
  // La espera empieza antes del clic: la página quita «hecho» de la dirección en cuanto carga y la espera llegaba tarde
  const llega3 = pg.waitForURL(/hecho=creado/);
  await pg.click('dialog[open] .btn-primario');
  await llega3;
  await pg.waitForSelector('[data-filas] tr');
  comprueba((await pg.$$('[data-filas] tr')).length === enEspera, t('el grupo nuevo tiene a las personas elegidas'));
  await pg.click('[data-acciones] button:has-text("Cancelar el grupo")');
  const dlg = await texto('#dlg-cancelar');
  comprueba(/¿Cancelar el grupo APD-G-\d{4}-\d{3}\?/.test(dlg) && /No se puede deshacer/.test(dlg) && /Volver sin cambios/.test(dlg) && /Sí, cancelar el grupo/.test(dlg)
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
  await pg.goto(BASE + 'espera.html?curso=poda-renovacion');
  await pg.waitForSelector('.bloque-adscripcion tr[data-folio]');
  comprueba((await pg.$$('.bloque-adscripcion tr[data-folio]')).length === enEspera, t('al cancelar, las personas regresan a la espera'));

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
}
const APDfecha = (iso) => iso.split('-').reverse().join('/');

// Material de estudio (decisión 2026-10-18): la página pública sin cuenta y la del personal (agregar, ocultar)
async function materialEstudio(navegador, ancho, alto, sufijo) {
  const t = (m) => `[material ${sufijo}] ${m}`;
  const c = await navegador.newContext({ viewport: { width: ancho, height: alto } });
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
  const c = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
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

async function accesibilidad(navegador) {
  if (!process.env.AXE) { console.log('OMITIDO  accesibilidad: falta AXE=<ruta a axe.min.js del estándar>'); return; }
  const axe = readFileSync(process.env.AXE, 'utf8');
  const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + 'index.html');
  await page.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), paraDictaminador.id);
  const pantallas = [['index.html'], ['cuenta.html'], ['cuenta.html', 'con errores'], ['entrar.html'], ['tramites.html'], ['datos.html'], ['solicitud.html?tipo=dictaminador'], ['solicitud.html?tipo=dictaminador', 'con errores'], ['verificar.html'],
    ['revision.html'], [`revisar.html?folio=${porClasificar.folio}`], [`revisar.html?folio=${porClasificar.folio}`, 'con errores'], [`revisar.html?folio=${noCumple.folio}`, 'rechazo'], [`revisar.html?folio=${porClasificar.folio}`, 'visor'],
    ['grupos.html'], ['espera.html?curso=poda-nueva'], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_integracion').folio}`], [`grupo.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso').folio}`],
    [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13').folio}`], [`asistencia.html?folio=${datos.grupo.find((g) => g.estado === 'en_curso' && g.fecha_inicio === '2026-10-13').folio}`, 'sin marcar'],
    ['material.html'], ['material-personal.html'], ['citas.html'], [`cotejo.html?folio=${conCita.folio}`], [`cotejo.html?folio=${conCita.folio}`, 'con errores'], [`cotejo.html?folio=${conCita.folio}`, 'factura'],
    ['solicitud.html', 'menú de pruebas'], ['cuenta.html', 'menú de pruebas'], ['entrar.html', 'menú de pruebas']];
  for (const [url, estado] of pantallas) {
    await page.goto(BASE + url);
    await page.waitForLoadState('networkidle');
    if (estado === 'rechazo') await page.check('input[name="comprobante_confirma"][value="si"]');
    else if (estado === 'menú de pruebas') { await page.click('.menu-pruebas-boton'); await page.waitForSelector('dialog.menu-pruebas[open] [data-guardado]'); }
    else if (estado === 'factura') {
      await page.check('input[name="se_presento"][value="si"]');
      await page.check('input[name="identidad"][value="misma"]');
      for (const k of await page.$$eval('article.doc-revision', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.dataset.doc))) await page.check(`input[name="coincide_${k}"][value="si"]`);
      await page.check('input[name="pago"][value="si"]');
    } else if (estado === 'sin marcar') await page.click('[data-guardar]');
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
  // SOLO=guardado corre sólo el recorrido guardado y los caminos del cotejo; SOLO=grupos, sólo grupos y asistencia (para depurar)
  const solo = process.env.SOLO || '';
  if (!solo) {
    await recorrido(navegador, 390, 844, 'telefono');
    await recorrido(navegador, 1280, 900, 'escritorio');
    await personal(navegador, 390, 844, 'telefono');
    await personal(navegador, 1440, 900, 'escritorio');
  }
  if (!solo || solo === 'solicitud') {
    await solicitudRegresos(navegador, 390, 844, 'telefono');
    await solicitudRegresos(navegador, 1280, 900, 'escritorio');
  }
  if (!solo || solo === 'guardado') {
    await recorridoGuardado(navegador);
    await caminosCotejo(navegador);
  }
  if (!solo || solo === 'grupos') {
    await caminosGrupos(navegador, 390, 844, 'telefono');
    await caminosGrupos(navegador, 1280, 900, 'escritorio');
  }
  if (!solo || solo === 'material') {
    await materialEstudio(navegador, 390, 844, 'telefono');
    await materialEstudio(navegador, 1280, 900, 'escritorio');
  }
  if (!solo || solo === 'persistencia') await persistenciaPrueba(navegador);
  if (!solo) await accesibilidad(navegador);
} catch (e) {
  mal(`El recorrido se detuvo: ${e.message.split('\n')[0]}`);
} finally {
  await navegador.close();
}
console.log(fallas ? `\n${fallas} comprobación(es) fallida(s).` : '\nTodas las comprobaciones correctas.');
process.exit(fallas ? 1 : 0);
