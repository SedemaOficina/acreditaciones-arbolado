// B4 · Flujo con teclado: revisar una solicitud (validar, observar con motivos frecuentes, rechazar con confirmación).
// Cada control se alcanza con focus() y se opera sólo con Espacio, Enter, flechas, Escape y escritura (el orden de Tab
// se mide aparte en teclado-barrido). Se registra el foco al abrir y cerrar el visor, al abrir y cerrar la
// confirmación, y tras registrar; axe en cada resultado.
// Uso: node teclado-revisar.mjs [390|1440] [corrida]
import { navegador, contexto, BASE, guarda, axe, datos } from './lib.mjs';
import { registroDeFoco, registroDeAnuncios, activo, focos, anuncios, teclas, dondeFoco } from './teclado-lib.mjs';

const ancho = Number(process.argv[2] || 1440);
const corrida = process.argv[3] || '1';
const nav = await navegador();
const R = { ancho, corrida, eventos: [], axe: [] };
const ev = (x) => { R.eventos.push(x); console.log(x); };
const ax = async (p, que) => { const v = await axe(p); R.axe.push({ que, v }); ev(`axe ${que}: ${v.length ? v.map((x) => `${x.id}(${x.n}) ${x.nodos[0].html.slice(0, 100)}`).join(' | ') : '0'}`); };
const enviada = (f) => datos.solicitud.find((s) => s.estado === 'enviada' && f(s)).folio;

