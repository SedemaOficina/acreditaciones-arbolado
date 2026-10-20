// ri · Inventario de regiones vivas (WCAG 4.1.3) por pantalla, después de cargar: aria-live, role status/alert/log,
// <output> (rol status implícito) y la región de anuncios del estándar. Dice de dónde viene (HTML de la página, creada por
// app/ o por formkit/ — se infiere por la clase y los atributos) y si está oculta. Uso: node inventario-vivas.mjs <BASE>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:8906/').replace(/\/?$/, '/');
const d = JSON.parse(readFileSync('/home/claude/trabajo/aud20-ri/sitio/datos/ficticios.json'));
const act = (estado) => d.solicitud.find((x) => x.estado === estado && d.solicitante.find((p) => p.id === x.solicitante_id && p.estado === 'activa'));
const sinTramite = d.solicitante.find((p) => p.estado === 'activa' && !d.solicitud.some((s) => s.solicitante_id === p.id));
const cita = act('validada_en_linea'), obs = act('con_observaciones');
const PAGINAS = [
  ['index.html'], ['cuenta.html'], ['entrar.html'], ['verificar.html'], ['material.html'], ['tramites.html', cita.solicitante_id],
  ['solicitud.html', sinTramite.id], [`solicitud.html?folio=${obs.folio}`, obs.solicitante_id], ['datos.html', sinTramite.id], ['corregir.html', cita.solicitante_id], ['examen.html'],
  ['revision.html'], [`revisar.html?folio=${d.solicitud.find((s) => s.estado === 'enviada').folio}`], ['citas.html'], [`cotejo.html?folio=${cita.folio}`], ['grupos.html?curso=poda-nueva'],
  ['programar.html?curso=poda-nueva'], [`grupo.html?folio=${d.grupo.find((g) => g.estado === 'en_integracion').folio}`], ['asistencia.html'], ['aplicar.html'], ['material-personal.html']
];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const salida = [];
for (const [url, sesion] of PAGINAS) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  if (sesion) await ctx.addInitScript((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), sesion);
  const pg = await ctx.newPage();
  const html = await (await fetch(BASE + url.split('?')[0])).text();
  await pg.goto(BASE + url, { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  const regiones = await pg.evaluate((fuente) => {
    const SEL = '[aria-live]:not([aria-live="off"]),[role="status"],[role="alert"],[role="log"],output';
    return [...document.querySelectorAll(SEL)].map((r) => {
      const at = [...r.attributes].filter((a) => /^(data-|role|aria-live|id|class)/.test(a.name)).map((a) => `${a.name}${a.value ? '=' + a.value : ''}`).join(' ');
      const marca = [...r.attributes].find((a) => a.name.startsWith('data-'));
      const enHtml = marca ? fuente.includes(marca.name) : r.id ? fuente.includes(`id="${r.id}"`) : false;
      const origen = r.hasAttribute('data-anuncios') ? 'formkit (anuncia)' : r.hasAttribute('data-aviso-formkit') || r.classList.contains('resumen-errores') ? 'formkit (aviso/resumen)' : r.matches('.interno-valor') ? 'app/pruebas.js (sólo prueba)' : r.closest('[data-visor-hojas], .visor') || r.matches('[data-visor-pagina],[data-visor-zoom]') ? 'formkit (visor)' : enHtml ? 'HTML de la página' : 'creada por script';
      return { region: `${r.tagName.toLowerCase()} ${at}`.slice(0, 160), origen, oculta: !r.checkVisibility() && !r.closest('.solo-lector'), texto: r.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) };
    });
  }, html);
  salida.push({ url, regiones });
  console.log(`\n${url}: ${regiones.length} regiones`);
  for (const r of regiones) console.log(`  - [${r.origen}]${r.oculta ? ' (oculta)' : ''} ${r.region} «${r.texto}»`);
  await ctx.close();
}
await b.close();
writeFileSync('salidas/inventario-vivas.json', JSON.stringify(salida, null, 1));
