// Pruebas de las pantallas del personal con volumen real (auditoría de tareas, 2026-10-17).
// Genera el escenario de herramientas/escenario-volumen.mjs (65 por revisar, 40 citas en un día, 112 en espera,
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
execFileSync('node', [join(raiz, 'herramientas/escenario-volumen.mjs'), join(raiz, 'sitio/datos/ficticios.json'), salida], { stdio: 'inherit' });
const cuerpo = readFileSync(salida);
const d = JSON.parse(cuerpo);
const hoy = d.fecha_corte;

let fallas = 0;
let total = 0;
const comprueba = (ok, texto) => { total += 1; console.log(`${ok ? 'BIEN' : 'MAL '}  ${texto}`); if (!ok) fallas += 1; };

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
  // Cada parte corre aunque otra se detenga (auditoría 2026-10-19, A1-02): la parte detenida cuenta como falla
  const paso = async (nombre, fn) => { try { await fn(); } catch (e) { comprueba(false, t(`${nombre}: se detuvo: ${String(e.message || e).split('\n')[0]}`)); } };

  await paso('aplicar: mis grupos de hoy', async () => {
    // A2 y propuesta D (2026-10-18): sin ?folio=, «Mis grupos de hoy»: una tarjeta por grupo del instructor con clase o
    // examen hoy; los que presentan examen llevan a «Aplicar el examen», que deja cambiar a los otros grupos en curso
    await ir('aplicar.html', '.hoy-grupo');
    const tarjetas = await pg.$$eval('.hoy-grupo', (l) => l.map((x) => [x.querySelector('.grupo-folio').textContent, x.querySelector('a.btn').getAttribute('href')]));
    comprueba(tarjetas.length === 4 && tarjetas.some(([f, h]) => f === 'APD-G-2026-020' && /aplicar\.html\?folio=APD-G-2026-020/.test(h))
      && tarjetas.some(([f, h]) => f === 'APD-G-2026-024' && /asistencia\.html/.test(h)), t('aplicar sin folio: «Mis grupos de hoy» con los 4 grupos del instructor y la acción de cada uno'));
    await sinDesborde('aplicar (mis grupos de hoy)');
    await ir('aplicar.html?folio=APD-G-2026-020', '[data-grupo] .datos-valor');
    comprueba(/Otros grupos en curso/.test(await texto('[data-grupo]')), t('aplicar: el grupo con examen hoy ofrece los otros grupos en curso'));
    await sinDesborde('aplicar');
    await ir('aplicar.html?folio=APD-G-2026-024', '[data-grupo] .datos-valor');
    const ap = await texto('[data-grupo]');
    comprueba(/no hoy/.test(ap) && /Faltan días del curso por capturar/.test(ap), t('aplicar: otro grupo avisa que su examen no es hoy y que faltan días por capturar'));

  });

  await paso('asistencia', async () => {
    // A1 y M9: asistencia señala el día sin capturar y resume el grupo
    await ir('asistencia.html?folio=APD-G-2026-024', '.asistencia-fila');
    comprueba(/sin capturar/.test(await texto('[data-dias]')) && /Falta capturar el día 2/.test(await texto('[data-avisos]')), t('asistencia: el día 2 pasado sin capturar se señala arriba y en «Corregir otro día»'));
    comprueba(/asisti|falt/.test(await texto('[data-totales]')), t('asistencia: lo marcado se resume junto a «Guardar»'));
    await sinDesborde('asistencia');

  });

  await paso('citas y pausa vencida', async () => {
    // A3 y M6: citas de días anteriores sin registrar y pausa vencida
    await ir('citas.html', '[data-filas] tr');
    comprueba(/3 citas de días anteriores están sin registrar/.test(await texto('[data-atrasadas]')), t('citas: aviso de las 3 citas de días anteriores sin registrar'));
    // Como RI-09 en «Asistencia» (auditoría 2026-10-20): se ve, pero no es una alerta que suene en cada carga
    comprueba(await pg.isVisible('[data-atrasadas] .aviso') && !(await pg.$('[data-atrasadas] [role="alert"]')), t('citas (como RI-09): el aviso de las citas sin registrar se ve, pero no es una alerta que suene al cargar'));
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

  });

  await paso('grupo de una organización', async () => {
    // M1, M10 y A5: grupo de una organización confirmado
    const izta = d.organizacion.find((o) => o.nombre === 'Iztapalapa');
    const enEsperaIzta = d.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && s.organizacion_id === izta.id).length;
    await ir('grupo.html?folio=APD-G-2026-023', '[data-acciones] a, [data-acciones] p');
    comprueba((await texto('[data-acciones]')).includes(`Agregar personas de Iztapalapa (${enEsperaIzta} en espera)`), t(`grupo de Iztapalapa: cuenta sólo a su gente en espera (${enEsperaIzta})`));
    comprueba(/Recibe personas hasta el/.test(await texto('[data-cupo-texto]')), t('grupo confirmado: dice hasta cuándo recibe y cuántos lugares quedan'));
    comprueba(/09:00/.test(await texto('[data-datos]')) && !/09:00:00/.test(await texto('[data-datos]')), t('grupo: la hora de entrada sin segundos'));
    // Desde la ficha (la dirección vieja espera.html lleva a Grupos con el grupo): sólo su gente
    await ir('espera.html?curso=poda-nueva&grupo=APD-G-2026-023', '.plan-persona input');
    const orgs = await pg.$$eval('.plan-persona-org, .plan-bloque-nombre', (l) => l.map((x) => x.textContent));
    comprueba(/grupos\.html\?curso=poda-nueva&grupo=APD-G-2026-023/.test(pg.url()) && (await pg.$$('.plan-persona input')).length === enEsperaIzta && orgs.every((x) => /^Iztapalapa/.test(x)),
      t('espera desde el grupo de Iztapalapa: lleva a Grupos y sólo muestra a su gente'));

  });

  // A1-04 (auditoría 2026-10-19): «Programar» con toda la espera del curso, sin personas elegidas en «Grupos»
  // (antes del planeador, que agrega dos personas a un grupo)
  await paso('programar con toda la espera', async () => {
    const espera = d.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva').length;
    await ir('programar.html?curso=poda-nueva', '.cal-dia');
    await pg.waitForSelector('[data-personas] .plan-casilla[value]');
    const casillas = await pg.$$eval('[data-personas] .plan-casilla[value]', (l) => [l.length, l.filter((k) => k.checked).length]);
    comprueba(casillas[0] === espera && casillas[1] > 0 && casillas[1] <= 25, t(`programar: lista a las ${casillas[0]} de ${espera} en espera y propone ${casillas[1]} (hasta 25)`));
    await sinDesborde(`programar con ${espera} en espera`);
  });

  await paso('planeador y programar', async () => {
    // M2, M3, M4 y M7 con el planeador (propuesta A): toda la espera, todos los grupos que reciben y cada botón dice cuál
    await ir('grupos.html?curso=poda-nueva', '.plan-grupo');
    const destinos = await pg.$$eval('[data-destinos] button', (l) => l.map((b) => b.textContent));
    comprueba(destinos.length === 5 && destinos.some((x) => /Iztapalapa/.test(x)) && destinos.some((x) => /Jardines Ejemplo del Norte/.test(x) && /APD-G-2026-021/.test(x)),
      t('planeador: un botón por grupo que recibe, con su nombre (de quién es y sus fechas)'));
    comprueba((await Promise.all(['APD-G-2026-004', 'APD-G-2026-005', 'APD-G-2026-021', 'APD-G-2026-022', 'APD-G-2026-023'].map((f) => pg.locator(`.plan-grupo[data-grupo="${f}"]`).count()))).every((n) => n === 1), t('planeador: todos los grupos que reciben están en su semana o en «Sin fecha»'));
    comprueba((await pg.$$('.plan-semana[data-semana="2026-10-26"] .plan-grupo')).length === 2, t('planeador: una semana con dos grupos los muestra a los dos'));
    comprueba(/falta 1 para confirmarlo|faltan 2 para confirmarlo/.test(await texto('.plan-grupo[data-grupo="APD-G-2026-021"]')), t('planeador: el grupo de Jardines dice cuántas le faltan'));
    await pg.check('.plan-persona input');
    comprueba(/1 elegida/.test(await texto('[data-elegidas]')), t('planeador: la barra lleva la cuenta de elegidas'));
    await sinDesborde('planeador con 112 en espera');
    // R4-03 (decisión 2 de la auditoría del 2026-10-19): el bloque de una organización dice «su grupo» y cuántas le faltan
    const cabJardines = (await pg.$$eval('.plan-bloque-cabeza', (l) => l.map((x) => x.textContent))).find((x) => /Jardines/.test(x)) || '';
    comprueba(/Su grupo APD-G-2026-021: 3 de 25, le faltan 2 para el mínimo/.test(cabJardines), t('planeador: el bloque de Jardines dice «Su grupo APD-G-2026-021» y cuántas le faltan'));
    comprueba((await pg.$$eval('.plan-bloque-cabeza', (l) => l.map((x) => x.textContent))).some((x) => /grupo propio de 5; o van a un grupo combinado|Alcanza para un grupo propio/.test(x)),
      t('planeador: el bloque de una organización sin grupo dice si alcanzan para uno propio'));
    // … y «Programar» avisa antes de crearle un segundo grupo, y ofrece agregarlas al suyo
    const jardines = d.organizacion.find((o) => /Jardines/.test(o.nombre));
    const dosJardines = d.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda' && s.modalidad === 'nueva' && s.organizacion_id === jardines.id).slice(0, 2).map((s) => s.folio);
    await ir(`programar.html?curso=poda-nueva&personas=${dosJardines.join(',')}`, '.cal-dia');
    comprueba(await pg.isVisible('[data-su-grupo] .aviso') && /ya tiene su grupo/.test(await texto('[data-su-grupo]')) && /APD-G-2026-021/.test(await texto('[data-su-grupo]')),
      t('programar: con personas de Jardines, avisa que ya tiene su grupo APD-G-2026-021'));
    await pg.check('input[name="integracion"][value="especifico"]');
    await pg.click('[data-programar="guardar"]');
    await pg.waitForSelector('dialog.dialogo-confirma[open]');
    comprueba(/¿Crear otro grupo de Jardines/.test(await texto('dialog.dialogo-confirma[open]')), t('programar: crear un segundo grupo de Jardines pide confirmación'));
    await pg.click('dialog.dialogo-confirma[open] [data-r="no"]');
    await pg.waitForTimeout(300);
    comprueba((await pg.evaluate(() => JSON.parse(localStorage.getItem('apd.personal.grupos') || '[]').filter((e) => e.tipo === 'crear').length)) === 0, t('programar: con «No» no se crea el segundo grupo'));
    await Promise.all([pg.waitForURL(/grupo\.html/), pg.click('[data-su-grupo] button')]);
    await pg.waitForSelector('[data-filas] tr');
    comprueba(/grupo\.html\?folio=APD-G-2026-021/.test(pg.url()) && (await Promise.all(dosJardines.map((f) => pg.isVisible(`[data-filas] tr[data-folio="${f}"]`)))).every(Boolean),
      t('programar: «Agregarlas a APD-G-2026-021» las agrega a su grupo y abre su ficha'));

  });

  await paso('bandeja', async () => {
    // M8: la bandeja resume cuántas llevan más tiempo
    await ir('revision.html', '[data-filas] tr');
    comprueba(/con 10 días o más/.test(await texto('[data-cuenta]')), t('bandeja: la cuenta dice cuántas llevan 10 días o más'));

  });

  await paso('cita en la revisión', async () => {
    // M5: al fijar la cita se ve cuántas hay ese día y a esa hora
    const enviada = d.solicitud.find((s) => s.estado === 'enviada' && s.folio >= 'APD-S-2026-00500');
    await ir(`revisar.html?folio=${enviada.folio}`, '#cita_fecha');
    const manana = new Date(`${hoy}T12:00:00-06:00`); manana.setDate(manana.getDate() + 1);
    const dia = manana.toISOString().slice(0, 10);
    const nDia = d.cita.filter((c) => c.resultado === 'pendiente' && c.programada_en.startsWith(dia)).length;
    // La fecha de la cita se escribe día/mes/año (formato «fecha-dma», auditoría 2026-10-18, D9)
    await pg.evaluate((v) => { const f = document.getElementById('cita_fecha'); f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }, dia.split('-').reverse().join('/'));
    // Los campos de la cita se muestran al validar; aquí se llenan directo para leer la carga
    await pg.evaluate(() => { const h = document.getElementById('cita_hora'); h.value = '09:00'; h.dispatchEvent(new Event('change', { bubbles: true })); });
    comprueba((await texto('[data-carga-cita]')).includes(`Ese día ya hay ${nDia} citas`), t(`revisar: al fijar la cita se ve que ese día ya hay ${nDia}`));

  });

  comprueba(errores.length === 0, t(`sin errores en la consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`));
  await ctx.close();
}

