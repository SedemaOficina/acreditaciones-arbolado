// B4 · Foco tras enviar en «Entrar» (error y contraseña equivocada), «Verificar» (vigente, inexistente) y «Mi perfil»
// (guardar contacto), sólo con teclado (focus + Enter). Uso: node foco-resultados.mjs <ancho> <corrida>
import { navegador, contexto, BASE, guarda, axe, datos } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, anuncios, dondeFoco, teclas } from './teclado-lib.mjs';
const ancho = Number(process.argv[2] || 390), corrida = process.argv[3] || '1';
const nav = await navegador(); const R = []; const ev = (x) => { R.push(x); console.log(x); };
const nueva = async (s) => { const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion: s }); await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios); return { c, p: await c.newPage() }; };
const per = datos.solicitante.find((x) => x.estado === 'activa');
{ const { c, p } = await nueva(); await p.goto(BASE + 'entrar.html', { waitUntil: 'networkidle' });
  await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(600); ev(`entrar vacío → ${await dondeFoco(p)}`);
  await teclas(p, '#curp', `texto:${per.curp}`); await teclas(p, '#contrasena', 'texto:equivocada-1234'); await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(1200);
  ev(`entrar contraseña equivocada → ${await dondeFoco(p)}; anuncios ${JSON.stringify((await anuncios(p)).map((a) => a.tipo + ': ' + a.texto))}`);
  const v = await axe(p); ev(`axe: ${v.map((x) => x.id).join(',') || 0}`); await c.close(); }
for (const num of [datos.verificacion_publica[0].numero, 'PD-2026-9999']) { const { c, p } = await nueva(); await p.goto(BASE + 'verificar.html', { waitUntil: 'networkidle' });
  await teclas(p, '#numero', `texto:${num}`, 'Enter'); await p.waitForTimeout(900);
  ev(`verificar ${num} → foco ${await dondeFoco(p)}; anuncios ${JSON.stringify((await anuncios(p)).map((a) => a.tipo + ': ' + a.texto.slice(0, 90)))}`);
  const v = await axe(p); ev(`axe: ${v.map((x) => x.id).join(',') || 0}`); await c.close(); }
{ const s = datos.solicitante.find((x) => x.estado === 'activa'); const { c, p } = await nueva(s.id); await p.goto(BASE + 'datos.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  const btn = await p.$$eval('form button[type=submit], form [data-accion="enviar"]', (l) => l.map((b) => b.closest('form').id + ':' + b.textContent.trim()));
  ev(`Mi perfil, botones de guardar: ${btn.join(' | ')}`);
  await teclas(p, '#telefono', 'Control+A', 'texto:0000000088');
  await p.locator('#telefono').evaluate((i) => i.closest('form').querySelector('[data-accion="enviar"]').focus()); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  ev(`Mi perfil, guardar contacto → foco ${await dondeFoco(p)}; anuncios ${JSON.stringify((await anuncios(p)).map((a) => a.tipo + ': ' + a.texto.slice(0, 90)))}`);
  const v = await axe(p); ev(`axe: ${v.map((x) => x.id).join(',') || 0}`); await c.close(); }
guarda(`foco-resultados-${ancho}-${corrida}.json`, R); await nav.close();
