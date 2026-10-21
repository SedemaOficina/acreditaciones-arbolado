// C1 · Comprobaciones de las fichas de tareas del personal (2 repeticiones, contexto nuevo cada vez).
// Uso: node guiones/c1-verifica.mjs
import { contexto, ir, captura, guarda, cierra, ESC, TEL, ficticios, volumen } from './comun.mjs';
import { readFileSync } from 'node:fs';
const d = ficticios();
const vol = JSON.parse(volumen());
const casos = JSON.parse(readFileSync('/home/claude/trabajo/evidencia-2026-10-20/r4/salidas/casos.json', 'utf8'));
const caso = (k) => casos.find((c) => c.clave === k);
const R = {};
const anota = (k, rep, o) => { (R[k] ||= {})[`r${rep}`] = o; };

for (const rep of [1, 2]) {
  // a · Planeador: ¿dice cuántas prioritarias y cuántos grupos alcanzan?
  {
    const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona', 800);
    const t = await pg.$eval('main', (m) => m.innerText);
    anota('a-planeador-resumen', rep, {
      resumen: (await pg.$eval('main', (m) => [...m.querySelectorAll('p')].map((p) => p.textContent.trim()).find((x) => /personas en espera/.test(x)))),
      diceCuantasPrioritarias: /\d+\s+(espera|esperan)\s+\d+ días o más|\d+ prioritarias/.test(t),
      diceGruposQueAlcanzan: /Alcanza para \d+ grupos|grupos nuevos|alcanza(n)? para (un|\d+) grupos? (nuevo|de)/i.test(t),
      enEspera: await pg.$$eval('.plan-persona', (l) => l.length),
      prioritarias: await pg.$$eval('.plan-persona', (l) => l.filter((x) => /prioritaria/.test(x.textContent)).length)
    });
    await ctx.close();
  }
  // b · Agenda: ¿se distingue una 2.ª cita (si no viene, se cierra) o una cita nueva por falta de pago?
  {
    const ctx = await contexto({ vp: ESC }); const pg = await ctx.newPage();
    const out = {};
    for (const [k, previa] of [['cita-inasistencia', 'no_se_presento'], ['cita-sin-pago', 'sin_pago']]) {
      const s = d.solicitud.find((x) => x.estado === 'validada_en_linea' && d.cita.some((c) => c.solicitud_id === x.id && c.resultado === previa) && d.cita.some((c) => c.solicitud_id === x.id && c.resultado === 'pendiente'));
      const c = d.cita.filter((x) => x.solicitud_id === s.id && ['pendiente'].includes(x.resultado)).pop();
      const dia = new Date(c.programada_en).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      await ir(pg, `citas.html?dia=${dia}`, '[data-filas] tr', 700);
      const fila = (await pg.locator(`[data-filas] tr[data-folio="${s.folio}"]:not([hidden])`).first().textContent()).replace(/\s+/g, ' ').trim();
      out[k] = { folio: s.folio, dia, fila, distingue: /2\.ª|segunda|se cierra|sin pago|comprobante/i.test(fila) };
      if (rep === 1) await captura(pg, `c1-b-agenda-${k}`, false);
    }
    anota('b-agenda-segunda-cita', rep, out);
    await ctx.close();
  }
  // c · Reenviada: ¿la observación anterior está junto al documento corregido?
  {
    const ctx = await contexto({ vp: ESC }); const pg = await ctx.newPage();
    const s = d.solicitud.find((x) => x.solicitante_id === caso('reenviada').persona && x.estado === 'enviada');
    await ir(pg, `revisar.html?folio=${s.folio}`, '#formulario:not([hidden])', 1000);
    const r = await pg.evaluate(() => {
      const det = document.querySelector('[data-anteriores]');
      const obsAnteriores = [...document.querySelectorAll('[data-anteriores-lista] li')].map((li) => li.textContent.trim());
      const corregidos = [...document.querySelectorAll('.doc-corregido')].map((c) => { const art = c.closest('article, [data-doc]'); return { doc: art && art.dataset.doc, texto: art ? art.innerText.replace(/\s+/g, ' ').slice(0, 300) : '' }; });
      return { plegadoAbierto: det ? det.open : null, obsAnteriores, corregidos };
    });
    r.observacionJuntoAlDocumento = r.corregidos.map((c) => ({ doc: c.doc, laTrae: r.obsAnteriores.some((o) => c.texto.includes(o.split(': ').slice(1).join(': ').replace(/ — la persona cargó uno nuevo$/, '').slice(0, 25))) }));
    if (rep === 1) await captura(pg, 'c1-c-reenviada', false);
    anota('c-reenviada-observacion-anterior', rep, { folio: s.folio, ...r });
    await ctx.close();
  }
  // d · Aplicar: tamaño de la fotografía con que se compara a la persona; ¿se puede ampliar?
  {
    const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
    await ir(pg, 'aplicar.html?folio=APD-G-2026-020', '[data-grupo] .datos-valor', 900);
    const r = await pg.evaluate(() => { const f = document.querySelector('.examen-foto-lista'); const b = f.getBoundingClientRect(); const img = f.querySelector('img');
      return { ancho: Math.round(b.width), alto: Math.round(b.height), esEnlaceOBoton: Boolean(f.closest('a, button')) || (img && (img.closest('a,button') !== null)), cursor: getComputedStyle(img || f).cursor }; });
    const antes = await pg.$eval('.examen-foto-lista', (f) => f.getBoundingClientRect().width);
    await pg.click('.examen-foto-lista').catch(() => {}); await pg.waitForTimeout(400);
    r.trasClic = { dialogoAbierto: await pg.locator('dialog[open]').count(), ancho: Math.round(await pg.$eval('.examen-foto-lista', (f) => f.getBoundingClientRect().width)), igual: antes === await pg.$eval('.examen-foto-lista', (f) => f.getBoundingClientRect().width) };
    if (rep === 1) { const el = await pg.$('[data-filas] tr, tbody tr'); if (el) await el.screenshot({ path: '/home/claude/trabajo/evidencia-2026-10-20/r4/capturas/c1-d-aplicar-fila-foto.png' }); }
    // f · Otros grupos en curso: enlaces con el mismo texto
    r.otros = await pg.$$eval('.otros-grupos a', (l) => l.map((a) => a.textContent.trim()));
    r.titulo = await pg.$eval('[data-grupo]', (g) => g.innerText.split('\n').slice(0, 3).join(' | '));
    anota('d-aplicar-foto-y-otros', rep, r);
    await ctx.close();
  }
  // e · Asistencia: del aviso «Falta capturar el día 2» a donde se captura
  {
    const ctx = await contexto({ vp: TEL, vol: true }); const pg = await ctx.newPage();
    await ir(pg, 'asistencia.html?folio=APD-G-2026-024', '.asistencia-fila', 800);
    const r = await pg.evaluate(() => {
      const aviso = document.querySelector('[data-avisos]');
      const y = (e) => Math.round(e.getBoundingClientRect().top + scrollY);
      const corregir = [...document.querySelectorAll('summary, h2, h3, button')].find((x) => /Corregir otro día/.test(x.textContent));
      const det = corregir ? corregir.closest('details') : null;
      return { avisoY: y(aviso), avisoTieneEnlace: aviso.querySelectorAll('a, button').length, corregirY: corregir ? y(corregir) : null, corregirPlegado: det ? !det.open : null, ventana: innerHeight };
    });
    anota('e-asistencia-dia-sin-capturar', rep, r);
    if (rep === 1) await captura(pg, 'c1-e-asistencia-aviso', true);
    await ctx.close();
  }
  // h · Ficha del grupo en curso: «Situación» de la lista contra el concentrado
  {
    const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
    await ir(pg, 'grupo.html?folio=APD-G-2026-020', '[data-filas] tr', 900);
    const r = await pg.evaluate(() => {
      const lista = [...document.querySelectorAll('[data-filas] tr')].map((tr) => tr.innerText.replace(/\s+/g, ' '));
      const conc = [...document.querySelectorAll('[data-conc-filas] tr')].map((tr) => tr.innerText.replace(/\s+/g, ' '));
      return { situacionesLista: [...new Set(lista.map((t) => (t.match(/(Inscrita|Sin derecho[^ ]*|Con derecho|Aprobada|No acreditada)\s*$/) || [])[1]))], sinDerechoConcentrado: conc.filter((t) => /Sin derecho/.test(t)).length };
    });
    anota('h-grupo-situacion-vs-concentrado', rep, r);
    await ctx.close();
  }
}
guarda('c1-verifica.json', R);
console.log(JSON.stringify(R, null, 1));
await cierra();