async function abre(folio) {
  const { c } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900 });
  await c.addInitScript(registroDeFoco); await c.addInitScript(registroDeAnuncios);
  const p = await c.newPage();
  await p.goto(BASE + `revisar.html?folio=${folio}`, { waitUntil: 'networkidle' }); await p.waitForSelector('#formulario:not([hidden])'); await p.waitForTimeout(300);
  return { c, p };
}
// Ve cada documento con el teclado y lo decide
async function decideDocs(p, decision, conVisor) {
  const docs = await p.$$eval('[data-ver]', (l) => l.filter((b) => b.checkVisibility()).map((b) => b.dataset.ver));
  for (const [i, k] of docs.entries()) {
    await teclas(p, `[data-ver="${k}"]`, 'Enter'); await p.waitForTimeout(600);
    const a = await activo(p);
    if (i === 0 || conVisor) {
      ev(`visor de ${k}: foco al abrir en ${a.desc} (dentro de diálogo: ${a.enDialogo}); visor modal: ${await p.evaluate(() => { const d = document.querySelector('dialog[data-visor]'); return d ? d.open + '/' + d.matches(':modal') : 'sin visor'; })}`);
      const vueltas = []; for (let t = 0; t < 10; t++) { await p.keyboard.press('Tab'); vueltas.push((await activo(p)).desc.slice(0, 40)); }
      ev(`  Tab ×10 en el visor: ${[...new Set(vueltas)].join(' → ')}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ev(`  Escape → foco en ${await dondeFoco(p)}; visor abierto: ${await p.evaluate(() => { const d = document.querySelector('dialog[data-visor]'); return d ? d.open : 'sin visor'; })}`);
    }
    const d = decision(k, i);
    await teclas(p, `input[name="decision_${k}"][value="${d}"]`, 'Space');
    if (d === 'con_observacion') {
      // Motivos frecuentes (chips) con el teclado, si hay
      const chip = await p.$(`[data-campo="observacion_${k}"] .chip-fijo, [data-campo="observacion_${k}"] [data-chip]`);
      if (chip) { await chip.focus(); await p.keyboard.press('Enter'); ev(`  chip de motivo frecuente con Enter: «${await p.inputValue('#observacion_' + k)}»`); }
      else await teclas(p, `#observacion_${k}`, 'texto:No se lee completo: vuelve a escanearlo.');
    }
  }
  return docs;
}

// 1 · Validar (poda nueva)
{
  const { c, p } = await abre(enviada((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && true));
  ev(`— VALIDAR — foco al abrir: ${await dondeFoco(p)}`);
  await decideDocs(p, () => 'aceptado', true);
  ev(`resultado propuesto: ${await p.inputValue('#resultado')}`);
  // Fecha y hora de la cita, con teclado
  if (await p.isVisible('#cita_fecha')) {
    const dia = await p.evaluate(() => { const d = new Date('2026-10-14T12:00:00-06:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10).split('-').reverse().join(''); });
    await teclas(p, '#cita_fecha', `texto:${dia}`);
    await teclas(p, '#cita_hora', 'ArrowDown', 'ArrowDown');
  }
  await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(1500);
  ev(`foco tras validar: ${await dondeFoco(p)}; resultado visible: ${await p.isVisible('[data-hecho]')}`);
  ev(`anuncios: ${JSON.stringify((await anuncios(p)).slice(-4).map((a) => `${a.tipo}: ${a.texto}`))}`);
  await ax(p, 'resultado: validada');
  await p.screenshot({ path: `../capturas/teclado-revisar-validada-${ancho}-${corrida}.png` });
  R.focosValidar = await focos(p);
  await c.close();
}
// 2 · Observar
{
  const { c, p } = await abre(enviada((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'renovacion') );
  ev('— OBSERVAR —');
  await decideDocs(p, (k, i) => (i === 0 ? 'con_observacion' : 'aceptado'), false);
  ev(`resultado propuesto: ${await p.inputValue('#resultado')}`);
  // Enviar primero sin mensaje si lo pide, para ver el error
  await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(1500);
  ev(`foco tras registrar observaciones: ${await dondeFoco(p)}; resultado visible: ${await p.isVisible('[data-hecho]')}`);
  ev(`anuncios: ${JSON.stringify((await anuncios(p)).slice(-4).map((a) => `${a.tipo}: ${a.texto}`))}`);
  await ax(p, 'resultado: con observaciones (o error)');
  await p.screenshot({ path: `../capturas/teclado-revisar-observada-${ancho}-${corrida}.png` });
  R.focosObservar = await focos(p);
  await c.close();
}
// 3 · Rechazar (dictaminador que no cumple el perfil), con la confirmación
{
  const { c, p } = await abre(enviada((s) => s.perfil_academico === 'no_cumple'));
  ev('— RECHAZAR —');
  await teclas(p, 'input[name="comprobante_confirma"][value="si"]', 'Space');
  await decideDocs(p, () => 'aceptado', false).catch((e) => ev('docs: ' + e.message.split('\n')[0]));
  if (await p.isVisible('#motivo_rechazo') && !(await p.inputValue('#motivo_rechazo'))) await teclas(p, '#motivo_rechazo', 'texto:El comprobante de estudios no acredita el grado mínimo requerido.');
  await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(800);
  const enConf = await activo(p);
  ev(`confirmación: foco en ${enConf.desc} (dentro de diálogo ${enConf.enDialogo})`);
  await ax(p, 'confirmación de rechazo abierta');
  const vueltas = []; for (let t = 0; t < 8; t++) { await p.keyboard.press('Tab'); vueltas.push((await activo(p)).desc.slice(0, 40)); }
  ev(`  Tab ×8 en la confirmación: ${[...new Set(vueltas)].join(' → ')}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ev(`  Escape → foco en ${await dondeFoco(p)}`);
  await teclas(p, '[data-accion="enviar"]', 'Enter'); await p.waitForTimeout(800);
  const si = await p.$$eval('dialog[open] button', (l) => l.map((b) => b.textContent.trim()));
  ev(`  botones de la confirmación: ${si.join(' | ')}`);
  await p.locator('dialog[open] button', { hasText: /^Sí/ }).first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  ev(`foco tras rechazar: ${await dondeFoco(p)}; resultado visible: ${await p.isVisible('[data-hecho]')}`);
  await ax(p, 'resultado: rechazada');
  await p.screenshot({ path: `../capturas/teclado-revisar-rechazada-${ancho}-${corrida}.png` });
  R.focosRechazar = await focos(p);
  await c.close();
}
guarda(`teclado-revisar-${ancho}-${corrida}.json`, R);
const malos = [...R.focosValidar, ...R.focosObservar, ...R.focosRechazar].filter((f) => f.indicador === 'NINGUNO' || f.tapado === 'TOTAL' || (f.contrasteAnillo && f.contrasteAnillo < 3) || !f.dentro);
ev(`focos con problema: ${malos.length}`); for (const m of malos.slice(0, 12)) ev(`  ${m.el} · ${m.indicador} · ${m.tapado} ${m.tapadoPor || ''} · dentro ${m.dentro}`);
await nav.close();
