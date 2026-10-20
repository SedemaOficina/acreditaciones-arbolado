// B4 · axe después de presionar cada botón visible (diálogos de confirmación, avisos, errores, menús, visor, franja del
// borrador), y un segundo nivel: dentro de cada diálogo que se abre, cada botón del diálogo. Cada clic sobre la página
// recién cargada (contexto limpio por estado). A 390 y 1440 px, con movimiento reducido.
// Uso: node axe-botones.mjs [390|1440]  → ../axe-botones-<ancho>.json
import { navegador, contexto, axe, guarda, datos, BASE } from './lib.mjs';

const anchos = process.argv[2] ? [Number(process.argv[2])] : [390, 1440];
const nav = await navegador();
const pg0 = await nav.newPage();
await pg0.goto(BASE + 'index.html');
const casos = await pg0.evaluate(async () => { const d = await APD.cargar(); return Object.fromEntries(APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.filter((c) => c.persona).map((c) => [c.clave, c.persona.id]))); });
await pg0.close();
const enviada = (f) => datos.solicitud.find((s) => s.estado === 'enviada' && f(s)).folio;
const ESTADOS = [
  ['index', 'index.html'], ['cuenta', 'cuenta.html'], ['entrar', 'entrar.html'], ['verificar', 'verificar.html'], ['material', 'material.html'], ['examen', 'examen.html'],
  ['tramites obs', 'tramites.html', casos['obs-poda']], ['tramites cita', 'tramites.html', casos.cita], ['tramites por-vencer', 'tramites.html', casos['por-vencer']], ['tramites borrador', 'tramites.html', casos.borrador],
  ['datos', 'datos.html', casos.cita], ['solicitud nueva', 'solicitud.html?tipo=poda', casos['no-renovable']], ['solicitud borrador', `solicitud.html?folio=${datos.solicitud.find((s) => s.estado === 'borrador').folio}`, casos.borrador],
  ['corregir pausa', `corregir.html?folio=APD-S-2026-00052`, datos.solicitud.find((s) => s.folio === 'APD-S-2026-00052').solicitante_id],
  ['revision', 'revision.html'], ['revisar poda', `revisar.html?folio=${enviada((s) => s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva')}`],
  ['revisar dictaminador', `revisar.html?folio=${enviada((s) => s.perfil_academico === 'por_clasificar')}`], ['revisar no cumple', `revisar.html?folio=${enviada((s) => s.perfil_academico === 'no_cumple')}`],
  ['citas', 'citas.html'], ['cotejo', 'cotejo.html?folio=APD-S-2026-00042'], ['cotejo pausa', 'cotejo.html?folio=APD-S-2026-00053'],
  ['grupos', 'grupos.html?curso=poda-nueva'], ['programar', 'programar.html?curso=poda-nueva'],
  ['grupo integracion', 'grupo.html?folio=APD-G-2026-005'], ['grupo en curso', 'grupo.html?folio=APD-G-2026-003'], ['grupo concluido', 'grupo.html?folio=APD-G-2026-001'],
  ['asistencia', 'asistencia.html?folio=APD-G-2026-003'], ['aplicar', 'aplicar.html?folio=APD-G-2026-006'], ['material-personal', 'material-personal.html'],
  ['VOL grupos', 'grupos.html?curso=poda-nueva', null, true], ['VOL revision', 'revision.html', null, true], ['VOL aplicar', 'aplicar.html?folio=APD-G-2026-020', null, true]
];

function marcaBotones() {
  const vis = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !el.closest('[hidden]');
  const lista = [...document.querySelectorAll('button,summary,[role=button],[role=tab]')].filter((el) => vis(el) && !el.disabled);
  return lista.map((el, i) => { el.dataset.r3 = String(i); return { i, nombre: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70), dentroDialogo: Boolean(el.closest('dialog[open]')) }; });
}
const espera = (p) => p.waitForTimeout(450);

const salida = [];
for (const ancho of anchos) {
  for (const [nombre, url, sesion, vol] of ESTADOS) {
    const { c, errores } = await contexto(nav, { ancho, alto: ancho < 700 ? 844 : 900, sesion, vol });
    const p = await c.newPage();
    const cargar = async () => { await p.goto(BASE + url, { waitUntil: 'load' }); await espera(p); return p.evaluate(marcaBotones); };
    const botones = await cargar();
    for (const b of botones) {
      if (/^Salir$|Empezar de cero|Borrar lo guardado/.test(b.nombre)) continue; // no borrar el estado de prueba a medio recorrido
      const lista = await cargar();
      const mismo = lista.find((x) => x.nombre === b.nombre) || lista[b.i];
      if (!mismo) continue;
      try { await p.locator(`[data-r3="${mismo.i}"]`).click({ timeout: 2500 }); } catch (e) { salida.push({ ancho, nombre, boton: b.nombre, error: 'no se pudo presionar: ' + e.message.split('\n')[0] }); continue; }
      await espera(p);
      if (!p.url().startsWith(BASE)) continue;
      const v = await axe(p).catch((e) => [{ id: 'ERROR', n: 1, nodos: [{ html: String(e).slice(0, 200) }] }]);
      const abierto = await p.evaluate(() => Boolean(document.querySelector('dialog[open]')));
      salida.push({ ancho, nombre, url, boton: b.nombre, destino: p.url().replace(BASE, ''), dialogo: abierto, violaciones: v });
      process.stdout.write(v.length ? 'X' : '.');
      if (abierto && !/Menú de pruebas/.test(b.nombre)) {
        // Segundo nivel: cada botón del diálogo
        const enDialogo = (await p.evaluate(marcaBotones)).filter((x) => x.dentroDialogo);
        for (const d of enDialogo) {
          await cargar();
          const l1 = await p.evaluate(marcaBotones);
          const m1 = l1.find((x) => x.nombre === b.nombre); if (!m1) continue;
          await p.locator(`[data-r3="${m1.i}"]`).click({ timeout: 2500 }).catch(() => {});
          await espera(p);
          const l2 = (await p.evaluate(marcaBotones)).filter((x) => x.dentroDialogo);
          const m2 = l2.find((x) => x.nombre === d.nombre); if (!m2) continue;
          try { await p.locator(`[data-r3="${m2.i}"]`).click({ timeout: 2500 }); } catch (e) { continue; }
          await espera(p);
          if (!p.url().startsWith(BASE)) continue;
          const v2 = await axe(p).catch((e) => [{ id: 'ERROR', n: 1, nodos: [{ html: String(e).slice(0, 200) }] }]);
          salida.push({ ancho, nombre, url, boton: `${b.nombre} → ${d.nombre}`, destino: p.url().replace(BASE, ''), violaciones: v2 });
          process.stdout.write(v2.length ? 'X' : ',');
        }
      }
    }
    salida.push({ ancho, nombre, errores });
    await c.close();
  }
}
await nav.close();
const con = salida.filter((r) => r.violaciones && r.violaciones.length);
guarda(`axe-botones-${anchos.join('-')}.json`, { fecha: new Date().toISOString(), clics: salida.filter((r) => r.violaciones).length, conViolaciones: con.length, salida });
console.log(`\n${salida.filter((r) => r.violaciones).length} estados tras clic; con violaciones: ${con.length}`);
for (const r of con) console.log(`${r.ancho} ${r.nombre} [${r.boton}] → ${r.violaciones.map((v) => `${v.id}(${v.n}): ${v.nodos[0].html.slice(0, 120)}`).join(' | ')}`);
