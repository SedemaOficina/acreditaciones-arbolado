// Pruebas de las pantallas del personal con volumen real (auditoría de tareas, 2026-10-17).
// Genera el escenario de docs/auditoria-tareas/escenario-volumen.mjs (65 por revisar, 40 citas en un día, 112 en espera,
// grupos de 25, un día sin capturar, citas atrasadas y una pausa vencida) y lo sirve en lugar de datos/ficticios.json.
// Uso: node herramientas/probar-volumen.mjs [http://localhost:8765/]   (con el sitio servido)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const salida = join(mkdtempSync(join(tmpdir(), 'apd-volumen-')), 'volumen.json');
execFileSync('node', [join(raiz, 'docs/auditoria-tareas/escenario-volumen.mjs'), join(raiz, 'sitio/datos/ficticios.json'), salida], { stdio: 'inherit' });
const cuerpo = readFileSync(salida);
const d = JSON.parse(cuerpo);
const hoy = d.fecha_corte;

let fallas = 0;
const comprueba = (ok, texto) => { console.log(`${ok ? 'BIEN' : 'MAL '}  ${texto}`); if (!ok) fallas += 1; };

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [tam, vp] of [['teléfono', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
  const ctx = await navegador.newContext({ viewport: vp, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(String(e)));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const t = (x) => `[${tam}] ${x}`;
  const ir = async (url, sel) => {
    await pg.goto(BASE + url); await pg.waitForSelector(sel, { state: 'attached' }); await pg.waitForTimeout(300);
    const malo = (await pg.evaluate(() => document.body.innerText)).match(/\b(null|undefined|NaN)\b/);
    if (malo) comprueba(false, t(`${url}: se ve «${malo[1]}»`));
  };
  const texto = (sel) => pg.textContent(sel);
  const sinDesborde = async (donde) => comprueba(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), t(`${donde}: sin desborde horizontal`));

  // A2: «Aplicar el examen» abre el grupo que presenta hoy y deja cambiar
  await ir('aplicar.html', '[data-grupo] .datos-valor');
  comprueba((await texto('[data-grupo]')).includes('APD-G-2026-020') && /Otros grupos en curso/.test(await texto('[data-grupo]')), t('aplicar: abre el grupo cuyo examen es hoy y ofrece los otros'));
  await sinDesborde('aplicar');
  await ir('aplicar.html?folio=APD-G-2026-024', '[data-grupo] .datos-valor');
  const ap = await texto('[data-grupo]');
  comprueba(/no hoy/.test(ap) && /Faltan días del curso por capturar/.test(ap), t('aplicar: otro grupo avisa que su examen no es hoy y que faltan días por capturar'));

  // A1 y M9: asistencia señala el día sin capturar y resume el grupo
  await ir('asistencia.html?folio=APD-G-2026-024', '.asistencia-fila');
  comprueba(/sin capturar/.test(await texto('[data-dias]')) && /Falta capturar el día 2/.test(await texto('[data-avisos]')), t('asistencia: el día 2 pasado sin capturar se señala arriba y en «Corregir otro día»'));
  comprueba(/asisti|falt/.test(await texto('[data-totales]')), t('asistencia: lo marcado se resume junto a «Guardar»'));
  await sinDesborde('asistencia');

  // A3 y M6: citas de días anteriores sin registrar y pausa vencida
  await ir('citas.html', '[data-filas] tr');
  comprueba(/3 citas de días anteriores están sin registrar/.test(await texto('[data-atrasadas]')), t('citas: aviso de las 3 citas de días anteriores sin registrar'));
  await pg.click('[data-atrasadas] button');
  comprueba((await pg.locator('[data-filas] tr:visible', { hasText: 'Sin registrar' }).count()) === 3, t('citas: el botón lleva al día con las 3 citas «Sin registrar»'));
  await sinDesborde('citas');
  const pausa = d.solicitud.find((s) => s.cotejo_pausa && s.cita_en && s.cita_en.slice(0, 10) < hoy);
  await ir('citas.html', '[data-filas] tr');
  await pg.fill('#buscar', pausa.folio);
  const filaPausa = pg.locator(`[data-filas] tr[data-folio="${pausa.folio}"]`);
  comprueba(/Pausa vencida/.test(await filaPausa.textContent()) && (await filaPausa.locator('a').count()) === 0, t('citas: la pausa de ayer sale vencida y sin «Retomar»'));
  await ir(`cotejo.html?folio=${pausa.folio}`, '[data-estado] .estado');
  comprueba(/La pausa venció/.test(await texto('main')) && await pg.isHidden('#formulario'), t('cotejo: una pausa vencida no se retoma'));

  // M1, M10 y A5: grupo de una organización confirmado
  const izta = d.organizacion.find((o) => o.nombre === 'Iztapalapa');
  const enEsperaIzta = d.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && s.organizacion_id === izta.id).length;
  await ir('grupo.html?folio=APD-G-2026-023', '[data-acciones] a, [data-acciones] p');
  comprueba((await texto('[data-acciones]')).includes(`Agregar personas de Iztapalapa (${enEsperaIzta} en espera)`), t(`grupo de Iztapalapa: cuenta sólo a su gente en espera (${enEsperaIzta})`));
  comprueba(/Recibe personas hasta el/.test(await texto('[data-cupo-texto]')), t('grupo confirmado: dice hasta cuándo recibe y cuántos lugares quedan'));
  comprueba(/09:00/.test(await texto('[data-datos]')) && !/09:00:00/.test(await texto('[data-datos]')), t('grupo: la hora de entrada sin segundos'));
  await ir('espera.html?curso=poda-nueva&grupo=APD-G-2026-023', '.bloque-adscripcion');
  const nombres = await pg.$$eval('.adscripcion-nombre', (l) => l.map((x) => x.textContent));
  comprueba(nombres.length === 1 && nombres[0] === 'Iztapalapa', t('espera desde el grupo de Iztapalapa: sólo su bloque'));

  // M2, M3 y M4: espera completa
  await ir('espera.html?curso=poda-nueva', '.bloque-adscripcion');
  const jardines = pg.locator('.bloque-adscripcion', { hasText: 'Jardines Ejemplo del Norte' });
  comprueba(/Su grupo APD-G-2026-021/.test(await jardines.locator('.fila-adscripcion').textContent()), t('espera: el bloque de Jardines dice su grupo por confirmar, no «alcanza para un grupo propio»'));
  comprueba((await pg.$$eval('[data-destinos] button', (l) => l.map((b) => b.textContent))).some((x) => /sólo Iztapalapa/.test(x)), t('espera: cada botón dice de quién es el grupo'));
  await pg.check('.bloque-adscripcion tr[data-folio] input');
  comprueba(/1 elegida/.test(await texto('[data-barra-cuenta]')) && /un grupo recibe hasta 25/.test(await texto('[data-elegidas]')), t('espera: la barra lleva la cuenta y se dice cuántas caben'));
  await sinDesborde('espera');
  // Las confirmaciones no escriben «null» (auditoría integral: un hueco en la lista se veía como texto)
  const indep = pg.locator('.bloque-adscripcion', { hasText: 'Independiente' }).locator('tr[data-folio] input');
  await indep.nth(0).check(); await indep.nth(1).check();
  await pg.click('[data-destinos] button:has-text("Crear un grupo")');
  await pg.waitForSelector('dialog[open]');
  comprueba(!/\bnull\b|\bundefined\b/.test(await pg.textContent('dialog[open]')), t('confirmación de crear un grupo: sin «null» ni «undefined»'));
  await pg.click('dialog[open] [data-r="no"]');
  comprueba(await pg.evaluate(() => { const m = document.querySelector('[data-tabla]'); return m.scrollWidth <= m.clientWidth + 1; }), t('espera: la tabla no se ensancha (no hay que desplazarla de lado)'));

  // M7: «Grupos» lista todos los grupos que reciben
  await ir('grupos.html', '.curso');
  const poda = await pg.locator('.curso', { hasText: 'Poda y derribo · nueva' }).textContent();
  comprueba(['APD-G-2026-004', 'APD-G-2026-021', 'APD-G-2026-022', 'APD-G-2026-023'].every((f) => poda.includes(f)) && /grupos nuevos/.test(poda), t('grupos: la tarjeta lista todos los grupos que reciben y cuántos grupos nuevos alcanzan'));
  await sinDesborde('grupos');

  // M8: la bandeja resume cuántas llevan más tiempo
  await ir('revision.html', '[data-filas] tr');
  comprueba(/con 10 días o más/.test(await texto('[data-cuenta]')), t('bandeja: la cuenta dice cuántas llevan 10 días o más'));

  // M5: al fijar la cita se ve cuántas hay ese día y a esa hora
  const enviada = d.solicitud.find((s) => s.estado === 'enviada' && s.folio >= 'APD-S-2026-00500');
  await ir(`revisar.html?folio=${enviada.folio}`, '#cita_fecha');
  const manana = new Date(`${hoy}T12:00:00-06:00`); manana.setDate(manana.getDate() + 1);
  const dia = manana.toISOString().slice(0, 10);
  const nDia = d.cita.filter((c) => c.resultado === 'pendiente' && c.programada_en.startsWith(dia)).length;
  await pg.evaluate((v) => { const f = document.getElementById('cita_fecha'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }, dia);
  // Los campos de la cita se muestran al validar; aquí se llenan directo para leer la carga
  await pg.evaluate(() => { const h = document.getElementById('cita_hora'); h.value = '09:00'; h.dispatchEvent(new Event('change', { bubbles: true })); });
  comprueba((await texto('[data-carga-cita]')).includes(`Ese día ya hay ${nDia} citas`), t(`revisar: al fijar la cita se ve que ese día ya hay ${nDia}`));

  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
  await ctx.close();
}
await navegador.close();
console.log(fallas ? `\n${fallas} comprobación(es) fallida(s).` : '\nTodas las comprobaciones correctas.');
process.exit(fallas ? 1 : 0);
