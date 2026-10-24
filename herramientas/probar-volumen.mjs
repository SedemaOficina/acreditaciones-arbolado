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
    // Sesión de trabajo del 23/10/2026: cursos de lunes a viernes y como máximo 2 grupos a la vez. Con el corte en miércoles,
    // los dos grupos del instructor van en su día 3 (ninguno presenta examen hoy): cada uno lleva a «Asistencia»
    comprueba(tarjetas.length === 2 && ['APD-G-2026-003', 'APD-G-2026-020'].every((g) => tarjetas.some(([f, h]) => f === g && /asistencia\.html/.test(h))),
      t('aplicar sin folio: «Mis grupos de hoy» con los 2 grupos del instructor y la acción de cada uno'));
    await sinDesborde('aplicar (mis grupos de hoy)');
    await ir('aplicar.html?folio=APD-G-2026-020', '[data-grupo] .datos-valor');
    comprueba(/Otros grupos en curso/.test(await texto('[data-grupo]')), t('aplicar: el grupo ofrece los otros grupos en curso'));
    await sinDesborde('aplicar');
    await ir('aplicar.html?folio=APD-G-2026-003', '[data-grupo] .datos-valor');
    const ap = await texto('[data-grupo]');
    comprueba(/no hoy/.test(ap) && /Faltan días del curso por capturar/.test(ap), t('aplicar: otro grupo avisa que su examen no es hoy y que faltan días por capturar'));

  });

  // C1-02 (auditoría 2026-10-20; decisión 14 a de Liber): la fotografía con que se confirma la identidad es una miniatura
  // de 96 px que se amplía ahí mismo a unos 320 px (en teléfono, al ancho de la tarjeta) con clic o con el teclado
  await paso('aplicar: fotografía ampliable', async () => {
    await ir('aplicar.html?folio=APD-G-2026-020', '[data-filas] tr .examen-foto-boton img');
    const foto = '[data-filas] tr:first-child .examen-foto-lista';
    const ancho = () => pg.$eval(foto, (f) => Math.round(f.getBoundingClientRect().width));
    const mini = await ancho();
    await pg.click(foto);
    await pg.waitForFunction((s) => document.querySelector(s).getBoundingClientRect().width > 200, foto);
    const grande = await ancho();
    const dentro = await pg.$eval(foto, (f) => { const r = f.getBoundingClientRect(); const t = f.closest('tr').getBoundingClientRect(); return r.right <= t.right + 1; });
    await pg.keyboard.press('Enter');
    await pg.waitForFunction((s) => document.querySelector(s).getBoundingClientRect().width < 120, foto);
    const nombre = await pg.getAttribute('[data-filas] tr:first-child .examen-foto-boton', 'aria-label');
    comprueba(mini >= 96 && grande >= (tam === 'teléfono' ? 280 : 300) && dentro && /^Ampliar la fotografía de /.test(nombre),
      t(`C1-02: la fotografía mide ${mini} px y se amplía a ${grande} px sin salirse de su renglón; con Intro se reduce («${nombre}»)`));
    await sinDesborde('aplicar con la fotografía');
  });

  // C1-06 (auditoría 2026-10-20): en «Otros grupos en curso» un nombre que se repite lleva su folio y cuántas personas tiene.
  // Desde la sesión del 23/10/2026 (de lunes a viernes, como máximo 2 grupos a la vez) ningún par de grupos en curso se
  // llama igual en este escenario: se comprueba que no se repite ningún nombre ni el del grupo en pantalla
  await paso('aplicar: otros grupos con el mismo nombre', async () => {
    await ir('aplicar.html?folio=APD-G-2026-020', '.otros-grupos a');
    const enlaces = await pg.$$eval('.otros-grupos a', (l) => l.map((a) => a.textContent.trim()));
    const actual = await texto('[data-grupo] .grupo-nombre');
    const de006 = enlaces.find((x) => /APD-G-2026-006/.test(x)) || '';
    comprueba(new Set(enlaces).size === enlaces.length && enlaces.every((x) => !x.startsWith(`${actual} (`)) && /APD-G-2026-006|Poda nueva · del 5 al 9 de octubre/.test(de006 || enlaces.join(' ')),
      t(`C1-06: «Otros grupos en curso» no repite el nombre del grupo en pantalla («${de006}»)`));
  });

  // C4-07 (auditoría 2026-10-20): en la ficha de un grupo en curso, la situación de la lista y la del concentrado coinciden
  await paso('grupo en curso: situación y concentrado', async () => {
    await ir('grupo.html?folio=APD-G-2026-020', '[data-conc-filas] tr');
    const r = await pg.evaluate(() => {
      const quien = (tr) => tr.querySelector('td').textContent.trim();
      const conc = Object.fromEntries([...document.querySelectorAll('[data-conc-filas] tr')].map((tr) => [quien(tr), /Sin derecho/.test(tr.lastElementChild.textContent)]));
      const lista = [...document.querySelectorAll('[data-filas] tr')].map((tr) => [quien(tr), /Sin derecho a examen/.test(tr.textContent), /Inscrita/.test(tr.textContent)]);
      return { sinDerecho: Object.values(conc).filter(Boolean).length, distintas: lista.filter(([q, sd, ins]) => conc[q] !== sd || (conc[q] && ins)).map(([q]) => q) };
    });
    comprueba(r.sinDerecho === 4 && !r.distintas.length, t(`C4-07: grupo APD-G-2026-020, las ${r.sinDerecho} sin derecho del concentrado se ven así en la lista${r.distintas.length ? `; no coinciden: ${r.distintas.join(', ')}` : ''}`));
  });

  await paso('asistencia', async () => {
    // A1 y M9: asistencia señala el día sin capturar y resume el grupo
    // El día 2 sin capturar: el grupo de la alcaldía, al que el escenario le quita ese día (sesión del 23/10/2026)
    await ir('asistencia.html?folio=APD-G-2026-003', '.asistencia-fila');
    comprueba(/sin capturar/.test(await texto('[data-dias]')) && /Falta capturar el día 2/.test(await texto('[data-avisos]')), t('asistencia: el día 2 pasado sin capturar se señala arriba y en «Corregir otro día»'));
    comprueba(/asisti|falt/.test(await texto('[data-totales]')), t('asistencia: lo marcado se resume junto a «Guardar»'));
    await sinDesborde('asistencia');
    // C1-05 (auditoría 2026-10-20): el aviso trae el enlace al día que falta, que abre ese día para capturarlo
    const enlace = pg.locator('[data-avisos] a', { hasText: 'Capturar el día 2' });
    comprueba((await enlace.count()) === 1 && /asistencia\.html\?folio=APD-G-2026-003&dia=2$/.test(await enlace.getAttribute('href')), t('C1-05: «Falta capturar el día 2» trae el enlace «Capturar el día 2»'));
    await Promise.all([pg.waitForURL(/dia=2/), enlace.click()]);
    await pg.waitForSelector('.asistencia-fila');
    comprueba(/Corregir el día 2 de 5/.test(await texto('[data-titulo-dia]')), t('C1-05: el enlace abre el día 2 para capturarlo'));

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
    // C4-08 (auditoría 2026-10-20): la cuenta del día suma igual que la situación de sus filas; la que está en pausa no
    // va «por atender». C1-07: con «Por atender» quedan las del día sin resultado (también la de la pausa)
    await ir('citas.html', '[data-filas] tr');
    const situaciones = async () => pg.$$eval('[data-filas] tr:not([hidden])', (l) => l.map((tr) => tr.querySelector('.estado').textContent.trim()));
    const filasHoy = await situaciones();
    const nPausa = filasHoy.filter((x) => /^En pausa/.test(x)).length;
    const nPor = filasHoy.filter((x) => /^Por atender/.test(x)).length;
    comprueba(nPausa === 1 && (await texto('[data-cuenta]')).trim() === `${filasHoy.length} citas: ${nPor} por atender, 1 en pausa.`,
      t(`C4-08: «${(await texto('[data-cuenta]')).trim()}» con ${nPor} filas «Por atender» y ${nPausa} en pausa`));
    await pg.selectOption('#ver', 'por-atender');
    await pg.waitForFunction(() => /sin resultado/.test(document.querySelector('[data-cuenta]').textContent));
    comprueba((await situaciones()).length === nPor + nPausa, t(`C1-07: con «Por atender» quedan las ${nPor + nPausa} citas de hoy sin resultado`));
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
    // C3-01 (auditoría 2026-10-20; decisión de Liber, opción a): a la vista las propuestas; las demás, plegadas en
    // «Cambiar a quiénes van (N más en espera)», y al desplegarlo se ven y se eligen
    const vis = () => pg.$$eval('[data-personas] .plan-casilla[value]', (l) => l.filter((k) => k.checkVisibility()).map((k) => k.checked));
    const antes = await vis();
    const resumen = (await texto('[data-mas-espera] > summary.plegable-titulo')).trim();
    const pantallas = await pg.evaluate(() => document.documentElement.scrollHeight / innerHeight);
    await pg.click('[data-mas-espera] > summary');
    const despues = await vis();
    const folioOtra = await pg.getAttribute('[data-mas-espera] .plan-casilla[value]:not(:checked)', 'value');
    const otra = pg.locator(`[data-mas-espera] .plan-casilla[value="${folioOtra}"]`);
    await otra.check();
    comprueba(antes.length === casillas[1] && antes.every(Boolean) && resumen === `Cambiar a quiénes van (${espera - casillas[1]} más en espera)`
      && despues.length === espera && await otra.isChecked() && (tam !== 'teléfono' || pantallas < 8.5),
      t(`C3-01: «Programar» abre con las ${antes.length} propuestas a la vista y «${resumen}» plegado (${pantallas.toFixed(1)} pantallas); al desplegarlo se ven las ${despues.length} y se eligen`));
    await sinDesborde(`programar con ${espera} en espera`);
  });

  // C1-01 (auditoría 2026-10-20): arriba de la lista, cuántas son prioritarias (desde 15 días desde la sesión de trabajo del
  // 23/10/2026, P143; antes «31 días o más») y cuántos grupos nuevos alcanzan (M7). Antes del paso que agrega personas a un grupo.
  await paso('planeador: cifras de la espera', async () => {
    await ir('grupos.html?curso=poda-nueva', '.plan-persona');
    const n = (await pg.$$('.plan-persona')).length;
    const prio = await pg.$$eval('.plan-persona', (l) => l.filter((x) => /prioritaria/.test(x.textContent)).length);
    const nuevos = Math.floor(n / 25) + (n % 25 >= 5 ? 1 : 0);
    const cuenta = (await texto('[data-cuenta]')).trim();
    const dias = (x) => Math.round((Date.parse(`${hoy}T12:00:00-06:00`) - Date.parse(`${new Date(x.lista_para_curso_en || x.estado_desde).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })}T12:00:00-06:00`)) / 86400000);
    const esperan = d.solicitud.filter((x) => x.estado === 'lista_para_curso' && x.tipo_acreditacion === 'poda' && x.modalidad === 'nueva');
    const prioDatos = esperan.filter((x) => dias(x) >= 15).length;
    comprueba(n === esperan.length && prio === prioDatos && cuenta.includes(`${n} personas en espera (${prio} esperan 15 días o más)`) && cuenta.includes(`Alcanza para ${nuevos} grupos nuevos de hasta 25.`)
      && (await pg.evaluate(() => document.querySelector('[data-cuenta]').compareDocumentPosition(document.querySelector('[data-personas]')) & Node.DOCUMENT_POSITION_FOLLOWING)),
      t(`C1-01: arriba de la lista, «${cuenta}»`));
  });

  // C1-03 (auditoría 2026-10-20; decisión 11 b de Liber): en renovación, el planeador y «Programar» muestran los bloques
  // por su vencimiento más antiguo y, dentro, primero las vencidas; la propuesta toma primero a las vencidas (aunque
  // parta un bloque) y el encabezado dice ese orden
  await paso('espera de renovación', async () => {
    for (const pantalla of ['grupos', 'programar']) {
      await ir(`${pantalla}.html?curso=poda-renovacion`, '.plan-persona');
      const r = await pg.evaluate(() => {
        const unidades = [...document.querySelector('[data-personas]').children].map((n) => (n.matches('li') ? n.firstElementChild : n)).map((n) =>
          [...(n.matches('.plan-bloque') ? n.querySelectorAll('.plan-persona') : [n])].map((f) => { const m = f.textContent.match(/(Vencida|Vence) el (\d{2})\/(\d{2})\/(\d{4})/); return { vencida: m[1] === 'Vencida', iso: `${m[4]}-${m[3]}-${m[2]}` }; }));
        return { unidades, nota: (document.querySelector('[data-orden]') || document.querySelector('[data-propuesta]')).textContent };
      });
      const antigua = r.unidades.map((u) => u.map((p) => p.iso).sort()[0]);
      const enOrden = antigua.every((f, i) => !i || antigua[i - 1] <= f);
      const dentro = r.unidades.every((u) => u.every((p, i) => !i || !p.vencida || u[i - 1].vencida));
      const cinco = await pg.evaluate(() => APD.cargar().then((x) => APD_PERSONAL.lasQueMasEsperan(APD_PERSONAL.enEspera(x, 'poda', 'renovacion'), 5).map((y) => y.vencida)));
      comprueba(enOrden && dentro && cinco.length === 5 && cinco.every(Boolean) && /vencid|vencieron/.test(r.nota),
        t(`C1-03: ${pantalla} de renovación, bloques por su vencimiento más antiguo, dentro primero las vencidas y la propuesta de 5 con ${cinco.filter(Boolean).length} vencidas («${r.nota.slice(0, 60)}…»)`));
    }
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
    // R4-03 (decisión 2 de la auditoría del 2026-10-19): el bloque de una organización dice «su grupo» y cuántas le faltan.
    // Desde la sesión de trabajo del 23/10/2026 sólo las instituciones de gobierno van en bloque: Iztapalapa (alcaldía) con
    // su grupo APD-G-2026-023; las de Jardines (empresa) van una por una y cada fila dice su grupo
    const cabIzta = (await pg.$$eval('.plan-bloque-cabeza', (l) => l.map((x) => x.textContent))).find((x) => /^Iztapalapa/.test(x)) || '';
    comprueba(/Su grupo APD-G-2026-023: 18 de 25, caben 7/.test(cabIzta), t(`planeador: el bloque de Iztapalapa dice «Su grupo APD-G-2026-023» y cuántas caben («${cabIzta.slice(0, 90)}»)`));
    const filasJardines = await pg.$$eval('[data-personas] > .plan-persona', (l) => l.map((x) => x.textContent).filter((x) => /Jardines/.test(x)));
    comprueba(filasJardines.length > 1 && filasJardines.every((x) => /Su grupo APD-G-2026-021: 3 de 25, le faltan 2 para el mínimo/.test(x))
      && !(await pg.$$eval('.plan-bloque-nombre', (l) => l.some((x) => /Jardines/.test(x.textContent)))),
      t(`planeador: las ${filasJardines.length} de Jardines (empresa) van una por una, sin bloque, y cada una dice «Su grupo APD-G-2026-021»`));
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
    await pg.evaluate(() => { const h = document.getElementById('cita_hora'); h.value = '09:30'; h.dispatchEvent(new Event('change', { bubbles: true })); });
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
    // El alto visible: fija, la barra se extiende por debajo de la ventana (sesión del 23/10, parte B) y esa parte no se ve
    const barra = await pg.evaluate(() => { const b = document.querySelector('.plan-barra'); const r = b.getBoundingClientRect(); return { pos: getComputedStyle(b).position, alto: Math.min(r.bottom, innerHeight) - r.top }; });
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
    await pg.goto(BASE + 'asistencia.html?folio=APD-G-2026-003');
    await pg.waitForSelector('.asistencia-fila');
    await pg.waitForFunction(() => /asisti/.test(document.querySelector('[data-totales]').textContent));
    await pg.evaluate(() => new Promise((listo) => setTimeout(listo, 300)));
    const alCargar = await de(0);
    comprueba(/Falta capturar el día 2/.test(await texto('[data-avisos]')) && !(await pg.$('[data-avisos] [role="alert"]')) && !alCargar.some((e) => e.rol === 'alert'),
      'asistencia (RI-09): «Falta capturar el día 2» se ve, pero no es una alerta que suene al cargar');
    comprueba(!alCargar.some((e) => /sin marcar|asisti/.test(e.texto)), `asistencia (B4-03): al cargar no se anuncian los totales (${alCargar.map((e) => e.texto.slice(0, 40)).join(' | ') || 'nada'})`);
    await pg.evaluate(() => { window.__marca = 1; });
    await pg.focus('.asistencia-fila .opcion-input:not([disabled])');
    await pg.keyboard.press('Space');
    await pg.waitForFunction(() => window.__vivas.some((e) => e.marca === 1), null, { timeout: 4000 }).catch(() => {});
    await pg.evaluate(() => new Promise((listo) => setTimeout(listo, 300)));
    const marcar = await de(1);
    comprueba(marcar.length === 1 && /1 asistió/.test(marcar[0].texto), `asistencia (B4-03): marcar a una persona anuncia los totales una vez (${marcar.map((e) => e.texto).join(' | ')})`);
  } catch (e) { comprueba(false, `asistencia, anuncios: se detuvo: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close();
  async function texto(sel) { return pg.textContent(sel); }
}
// D4-04 (auditoría 2026-10-20; decisión 15 b: respuesta ≤ 200 ms): en «Citas de cotejo» con volumen (40 citas hoy y 30 los
// días siguientes), cada tecla de «Buscar» responde pronto con el procesador 4× más lento (Emulation.setCPUThrottlingRate,
// como d4-interaccion.mjs de r5). Se mide de cada evento «input» al cuadro siguiente ya pintado y, aparte, de la última
// tecla a la agenda ya filtrada (se filtra al dejar de teclear 150 ms). Antes de la corrección, en el equipo de la
// auditoría: 472 a 568 ms por tecla. La máquina de GitHub es más lenta y variable: los topes de la prueba son amplios
// (400 ms por tecla, el doble del presupuesto; 1 s hasta la agenda filtrada) y además se comprueba la causa, que no
// depende de la máquina: al seguir escribiendo no se vuelven a preparar las celdas de la tabla (sin cambios de
// data-etiqueta) ni se reescribe la hora de las filas.
{
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
  await ctx.addInitScript(() => {
    window.__teclas = [];
    window.__mut = { etiquetas: 0, horas: 0 };
    window.addEventListener('input', (e) => {
      if (!e.target || e.target.id !== 'buscar') return;
      const t0 = e.timeStamp;
      window.__ultima = t0;
      requestAnimationFrame(() => setTimeout(() => window.__teclas.push(performance.now() - t0), 0));
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((l) => {
        for (const m of l) {
          const nodo = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          // La agenda quedó filtrada: la cuenta cambió (se toma el cuadro siguiente, ya pintado)
          if (nodo && nodo.closest('[data-cuenta]') && window.__ultima) { const u = window.__ultima; requestAnimationFrame(() => setTimeout(() => { window.__filtrada = performance.now() - u; }, 0)); }
          if (!window.__contar) continue;
          if (m.type === 'attributes' && m.attributeName === 'data-etiqueta') window.__mut.etiquetas += 1;
          if (m.type !== 'attributes' && nodo && nodo.closest('[data-filas] td:first-child')) window.__mut.horas += 1;
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-etiqueta'] });
    });
  });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(String(e)));
  try {
    await pg.goto(BASE + 'citas.html');
    await pg.waitForSelector('[data-filas] tr:not([hidden])');
    const nFilas = await pg.locator('[data-filas] tr').count();
    const cdp = await ctx.newCDPSession(pg);
    await pg.click('#buscar');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // Primera tecla: pasa del día a la búsqueda (la columna cambia a «Fecha y hora»: ahí sí se preparan las celdas)
    await pg.keyboard.type('M');
    await pg.waitForFunction(() => document.querySelector('[data-col-hora]').textContent === 'Fecha y hora' && window.__teclas.length >= 1);
    const conM = await pg.textContent('[data-cuenta]');
    await pg.evaluate(() => { window.__contar = true; window.__mut = { etiquetas: 0, horas: 0 }; window.__filtrada = null; });
    await pg.keyboard.type('ODELO', { delay: 120 });
    await pg.waitForFunction((a) => window.__teclas.length >= 6 && window.__filtrada && document.querySelector('[data-cuenta]').textContent !== a, conM);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const r = await pg.evaluate(() => ({ teclas: window.__teclas.map(Math.round), filtrada: Math.round(window.__filtrada), mut: window.__mut, cuenta: document.querySelector('[data-cuenta]').textContent }));
    const peor = Math.max(...r.teclas);
    comprueba(peor <= 400 && r.filtrada <= 1000 && /coincide/.test(r.cuenta) && !errores.length,
      `citas con volumen (D4-04): con el procesador 4× más lento, cada tecla de «Buscar» responde en ${r.teclas.join(', ')} ms (peor ${peor}; tope de la prueba 400 ms; presupuesto 200 ms) y la agenda queda filtrada ${r.filtrada} ms después de la última tecla (tope 1 s), en ${nFilas} filas`);
    comprueba(r.mut.etiquetas === 0 && r.mut.horas === 0,
      `citas con volumen (D4-04): al seguir escribiendo no se vuelven a preparar las celdas (${r.mut.etiquetas} cambios de data-etiqueta) ni se reescribe la hora (${r.mut.horas} cambios)`);
    // Lo ya corregido sigue: la búsqueda se guarda en la pestaña y, al borrarla, la hora vuelve a ser sólo la hora
    const guardada = await pg.evaluate(() => sessionStorage.getItem('apd.citas.buscar'));
    const horaBusqueda = (await pg.textContent('[data-filas] tr:not([hidden]) td:first-child')).trim();
    await pg.fill('#buscar', '');
    await pg.waitForFunction(() => document.querySelector('[data-col-hora]').textContent === 'Hora');
    const horaDia = (await pg.textContent('[data-filas] tr:not([hidden]) td:first-child')).trim();
    const etiqueta = await pg.getAttribute('[data-filas] tr:not([hidden]) td:first-child', 'data-etiqueta');
    comprueba(guardada === 'MODELO' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(horaBusqueda) && /^\d{2}:\d{2}$/.test(horaDia) && etiqueta === 'Hora',
      `citas con volumen (D4-04): la búsqueda se guarda en la pestaña («${guardada}»); buscando, la hora lleva la fecha («${horaBusqueda}»); sin búsqueda, sólo la hora («${horaDia}», rótulo «${etiqueta}»)`);
  } catch (e) { comprueba(false, `citas con volumen (D4-04): se detuvo: ${String(e.message || e).split('\n')[0]}`); }
  await ctx.close();
}

await navegador.close();
console.log(fallas ? `\n${fallas} de ${total} comprobación(es) fallida(s).` : `\nLas ${total} comprobaciones, correctas.`);
process.exit(fallas ? 1 : 0);
