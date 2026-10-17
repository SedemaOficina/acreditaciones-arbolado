// PRUEBAS DEL EXAMEN EN LÍNEA (etapa 2): la pantalla de quien aplica (aplicar.html) y la de la persona (examen.html),
// en teléfono (390 px) y escritorio (1280 px), sobre los datos ficticios y el servidor simulado. Falla si:
//   · hay errores en la consola o excepciones en la página;
//   · la página se desborda a lo ancho;
//   · un camino no termina como debe: aprobar, no aprobar, tiempo agotado, suspensión, código repuesto,
//     código inexistente o mal escrito, recarga a mitad del examen.
//
// Uso:  (cd sitio && python3 -m http.server 8765) &
//       AXE=<ruta a axe.min.js> CHROMIUM=<ruta opcional> node herramientas/probar-examen.mjs http://localhost:8765/ [carpeta-de-capturas]

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] ? join(raiz, process.argv[3]) : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

let fallas = 0;
let bien = 0;
const ok = (cond, texto) => { if (cond) { bien += 1; } else { fallas += 1; console.log(`FALLA    ${texto}`); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function contexto(ancho) {
  const c = await navegador.newContext({ viewport: { width: ancho, height: ancho < 600 ? 844 : 900 } });
  c.errores = [];
  c.on('page', (p) => vigila(c, p));
  return c;
}
function vigila(c, p) {
  p.on('console', (m) => { if (m.type() === 'error') c.errores.push(`${p.url()}: ${m.text()}`); });
  p.on('pageerror', (e) => c.errores.push(`${p.url()}: ${e.message}`));
}
async function sinDesborde(p, que) {
  const d = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(d <= 1, `${que}: se desborda ${d} px a lo ancho`);
}
async function captura(p, nombre) { if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, `examen-${nombre}.png`), fullPage: true }); }
const vista = (p) => p.evaluate(() => (document.querySelector('[data-vista]:not([hidden])') || {}).dataset?.vista);

