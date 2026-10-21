// B4 · Flujo con teclado: «Crea tu cuenta» de principio a fin (Tab, flechas, Espacio, Enter), con el aviso de
// privacidad abierto y cerrado con Escape, la foto con Enter en «Elegir», envío con errores primero y luego completo.
// Uso: node teclado-cuenta.mjs [390|1440] [corrida]
import { navegador, contexto, BASE, guarda } from './lib.mjs';
import { registroDeFoco, llenaConTeclado, activo, focos, FOTO } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 390);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const { c, errores } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900 });
await c.addInitScript(registroDeFoco);
await c.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await c.newPage();
await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' });
const R = { ancho, corrida, eventos: [] };
const ev = (x) => { R.eventos.push(x); console.log(x); };

// 1 · Primer Tab: «Ir al contenido»
await p.keyboard.press('Tab');
const primero = await activo(p);
const saltoVisible = await p.evaluate(() => { const a = document.activeElement; const b = a.getBoundingClientRect(); return b.top >= 0 && b.height > 0 && getComputedStyle(a).transform; });
ev(`primer Tab: ${primero.desc} (visible: ${JSON.stringify(saltoVisible)})`);
await p.keyboard.press('Enter'); await p.keyboard.press('Tab');
ev(`tras «Ir al contenido» + Tab: ${(await activo(p)).desc}`);

// 2 · Enviar vacío con Enter sobre «Crear cuenta»: ¿a dónde va el foco?
await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' });
const vacio = await llenaConTeclado(p, { parar: /Crear (mi |la )?cuenta/i });
ev(`Tabs hasta «Crear cuenta» con el formulario vacío: ${vacio.pasos.length}`);
await p.keyboard.press('Enter'); await p.waitForTimeout(700);
ev(`foco tras enviar vacío: ${(await activo(p)).desc}`);
ev(`resumen de errores visible: ${await p.evaluate(() => { const r = document.querySelector('.resumen-errores,[data-resumen-errores]'); return r ? r.checkVisibility() + ' «' + r.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) + '»' : 'no hay'; })}`);
// Enlace del resumen al primer campo con Enter
await p.keyboard.press('Tab'); const enResumen = await activo(p); ev(`siguiente Tab: ${enResumen.desc}`);
if (enResumen.tag === 'A' || enResumen.tag === 'BUTTON') { await p.keyboard.press('Enter'); await p.waitForTimeout(300); ev(`Enter en el enlace del resumen → foco: ${(await activo(p)).desc}`); }

// 3 · Llenado completo con teclado
await p.goto(BASE + 'cuenta.html', { waitUntil: 'networkidle' });
const N = await p.evaluate(() => {
  const ALF = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  const dig = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALF.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
  const fecha = `19${70 + Math.floor(Math.random() * 25)}-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;
  const curp = dig(FORMKIT_VALIDACIONES.prefijoCurp({ nombre: 'Paula', primer: 'Ejemplo', segundo: 'Teclado' }, fecha, 'M', 'NE') + '0');
  return { curp, fecha: fecha.split('-').reverse().join('/') };
});
const correo = `prueba.${N.curp.toLowerCase()}@ejemplo.local`;
const V = { texto: { nombre: 'Paula', primer_apellido: 'Ejemplo', segundo_apellido: 'Teclado', fecha_nacimiento: N.fecha.replace(/\//g, ''), curp: N.curp, correo, correo2: correo, telefono: '0000000099' },
  radio: { adscrito: 'no' }, casilla: ['aviso', 'humano'], archivos: { foto: FOTO }, parar: /Crear (mi |la )?cuenta/i };
// Contraseña: se pega (3.3.8)
const lleno = await llenaConTeclado(p, V);
ev(`llenado: ${lleno.pasos.length} Tabs hasta ${lleno.parado}`);
for (const x of lleno.pasos.filter((s) => s.startsWith('  ↳'))) ev(x);
// Pegar la contraseña con Control+V en los dos campos
for (const id of ['contrasena', 'contrasena2']) {
  await p.evaluate(() => navigator.clipboard.writeText('una frase larga de prueba'));
  await p.focus('#' + id); await p.keyboard.press('Control+V'); await p.waitForTimeout(100);
  ev(`pegar en #${id}: ${(await p.inputValue('#' + id)).length} caracteres`);
}
// Aviso de privacidad: Enter lo abre, Escape lo cierra; el foco debe volver al botón
await p.focus('[data-abre-dialogo="dialogo-privacidad"]');
await p.keyboard.press('Enter'); await p.waitForTimeout(400);
const enDlg = await activo(p);
ev(`aviso de privacidad abierto: foco en ${enDlg.desc} (dentro del diálogo: ${enDlg.enDialogo})`);
// Trampa: Tab 30 veces dentro del diálogo, ¿se sale?
const ciclo = []; const fuera = []; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); const a = await activo(p); ciclo.push(a.enDialogo); if (!a.enDialogo) fuera.push(a.desc); }
ev(`Tab ×12 con el diálogo abierto: dentro ${ciclo.filter(Boolean).length} de 12; fuera: ${[...new Set(fuera)].join(', ')}`);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ev(`Escape → foco en ${(await activo(p)).desc}`);
// Enviar
await p.focus('[data-accion="enviar"]'); await p.keyboard.press('Enter');
await p.waitForTimeout(2500);
const tras = await activo(p);
ev(`foco tras crear la cuenta: ${tras.desc}`);
ev(`acuse visible: ${await p.evaluate(() => { const a = document.querySelector('[data-acuse]'); return a ? !a.hidden : 'no hay'; })}; errores en pantalla: ${await p.evaluate(() => [...document.querySelectorAll('.err')].filter((e) => e.textContent.trim() && e.checkVisibility()).map((e) => e.textContent.trim()).join(' | ') || 'ninguno')}`);
await p.screenshot({ path: `../capturas/teclado-cuenta-acuse-${ancho}-${corrida}.png` });
R.focos = await focos(p);
R.errores = errores;
guarda(`teclado-cuenta-${ancho}-${corrida}.json`, R);
const malos = R.focos.filter((f) => f.indicador === 'NINGUNO' || f.tapado === 'TOTAL' || f.tapado === 'parcial' || (f.contrasteAnillo && f.contrasteAnillo < 3) || !f.dentro);
ev(`focos registrados: ${R.focos.length}; con problema: ${malos.length}`);
for (const m of malos.slice(0, 15)) ev(`  ${m.el} · indicador ${m.indicador} · contraste ${m.contrasteAnillo} · tapado ${m.tapado} ${m.tapadoPor || ''} · dentro ${m.dentro}`);
await nav.close();
