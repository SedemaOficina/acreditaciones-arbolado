// B4 · Reproducción: en «Programar un curso», cada flecha dentro del mismo mes vuelve a escribir el nombre del mes en
// la región viva (aria-live) del calendario. Uso: node repro-calendario-anuncios.mjs <corrida>
import { navegador, contexto, BASE, guarda } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, anuncios, activo } from './teclado-lib.mjs';
const corrida = process.argv[2] || '1';
const nav = await navegador();
const R = [];
for (const ancho of [1440, 390]) {
  const { c } = await contexto(nav, { ancho, alto: 900 }); await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
  const p = await c.newPage(); await p.goto(BASE + 'programar.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  for (let t = 0; t < 60; t++) { await p.keyboard.press('Tab'); if (/cal-dia/.test((await activo(p)).desc)) break; }
  await anuncios(p);
  const fila = [];
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) { await p.keyboard.press(k); await p.waitForTimeout(250); const a = await anuncios(p); fila.push({ tecla: k, dia: (await activo(p)).texto.slice(0, 40), anuncios: a.map((x) => x.texto) }); }
  R.push({ ancho, fila }); console.log(ancho, JSON.stringify(fila));
  await c.close();
}
guarda(`repro-calendario-anuncios-${corrida}.json`, R);
await nav.close();
