import { navegador, contexto, BASE, datos } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, anuncios, dondeFoco, activo } from './teclado-lib.mjs';
const nav = await navegador();
for (const ancho of [390, 1440]) for (const corrida of [1, 2]) {
const s = datos.solicitante.find((x) => x.estado === 'activa');
const { c } = await contexto(nav, { ancho, sesion: s.id }); await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
const p = await c.newPage(); await p.goto(BASE + 'datos.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
const orden = [];
for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const a = await activo(p); orden.push(a.desc.slice(0, 50)); if (a.id === 'telefono') break; }
await p.keyboard.press('Control+A'); await p.keyboard.type('0000000088');
for (let i = 0; i < 10; i++) { await p.keyboard.press('Tab'); const a = await activo(p); if (/Guardar/.test(a.texto)) break; }
const b = await dondeFoco(p); await anuncios(p);
await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
console.log(ancho, corrida, 'Tabs a teléfono', orden.length, '| botón:', b, '→ foco', await dondeFoco(p), '| anuncios', JSON.stringify((await anuncios(p)).map(a => a.texto.slice(0, 80))));
await c.close(); }
await nav.close();
