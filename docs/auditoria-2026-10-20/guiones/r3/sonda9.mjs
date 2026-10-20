import { navegador, contexto, BASE } from './lib.mjs';
import { registroDeFoco, activo } from './teclado-lib.mjs';
const nav = await navegador();
const ancho = Number(process.argv[2] || 1440);
const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900 }); await c.addInitScript(registroDeFoco);
const p = await c.newPage();
await p.goto(BASE + 'revisar.html?folio=APD-S-2026-00044', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
// Tab hasta «Ver documento» del primero
let n = 0; for (; n < 60; n++) { await p.keyboard.press('Tab'); const a = await activo(p); if (/Ver documento/.test(a.texto)) break; }
console.log('Tabs hasta el primer «Ver documento»:', n + 1);
await p.keyboard.press('Enter'); await p.waitForTimeout(600);
console.log('al abrir:', (await activo(p)).desc, 'modal:', await p.evaluate(() => document.querySelector('dialog[data-visor]').matches(':modal')));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('Escape inmediato →', (await activo(p)).desc, 'abierto:', await p.evaluate(() => document.querySelector('dialog[data-visor]').open));
// reabrir y volver con Mayús+Tab hasta las opciones de ese documento
await p.locator('[data-ver="identificacion_oficial"]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
let k = 0; const ruta = []; for (; k < 80; k++) { await p.keyboard.press('Shift+Tab'); const a = await activo(p); ruta.push(a.desc.slice(0, 35)); if (a.name === 'decision_identificacion_oficial') break; }
console.log('Mayús+Tab desde el visor hasta «Sí, aceptarlo» del mismo documento:', k + 1, ruta.slice(0, 8).join(' ← '));
let j = 0; await p.locator('[data-ver="identificacion_oficial"]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
for (; j < 120; j++) { await p.keyboard.press('Tab'); const a = await activo(p); if (a.name === 'decision_identificacion_oficial') break; }
console.log('Tab hacia adelante desde el visor hasta «Sí, aceptarlo»:', j + 1);
// foco en una opción: ¿se ve?
await p.keyboard.press('Space'); await p.waitForTimeout(200);
const m = await p.evaluate(() => { const a = document.activeElement; const l = a.closest('label'); const cs = getComputedStyle(a); const cl = l && getComputedStyle(l); return { input: `${a.getBoundingClientRect().width}x${a.getBoundingClientRect().height} op=${cs.opacity} outline=${cs.outlineStyle} ${cs.outlineWidth}`, label: l ? `outline=${cl.outlineStyle} ${cl.outlineWidth} sombra=${cl.boxShadow.slice(0,50)} borde=${cl.borderColor}` : 'sin label' }; });
console.log('opción enfocada:', JSON.stringify(m));
await p.screenshot({ path: `../capturas/revisar-opcion-foco-${ancho}.png` });
await nav.close();
