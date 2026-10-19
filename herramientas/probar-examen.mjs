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

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

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
  const enviado = (await ex.textContent('[data-resultado-datos]')).match(/Enviado\s*(\d{2}\/\d{2}\/\d{4}), (\d{2}):(\d{2})/);
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
