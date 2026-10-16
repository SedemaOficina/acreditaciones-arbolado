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
const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
// Persona nueva ficticia, con CURP coherente con su nombre y su fecha de nacimiento
const NUEVA = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', nacimiento: '1999-12-30' };
NUEVA.curp = conDigito(globalThis.APD_CURP.prefijo({ nombre: NUEVA.nombre, primer: NUEVA.primer_apellido, segundo: NUEVA.segundo_apellido }, NUEVA.nacimiento, 'M', 'NE') + '0');
const otroDigito = (c) => c.slice(0, 17) + String((Number(c[17]) + 1) % 10);
// Fecha de nacimiento de una persona ficticia: está en su CURP (homoclave 0 = nacida antes de 2000)
const nacimientoDe = (p) => `19${p.curp.slice(4, 6)}-${p.curp.slice(6, 8)}-${p.curp.slice(8, 10)}`;
const CONTRASENA = 'Prueba-ficticia-2026';
const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender'];

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
}
async function sinDesborde(page, donde) {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  comprueba(ok, `${donde}: sin desborde horizontal`);
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
  await page.fill('#fecha_nacimiento', p.nacimiento || nacimientoDe(p));
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
  await page.fill('#fecha_nacimiento', '1999-12-31');
  await page.press('#fecha_nacimiento', 'Tab');
  comprueba(/fecha de nacimiento no coincide/.test(await page.textContent('[data-campo="curp"] .err')), t('cuenta: con la CURP ya escrita, una fecha distinta se marca al momento'));
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
  await page.fill('#fecha_nacimiento', '1999-12-31');
  await page.click('[data-accion="enviar"]');
  comprueba(await page.locator('[aria-invalid="true"]').count() > 0, t('cuenta: la fecha de nacimiento distinta a la de la CURP se rechaza'));
  await page.fill('#fecha_nacimiento', NUEVA.nacimiento);
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
  await captura(page, `03-solicitud-documentos-${sufijo}`);
  await siguiente(page);
  await marcaCasillas(page);
  await captura(page, `04-solicitud-revision-${sufijo}`);
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
  await page.click('[data-sesion] button').catch(() => {});
  await page.goto(BASE + 'index.html');
  await page.evaluate(() => sessionStorage.clear());

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
  await page.fill('#numero', noVigente.numero);
  await page.click('[data-accion="enviar"]');
  await page.waitForFunction(() => document.querySelector('[data-resultado]').dataset.tono === 'error');
  bien(t(`verificar: ${noVigente.numero} no vigente (segunda consulta sin recargar)`));
  await captura(page, `09-verificar-${sufijo}`);
  await sinDesborde(page, t('verificar'));

  // Mis datos: datos ligados a la CURP sólo de lectura; cambia su adscripción y se conserva
  await page.evaluate(() => sessionStorage.clear());
  await entra(page, CON_ORG.curp);
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(/Sexo/.test(await page.textContent('[data-identidad]')) && await page.$('#curp') === null,
    t('mis datos: muestra CURP y sexo sin dejarlos cambiar'));
  comprueba(await page.isChecked('input[name="adscrito"][value="si"]') && await page.isChecked('input[name="tipo_adscripcion"][value="privada"]'),
    t('mis datos: trae la adscripción vigente de la persona'));
  await page.check('input[name="tipo_adscripcion"][value="alcaldia"]', { force: true });
  const alcaldias = await page.$$eval('#alcaldia option[value]:not([value=""])', (os) => os.map((o) => o.textContent));
  comprueba(alcaldias.length === 16 && alcaldias.join('|') === [...alcaldias].sort((x, y) => x.localeCompare(y, 'es')).join('|'),
    t('mis datos: las 16 alcaldías a la vista, en orden alfabético'));
  await page.selectOption('#alcaldia', 'tlalpan');
  await captura(page, `14-mis-datos-${sufijo}`);
  await sinDesborde(page, t('mis datos'));
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-acuse]:not([hidden])');
  comprueba(/Tlalpan/.test(await page.textContent('[data-acuse-folio]')), t('mis datos: guarda la nueva adscripción (Alcaldía · Tlalpan)'));
  await page.goto(BASE + 'datos.html');
  await page.waitForSelector('[data-identidad] .datos');
  comprueba(await page.inputValue('#alcaldia') === 'tlalpan', t('mis datos: al volver, la adscripción es la nueva'));
  await page.evaluate(() => sessionStorage.clear());

  // Fallo de envío simulado
  await page.goto(BASE + 'cuenta.html?simular=error');
  await llenaCuenta(page, NUEVA);
  await page.click('[data-accion="enviar"]');
  await page.waitForSelector('[data-estado-envio]:not([hidden])');
  bien(t('cuenta: el fallo de envío se avisa y la captura se conserva'));

  // Menú de pruebas: sin obligatorias se avanza vacío hasta la revisión; se vuelve a activar
  await page.goto(BASE + 'solicitud.html');
  await page.click('.menu-pruebas-boton');
  comprueba(await page.isVisible('dialog.menu-pruebas'), t('menú de pruebas: se abre'));
  await page.selectOption('#menu-pruebas-persona', 'nueva');
  await page.click('dialog.menu-pruebas >> text=Entrar como esta persona');
  await page.waitForURL(/tramites\.html/);
  await page.goto(BASE + 'solicitud.html');
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=Desactivar las preguntas obligatorias');
  await page.waitForLoadState('load');
  await page.waitForSelector('.menu-pruebas-boton');
  comprueba(await page.locator('form [data-requerido]').count() === 0, t('menú de pruebas: preguntas obligatorias desactivadas'));
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=3. Revisión');
  await page.waitForSelector('section[data-paso][data-revision]:not([hidden])');
  bien(t('menú de pruebas: salta al paso de revisión sin llenar'));
  await captura(page, `11-menu-pruebas-${sufijo}`);
  await page.click('.menu-pruebas-boton');
  await page.click('dialog.menu-pruebas >> text=Activar las preguntas obligatorias');
  await page.waitForLoadState('load');
  await page.waitForSelector('.menu-pruebas-boton');
  comprueba(await page.locator('form [data-requerido]').count() > 0, t('menú de pruebas: preguntas obligatorias activadas de nuevo'));
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
    comprueba(await page.locator('[data-solicitudes] .datos-por-confirmar').count() === 3,
      t('mis solicitudes: concepto, monto y referencia del pago se marcan en amarillo, por confirmar'));
    await page.click('[data-sesion] button');
  }
  comprueba(Boolean(emitida && conGrupo && conCita), t('mis solicitudes: hay ficticios para revisar las tres fichas'));

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
  await page.evaluate((id) => sessionStorage.setItem('apd.sesion', JSON.stringify({ id })), paraDictaminador.id);
  const pantallas = [['index.html'], ['cuenta.html'], ['cuenta.html', 'con errores'], ['entrar.html'], ['tramites.html'], ['datos.html'], ['solicitud.html?tipo=dictaminador'], ['solicitud.html?tipo=dictaminador', 'con errores'], ['verificar.html']];
  for (const [url, estado] of pantallas) {
    await page.goto(BASE + url);
    await page.waitForLoadState('networkidle');
    if (estado) await page.click(url.startsWith('solicitud') ? `${pasoVisible} [data-accion="siguiente"]` : '[data-accion="enviar"]');
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
  await accesibilidad(navegador);
} catch (e) {
  mal(`El recorrido se detuvo: ${e.message.split('\n')[0]}`);
} finally {
  await navegador.close();
}
console.log(fallas ? `\n${fallas} comprobación(es) fallida(s).` : '\nTodas las comprobaciones correctas.');
process.exit(fallas ? 1 : 0);
