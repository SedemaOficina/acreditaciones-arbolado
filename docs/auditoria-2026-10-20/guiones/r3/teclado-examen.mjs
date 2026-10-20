// B4 · Examen en el salón sólo con teclado (con el escenario de volumen: grupo APD-G-2026-020, examen hoy).
// Pase de lista con Enter en «Presente», el código en «Entra a tu examen», «¿Eres tú?», instrucciones, 10 preguntas
// (flechas para elegir, Enter en «Siguiente»), revisión y envío. Foco tras cada paso, anuncios (el reloj no debe
// anunciarse cada segundo), barra fija del examen y axe en cada vista. Uso: node teclado-examen.mjs [ancho] [corrida]
import { navegador, contexto, BASE, guarda, axe } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, activo, focos, anuncios, dondeFoco } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 1440);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const R = { ancho, corrida, eventos: [], axe: [] };
const ev = (x) => { R.eventos.push(x); console.log(x); };
const ax = async (p, que) => { const v = await axe(p); R.axe.push({ que, v }); ev(`axe ${que}: ${v.length ? v.map((x) => `${x.id}(${x.n}) ${x.nodos[0].html.slice(0, 100)}`).join(' | ') : '0'}`); };
const tabHasta = async (p, re, max = 40, atras = false) => { for (let i = 0; i < max; i++) { await p.keyboard.press(atras ? 'Shift+Tab' : 'Tab'); const a = await activo(p); if (re.test(a.texto) || re.test(a.desc)) return i + 1; } return null; };

const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, vol: true });
await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
const a = await c.newPage();
await a.goto(BASE + 'aplicar.html?folio=APD-G-2026-020', { waitUntil: 'networkidle' }); await a.waitForTimeout(400);
ev(`Tabs hasta el primer «Presente»: ${await tabHasta(a, /presente, generar/)}`);
await a.keyboard.press('Enter'); await a.waitForTimeout(700);
const codigo = await a.evaluate(() => { const m = document.body.innerText.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/); return m ? m[0] : null; });
ev(`código: ${codigo}`);
const q = await c.newPage();
await q.goto(BASE + 'examen.html', { waitUntil: 'networkidle' }); await q.waitForTimeout(300);
ev(`Tabs hasta el código: ${await tabHasta(q, /Código del examen/)}`);
await q.keyboard.type(codigo, { delay: 20 }); await q.keyboard.press('Enter'); await q.waitForTimeout(900);
ev(`Enter en el campo del código → foco: ${await dondeFoco(q)}`);
await ax(q, '¿Eres tú?');
ev(`Tabs hasta «Sí, soy yo»/continuar: ${await tabHasta(q, /^Sí|soy yo|Continuar/i)} (${await dondeFoco(q)})`);
await q.keyboard.press('Enter'); await q.waitForTimeout(800);
ev(`→ foco: ${await dondeFoco(q)}`);
await ax(q, 'instrucciones');
ev(`Tabs hasta «Empezar el examen»: ${await tabHasta(q, /Empezar el examen/)}`);
await q.keyboard.press('Enter'); await q.waitForTimeout(900);
ev(`→ foco al empezar: ${await dondeFoco(q)}`);
ev(`reloj: ${await q.evaluate(() => { const r = document.querySelector('[data-reloj]'); return `aria-live=${r.getAttribute('aria-live')} dentro de región viva: ${Boolean(r.closest('[aria-live],[role=status],[role=timer]'))} «${r.textContent.trim()}»`; })}`);
await ax(q, 'pregunta 1');
await anuncios(q);
for (let i = 0; i < 10; i++) {
  const tabsOp = await tabHasta(q, /opcion|radio/, 20);
  await q.keyboard.press('ArrowDown'); await q.waitForTimeout(250);
  const marcada = await q.evaluate(() => Boolean(document.querySelector('[data-opciones] input:checked')));
  const tabsSig = await tabHasta(q, /^Siguiente|^Revisar/, 15);
  await q.keyboard.press('Enter'); await q.waitForTimeout(500);
  const f = await activo(q);
  const m = await q.evaluate(() => window.__r3mide(document.activeElement));
  ev(`pregunta ${i + 1}: ${tabsOp} Tabs a la opción (marcada con flecha: ${marcada}), ${tabsSig} a «Siguiente»; foco después: ${f.desc.slice(0, 70)}; tapado ${m.tapado} ${m.tapadoPor || ''}`);
  if (/Revisa antes/.test(f.desc) || await q.isVisible('[data-vista="revision"]')) break;
}
const an = await anuncios(q);
ev(`anuncios durante las preguntas: ${an.length}; con la hora del reloj: ${an.filter((x) => /\d+:\d\d/.test(x.texto)).length}; ejemplos: ${JSON.stringify(an.slice(0, 6).map((x) => x.texto.slice(0, 60)))}`);
await ax(q, 'revisar antes de enviar');
await q.screenshot({ path: `../capturas/teclado-examen-revision-${ancho}-${corrida}.png` });
ev(`Tabs hasta «Enviar»: ${await tabHasta(q, /^Enviar/)}`);
await q.keyboard.press('Enter'); await q.waitForTimeout(900);
const f = await activo(q);
ev(`tras «Enviar»: foco ${f.desc} (diálogo ${f.enDialogo})`);
if (f.enDialogo) { await ax(q, 'confirmación de envío'); await q.locator('dialog[open] button', { hasText: /^Sí/ }).first().focus(); await q.keyboard.press('Enter'); await q.waitForTimeout(1200); }
ev(`resultado: foco ${await dondeFoco(q)}; anuncios ${JSON.stringify((await anuncios(q)).map((x) => x.texto.slice(0, 80)))}`);
await ax(q, 'resultado del examen');
await q.screenshot({ path: `../capturas/teclado-examen-resultado-${ancho}-${corrida}.png` });
R.focos = await focos(q);
guarda(`teclado-examen-${ancho}-${corrida}.json`, R);
await nav.close();
