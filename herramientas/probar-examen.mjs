// PRUEBAS DEL EXAMEN EN LÍNEA (etapa 2): la pantalla de quien aplica (aplicar.html) y la de la persona (examen.html),
// en teléfono (390 px) y escritorio (1280 px), sobre los datos ficticios y el servidor simulado. Falla si:
//   · hay errores en la consola o excepciones en la página;
//   · la página se desborda a lo ancho;
//   · un camino no termina como debe: aprobar, no aprobar, tiempo agotado, suspensión, código repuesto,
//     código inexistente o mal escrito, recarga a mitad del examen.
//
// Uso:  AXE=<ruta a axe.min.js> npm run probar-examen   (sirve sitio/ mientras dura, herramientas/con-servidor.sh), o con un servidor ya encendido:
//       AXE=<ruta a axe.min.js> CHROMIUM=<ruta opcional> node herramientas/probar-examen.mjs http://localhost:8765/ [carpeta-de-capturas]

import { chromium } from 'playwright';
import { navegadorSinGoogle } from './sin-google.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const CAPTURAS = process.argv[3] ? resolve(raiz, process.argv[3]) : null;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

let fallas = 0;
let bien = 0;
const ok = (cond, texto) => { if (cond) { bien += 1; } else { fallas += 1; console.log(`FALLA    ${texto}`); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// El mapa de Google de «Mis trámites» (P68) se contesta con una página mínima: herramientas/sin-google.mjs
const navegador = navegadorSinGoogle(await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}));

