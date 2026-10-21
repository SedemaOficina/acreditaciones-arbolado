// B4 · Flujos del personal con teclado: cotejo completo, programar un grupo (calendario con flechas), confirmar un grupo
// en su ficha, asistencia, pase de lista del examen y el examen de la persona en el salón. Sólo Tab, Mayús+Tab,
// flechas, Espacio, Enter, Escape y escritura (conductor llenaConTeclado). Foco y anuncios tras cada acción; axe en cada
// resultado. Uso: node teclado-personal.mjs [390|1440] [corrida]
import { navegador, contexto, BASE, guarda, axe } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, llenaConTeclado, activo, focos, anuncios, dondeFoco, PDF } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 1440);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const R = { ancho, corrida, eventos: [], axe: [], focos: [] };
const ev = (x) => { R.eventos.push(x); console.log(x); };
const ax = async (p, que) => { const v = await axe(p); R.axe.push({ que, v }); ev(`axe ${que}: ${v.length ? v.map((x) => `${x.id}(${x.n}) ${x.nodos[0].html.slice(0, 100)}`).join(' | ') : '0'}`); };
const an = async (p) => JSON.stringify((await anuncios(p)).slice(-5).map((a) => `${a.tipo}: ${a.texto}`));
async function pagina(url, vol = false) {
  const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, vol });
  await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
  const p = await c.newPage(); await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  return { c, p };
}
const errores = (p) => p.evaluate(() => [...document.querySelectorAll('.err')].filter((e) => e.textContent.trim() && e.checkVisibility()).map((e) => e.textContent.trim()).join(' | ') || 'ninguno');

// 1 · Cotejo completo (cita de APD-S-2026-00042), con la factura
{
  const { c, p } = await pagina('cotejo.html?folio=APD-S-2026-00042');
  ev('— COTEJO —');
  const docs = await p.$$eval('[name^="coincide_"]', (l) => [...new Set(l.map((x) => x.name))]);
  const radio = { se_presento: 'si', identidad: 'misma', pago: 'si' }; for (const d of docs) radio[d] = 'si';
  // «Atender como si fuera su día» (sólo en la prueba) con Enter
  const a1 = await llenaConTeclado(p, { parar: /como si fuera|Atender/ }, 60);
  if (a1.parado) { await p.keyboard.press('Enter'); await p.waitForTimeout(500); ev(`foco tras «atender como si fuera su día»: ${await dondeFoco(p)}`); }
  { const a = await activo(p); if (a.name === 'se_presento' && !a.checked) { await p.keyboard.press('Space'); await p.keyboard.press('Shift+Tab'); } }
  const ll = await llenaConTeclado(p, { radio, texto: { factura_rfc: 'XAXX010101000', factura_razon_social: 'PERSONA FICTICIA', factura_folio_fiscal: '6F9619FF-8B86-D011-B42D-00C04FC964FF' }, archivos: { factura_pago: PDF('factura') }, parar: /^Registrar|^Concluir|^Terminar|^Guardar/ }, 200);
  ev(`cotejo: ${ll.pasos.length} Tabs hasta ${ll.parado}`);
  for (const x of ll.pasos.filter((s) => s.startsWith('  ↳'))) ev(x);
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  ev(`foco tras registrar el cotejo: ${await dondeFoco(p)}; resultado visible: ${await p.isVisible('[data-hecho]')}; errores: ${await errores(p)}`);
  ev(`anuncios: ${await an(p)}`);
  await ax(p, 'cotejo: resultado o errores');
  await p.screenshot({ path: `../capturas/teclado-cotejo-${ancho}-${corrida}.png` });
  R.focos.push(...await focos(p)); await c.close();
}