// B4-01, B1-01 y RI-01 (auditoría 2026-10-20; decisión 1 a y c): en «Grupos», con la espera de 66 personas, la barra de
// elegidas no tapa la casilla enfocada en las tres computadoras. Se recorre con Tab (y con Mayúsculas+Tab) toda la
// pantalla y se cuenta cada parada que queda oculta por completo por algo fijo o pegajoso (cinco puntos: el centro y las
// cuatro esquinas, como foco-recorrido.mjs del revisor independiente). La barra, que aquí mide más de un cuarto de la
// ventana, deja de ser fija.
for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768]]) {
  const tam = `${w}×${h}`;
  const ctx = await navegador.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
  const pg = await ctx.newPage();
  try {
    await pg.goto(BASE + 'grupos.html?curso=poda-nueva');
    await pg.waitForSelector('.plan-persona input');
    // La barra ya se ve y pasaron dos cuadros (su ResizeObserver ya la midió)
    await pg.waitForSelector('.plan-barra:not([hidden])');
    await pg.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))));
    const barra = await pg.evaluate(() => { const b = document.querySelector('.plan-barra'); return { pos: getComputedStyle(b).position, alto: b.getBoundingClientRect().height }; });
    comprueba(barra.alto <= h / 4 || barra.pos === 'static', `[${tam}] grupos con volumen: la barra de elegidas (${Math.round(barra.alto)} px, ${Math.round(barra.alto / h * 100)} % de la ventana) deja de ser fija si mide más de un cuarto`);
    for (const tecla of ['Tab', 'Shift+Tab']) {
      await pg.evaluate(() => { window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); });
      let paradas = 0; let casillas = 0; const ocultas = [];
      for (let k = 0; k < 400; k++) {
        await pg.keyboard.press(tecla);
        const m = await pg.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return listo(null);
          const fijos = [...document.querySelectorAll('body *')].filter((x) => /fixed|sticky/.test(getComputedStyle(x).position) && !x.contains(a) && x.checkVisibility());
          const r = a.getBoundingClientRect();
          const puntos = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 1, r.top + 1], [r.right - 1, r.top + 1], [r.left + 1, r.bottom - 1], [r.right - 1, r.bottom - 1]]
            .filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
          const tapado = puntos.length > 0 && puntos.every(([x, y]) => { const e = document.elementFromPoint(x, y); return e && fijos.some((f) => f.contains(e)); });
          listo({ casilla: a.matches('.plan-casilla, .plan-bloque input'), tapado, nombre: (a.getAttribute('aria-label') || a.closest('label, .plan-persona')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), primero: window.__primero === a, marca: (window.__primero = window.__primero || a) });
        }))));
        if (!m) continue;
        if (m.primero && paradas > 0) break;
        paradas += 1; if (m.casilla) casillas += 1;
        if (m.tapado) ocultas.push(m.nombre);
      }
      await pg.evaluate(() => { window.__primero = null; });
      comprueba(casillas >= 66 && ocultas.length === 0, `[${tam}] grupos con volumen, ${tecla}: ninguna de las ${paradas} paradas (${casillas} casillas) queda oculta por completo por la barra${ocultas.length ? `: ${ocultas.length}, p. ej. «${ocultas[0]}»` : ''}`);
    }
  } catch (e) { comprueba(false, `[${tam}] grupos con volumen, foco no oculto: se detuvo: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close();
}

// RI-09 y B4-03 (auditoría 2026-10-20): en «Asistencia» del grupo de 25 con el día 2 sin capturar, «Falta capturar el día
// 2» se ve pero no es una alerta que suene en cada carga, y los totales se anuncian sólo al marcar a alguien. Se observa
// cada cambio de texto de las regiones vivas (como guiones/ri/gestion-foco.mjs).
{
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
  await ctx.addInitScript(() => {
    const SEL = '[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],output';
    const ev = (window.__vivas = []); const ult = new WeakMap(); window.__marca = 0;
    const revisa = () => { for (const r of document.querySelectorAll(SEL)) { const t = r.checkVisibility() || r.closest('.solo-lector') ? r.textContent.replace(/\s+/g, ' ').trim() : ''; const a = ult.get(r); ult.set(r, t); if (t && t !== a) ev.push({ marca: window.__marca, rol: r.getAttribute('role') || '', texto: t }); } };
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; queueMicrotask(() => { pend = false; revisa(); }); }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'role', 'aria-live'] });
  });
  const pg = await ctx.newPage();
  const de = (k) => pg.evaluate((m) => window.__vivas.filter((e) => e.marca === m && !/^\(vacío\)$|_/.test(e.texto)), k);
  try {
    await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-024');
    await pg.waitForSelector('.asistencia-fila');
    await pg.waitForFunction(() => /asisti/.test(document.querySelector('[data-totales]').textContent));
    await pg.evaluate(() => new Promise((listo) => setTimeout(listo, 300)));
    const alCargar = await de(0);
    comprueba(/Falta capturar el día 2/.test(await texto('[data-avisos]')) && !(await pg.$('[data-avisos] [role="alert"]')) && !alCargar.some((e) => e.rol === 'alert'),
      'asistencia (RI-09): «Falta capturar el día 2» se ve, pero no es una alerta que suene al cargar');
    comprueba(!alCargar.some((e) => /sin marcar|asisti/.test(e.texto)), `asistencia (B4-03): al cargar no se anuncian los totales (${alCargar.map((e) => e.texto.slice(0, 40)).join(' | ') || 'nada'})`);
    await pg.evaluate(() => { window.__marca = 1; });
    await pg.focus('.asistencia-fila .asis-opcion-input:not([disabled])');
    await pg.keyboard.press('Space');
    await pg.waitForFunction(() => window.__vivas.some((e) => e.marca === 1), null, { timeout: 4000 }).catch(() => {});
    await pg.evaluate(() => new Promise((listo) => setTimeout(listo, 300)));
    const marcar = await de(1);
    comprueba(marcar.length === 1 && /1 asistió/.test(marcar[0].texto), `asistencia (B4-03): marcar a una persona anuncia los totales una vez (${marcar.map((e) => e.texto).join(' | ')})`);
  } catch (e) { comprueba(false, `asistencia, anuncios: se detuvo: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close();
  async function texto(sel) { return pg.textContent(sel); }
}
await navegador.close();
console.log(fallas ? `\n${fallas} de ${total} comprobación(es) fallida(s).` : `\nLas ${total} comprobaciones, correctas.`);
process.exit(fallas ? 1 : 0);