/* Zona horaria del navegador fija: la de la Ciudad de México (auditoría 2026-10-19, B8-03); una pasada corta va en UTC */
async function contexto(ancho, zona = 'America/Mexico_City') {
  const c = await navegador.newContext({ viewport: { width: ancho, height: ancho < 600 ? 844 : 900 }, timezoneId: zona });
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

/* Pasa lista en aplicar.html: marca presente a la n-ésima persona por pasar lista y devuelve su código */
async function generar(ap, n) {
  const boton = ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).nth(n);
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
  // El grupo en curso de diez personas: desde el 2026-10-18 hay otro en curso (el del caso «aprobó hoy»)
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('[data-filas] tr');
  const filas = await ap.locator('[data-filas] tr').count();
  ok(filas === 10, `aplicar: 10 personas inscritas (hay ${filas})`);
  ok(await ap.locator('[data-filas] .estado', { hasText: 'Sin derecho a examen' }).count() === 1, 'aplicar: una persona sin derecho a examen');
  ok(await ap.locator('tr', { hasText: 'Sin derecho a examen' }).locator('[data-accion]').count() === 0, 'aplicar: a quien no tiene derecho no se le pasa lista');
  await ap.waitForFunction(() => document.querySelectorAll('[data-filas] .examen-foto-lista img').length === 10);
  ok(true, 'aplicar: la lista muestra la fotografía de cada persona');
  // «No llegó» y después llega
  const tarde = ap.locator('[data-filas] tr').filter({ has: ap.locator('[data-accion="ausente"]') }).last();
  const insTarde = await tarde.getAttribute('data-ins');
  await tarde.locator('[data-accion="ausente"]').click();
  await ap.waitForSelector(`tr[data-ins="${insTarde}"] >> text=No llegó al examen`);
  ok(true, 'pase de lista: «No llegó» queda registrado');
  ok(/1 no llegó/.test(await ap.textContent('[data-cuenta]')), 'resumen: cuenta a quien no llegó');
  await ap.click(`tr[data-ins="${insTarde}"] >> text=Llegó: marcar presente`);
  await ap.waitForSelector(`tr[data-ins="${insTarde}"] .examen-codigo`);
  ok(true, 'pase de lista: si llega después se marca presente y aparece su código');
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
  await ex.fill('#codigo', c1);
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await ex.waitForSelector('[data-foto-persona] img');
  ok(true, '¿eres tú?: muestra la fotografía de la persona');
  await ex.click('[data-ir-vista="instrucciones"]');
  await ex.click('[data-empezar]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  // Banco ficticio para probar la interfaz (decisión de Liber, 18/10/2026): 10 preguntas en los dos exámenes, 60 minutos
  const N = await ex.evaluate(() => APD_EXAMEN_BANCO.examenDe('poda').preguntas);
  const banco = await ex.evaluate(() => ({
    reactivos: APD_EXAMEN_BANCO.reactivos.length,
    dictaminador: APD_EXAMEN_BANCO.examenDe('dictaminador'),
    poda: APD_EXAMEN_BANCO.examenDe('poda'),
    claves: APD_EXAMEN_BANCO.reactivos.map((r) => r.clave).join(','),
    opcionesDeTexto: APD_EXAMEN_BANCO.reactivos.every((r) => Object.keys(r.opciones).join('') === 'abcd' && Object.values(r.opciones).every((o) => typeof o === 'string')),
    correctas: [...new Set(APD_EXAMEN_BANCO.reactivos.map((r) => r.correcta))].sort().join('')
  }));
  ok(banco.reactivos === 10 && banco.claves === 'F01,F02,F03,F04,F05,F06,F07,F08,F09,F10', `banco ficticio: 10 preguntas, F01 a F10 (${banco.claves})`);
  ok(banco.opcionesDeTexto, 'banco ficticio: todas de opción múltiple con 4 opciones de texto (a–d)');
  ok(banco.correctas === 'abcd', `banco ficticio: la correcta se reparte entre las cuatro letras (${banco.correctas})`);
  ok(N === 10 && banco.poda.minutos === 60 && banco.dictaminador.preguntas === 10 && banco.dictaminador.minutos === 60,
    `los dos exámenes: 10 preguntas y 60 minutos (${JSON.stringify(banco.poda)} · ${JSON.stringify(banco.dictaminador)})`);
  ok((await ex.textContent('[data-numero]')) === `Pregunta 1 de ${N}`, `pregunta 1 de ${N}`);
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  ok(true, 'la respuesta se guarda al elegirla');
  await ex.check('[data-marcar]');
  await ex.click('[data-siguiente]');
  ok((await ex.textContent('[data-numero]')) === `Pregunta 2 de ${N}`, 'Siguiente lleva a la pregunta 2');
  ok(await ex.locator('.examen-numero[data-estado="marcada"]').count() === 1, 'mapa: la pregunta 1 aparece marcada');
  await captura(ex, 'pregunta-escritorio');
  // Recargar no saca a la persona de su examen
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  ok(true, 'una recarga vuelve al examen abierto');
  // El mismo código en otra computadora (otra pestaña) mientras la primera sigue abierta: no entra y se avisa
  const otra = await c.newPage();
  await otra.goto(`${BASE}examen.html`);
  await otra.fill('#codigo', c1);
  await otra.click('#entrar [data-accion="enviar"]');
  await otra.waitForFunction(() => document.querySelector('[data-campo="codigo"]').textContent.includes('otra computadora'));
  ok(true, 'el mismo código no se abre en otra computadora mientras la primera sigue abierta');
  await ap.waitForFunction(() => document.querySelector('[data-filas]').textContent.includes('se intentó abrir en otra computadora 1 vez'));
  ok(true, 'aplicar: ve el intento en otra computadora');
  await otra.close();
  // Quien aplica ve el avance al momento
  await ap.waitForFunction((n) => document.querySelector('[data-filas]').textContent.includes(`Contestando · 1 de ${n}`), N);
  ok(true, 'aplicar: ve «Contestando · 1 de N»');
  await ex.evaluate((cod) => APD_EXAMEN_API.pruebas.contestar(cod, 'bien'), c1);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await enviar(ex);
  ok((await ex.textContent('[data-calificacion]')) === '10.0', 'todas bien: calificación 10.0');
  ok((await ex.textContent('[data-resultado-titulo]')).includes('Aprobaste') && (await ex.getAttribute('[data-vista="resultado"]', 'data-tono')) === 'ok', 'todas bien: el título dice «Aprobaste», en verde');
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
  // En otra computadora, el código ya enviado no muestra el nombre ni la calificación a quien tenga el papel (código de
  // un solo uso; auditoría «intentar romperlo», F3 B11)
  const ajena = await c.newPage();
  await ajena.goto(`${BASE}examen.html`);
  await ajena.fill('#codigo', c1);
  await ajena.click('#entrar [data-accion="enviar"]');
  await ajena.waitForFunction(() => document.querySelector('[data-campo="codigo"]').textContent.includes('ya se envió'), null, { timeout: 5000 }).catch(() => {});
  ok((await ajena.textContent('[data-campo="codigo"]')).includes('ya se envió') && await ajena.isHidden('[data-vista="resultado"]'),
    'un código ya enviado, en otra computadora: «Este examen ya se envió», sin el resultado');
  await ajena.close();
  // La mezcla de la prueba ignora un examen de otro banco igual que el servidor simulado: su lista de preguntas es la
  // del banco (F4 M5)
  ok(await ap.evaluate(() => APD_ARCHIVOS_PRUEBA.PREGUNTAS_BANCO.join(',') === APD_EXAMEN_BANCO.reactivos.map((r) => r.clave).join(',')),
    'la lista de preguntas del banco de la mezcla (archivos-prueba.js) es la del banco ficticio');

  // 2 · No aprueba
  const c2 = await generar(ap, 0);
  await entraYEmpieza(ex, c2);
  await ex.evaluate((cod) => APD_EXAMEN_API.pruebas.contestar(cod, 'reprobar'), c2);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await enviar(ex);
  const cal2 = Number(await ex.textContent('[data-calificacion]'));
  ok(cal2 < 7, `una de cada tres bien: no alcanza 7.0 (${cal2})`);
  ok((await ex.textContent('[data-resultado-titulo]')).includes('No aprobaste') && (await ex.getAttribute('[data-vista="resultado"]', 'data-tono')) === 'error', 'no aprobado: el título dice «No aprobaste», en rojo');
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

  // 4b · La computadora falla: la pantalla deja de avisar y la persona sigue en otra con el mismo código
  const c4b = await generar(ap, 0);
  const falla = await c.newPage();
  await falla.goto(`${BASE}examen.html`);
  await entraYEmpieza(falla, c4b);
  await falla.locator('[data-opciones] input').first().check();
  await falla.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  await falla.close();
  await espera(13000);
  const sigue = await c.newPage();
  await sigue.goto(`${BASE}examen.html`);
  await sigue.fill('#codigo', c4b);
  await sigue.click('#entrar [data-accion="enviar"]');
  await sigue.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  ok((await sigue.textContent('[data-contestadas]')).includes('1 contestada'), 'computadora que falla: sigue en otra con su respuesta guardada');
  await sigue.close();

  // 5 · Código perdido: se repone y el examen sigue igual
  const c5 = await generar(ap, 0);
  await entraYEmpieza(ex, c5);
  await ex.locator('[data-opciones] input').nth(1).check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  const ins5 = await ap.locator('tr', { hasText: c5 }).getAttribute('data-ins');
  await ap.locator('tr', { hasText: c5 }).locator('[data-accion="reponer"]').click();
  await ap.click('.dialogo-confirma [data-r="si"]');
  await ap.waitForFunction((v) => !document.querySelector('[data-filas]').textContent.includes(v), c5);
  const c5b = (await ap.locator(`tr[data-ins="${ins5}"] .examen-codigo`).textContent()).trim();
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
  await ap.click('.menu-pruebas >> text=Pasar lista: todas presentes');
  await ap.waitForFunction(() => document.querySelector('.menu-pruebas-estado').textContent.startsWith('Lista pasada'));
  await ap.click('.menu-pruebas >> text=Simular que todas contestan y envían');
  await ap.waitForFunction(() => /enviados? con respuestas/.test(document.querySelector('.menu-pruebas-estado').textContent));
  await ap.click('.menu-pruebas-cabeza .btn-enlace');
  const todos = await ap.waitForSelector('[data-todos]:not([hidden])', { timeout: 8000 }).then(() => true, () => false);
  ok(todos, `aplicar: aviso de que todas terminaron (${await ap.textContent('[data-cuenta]')})`);
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
  const total = await ex.evaluate(() => APD_EXAMEN_BANCO.examenDe('poda').preguntas);
  ok(await ex.locator('.examen-numero').count() === total, `mapa con ${total} números`);
  ok((await ex.textContent('[data-vista="instrucciones"]')).includes(`Son ${total} preguntas`), `instrucciones: «Son ${total} preguntas»`);
  // Cada pregunta: 4 opciones de texto con sus letras a) a d), sin imágenes; se recorren todas con «Siguiente»
  let letrasBien = 0;
  for (let i = 0; i < total; i++) {
    const letras = (await ex.locator('[data-opciones] .examen-letra').allTextContents()).join('');
    if (letras === 'a)b)c)d)' && await ex.locator('[data-opciones] img').count() === 0 && await ex.locator('[data-opciones] input[type="radio"]').count() === 4) letrasBien += 1;
    if (i < total - 1) await ex.click('[data-siguiente]');
  }
  ok(letrasBien === total, `las ${total} preguntas con 4 opciones de texto, letras a) a d) y sin imágenes (${letrasBien})`);
  ok((await ex.textContent('[data-numero]')) === `Pregunta ${total} de ${total}` && (await ex.textContent('[data-siguiente]')) === 'Revisar y enviar', 'en la última pregunta, «Siguiente» dice «Revisar y enviar»');
  await sinDesborde(ex, 'examen teléfono · última pregunta');
  // Orden al azar por persona: las preguntas no salen en el orden del banco y alguna pregunta baraja sus opciones;
  // con el mismo código, el orden no cambia
  const orden = await ex.evaluate(() => {
    const c = sessionStorage.getItem('apd.examen.abierto');
    const v = APD_EXAMEN_API.estado(c);
    const w = APD_EXAMEN_API.estado(c);
    return {
      preguntas: v.preguntas.map((p) => p.clave).join(','),
      opciones: v.preguntas.filter((p) => p.opciones.map((o) => o.valor).join('') !== 'abcd').length,
      igual: JSON.stringify(v.preguntas) === JSON.stringify(w.preguntas),
      sinClave: v.preguntas.every((p) => !('correcta' in p) && p.opciones.every((o) => Object.keys(o).join() === 'valor,texto'))
    };
  });
  ok(orden.preguntas !== 'F01,F02,F03,F04,F05,F06,F07,F08,F09,F10' && orden.opciones > 0, `orden al azar de preguntas y opciones (${orden.preguntas}; ${orden.opciones} con opciones barajadas)`);
  ok(orden.igual, 'el orden no cambia para el mismo código');
  ok(orden.sinClave, 'la página recibe las preguntas sin la respuesta correcta (sólo valor y texto de cada opción)');
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
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('.examen-codigo');
  await sinDesborde(ap, 'aplicar teléfono');
  await captura(ap, 'aplicar-telefono');
  ok(c.errores.length === 0, `teléfono sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Lo que el examen deja en los datos y lo que la base no permitiría (auditoría 2026-10-18: C3, B3, C 2.5 y B4) ──
{
  const c = await contexto(1280);
  const p = await c.newPage();
  // C3 y B3: el examen en línea enviado llega a la solicitud (apd.examen, origen examen_web) y a «Mis trámites»
  await p.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await p.waitForSelector('[data-filas] tr');
  const cod = await generar(p, 0);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await entraYEmpieza(ex, cod);
  await ex.evaluate((x) => APD_EXAMEN_API.pruebas.contestar(x, 'bien'), cod);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await ex.click('.examen-mapa-titulo');
  await ex.locator('.examen-numero').last().click();
  await enviar(ex);
  const enviado = (await ex.textContent('[data-resultado-datos]')).match(/Enviado\s*(\d{2}\/\d{2}\/\d{4})/);
  const r = await ex.evaluate(async (codigo) => {
    const reg = JSON.parse(localStorage.getItem(`apd.examen.c.${codigo}`));
    const d = await APD.cargar();
    const ins = d.inscripcion.find((i) => i.id === reg.inscripcion_id);
    const s = d.solicitud.find((x) => x.id === ins.solicitud_id);
    const e = d.examen.find((x) => x.inscripcion_id === ins.id);
    return { estado: s.estado, examen: e, folio: s.folio, solicitante: s.solicitante_id, grupo: ins.grupo_id, examen_en: reg.grupo.examen_en };
  }, cod);
  ok(r.estado === 'aprobada', `C3: el examen aprobado deja la solicitud aprobada (está «${r.estado}»)`);
  ok(r.examen && r.examen.origen === 'examen_web' && r.examen.calificacion === 10 && r.examen.presentado_en === r.examen_en,
    `C3: la calificación queda en apd.examen, del examen en línea, el día del examen (${JSON.stringify(r.examen)})`);
  ok(enviado && enviado[1] === r.examen_en.split('-').reverse().join('/'), `B14: «Enviado» lleva la fecha del examen, no la real (${enviado && enviado[1]})`);
  // La persona lo ve en «Mis trámites»
  await p.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), r.solicitante);
  await p.goto(`${BASE}tramites.html`);
  await p.waitForSelector('[data-solicitudes] .ficha');
  ok(/Aprobada/.test(await p.textContent('[data-solicitudes]')), 'B3: «Mis trámites» dice que aprobó');
  // Con examen ya no se da de baja (la base: baja_con_examen)
  await p.goto(`${BASE}grupo.html?folio=APD-G-2026-003`);
  await p.waitForSelector('[data-sesion-personal] a');
  const baja = await p.evaluate(async ({ folio, grupo }) => {
    await APD_PERSONAL.guardaGrupo({ tipo: 'baja', grupo_id: grupo, folio, motivo: 'Prueba de la auditoría', por: 'revision.prueba' });
    const d = await APD.cargar();
    const s = d.solicitud.find((x) => x.folio === folio);
    return { estado: s.estado, activa: d.inscripcion.some((i) => i.solicitud_id === s.id && i.activa) };
  }, { folio: r.folio, grupo: r.grupo });
  ok(baja.estado === 'aprobada' && baja.activa, `C3: quien ya presentó examen no se da de baja (${JSON.stringify(baja)})`);
  // C 2.5: quien ya tiene la calificación capturada no recibe código ni presenta otro examen
  await p.goto(`${BASE}aplicar.html?folio=APD-G-2026-006`);
  await p.waitForSelector('[data-filas] tr');
  const conCalif = await p.evaluate(async () => {
    const d = await APD.cargar();
    const g = d.grupo.find((x) => x.folio === 'APD-G-2026-006');
    const f = APD_EXAMEN_GRUPO.personas(d, g).find((x) => x.examen);
    const rechaza = await APD_EXAMEN_GRUPO.pasarLista(d, g, f, true, 'instructor.ficticio').then(() => false, () => true);
    return { ins: f.inscripcion.id, rechaza, codigos: APD_EXAMEN_API.delGrupo(g.id).filter((x) => x.inscripcion_id === f.inscripcion.id).length };
  });
  ok(conCalif.rechaza && conCalif.codigos === 0, 'C 2.5: a quien ya tiene calificación no se le pasa lista ni se le genera código');
  ok(await p.locator(`tr[data-ins="${conCalif.ins}"] [data-accion]`).count() === 0 && /calificación registrada/.test(await p.textContent(`tr[data-ins="${conCalif.ins}"]`)),
    'C 2.5: su fila dice que la calificación ya está registrada, sin «Presente» ni «No llegó»');
  // B4: un grupo que no está en curso o no existe no abre otro: se dice y se ofrecen los grupos en curso
  for (const [folio, texto] of [['APD-G-2026-001', 'no está en curso'], ['APD-G-2026-999', 'No hay un grupo']]) {
    await p.goto(`${BASE}aplicar.html?folio=${folio}`);
    await p.waitForSelector('[data-sin-grupo]:not([hidden])');
    ok((await p.textContent('[data-sin-grupo]')).includes(texto) && await p.isHidden('[data-con-grupo]') && await p.locator('[data-mis-grupos] a').count() > 0,
      `B4: aplicar.html?folio=${folio} avisa («${texto}») y ofrece los grupos en curso, sin abrir otro`);
  }
  ok(c.errores.length === 0, `datos del examen sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Otra zona horaria (auditoría 2026-10-19, B8-03): con el navegador en UTC, «Enviado» y «Mis trámites» dicen lo mismo ──
{
  const c = await contexto(1280, 'UTC');
  const p = await c.newPage();
  await p.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await p.waitForSelector('[data-filas] tr');
  const cod = await generar(p, 0);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await entraYEmpieza(ex, cod);
  await ex.evaluate((x) => APD_EXAMEN_API.pruebas.contestar(x, 'bien'), cod);
  await ex.reload();
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await ex.click('.examen-mapa-titulo');
  await ex.locator('.examen-numero').last().click();
  await enviar(ex);
  // dd/mm/aaaa y la hora, sin coma (decisión 16 b del 20/10; C5-01)
  const enviado = (await ex.textContent('[data-resultado-datos]')).match(/Enviado\s*(\d{2}\/\d{2}\/\d{4}) (\d{2}):(\d{2})/);
  const r = await ex.evaluate(async (codigo) => {
    const reg = JSON.parse(localStorage.getItem(`apd.examen.c.${codigo}`));
    const d = await APD.cargar();
    const ins = d.inscripcion.find((i) => i.id === reg.inscripcion_id);
    const s = d.solicitud.find((x) => x.id === ins.solicitud_id);
    return { estado: s.estado, solicitante: s.solicitante_id, examen_en: reg.grupo.examen_en };
  }, cod);
  // La hora de «Enviado» es la de la Ciudad de México, aunque el navegador esté en UTC (seis horas de diferencia)
  const horaCiudad = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }).format(new Date()));
  ok(enviado && enviado[1] === r.examen_en.split('-').reverse().join('/') && [horaCiudad, (horaCiudad + 23) % 24].includes(Number(enviado[2])),
    `UTC: «Enviado» lleva la fecha del examen y la hora de la Ciudad (${enviado && enviado.slice(1).join(' ')}; hora de la Ciudad ${horaCiudad})`);
  await p.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), r.solicitante);
  await p.goto(`${BASE}tramites.html`);
  await p.waitForSelector('[data-solicitudes] .ficha');
  ok(r.estado === 'aprobada' && /Aprobada/.test(await p.textContent('[data-solicitudes]')), 'UTC: «Mis trámites» dice que aprobó');
  ok(c.errores.length === 0, `UTC sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Sin conexión (ajustes del equipo, 25/10/2026: no perder el avance del examen) ──
// La falta de conexión se simula por pestaña en el servidor simulado (APD_EXAMEN_API.pruebas.conexion). Lo que ve el
// servidor se pregunta desde la pantalla de quien aplica, que sí tiene conexión.
const PEND = 'apd.examen.pendiente.';
const pendientesDe = (p, codigo) => p.evaluate((k) => Object.keys(localStorage).filter((x) => x.startsWith(k)).length, `${PEND}${codigo}.`);
const delServidor = (ap, codigo) => ap.evaluate((x) => { const v = APD_EXAMEN_API.estado(x); return v ? Object.keys(v.respuestas).length : -1; }, codigo);
{
  const c = await contexto(1280);
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('[data-filas] tr');
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);

  // 1 · Sin conexión se sigue contestando; al volver, se envía; «Enviar mis respuestas» espera a que se envíe
  const c1 = await generar(ap, 0);
  await entraYEmpieza(ex, c1);
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => document.querySelector('[data-guardado]').textContent === 'Respuesta guardada.');
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.click('[data-siguiente]');
  await ex.locator('[data-opciones] input').nth(1).check();
  await ex.waitForFunction(() => /Sin conexión por ahora/.test(document.querySelector('[data-guardado]').textContent));
  ok(await ex.locator('[data-vista="pregunta"] [data-aviso-falla]:not([hidden])').count() === 0 && await ex.isChecked('[data-opciones] input >> nth=1'),
    'sin conexión: la respuesta se queda elegida, con una línea tranquila y sin aviso de error');
  ok((await ex.textContent('[data-guardado]')).includes('se enviará cuando vuelva la conexión'), 'sin conexión: dice que se enviará cuando vuelva la conexión');
  await captura(ex, 'sin-conexion-escritorio');
  // Cambia de idea en la misma pregunta y contesta otra: sigue contestando
  await ex.locator('[data-opciones] input').nth(2).check();
  await ex.click('[data-siguiente]');
  await ex.locator('[data-opciones] input').nth(3).check();
  await ex.waitForFunction(() => /3 contestadas/.test(document.querySelector('[data-contestadas]').textContent));
  ok(await pendientesDe(ex, c1) === 2 && await delServidor(ap, c1) === 1, `sin conexión: 2 preguntas quedan en esta computadora y el servidor sólo tiene la primera (${await pendientesDe(ex, c1)}; ${await delServidor(ap, c1)})`);
  ok((await ex.textContent('[data-numero]')) === 'Pregunta 3 de 10', 'sin conexión: la persona sigue avanzando entre preguntas');
  // «Enviar mis respuestas» con pendientes: no abre la confirmación, lo explica y reintenta
  await ex.click('.examen-mapa-titulo');
  await ex.locator('.examen-numero').last().click();
  await ex.click('[data-siguiente]');
  await ex.waitForSelector('[data-vista="revision"]:not([hidden])');
  ok(/Faltan enviar 2 respuestas/.test(await ex.textContent('[data-vista="revision"] [data-aviso-falla]')), 'revisión: avisa que faltan enviar 2 respuestas');
  await ex.click('[data-enviar]');
  await ex.waitForFunction(() => /Faltan enviar 2 respuestas/.test(document.querySelector('[data-vista="revision"] [data-aviso-falla]').textContent) && document.activeElement && document.activeElement.closest('[data-aviso-falla]'));
  ok(await ex.locator('dialog.dialogo-confirma[open]').count() === 0, '«Enviar mis respuestas» con respuestas sin enviar: no se envía y lo explica');
  await captura(ex, 'sin-conexion-revision-escritorio');
  // Vuelve la conexión: se envía sola y en la revisión ya no hay aviso
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(true));
  await ex.waitForFunction((k) => !Object.keys(localStorage).some((x) => x.startsWith(k)), `${PEND}${c1}.`);
  const servidor = await ap.evaluate((x) => APD_EXAMEN_API.estado(x), c1);
  const enPantalla = await ex.evaluate(() => { const c = sessionStorage.getItem('apd.examen.abierto'); return APD_EXAMEN_API.estado(c).preguntas.map((p) => p.opciones.map((o) => o.valor)); });
  ok(Object.keys(servidor.respuestas).length === 3 && servidor.respuestas[servidor.preguntas[1].clave] === enPantalla[1][2] && servidor.respuestas[servidor.preguntas[2].clave] === enPantalla[2][3],
    'al volver la conexión se envía lo pendiente, con la última opción elegida en cada pregunta');
  await ex.waitForFunction(() => document.querySelector('[data-vista="revision"] [data-aviso-falla]').hidden);
  ok(true, 'revisión: al enviarse lo pendiente, el aviso se quita');
  await ex.click('[data-enviar]');
  ok(await ex.waitForSelector('dialog.dialogo-confirma[open]').then(() => true, () => false), 'sin pendientes, «Enviar mis respuestas» pide la confirmación');
  await ex.click('.dialogo-confirma [data-r="si"]');
  await ex.waitForSelector('[data-vista="resultado"]:not([hidden])');
  await ex.click('[data-vista="resultado"] [data-salir]');

  // 2 · Recarga sin conexión: lo pendiente se conserva; al volver, el examen se abre solo y se envía
  const c2 = await generar(ap, 0);
  await entraYEmpieza(ex, c2);
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.locator('[data-opciones] input').first().check();
  await ex.click('[data-siguiente]');
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => /2 contestadas/.test(document.querySelector('[data-contestadas]').textContent));
  await ex.reload();
  await ex.waitForSelector('[data-aviso-entrar]:not([hidden])');
  ok(/Sin conexión por ahora/.test(await ex.textContent('[data-aviso-entrar]')) && await pendientesDe(ex, c2) === 2 && await delServidor(ap, c2) === 0,
    'recarga sin conexión: lo dice y conserva en esta computadora las 2 respuestas');
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(true));
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await ex.waitForFunction((k) => !Object.keys(localStorage).some((x) => x.startsWith(k)), `${PEND}${c2}.`);
  ok(await delServidor(ap, c2) === 2 && /2 contestadas/.test(await ex.textContent('[data-contestadas]')), 'al volver la conexión, el examen se abre solo, se envía lo pendiente y sigue donde se quedó');

  // 3 · Recarga con pendientes y ya con conexión: primero se envía lo pendiente y luego se sigue
  // (el examen se abrió en la pregunta 3, la primera sin contestar)
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => /3 contestadas/.test(document.querySelector('[data-contestadas]').textContent));
  await ex.evaluate(() => sessionStorage.removeItem('apd.examen.prueba.sin_conexion')); // vuelve sin que la página se entere
  await ex.reload();
  await ex.waitForFunction(() => /Se enviaron las respuestas que habían quedado en esta computadora/.test(document.querySelector('[data-guardado]').textContent));
  ok(await delServidor(ap, c2) === 3 && await pendientesDe(ex, c2) === 0 && (await ex.textContent('[data-numero]')) === 'Pregunta 4 de 10',
    'recarga con pendientes: primero se envían y sigue en la primera pregunta sin contestar');

  // 4 · Corte de luz: la pestaña se pierde; con el mismo código en la misma computadora se envía lo pendiente
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => /4 contestadas/.test(document.querySelector('[data-contestadas]').textContent));
  await ex.close();
  await ap.evaluate((x) => localStorage.removeItem(`apd.examen.latido.${x}`), c2); // la pantalla apagada ya no avisa
  const luz = await c.newPage();
  await luz.goto(`${BASE}examen.html`);
  await luz.fill('#codigo', c2);
  await luz.click('#entrar [data-accion="enviar"]');
  await luz.waitForFunction(() => /Se enviaron las respuestas que habían quedado en esta computadora/.test(document.querySelector('[data-guardado]').textContent));
  ok(await delServidor(ap, c2) === 4 && /4 contestadas/.test(await luz.textContent('[data-contestadas]')), 'después de un corte de luz, con el mismo código en la misma computadora: se envía lo pendiente y sigue');
  await luz.close();
  ok(c.errores.length === 0, `sin conexión, sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── El reloj del examen se detiene durante un corte (decisión de Liber del 25/10/2026) ──
// La pantalla manda una señal de vida con su código; el servidor cuenta el tiempo sólo mientras llegan: más de 30 s sin
// señal y deja de contar desde la última; al volver, primero se envía lo pendiente y la señal siguiente reanuda. El reloj
// del servidor simulado se adelanta (APD_EXAMEN_API.pruebas.adelantar), así que no se espera el tiempo real: las pruebas
// esperan condiciones.
const AXE_RELOJ = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null;
async function axeEn(p, que) {
  if (!AXE_RELOJ) return;
  await p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  if (!(await p.evaluate(() => Boolean(window.axe)))) await p.evaluate(AXE_RELOJ);
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
  ok(r.length === 0, `axe ${que}:\n  ${r.join('\n  ')}`);
}
for (const ancho of [1280, 390]) {
  const donde = ancho < 600 ? 'teléfono' : 'escritorio';
  const t = (m) => `reloj durante un corte (${donde}): ${m}`;
  const c = await contexto(ancho);
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('[data-filas] tr');
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  const reg = (codigo) => ap.evaluate((x) => JSON.parse(localStorage.getItem(`apd.examen.c.${x}`)), codigo);
  const restante = (codigo) => ap.evaluate((x) => APD_EXAMEN_API.estado(x).restante_ms, codigo);
  const adelanta = (ms, conSenal) => ap.evaluate(([m, k]) => APD_EXAMEN_API.pruebas.adelantar(m, k), [ms, conSenal || null]);
  // Lo que muestra la pantalla de la persona, en segundos, y lo que dice el servidor
  const enPantalla = () => ex.evaluate(() => { const [m, s] = document.querySelector('[data-reloj-texto]').textContent.split(':').map(Number); return m * 60 + s; });
  const coincideEn = (pg, codigo) => pg.waitForFunction((x) => {
    const [m, s] = document.querySelector('[data-reloj-texto]').textContent.split(':').map(Number);
    return Math.abs(m * 60 + s - APD_EXAMEN_API.estado(x).restante_ms / 1000) <= 3;
  }, codigo, { timeout: 15000 }).then(() => true, () => false);
  const coincide = (codigo) => ex.waitForFunction((x) => {
    const [m, s] = document.querySelector('[data-reloj-texto]').textContent.split(':').map(Number);
    return Math.abs(m * 60 + s - APD_EXAMEN_API.estado(x).restante_ms / 1000) <= 3;
  }, codigo, { timeout: 15000 }).then(() => true, () => false);
  const fila = (codigo) => ap.locator('[data-filas] tr', { hasText: codigo });

  if (ancho === 1280) {
    const P = await ap.evaluate(() => APD_EXAMEN_API.parametros());
    ok(P.senal_cada_s >= 10 && P.senal_cada_s <= 15 && P.sin_senal_s === 30 && P.tope_pausa_min === 30,
      `reloj durante un corte: parámetros (señal cada ${P.senal_cada_s} s, ${P.sin_senal_s} s sin señal detienen el tiempo, tope de ${P.tope_pausa_min} minutos)`);
  }
  const k = await generar(ap, 0);
  await entraYEmpieza(ex, k);
  // La pantalla manda su señal de vida, con su código, sin que la persona haga nada
  const s0 = (await reg(k)).senal_en;
  ok(await ap.waitForFunction(([x, antes]) => JSON.parse(localStorage.getItem(`apd.examen.c.${x}`)).senal_en !== antes, [k, s0], { timeout: 20000 }).then(() => true, () => false),
    t('la pantalla manda su señal de vida al servidor cada pocos segundos'));

  // 1 · Con señal, el reloj avanza; la pantalla muestra lo que dice el servidor
  const r0 = await restante(k);
  await adelanta(5 * 60000, k);
  const r1 = await restante(k);
  ok(r0 - r1 >= 5 * 60000 && r0 - r1 < 5 * 60000 + 5000, t(`con señal, el reloj avanza: 5 minutos después quedan 5 minutos menos (${Math.round((r0 - r1) / 1000)} s)`));
  ok(await coincide(k), t('el tiempo que muestra la pantalla es el del servidor'));

  // 2 · Sin señal, el reloj no avanza
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => /el tiempo de tu examen está detenido/.test(document.querySelector('[data-aviso-tiempo]').textContent));
  const ultima = (await reg(k)).senal_en;
  await adelanta(2 * 60000);
  const r2 = await restante(k);
  await adelanta(3 * 60000);
  const r3 = await restante(k);
  ok(r3 === r2 && Math.abs(r1 - r2) < 20000, t(`sin señal, el reloj no avanza en el servidor (${Math.round(r2 / 1000)} s y ${Math.round(r3 / 1000)} s, 3 minutos después)`));
  const p1 = await enPantalla();
  await ex.waitForTimeout(1500); // el reloj de la pantalla corre cada segundo: aquí se comprueba que ya no
  ok(await enPantalla() === p1 && await ex.isVisible('[data-aviso-tiempo]'), t('sin conexión, el reloj de la pantalla se detiene y lo dice'));
  await sinDesborde(ex, t('examen con el tiempo detenido'));
  await axeEn(ex, `${t('examen con el tiempo detenido')}`);
  await captura(ex, `reloj-detenido-${donde}`);
  // Quien aplica ve «Sin conexión desde las HH:MM» y cuánto lleva detenido
  const hh = await ap.evaluate((x) => APD.hora(x), ultima);
  ok(await ap.waitForFunction(([x, h]) => { const f = [...document.querySelectorAll('[data-filas] tr')].find((tr) => tr.textContent.includes(x));
    return f && f.textContent.includes(`Sin conexión desde las ${h}`) && /Su tiempo está detenido desde hace 5 minutos/.test(f.textContent); }, [k, hh], { timeout: 8000 }).then(() => true, () => false),
  t(`quien aplica ve «Sin conexión desde las ${hh}» con el tiempo que lleva detenido`));
  ok(/contestando \(1 sin conexión\)/.test(await ap.textContent('[data-cuenta]')), t('el resumen del grupo cuenta a quien está sin conexión'));
  await sinDesborde(ap, t('aplicar con una persona sin conexión'));
  await axeEn(ap, t('aplicar con una persona sin conexión'));
  await captura(ap, `aplicar-sin-conexion-${donde}`);

  // 3 · Al volver: primero se envía lo pendiente y después la señal reanuda el tiempo; la pausa queda en la bitácora
  await ex.evaluate(() => {
    window.__orden = [];
    for (const m of ['responder', 'marcar', 'senal']) { const f = APD_EXAMEN_API[m]; APD_EXAMEN_API[m] = (...a) => { window.__orden.push(m); return f(...a); }; }
  });
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(true));
  await ex.waitForFunction(() => !/detenido/.test(document.querySelector('[data-aviso-tiempo]').textContent) && !Object.keys(localStorage).some((x) => x.startsWith('apd.examen.pendiente.')));
  const orden = await ex.evaluate(() => window.__orden.join(','));
  const b1 = (await reg(k)).bitacora.filter((b) => b.evento === 'pausa');
  ok(/^responder,.*senal/.test(orden) && orden.indexOf('senal') > orden.indexOf('responder'), t(`al volver, primero se envía lo pendiente y después la señal que reanuda (${orden})`));
  ok(b1.length === 1 && b1[0].inicio === ultima && b1[0].duracion_ms >= 5 * 60000 && b1[0].detenido_ms === b1[0].duracion_ms && b1[0].fin > b1[0].inicio,
    t(`la pausa queda en la bitácora del examen con su inicio, fin y duración (${JSON.stringify(b1[0])})`));
  const r4 = await restante(k);
  ok(r4 <= r3 && r3 - r4 < 20000 && await coincide(k), t('al volver, el tiempo sigue desde donde se detuvo y la pantalla muestra el del servidor'));
  ok(await ap.waitForFunction((x) => { const f = [...document.querySelectorAll('[data-filas] tr')].find((tr) => tr.textContent.includes(x));
    return f && /Estuvo sin conexión 1 vez; tiempo detenido: 5 minutos/.test(f.textContent) && !f.textContent.includes('Sin conexión desde'); }, k, { timeout: 8000 }).then(() => true, () => false),
  t('quien aplica ve que estuvo sin conexión y cuánto tiempo se detuvo'));

  // 4 · El tope de la pausa acumulada (30 minutos) se respeta: después, el tiempo vuelve a correr y decide quien aplica
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await ex.click('[data-siguiente]');
  await ex.locator('[data-opciones] input').first().check();
  await ex.waitForFunction(() => /el tiempo de tu examen está detenido/.test(document.querySelector('[data-aviso-tiempo]').textContent));
  await adelanta(60000);
  const rA = await restante(k);
  await adelanta(39 * 60000); // 40 minutos sin conexión: con los 5 de antes, el tope se pasa a los 25
  const rB = await restante(k);
  await adelanta(60000);
  const rC = await restante(k);
  ok(rA - rB >= 15 * 60000 && rA - rB < 15 * 60000 + 30000, t(`el tope se respeta: de 40 minutos sin conexión sólo se detienen 25 (con los 5 de antes, 30) y los otros 15 corren (${Math.round((rA - rB) / 1000)} s)`));
  ok(rB - rC >= 60000 && rB - rC < 62000, t('después del tope, el tiempo corre aunque siga sin conexión'));
  ok(await ap.waitForFunction((x) => { const f = [...document.querySelectorAll('[data-filas] tr')].find((tr) => tr.textContent.includes(x));
    return f && /Pasó el tope de 30 minutos de tiempo detenido: su tiempo volvió a correr\. Decida si espera o suspende el examen\./.test(f.textContent) && f.textContent.includes('Sin conexión desde'); }, k, { timeout: 8000 }).then(() => true, () => false),
  t('quien aplica ve que pasó el tope y que decide'));
  await axeEn(ap, t('aplicar con el tope pasado'));
  await ex.evaluate(() => APD_EXAMEN_API.pruebas.conexion(true));
  await ex.waitForFunction(() => !/detenido/.test(document.querySelector('[data-aviso-tiempo]').textContent) && !Object.keys(localStorage).some((x) => x.startsWith('apd.examen.pendiente.')));
  const b2 = (await reg(k)).bitacora.filter((b) => b.evento === 'pausa');
  const total = b2.reduce((n, b) => n + b.detenido_ms, 0);
  ok(b2.length === 2 && b2[1].duracion_ms >= 41 * 60000 && b2[1].detenido_ms < b2[1].duracion_ms && b2[1].tope_en && total === 30 * 60000,
    t(`la segunda pausa queda en la bitácora con cuándo pasó el tope; en total se detuvieron 30 minutos (${Math.round(total / 60000)})`));
  ok(await coincide(k), t('después del tope, la pantalla también muestra el tiempo del servidor'));

  // 5 · A la pantalla se le acabó el tiempo pero el servidor lo tuvo detenido: el examen sigue
  const v = await ap.evaluate((x) => APD_EXAMEN_API.terminar(x, 'tiempo'), k);
  ok(v.situacion === 'contestando' && v.restante_ms > 0, t('«se acabó el tiempo» lo decide el servidor: si le queda tiempo, el examen sigue'));

  await ex.close();

  // 6 · Corte de luz (otra persona): la pantalla se apaga y no manda señal; al volver con el mismo código, en la misma
  // computadora, primero se envía lo que quedó pendiente y luego se reanuda
  const k2 = await generar(ap, 0);
  const antes = await c.newPage();
  await antes.goto(`${BASE}examen.html`);
  await entraYEmpieza(antes, k2);
  await antes.evaluate(() => APD_EXAMEN_API.pruebas.conexion(false));
  await antes.locator('[data-opciones] input').first().check();
  await antes.waitForFunction(() => /el tiempo de tu examen está detenido/.test(document.querySelector('[data-aviso-tiempo]').textContent));
  await antes.close();
  await ap.evaluate((x) => localStorage.removeItem(`apd.examen.latido.${x}`), k2); // la pantalla apagada ya no avisa
  const antesLuz = (await reg(k2)).senal_en;
  await adelanta(4 * 60000);
  const rL = await restante(k2);
  await adelanta(60000);
  ok(await restante(k2) === rL, t('con la pantalla apagada (corte de luz), el reloj del servidor no avanza'));
  const luz = await c.newPage();
  await luz.goto(`${BASE}examen.html`);
  await luz.fill('#codigo', k2);
  await luz.click('#entrar [data-accion="enviar"]');
  await luz.waitForFunction(() => /Se enviaron las respuestas que habían quedado en esta computadora/.test(document.querySelector('[data-guardado]').textContent));
  await ap.waitForFunction(([x, a]) => { const r = JSON.parse(localStorage.getItem(`apd.examen.c.${x}`)); return r.senal_en !== a && r.bitacora.some((b) => b.evento === 'pausa'); }, [k2, antesLuz], { timeout: 15000 });
  const b3 = (await reg(k2)).bitacora.filter((b) => b.evento === 'pausa');
  ok(b3.length === 1 && b3[0].inicio === antesLuz && b3[0].duracion_ms >= 5 * 60000 && b3[0].detenido_ms === b3[0].duracion_ms && Object.keys((await reg(k2)).respuestas).length === 1,
    t('después del corte de luz, con el mismo código: se envía lo pendiente, el tiempo se reanuda y la pausa queda en la bitácora'));
  ok(await coincideEn(luz, k2), t('después del corte de luz, la pantalla muestra el tiempo del servidor'));
  await luz.close();
  ok(c.errores.length === 0, t(`sin errores en la consola:\n  ${c.errores.join('\n  ')}`));
  await c.close();
}