// 2 · Programar un curso con el calendario y las flechas
{
  const { c, p } = await pagina('programar.html?curso=poda-nueva');
  ev('— PROGRAMAR —');
  // Tab hasta el calendario (botón de día con aria-pressed)
  let t = 0, a; for (; t < 60; t++) { await p.keyboard.press('Tab'); a = await activo(p); if (/cal-dia/.test(a.desc)) break; }
  ev(`Tabs hasta el calendario: ${t + 1} (${a.desc})`);
  const dias = [];
  for (const k of ['ArrowRight', 'ArrowDown', 'End', 'Home', 'PageDown', 'PageUp', 'ArrowLeft']) { await p.keyboard.press(k); await p.waitForTimeout(150); dias.push(`${k}→${(await activo(p)).texto.slice(0, 50)}`); }
  ev(`flechas en el calendario: ${dias.join(' | ')}`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ev(`Enter en un día: primer día = ${await p.inputValue('#fecha_inicio')}; anuncios ${await an(p)}`);
  const ll = await llenaConTeclado(p, { parar: /Crear y confirmar/ }, 200);
  ev(`programar: ${ll.pasos.length} Tabs más hasta ${ll.parado}`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const conf = await activo(p);
  ev(`tras «Crear y confirmar»: foco en ${conf.desc} (diálogo ${conf.enDialogo}); errores: ${await errores(p)}`);
  if (conf.enDialogo) {
    await ax(p, 'programar: confirmación abierta');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); ev(`  Escape → ${await dondeFoco(p)}`);
    await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    await p.locator('dialog[open] button', { hasText: /^Sí/ }).first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  }
  ev(`foco tras crear el grupo: ${await dondeFoco(p)}; anuncios ${await an(p)}`);
  await ax(p, 'programar: resultado');
  await p.screenshot({ path: `../capturas/teclado-programar-${ancho}-${corrida}.png` });
  R.focos.push(...await focos(p)); await c.close();
}

// 3 · Asistencia del día (grupo en curso APD-G-2026-003)
{
  const { c, p } = await pagina('asistencia.html?folio=APD-G-2026-003');
  ev('— ASISTENCIA —');
  // Guardar sin marcar primero: ¿a dónde va el foco?
  const g = await llenaConTeclado(p, { parar: /^Guardar/ }, 80);
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  ev(`guardar sin marcar: foco en ${await dondeFoco(p)}; anuncios ${await an(p)}`);
  await ax(p, 'asistencia: sin marcar');
  // Marcar con flechas: cada persona, «Asistió»
  await p.goto(BASE + 'asistencia.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  const nombres = await p.$$eval('.asis-opcion-input', (l) => [...new Set(l.map((x) => x.name))]);
  const radio = {}; for (const n of nombres) radio[n] = (await p.$eval(`input[name="${n}"]`, (x) => x.value));
  const ll = await llenaConTeclado(p, { radio, parar: /^Guardar/ }, 120);
  ev(`totales tras marcar con teclado: «${await p.textContent('[data-totales]')}»; anuncios ${await an(p)}`);
  ev(`asistencia: ${nombres.length} personas, ${ll.pasos.length} Tabs hasta ${ll.parado}`);
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  ev(`foco tras guardar: ${await dondeFoco(p)}; anuncios ${await an(p)}`);
  await ax(p, 'asistencia: guardada');
  await p.screenshot({ path: `../capturas/teclado-asistencia-${ancho}-${corrida}.png` });
  R.focos.push(...await focos(p)); await c.close();
}

// 4 · Aplicar el examen (APD-G-2026-006, examen hoy): pase de lista y código; luego el examen con teclado
let codigo = null;
{
  const { c, p } = await pagina('aplicar.html?folio=APD-G-2026-020', true);
  ev('— APLICAR —');
  const ll = await llenaConTeclado(p, { parar: /presente, generar/ }, 80);
  ev(`Tabs hasta el primer «Presente»: ${ll.pasos.length} (${ll.parado})`);
  if (ll.parado) {
    await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    const f = await activo(p);
    ev(`tras «Presente»: foco en ${f.desc} (diálogo ${f.enDialogo}); anuncios ${await an(p)}`);
    if (f.enDialogo) { await ax(p, 'aplicar: confirmación de presente'); const b = await p.$$eval('dialog[open] button', (l) => l.map((x) => x.textContent.trim())); ev(`  botones: ${b.join(' | ')}`); await p.locator('dialog[open] button', { hasText: /^Sí|Presente|Confirmar/ }).first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(900); ev(`  confirmado → foco ${await dondeFoco(p)}; anuncios ${await an(p)}`); }
    codigo = await p.evaluate(() => { const m = document.body.innerText.match(/\b[A-Z0-9]{4}[- ][A-Z0-9]{4}\b/); return m ? m[0] : null; });
    ev(`código visible: ${codigo}`);
    await ax(p, 'aplicar: con código');
  }
  await p.screenshot({ path: `../capturas/teclado-aplicar-${ancho}-${corrida}.png` });
  R.focos.push(...await focos(p));
  // Examen en la misma sesión del navegador (comparte lo guardado), como en probar-examen
  if (codigo) {
    const q = await c.newPage(); await q.goto(BASE + 'examen.html', { waitUntil: 'networkidle' }); await q.waitForTimeout(300);
    ev('— EXAMEN —');
    const e1 = await llenaConTeclado(q, { texto: { codigo: codigo.replace(/[- ]/, '') }, parar: /^Entrar|^Continuar/ }, 30);
    await q.keyboard.press('Enter'); await q.waitForTimeout(900);
    ev(`tras el código: foco ${await dondeFoco(q)}`);
    const e2 = await llenaConTeclado(q, { casilla: ['acepto', 'reglas'], parar: /^Empezar/ }, 40);
    await q.keyboard.press('Enter'); await q.waitForTimeout(900);
    ev(`tras «Empezar»: foco ${await dondeFoco(q)}; reloj: ${await q.evaluate(() => { const r = document.querySelector('[data-reloj]'); return r ? `aria-live=${r.getAttribute('aria-live')} role=${r.getAttribute('role')} «${r.textContent.trim()}»` : 'sin reloj'; })}`);
    await ax(q, 'examen: pregunta 1');
    // Contestar 3 preguntas: Tab a la opción, flecha, Siguiente
    for (let i = 0; i < 3; i++) {
      let k = 0; for (; k < 15; k++) { await q.keyboard.press('Tab'); const a = await activo(q); if (a.type === 'radio') break; }
      await q.keyboard.press('ArrowDown'); await q.waitForTimeout(200);
      let s = 0; for (; s < 10; s++) { await q.keyboard.press('Tab'); const a = await activo(q); if (/^Siguiente/.test(a.texto)) break; }
      await q.keyboard.press('Enter'); await q.waitForTimeout(500);
      ev(`pregunta ${i + 1}: ${k + 1} Tabs a la primera opción, ${s + 1} a «Siguiente»; foco tras «Siguiente»: ${await dondeFoco(q)}`);
    }
    // Anuncios del reloj en 5 s: no debe anunciar cada segundo
    await anuncios(q); await q.waitForTimeout(5200);
    const reloj = (await anuncios(q)).filter((x) => /\d+:\d\d/.test(x.texto));
    ev(`anuncios con la hora del reloj en 5 s: ${reloj.length}`);
    await q.screenshot({ path: `../capturas/teclado-examen-${ancho}-${corrida}.png` });
    // Barra fija del examen: ¿tapa el foco al volver con Mayús+Tab?
    const tap = []; for (let i = 0; i < 12; i++) { await q.keyboard.press('Shift+Tab'); await q.waitForTimeout(100); const m = await q.evaluate(() => window.__r3mide(document.activeElement)); if (m.tapado !== 'no') tap.push(`${m.el.slice(0, 50)} ${m.tapado} ${m.tapadoPor || ''}`); }
    ev(`Mayús+Tab ×12 en el examen, focos tapados: ${tap.length ? tap.join(' | ') : 'ninguno'}`);
    R.focos.push(...await focos(q));
  }
  await c.close();
}
guarda(`teclado-personal-${ancho}-${corrida}.json`, R);
const malos = R.focos.filter((f) => f.indicador === 'NINGUNO' || f.tapado === 'TOTAL' || (f.contrasteAnillo && f.contrasteAnillo < 3) || !f.dentro);
ev(`focos registrados ${R.focos.length}; con problema: ${malos.length}`); for (const m of malos.slice(0, 12)) ev(`  ${m.el} · ${m.indicador} · ${m.tapado} ${m.tapadoPor || ''} · dentro ${m.dentro}`);
await nav.close();