/* Genera en aplicar.html el código de la n-ésima persona con derecho y lo devuelve */
async function generar(ap, n) {
  const boton = ap.locator('[data-accion="generar"]').nth(n);
  const ins = await boton.getAttribute('data-ins');
  await boton.click();
  await ap.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
  return (await ap.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
}
/* Entra al examen con un código (escrito como lo escribiría una persona) y llega a la primera pregunta */
async function entraYEmpieza(ex, codigo) {
  await ex.fill('#codigo', codigo.toLowerCase().replace('-', ' '));
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await ex.click('[data-ir-vista="instrucciones"]');
  await ex.waitForSelector('[data-vista="instrucciones"]:not([hidden])');
  await ex.click('[data-empezar]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
}
async function enviar(ex) {
  await ex.click('[data-siguiente]'); // con el menú de pruebas se queda en la última; «Revisar y enviar»
  await ex.waitForSelector('[data-vista="revision"]:not([hidden])');
  await ex.click('[data-enviar]');
  await ex.click('.dialogo-confirma [data-r="si"]');
  await ex.waitForSelector('[data-vista="resultado"]:not([hidden])');
}

// ── Escritorio: el recorrido completo, con las dos pantallas abiertas en el mismo navegador ──
{
  const c = await contexto(1280);
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html`);
  await ap.waitForSelector('[data-filas] tr');
  const filas = await ap.locator('[data-filas] tr').count();
  ok(filas === 10, `aplicar: 10 personas inscritas (hay ${filas})`);
  ok(await ap.locator('[data-filas] .estado', { hasText: 'Sin derecho a examen' }).count() === 1, 'aplicar: una persona sin derecho a examen');
  ok((await ap.textContent('[data-grupo]')).includes('PILARES'), 'aplicar: el lugar es el salón de cómputo del PILARES');
  ok(/^\d{1,2} personas inscritas, 9 con derecho/.test(await ap.textContent('[data-cuenta]')), 'aplicar: resumen del grupo');
  await captura(ap, 'aplicar-inicio-escritorio');

  // 1 · Aprueba
  const c1 = await generar(ap, 0);
  ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c1), `código con formato XXXX-XXXX (${c1})`);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await captura(ex, 'entrar-escritorio');
  // Código mal escrito: error junto al campo
  await ex.fill('#codigo', 'ABC');
  await ex.click('#entrar [data-accion="enviar"]');
  ok(await ex.locator('#codigo[aria-invalid="true"]').count() === 1 && (await ex.textContent('[data-campo="codigo"] .err')).includes('8 letras'), 'código mal escrito: error junto al campo');
  // Código con formato correcto que no existe: error del servidor junto al campo
  await ex.fill('#codigo', 'AAAA-AAAA');
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForFunction(() => document.querySelector('[data-campo="codigo"]').textContent.includes('no existe'));
  ok(true, 'código inexistente: lo dice el servidor junto al campo');
  await entraYEmpieza(ex, c1);
  ok((await ex.textContent('[data-numero]')) === 'Pregunta 1 de 12', 'pregunta 1 de 12');
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  ok(true, 'la respuesta se guarda al elegirla');
  await ex.check('[data-marcar]');
  await ex.click('[data-siguiente]');
  ok((await ex.textContent('[data-numero]')) === 'Pregunta 2 de 12', 'Siguiente lleva a la pregunta 2');
  ok(await ex.locator('.examen-numero[data-estado="marcada"]').count() === 1, 'mapa: la pregunta 1 aparece marcada');
  await captura(ex, 'pregunta-escritorio');
  // Recargar no saca a la persona de su examen
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  ok(true, 'una recarga vuelve al examen abierto');
  // Quien aplica ve el avance al momento
  await ap.waitForFunction(() => document.querySelector('[data-filas]').textContent.includes('Contestando · 1 de 12'));
  ok(true, 'aplicar: ve «Contestando · 1 de 12»');
  await ex.evaluate((cod) => APD_EXAMEN_API.pruebas.contestar(cod, 'bien'), c1);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await enviar(ex);
  ok((await ex.textContent('[data-calificacion]')) === '10.0', 'todas bien: calificación 10.0');
  ok((await ex.textContent('[data-veredicto]')).includes('Aprobado'), 'todas bien: aprobado');
  await captura(ex, 'resultado-aprobado-escritorio');
  await ap.waitForFunction(() => document.querySelector('[data-filas]').textContent.includes('10.0 · aprobado'));
  ok(true, 'aplicar: ve «10.0 · aprobado»');
  // El código enviado ya no sirve para contestar: al entrar muestra el resultado
  await ex.click('[data-vista="resultado"] [data-salir]');
  await ex.fill('#codigo', c1);
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="resultado"]:not([hidden])');
  ok(true, 'un código ya enviado sólo muestra el resultado');
  await ex.click('[data-vista="resultado"] [data-salir]');

  // 2 · No aprueba
  const c2 = await generar(ap, 0);
  await entraYEmpieza(ex, c2);
  await ex.evaluate((cod) => APD_EXAMEN_API.pruebas.contestar(cod, 'reprobar'), c2);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await enviar(ex);
  const cal2 = Number(await ex.textContent('[data-calificacion]'));
  ok(cal2 < 7, `una de cada tres bien: no alcanza 7.0 (${cal2})`);
  ok((await ex.textContent('[data-veredicto]')).includes('No aprobado'), 'no aprobado');
  ok((await ex.textContent('[data-resultado-sigue]')).includes('solicitud nueva'), 'no aprobado: dice que inicie una solicitud nueva');
  await ex.click('[data-vista="resultado"] [data-salir]');

  // 3 · Se acaba el tiempo: se envía solo
  const c3 = await generar(ap, 0);
  await entraYEmpieza(ex, c3);
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  await ex.evaluate((cod) => APD_EXAMEN_API.pruebas.dejarMinutos(cod, 0.05), c3);
  await ex.reload();
  await ex.waitForSelector('[data-vista="resultado"]:not([hidden])', { timeout: 10000 });
  ok(await ex.isVisible('[data-por-tiempo]'), 'tiempo agotado: avisa que se enviaron las respuestas que tenía');
  await captura(ex, 'resultado-tiempo-escritorio');
  await ex.click('[data-vista="resultado"] [data-salir]');

  // 4 · Quien aplica suspende el examen
  const c4 = await generar(ap, 0);
  await entraYEmpieza(ex, c4);
  const fila4 = ap.locator('tr', { hasText: c4 });
  await fila4.locator('[data-accion="suspender"]').click();
  await ap.click('#suspender [data-accion="enviar"]');
  ok(await ap.locator('#motivo[aria-invalid="true"]').count() === 1, 'suspender: el motivo es obligatorio');
  await ap.fill('#motivo', 'Consultó su teléfono durante el examen.');
  await ap.click('#suspender [data-accion="enviar"]');
  await ap.waitForFunction(() => !document.querySelector('#dlg-suspender').open);
  await ex.waitForSelector('[data-vista="suspendido"]:not([hidden])', { timeout: 6000 });
  ok((await ex.textContent('[data-motivo-suspension]')).includes('teléfono'), 'la persona ve que su examen se suspendió y por qué');
  await ex.click('[data-vista="suspendido"] [data-salir]');

  // 5 · Código perdido: se repone y el examen sigue igual
  const c5 = await generar(ap, 0);
  await entraYEmpieza(ex, c5);
  await ex.locator('[data-opciones] input').nth(1).check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  await ap.locator('tr', { hasText: c5 }).locator('[data-accion="reponer"]').click();
  await ap.click('.dialogo-confirma [data-r="si"]');
  await ap.waitForFunction((v) => !document.querySelector('[data-filas]').textContent.includes(v), c5);
  const c5b = (await ap.locator('tr', { hasText: 'Contestando · 1 de 12' }).locator('.examen-codigo').textContent()).trim();
  ok(c5b !== c5, 'reponer: hay un código nuevo');
  await ex.waitForSelector('[data-vista="entrar"]:not([hidden])', { timeout: 6000 });
  ok((await ex.textContent('[data-aviso-entrar]')).includes('código nuevo'), 'reponer: la pantalla con el código anterior pide el nuevo');
  await ex.fill('#codigo', c5b);
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  ok((await ex.textContent('[data-contestadas]')).includes('1 contestada'), 'reponer: sigue con su respuesta guardada');
  await ex.fill('#codigo', '').catch(() => {});
  await ex.evaluate(() => sessionStorage.clear());
  const ex2 = await c.newPage();
  await ex2.goto(`${BASE}examen.html`);
  await ex2.fill('#codigo', c5);
  await ex2.click('#entrar [data-accion="enviar"]');
  await ex2.waitForFunction(() => document.querySelector('[data-campo="codigo"]').textContent.includes('ya no sirve'));
  ok(true, 'reponer: el código anterior ya no sirve');
  await ex2.close();

  await captura(ap, 'aplicar-avance-escritorio');
  await sinDesborde(ap, 'aplicar escritorio');
  // Menú de pruebas: sus acciones propias aparecen en «En esta pantalla»
  await ap.click('.menu-pruebas-boton');
  ok(await ap.locator('.menu-pruebas >> text=Simular que todas contestan y envían').count() === 1, 'menú de pruebas de aplicar: acciones propias');
  await ap.click('.menu-pruebas >> text=Generar los códigos de todas las personas con derecho');
  await ap.waitForFunction(() => document.querySelector('.menu-pruebas-estado').textContent === 'Códigos generados.');
  await ap.click('.menu-pruebas >> text=Simular que todas contestan y envían');
  await ap.waitForFunction(() => /enviados? con respuestas/.test(document.querySelector('.menu-pruebas-estado').textContent));
  await ap.click('.menu-pruebas-cabeza .btn-enlace');
  await ap.waitForSelector('[data-todos]:not([hidden])');
  ok(true, 'aplicar: aviso de que todas terminaron');
  ok(c.errores.length === 0, `escritorio sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Teléfono: la pantalla del examen de punta a punta, con el menú de pruebas ──
{
  const c = await contexto(390);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await ex.waitForSelector('.menu-pruebas-boton');
  await sinDesborde(ex, 'examen teléfono · entrar');
  await captura(ex, 'entrar-telefono');
  await ex.click('.menu-pruebas-boton');
  await ex.click('.menu-pruebas >> text=Usar el código de alguien del grupo en curso');
  await ex.waitForFunction(() => document.querySelector('.menu-pruebas-estado').textContent.startsWith('Código de'));
  await ex.click('.menu-pruebas-cabeza .btn-enlace');
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await sinDesborde(ex, 'examen teléfono · confirmar');
  await captura(ex, 'confirmar-telefono');
  await ex.click('[data-ir-vista="instrucciones"]');
  await captura(ex, 'instrucciones-telefono');
  await ex.click('[data-empezar]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await sinDesborde(ex, 'examen teléfono · pregunta');
  await captura(ex, 'pregunta-telefono');
  // La pregunta con imágenes
  const conImagen = await ex.evaluate(() => {
    const k = [...document.querySelectorAll('.examen-numero')].length;
    return k;
  });
  ok(conImagen === 12, 'mapa con 12 números');
  for (let i = 0; i < 12; i++) {
    if (await ex.locator('.examen-opcion-imagen').count()) break;
    await ex.click('[data-siguiente]');
  }
  if (await ex.locator('.examen-opcion-imagen').count()) { await sinDesborde(ex, 'examen teléfono · pregunta con imágenes'); await captura(ex, 'pregunta-imagenes-telefono'); }
  await ex.click('.menu-pruebas-boton');
  await ex.click('.menu-pruebas >> text=Contestar todas bien');
  await ex.click('.menu-pruebas-cabeza .btn-enlace');
  await ex.waitForTimeout(400);
  await ex.click('[data-siguiente]');
  await ex.waitForSelector('[data-vista="revision"]:not([hidden])');
  await sinDesborde(ex, 'examen teléfono · revisión');
  await captura(ex, 'revision-telefono');
  await ex.click('[data-enviar]');
  await captura(ex, 'confirmar-envio-telefono');
  await ex.click('.dialogo-confirma [data-r="si"]');
  await ex.waitForSelector('[data-vista="resultado"]:not([hidden])');
  await sinDesborde(ex, 'examen teléfono · resultado');
  await captura(ex, 'resultado-telefono');
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html`);
  await ap.waitForSelector('.examen-codigo');
  await sinDesborde(ap, 'aplicar teléfono');
  await captura(ap, 'aplicar-telefono');
  ok(c.errores.length === 0, `teléfono sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Accesibilidad con axe-core en cada pantalla del examen y en la de quien aplica ──
if (process.env.AXE) {
  const axe = readFileSync(process.env.AXE, 'utf8');
  const c = await contexto(390);
  const p = await c.newPage();
  const revisa = async (que) => {
    await p.addScriptTag({ content: axe });
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
    ok(r.length === 0, `axe ${que}:\n  ${r.join('\n  ')}`);
  };
  await p.goto(`${BASE}aplicar.html`);
  await p.waitForSelector('[data-filas] tr');
  await p.locator('[data-accion="generar"]').first().click();
  await p.waitForSelector('.examen-codigo');
  const cod = (await p.textContent('.examen-codigo')).trim();
  await revisa('aplicar');
  await p.goto(`${BASE}examen.html`);
  await revisa('examen · entrar');
  await entraYEmpieza(p, cod);
  await revisa('examen · pregunta');
  await p.evaluate((x) => APD_EXAMEN_API.pruebas.contestar(x, 'azar'), cod);
  await p.reload();
  await p.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await p.click('[data-siguiente]');
  await p.waitForSelector('[data-vista="revision"]:not([hidden])');
  await revisa('examen · revisión');
  await p.click('[data-enviar]');
  await p.click('.dialogo-confirma [data-r="si"]');
  await p.waitForSelector('[data-vista="resultado"]:not([hidden])');
  await revisa('examen · resultado');
  await c.close();
} else console.log('OMITIDO  accesibilidad: falta AXE=<ruta a axe.min.js>');

await navegador.close();
console.log(`${bien} comprobaciones correctas, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