// ── Lectura en voz alta (ajustes del equipo, 25/10/2026), con speechSynthesis simulado ──
/* Síntesis de voz simulada: guarda lo que se le pide leer (window.__habla) y cuántas veces se detiene (window.__detiene).
   voces = null: el navegador no tiene speechSynthesis */
function vozSimulada(voces) {
  window.__habla = [];
  window.__detiene = 0;
  if (voces === null) { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); return; }
  const s = {
    getVoices: () => voces,
    speak: (u) => window.__habla.push({ texto: u.text, lang: u.lang, rate: u.rate }),
    cancel: () => { window.__detiene += 1; },
    addEventListener: () => {}
  };
  Object.defineProperty(window, 'speechSynthesis', { value: s, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
}
const habla = (p) => p.evaluate(() => window.__habla.map((x) => x.texto));
for (const ancho of [390, 1280]) {
  const donde = ancho < 600 ? 'teléfono' : 'escritorio';
  const c = await contexto(ancho);
  await c.addInitScript(vozSimulada, [{ lang: 'en-US', name: 'Inglés' }, { lang: 'es-ES', name: 'España' }, { lang: 'es-MX', name: 'México' }]);
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('[data-filas] tr');
  const cod = await generar(ap, 0);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await ex.waitForSelector('#entrar [data-voz]:not([hidden])');
  await ex.click('#entrar [data-leer="entrar"]');
  ok((await habla(ex))[0] === 'Entra a tu examen.' && (await habla(ex)).some((t) => /levanta la mano/.test(t)), `${donde}: lee las instrucciones de la entrada`);
  await ex.fill('#codigo', cod);
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await ex.click('[data-vista="confirmar"] [data-leer="confirmar"]');
  const nombre = await ex.evaluate(() => document.querySelector('[data-persona] .datos-valor').textContent);
  ok((await habla(ex)).includes('¿Eres tú?') && (await habla(ex)).includes(`Nombre: ${nombre}.`), `${donde}: lee «¿Eres tú?» con el nombre de la persona`);
  await ex.click('[data-ir-vista="instrucciones"]');
  await ex.waitForSelector('[data-vista="instrucciones"]:not([hidden])');
  await ex.click('[data-vista="instrucciones"] [data-leer="instrucciones"]');
  const instr = await habla(ex);
  ok(instr.includes('Antes de empezar.') && instr.some((t) => /^Son 10 preguntas/.test(t)) && instr.some((t) => /Si se va el internet/.test(t)), `${donde}: lee las instrucciones de inicio del examen`);
  await ex.click('[data-empezar]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await captura(ex, `voz-pregunta-${donde}`);
  await sinDesborde(ex, `examen ${donde} · pregunta con lectura en voz alta`);
  // «Escuchar la pregunta»: la pregunta y sus opciones con su letra, en es-MX y más despacio
  await ex.evaluate(() => { window.__habla = []; });
  await ex.click('[data-vista="pregunta"] [data-leer="pregunta"]');
  const esperado = await ex.evaluate(() => [document.querySelector('[data-numero]').textContent + '.', document.querySelector('[data-enunciado]').textContent,
    ...[...document.querySelectorAll('[data-opciones] .opcion-nombre')].map((o) => `Opción ${o.querySelector('.examen-letra').textContent.replace(')', '')}: ${o.textContent.replace(/^[a-d]\)\s*/, '')}`)]);
  const dicho = await ex.evaluate(() => window.__habla);
  ok(JSON.stringify(dicho.map((x) => x.texto)) === JSON.stringify(esperado), `${donde}: «Escuchar la pregunta» lee la pregunta y sus cuatro opciones con su letra (${JSON.stringify(dicho.map((x) => x.texto)).slice(0, 160)})`);
  ok(dicho.every((x) => x.lang === 'es-MX' && x.rate > 0 && x.rate < 1), `${donde}: con la voz es-MX y un poco más despacio (${dicho[0] && dicho[0].lang}, ${dicho[0] && dicho[0].rate})`);
  // Cada opción, sola; escucharla no la elige
  ok(await ex.locator('[data-opciones] [data-leer-opcion]').count() === 4, `${donde}: cada opción tiene su botón «Escuchar»`);
  await ex.evaluate(() => { window.__habla = []; });
  await ex.click('[data-opciones] [data-leer-opcion="1"]');
  ok((await habla(ex)).join('|') === esperado[3] && !(await ex.isChecked('[data-opciones] input >> nth=1')), `${donde}: el «Escuchar» de la opción b la lee sola y no la elige`);
  ok(await ex.getAttribute('[data-leer-opcion="1"]', 'aria-label') === 'Escuchar la opción b', `${donde}: el botón de cada opción dice cuál lee (para el lector de pantalla)`);
  // Detener; y al cambiar de pregunta se detiene lo que se leía
  let antes = await ex.evaluate(() => window.__detiene);
  await ex.click('[data-vista="pregunta"] [data-detener]');
  ok(await ex.evaluate(() => window.__detiene) > antes, `${donde}: «Detener la lectura» la detiene`);
  antes = await ex.evaluate(() => window.__detiene);
  await ex.click('[data-siguiente]');
  ok(await ex.evaluate(() => window.__detiene) > antes && (await ex.textContent('[data-numero]')) === 'Pregunta 2 de 10', `${donde}: al cambiar de pregunta se detiene la lectura`);
  // Con el teclado: Tab hasta «Escuchar la pregunta» e Intro
  await ex.evaluate(() => { window.__habla = []; document.querySelector('[data-tarjeta-pregunta]').focus(); });
  for (let i = 0; i < 6 && !(await ex.evaluate(() => document.activeElement && document.activeElement.dataset.leer === 'pregunta')); i++) await ex.keyboard.press('Tab');
  await ex.keyboard.press('Enter');
  ok((await habla(ex))[0] === 'Pregunta 2 de 10.', `${donde}: con el teclado, Tab hasta «Escuchar la pregunta» e Intro la lee`);
  ok(c.errores.length === 0, `${donde}: lectura en voz alta sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}
// Sin voz en español (sólo inglés) o sin síntesis de voz: no hay botones y quien aplica ve el aviso; con es-ES, se usa ésa
for (const [voces, que] of [[[{ lang: 'en-US', name: 'Inglés' }], 'sin voz en español'], [null, 'sin síntesis de voz'], [[{ lang: 'es-ES', name: 'España' }], 'con es-ES']]) {
  const c = await contexto(1280);
  await c.addInitScript(vozSimulada, voces);
  const ap = await c.newPage();
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await ap.waitForSelector('[data-filas] tr');
  const cod = await generar(ap, 0);
  const ex = await c.newPage();
  await ex.goto(`${BASE}examen.html`);
  await entraYEmpieza(ex, cod);
  if (que === 'con es-ES') {
    await ex.waitForSelector('[data-vista="pregunta"] [data-voz]:not([hidden])');
    await ex.click('[data-vista="pregunta"] [data-leer="pregunta"]');
    ok(await ex.evaluate(() => window.__habla.length > 0 && window.__habla.every((x) => x.lang === 'es-ES')), 'sin es-MX, lee con otra voz en español (es-ES)');
  } else {
    await ap.waitForFunction((x) => (document.querySelector(`[data-filas] tr:has(.examen-codigo)`) || {}).textContent && [...document.querySelectorAll('[data-filas] tr')].some((tr) => tr.textContent.includes(x) && tr.textContent.includes('Esta computadora no puede leer en voz alta')), cod, { timeout: 10000 }).catch(() => {});
    const fila = await ap.locator('[data-filas] tr', { hasText: cod }).textContent();
    ok(await ex.locator('[data-voz]:not([hidden]), [data-leer-opcion]').count() === 0, `${que}: no aparecen los botones de lectura`);
    ok(fila.includes('Esta computadora no puede leer en voz alta'), `${que}: quien aplica ve «Esta computadora no puede leer en voz alta» en la fila de la persona`);
    if (que === 'sin voz en español') await captura(ap, 'aplicar-sin-voz-escritorio');
  }
  ok(c.errores.length === 0, `${que}: sin errores en la consola:\n  ${c.errores.join('\n  ')}`);
  await c.close();
}

// ── Accesibilidad con axe-core en cada pantalla del examen y en la de quien aplica ──
if (process.env.AXE) {
  const axe = readFileSync(process.env.AXE, 'utf8');
  const c = await contexto(390);
  // Con voz en español simulada: axe revisa también los botones de lectura en voz alta
  await c.addInitScript(vozSimulada, [{ lang: 'es-MX', name: 'México' }]);
  const p = await c.newPage();
  const revisa = async (que) => {
    await p.emulateMedia({ reducedMotion: 'reduce' }); // sin transiciones a medias al medir el contraste
    await p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await p.evaluate(axe); // por el protocolo del navegador: la política de contenido no deja scripts en línea
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
    ok(r.length === 0, `axe ${que}:\n  ${r.join('\n  ')}`);
  };
  await p.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`);
  await p.waitForSelector('[data-filas] tr');
  await p.locator('[data-accion="presente"]').first().click();
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
