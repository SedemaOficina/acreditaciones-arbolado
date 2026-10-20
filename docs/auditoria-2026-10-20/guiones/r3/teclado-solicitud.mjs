// B4 · Flujo con teclado: solicitud nueva de poda con carga de los 4 documentos (sólo Tab, flechas, Espacio y Enter),
// foco tras cada «Siguiente», tras cada carga y tras enviar; anuncios de las regiones vivas; axe en cada paso y en el
// acuse; después «Cargar el documento correcto» (corregir) de una cita en pausa.
// Uso: node teclado-solicitud.mjs [390|1440] [corrida]
import { navegador, contexto, BASE, guarda, axe, datos } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, llenaConTeclado, activo, focos, anuncios, PDF, dondeFoco } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 390);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const R = { ancho, corrida, eventos: [], axe: [] };
const ev = (x) => { R.eventos.push(x); console.log(x); };
const ax = async (p, que) => { const v = await axe(p); R.axe.push({ que, v }); ev(`axe ${que}: ${v.length ? v.map((x) => `${x.id}(${x.n}) ${x.nodos[0].html.slice(0, 100)}`).join(' | ') : '0'}`); };

// Preparación (no es parte de la prueba de teclado): una cuenta nueva con la página, como en probar-sitio
const { c, errores } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900 });
await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
const p = await c.newPage();
await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' });
await p.click('.menu-pruebas-boton'); await p.click('text=Llenar con datos ficticios'); await p.waitForTimeout(800);
await p.keyboard.press('Escape');
await p.click('[data-accion="enviar"]'); await p.waitForSelector('[data-acuse]:not([hidden])', { timeout: 10000 });
ev('cuenta de prueba creada (preparación con el menú de pruebas)');

// Solicitud con teclado
await p.goto(BASE + 'solicitud.html?tipo=poda', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
await anuncios(p);
const paso1 = await llenaConTeclado(p, { radio: { tipo: 'poda' }, select: { nivel_estudios: 'tecnica' }, texto: { carrera_tecnica: 'Técnico en jardinería' }, parar: /^Siguiente|^Continuar/ });
ev(`paso 1: ${paso1.pasos.length} Tabs hasta ${paso1.parado}`);
await p.keyboard.press('Enter'); await p.waitForTimeout(700);
ev(`foco tras «Siguiente» (paso 1→2): ${await dondeFoco(p)}`);
await ax(p, 'paso 2 documentos');
const archivos = {}; for (const k of ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal']) archivos[`doc_poda_nueva_${k}`] = PDF(k);
const paso2 = await llenaConTeclado(p, { archivos, parar: /^Siguiente|^Continuar/ });
for (const x of paso2.pasos.filter((s) => s.startsWith('  ↳'))) ev(x);
ev(`paso 2: ${paso2.pasos.length} Tabs hasta ${paso2.parado}`);
ev(`anuncios durante la carga: ${JSON.stringify((await anuncios(p)).map((a) => `${a.tipo}: ${a.texto}`))}`);
await ax(p, 'paso 2 con 4 documentos cargados');
await p.keyboard.press('Enter'); await p.waitForTimeout(700);
ev(`foco tras «Siguiente» (paso 2→3): ${await dondeFoco(p)}`);
await ax(p, 'paso 3 revisión');
const paso3 = await llenaConTeclado(p, { casilla: ['protesta', 'aviso', 'humano'], parar: /^Enviar/ });
ev(`paso 3: ${paso3.pasos.length} Tabs hasta ${paso3.parado}`);
await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
ev(`foco tras enviar: ${await dondeFoco(p)}; acuse visible: ${await p.isVisible('[data-acuse]')}`);
ev(`anuncios al enviar: ${JSON.stringify((await anuncios(p)).map((a) => `${a.tipo}: ${a.texto}`))}`);
await ax(p, 'acuse de la solicitud');
await p.screenshot({ path: `../capturas/teclado-solicitud-acuse-${ancho}-${corrida}.png` });
R.focosSolicitud = await focos(p);

// Corregir (cita en pausa de APD-S-2026-00052)
const s = datos.solicitud.find((x) => x.folio === 'APD-S-2026-00052');
await p.evaluate((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), s.solicitante_id);
await p.goto(BASE + `corregir.html?folio=${s.folio}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
ev(`corregir: foco al abrir: ${await dondeFoco(p)}`);
await anuncios(p);
const camp = await p.$$eval('[data-campo^="doc_"]', (l) => l.filter((x) => x.checkVisibility()).map((x) => x.dataset.campo));
const arch = {}; for (const k of camp) arch[k] = PDF(k);
const cor = await llenaConTeclado(p, { archivos: arch, parar: /^Enviar|^Cargar|^Mandar/ });
for (const x of cor.pasos.filter((q) => q.startsWith('  ↳'))) ev(x);
ev(`corregir: ${cor.pasos.length} Tabs hasta ${cor.parado}; campos ${camp.join(', ')}`);
ev(`anuncios al cargar: ${JSON.stringify((await anuncios(p)).map((a) => `${a.tipo}: ${a.texto}`))}`);
await p.keyboard.press('Enter'); await p.waitForTimeout(2000);
ev(`corregir: foco tras enviar: ${await dondeFoco(p)}`);
ev(`anuncios al enviar: ${JSON.stringify((await anuncios(p)).map((a) => `${a.tipo}: ${a.texto}`))}`);
await ax(p, 'corregir: resultado');
await p.screenshot({ path: `../capturas/teclado-corregir-resultado-${ancho}-${corrida}.png` });
R.focosCorregir = await focos(p);
R.errores = errores;
guarda(`teclado-solicitud-${ancho}-${corrida}.json`, R);
const malos = [...R.focosSolicitud, ...R.focosCorregir].filter((f) => f.indicador === 'NINGUNO' || f.tapado === 'TOTAL' || (f.contrasteAnillo && f.contrasteAnillo < 3) || !f.dentro);
ev(`focos con problema: ${malos.length}`); for (const m of malos.slice(0, 10)) ev(`  ${m.el} · ${m.indicador} · ${m.tapado} ${m.tapadoPor || ''} · dentro ${m.dentro}`);
await nav.close();
