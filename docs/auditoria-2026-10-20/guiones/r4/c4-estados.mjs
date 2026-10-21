// C4 · Matriz de estados: filtros, búsquedas, vistas y pasos frente a «Atrás», recarga, enlace compartido (otro
// contexto), dos pestañas y cambio de persona con una pantalla abierta. Cada caso corre 2 veces en contextos nuevos.
// Uso: node guiones/c4-estados.mjs
import { contexto, ir, captura, guarda, cierra, ESC, TEL, BASE, volumen } from './comun.mjs';
import { readFileSync } from 'node:fs';

const vol = JSON.parse(volumen());
const casos = JSON.parse(readFileSync('/home/claude/trabajo/evidencia-2026-10-20/r4/salidas/casos.json', 'utf8'));
const caso = (k) => casos.find((c) => c.clave === k);
const R = {};
const anota = (k, rep, obj) => { (R[k] ||= {})[`r${rep}`] = obj; };
const txt = (pg, s) => pg.$eval(s, (e) => e.textContent.trim()).catch(() => null);

for (const rep of [1, 2]) {
  // A · Bandeja de revisión: filtros frente a Atrás, recarga y enlace (teléfono y escritorio)
  for (const [tam, vp] of [['tel', TEL], ['esc', ESC]]) {
    const ctx = await contexto({ vp, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'revision.html', '[data-filas] tr', 700);
    if (tam === 'tel') await pg.click('[data-filtrar]');
    await pg.selectOption('#f_tipo', 'dictaminador');
    await pg.selectOption('#f_modalidad', 'renovacion');
    await pg.waitForTimeout(200);
    const con = { cuenta: await txt(pg, '[data-cuenta]'), boton: await txt(pg, '[data-filtrar]'), url: pg.url().replace(BASE, ''), visibles: await pg.$$eval('[data-filas] tr:not([hidden])', (l) => l.length) };
    if (rep === 1) await captura(pg, `c4-A-bandeja-filtrada-${tam}`, false);
    await pg.locator('[data-filas] tr:not([hidden]) a').first().click();
    await pg.waitForSelector('#formulario', { state: 'attached' }); await pg.waitForTimeout(500);
    await pg.goBack(); await pg.waitForSelector('[data-filas] tr', { state: 'attached' }); await pg.waitForTimeout(700);
    const atras = { tipo: await pg.inputValue('#f_tipo'), modalidad: await pg.inputValue('#f_modalidad'), cuenta: await txt(pg, '[data-cuenta]'), visibles: await pg.$$eval('[data-filas] tr:not([hidden])', (l) => l.length) };
    await pg.reload(); await pg.waitForSelector('[data-filas] tr', { state: 'attached' }); await pg.waitForTimeout(700);
    const recarga = { tipo: await pg.inputValue('#f_tipo'), modalidad: await pg.inputValue('#f_modalidad'), cuenta: await txt(pg, '[data-cuenta]') };
    anota(`A-bandeja-${tam}`, rep, { con, atras, recarga });
    await ctx.close();
  }

  // B · Citas: día elegido y búsqueda frente a Atrás, recarga y enlace
  {
    const ctx = await contexto({ vp: ESC, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'citas.html', '[data-filas] tr', 700);
    await pg.click('[data-flechas] button:last-child'); await pg.waitForTimeout(300);
    const dia = { titulo: await txt(pg, '[data-dia]'), url: pg.url().replace(BASE, ''), cuenta: await txt(pg, '[data-cuenta]') };
    await pg.fill('#buscar', 'APD-S-2026-0057'); await pg.waitForTimeout(300);
    const busca = { titulo: await txt(pg, '[data-dia]'), cuenta: await txt(pg, '[data-cuenta]'), url: pg.url().replace(BASE, '') };
    await pg.locator('[data-filas] tr:not([hidden]) a').first().click();
    await pg.waitForSelector('main', { state: 'attached' }); await pg.waitForTimeout(600);
    await pg.goBack(); await pg.waitForSelector('[data-filas] tr', { state: 'attached' }); await pg.waitForTimeout(700);
    const atras = { buscar: await pg.inputValue('#buscar'), titulo: await txt(pg, '[data-dia]'), cuenta: await txt(pg, '[data-cuenta]'), url: pg.url().replace(BASE, '') };
    await pg.reload(); await pg.waitForSelector('[data-filas] tr', { state: 'attached' }); await pg.waitForTimeout(700);
    const recarga = { buscar: await pg.inputValue('#buscar'), titulo: await txt(pg, '[data-dia]'), cuenta: await txt(pg, '[data-cuenta]') };
    const ctx2 = await contexto({ vp: ESC, vol: true }); const p2 = await ctx2.newPage();
    await ir(p2, dia.url, '[data-filas] tr', 700);
    const enlace = { titulo: await txt(p2, '[data-dia]'), cuenta: await txt(p2, '[data-cuenta]') };
    await ctx2.close();
    anota('B-citas', rep, { dia, busca, atras, recarga, enlace });
    await ctx.close();
  }

  // C · Grupos (planeador): curso y personas elegidas frente a Atrás, recarga, enlace y otra pestaña
  {
    const ctx = await contexto({ vp: ESC, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona', 700);
    await pg.click('button[data-curso="poda-renovacion"]'); await pg.waitForTimeout(500);
    const cajas = pg.locator('.plan-persona input');
    for (let i = 0; i < 3; i++) await cajas.nth(i).check();
    const antes = { url: pg.url().replace(BASE, ''), elegidas: await txt(pg, '[data-elegidas]'), resumen: await txt(pg, '[data-resumen], .plan-resumen, [data-curso-resumen]') };
    if (rep === 1) await captura(pg, 'c4-C-planeador-elegidas', false);
    const ver = pg.locator('.plan-grupo a', { hasText: 'Ver a las personas' }).first();
    if (await ver.count()) { await ver.click(); await pg.waitForLoadState('load'); await pg.waitForTimeout(500); await pg.goBack(); await pg.waitForSelector('.plan-persona'); await pg.waitForTimeout(700); }
    const atras = { url: pg.url().replace(BASE, ''), pulsado: await pg.getAttribute('button[aria-pressed="true"]', 'data-curso'), elegidas: await txt(pg, '[data-elegidas]'), marcadas: await pg.$$eval('.plan-persona input:checked', (l) => l.length) };
    await pg.reload(); await pg.waitForSelector('.plan-persona'); await pg.waitForTimeout(700);
    const recarga = { pulsado: await pg.getAttribute('button[aria-pressed="true"]', 'data-curso'), elegidas: await txt(pg, '[data-elegidas]'), marcadas: await pg.$$eval('.plan-persona input:checked', (l) => l.length) };
    const p3 = await ctx.newPage(); await ir(p3, 'grupos.html?curso=poda-renovacion', '.plan-persona', 700);
    const pestana = { elegidas: await txt(p3, '[data-elegidas]'), marcadas: await p3.$$eval('.plan-persona input:checked', (l) => l.length) };
    anota('C-planeador', rep, { antes, atras, recarga, pestana });
    await ctx.close();
  }

  // D · Programar: semana, instructor, hora y personas frente a recarga y Atrás/Adelante
  {
    const ctx = await contexto({ vp: ESC, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'programar.html?curso=poda-nueva', '.cal-dia', 900);
    await pg.click('.cal-dia[data-fecha="2026-11-09"]', { force: true }); await pg.waitForTimeout(300);
    await pg.selectOption('#instructor', 'instructor2.ficticio'); await pg.selectOption('#hora_entrada', '08:00');
    const marc = pg.locator('[data-personas] .plan-casilla[value]:checked');
    const nAntes = await marc.count();
    await marc.nth(0).uncheck(); await marc.nth(0).uncheck();
    const antes = { url: pg.url().replace(BASE, ''), fecha: await pg.inputValue('#fecha_inicio'), instructor: await pg.inputValue('#instructor'), hora: await pg.inputValue('#hora_entrada'), personas: await pg.locator('[data-personas] .plan-casilla[value]:checked').count(), propuestas: nAntes };
    pg.once('dialog', (d) => d.dismiss().catch(() => {}));
    await pg.reload().catch(() => {}); await pg.waitForSelector('.cal-dia'); await pg.waitForTimeout(900);
    const recarga = { url: pg.url().replace(BASE, ''), fecha: await pg.inputValue('#fecha_inicio'), instructor: await pg.inputValue('#instructor'), hora: await pg.inputValue('#hora_entrada'), personas: await pg.locator('[data-personas] .plan-casilla[value]:checked').count() };
    anota('D-programar', rep, { antes, recarga });
    await ctx.close();
  }

  // E · Bandeja en dos pestañas: se revisa en una; ¿la otra se entera?
  {
    const ctx = await contexto({ vp: ESC, vol: true });
    const a = await ctx.newPage(); await ir(a, 'revision.html', '[data-filas] tr', 700);
    const folio = await a.getAttribute('[data-filas] tr:first-child', 'data-folio');
    const antes = await txt(a, '[data-cuenta]');
    const b = await ctx.newPage(); await ir(b, `revisar.html?folio=${folio}`, '#formulario:not([hidden])', 900);
    for (const n of [...new Set(await b.$$eval('input[name^="decision_"][value="aceptado"]', (l) => l.map((x) => x.name)))]) {
      for (let i = 1; i <= 5; i++) { try { await b.check(`input[name="${n}"][value="aceptado"]`, { force: true, timeout: 2000 }); } catch (e) {} if (await b.isChecked(`input[name="${n}"][value="aceptado"]`)) break; await b.waitForTimeout(300 * i); }
      await b.waitForTimeout(300);
    }
    await b.fill('#cita_fecha', '20/10/2026'); await b.press('#cita_fecha', 'Tab'); await b.selectOption('#cita_hora', '10:00');
    await b.focus('[data-accion="enviar"]'); await b.click('[data-accion="enviar"]'); await b.waitForSelector('[data-hecho]:not([hidden])');
    await a.bringToFront(); await a.waitForTimeout(1500);
    const despues = { cuenta: await txt(a, '[data-cuenta]'), filaSigue: await a.locator(`[data-filas] tr[data-folio="${folio}"]:not([hidden])`).count() };
    await a.locator(`[data-filas] tr[data-folio="${folio}"] a`).click().catch(() => {});
    await a.waitForTimeout(1200);
    const alAbrir = (await a.$eval('main', (m) => m.innerText).catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
    if (rep === 1) await captura(a, 'c4-E-revisada-en-otra-pestana', false);
    anota('E-dos-pestanas-bandeja', rep, { folio, antes, despues, alAbrir });
    await ctx.close();
  }

  // F · Cambio de persona con «Mis trámites» abierto en otra pestaña (menú de pruebas, «Entrar como»)
  {
    const X = caso('obs-poda'); const Y = caso('cita');
    const ctx = await contexto({ vp: TEL, sesion: X.persona });
    const a = await ctx.newPage(); await ir(a, 'tramites.html', '[data-solicitudes] .ficha', 900);
    const nombreA = await txt(a, '[data-sesion]');
    const enlaceCorregir = await a.locator('[data-solicitudes] .ficha a', { hasText: /Corrige|corregir|Corregir/ }).first().getAttribute('href');
    const b = await ctx.newPage(); await ir(b, 'tramites.html', '[data-solicitudes] .ficha', 900);
    await b.click('.menu-pruebas-boton'); await b.waitForSelector('dialog.menu-pruebas[open]');
    await b.selectOption('#menu-pruebas-perfil', Y.perfil); await b.selectOption('#menu-pruebas-persona', Y.clave);
    await b.locator('dialog.menu-pruebas[open] button', { hasText: /^Entrar$/ }).click();
    await b.waitForURL(/tramites\.html/); await b.waitForSelector('[data-solicitudes] .ficha'); await b.waitForTimeout(600);
    const nombreB = await txt(b, '[data-sesion]');
    await a.bringToFront(); await a.waitForTimeout(1500);
    const aSigue = await txt(a, '[data-sesion]');
    // En la pestaña vieja (que todavía dice X), seguir el enlace «Corrige…» de X
    await a.locator('[data-solicitudes] .ficha a', { hasText: /Corrige|corregir|Corregir/ }).first().click();
    await a.waitForLoadState('load'); await a.waitForTimeout(1500);
    const tras = { url: a.url().replace(BASE, ''), cabecera: await txt(a, '[data-sesion]'), principio: (await a.$eval('main', (m) => m.innerText)).replace(/\s+/g, ' ').slice(0, 500) };
    if (rep === 1) await captura(a, 'c4-F-enlace-de-X-con-sesion-Y', true);
    anota('F-cambio-de-persona', rep, { X: X.clave, Y: Y.clave, nombreA, nombreB, aSigue, enlaceCorregir, tras });
    await ctx.close();
  }

  // G · Asistencia: día en pantalla en la dirección; lo marcado frente a recarga
  {
    const ctx = await contexto({ vp: TEL, vol: true });
    const pg = await ctx.newPage(); await ir(pg, 'asistencia.html?folio=APD-G-2026-024&dia=1', '.asistencia-fila', 700);
    const t1 = await txt(pg, '[data-titulo-dia]');
    await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-024'); await pg.waitForSelector('.asistencia-fila'); await pg.waitForTimeout(500);
    const t2 = await txt(pg, '[data-titulo-dia]');
    anota('G-asistencia-dia', rep, { conDia1: t1, sinDia: t2 });
    await ctx.close();
  }
}
guarda('c4-estados.json', R);
console.log(JSON.stringify(R, null, 1));
await cierra();
