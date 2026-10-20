// B4 · «Mi perfil» con teclado: «Cambiar» (contacto), editar el teléfono, «Guardar cambios» y «Cancelar»: a dónde va el
// foco y qué se anuncia. Uso: node repro-perfil.mjs <corrida>
import { navegador, contexto, BASE, datos, guarda, axe } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, anuncios, dondeFoco, activo } from './teclado-lib.mjs';
const corrida = process.argv[2] || '1';
const nav = await navegador(); const R = [];
const tabHasta = async (p, f, max = 60) => { for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); const a = await activo(p); if (f(a)) return i + 1; } return null; };
for (const ancho of [390, 1440]) for (const accion of ['guardar', 'cancelar']) {
  const s = datos.solicitante.find((x) => x.estado === 'activa');
  const { c } = await contexto(nav, { ancho, sesion: s.id }); await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
  const p = await c.newPage(); await p.goto(BASE + 'datos.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  const t1 = await tabHasta(p, (a) => /Cambiar.*contacto|contacto/i.test(a.texto) && a.tag === 'BUTTON');
  const boton = await dondeFoco(p);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const trasCambiar = await dondeFoco(p);
  const t2 = await tabHasta(p, (a) => a.id === 'telefono', 20);
  await p.keyboard.press('Control+A'); await p.keyboard.type('0000000088');
  const t3 = await tabHasta(p, (a) => (accion === 'guardar' ? /^Guardar cambios/ : /^Cancelar/).test(a.texto), 15);
  await anuncios(p);
  await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  const r = { ancho, accion, tabsHastaCambiar: t1, boton, focoTrasCambiar: trasCambiar, tabsHastaTelefono: t2, tabsHastaBoton: t3, focoFinal: await dondeFoco(p), anuncios: (await anuncios(p)).map((a) => `${a.tipo}: ${a.texto.slice(0, 90)}`), axe: (await axe(p)).map((v) => v.id) };
  R.push(r); console.log(JSON.stringify(r));
  await c.close();
}
guarda(`repro-perfil-${corrida}.json`, R); await nav.close();
