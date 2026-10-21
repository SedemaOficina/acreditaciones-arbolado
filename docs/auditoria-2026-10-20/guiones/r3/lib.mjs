// Auditoría B4 (accesibilidad), 20/10/2026, revisor r3 · utilidades comunes de los guiones.
// Se repiten en la próxima auditoría: BASE=http://localhost:<puerto>/ node <guion>.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const AQUI = dirname(fileURLToPath(import.meta.url));
export const EVID = join(AQUI, '..');
export const RAIZ = process.env.COPIA || '/home/claude/trabajo/aud20-r3';
export const BASE = (process.env.BASE || 'http://localhost:8903/').replace(/\/?$/, '/');
export const AXE = readFileSync(process.env.AXE || '/home/claude/trabajo/estandares-sia-151/formularios/vendor/axe-core/axe.min.js', 'utf8');
export const ZONA = 'America/Mexico_City';
export const datos = JSON.parse(readFileSync(join(RAIZ, 'sitio/datos/ficticios.json'), 'utf8'));
export const CAPTURAS = join(EVID, 'capturas');
mkdirSync(CAPTURAS, { recursive: true });

let volumenCuerpo = null;
export function volumen() {
  if (volumenCuerpo) return volumenCuerpo;
  const salida = join(mkdtempSync(join(tmpdir(), 'r3-vol-')), 'volumen.json');
  execFileSync('node', [join(RAIZ, 'herramientas/escenario-volumen.mjs'), join(RAIZ, 'sitio/datos/ficticios.json'), salida], { stdio: 'ignore' });
  volumenCuerpo = readFileSync(salida);
  return volumenCuerpo;
}

export async function navegador() {
  return chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
}

// Contexto nuevo (estado limpio). ancho: 320 | 390 | 1440 ...; vol: servir el escenario de volumen; sesion: id de solicitante
export async function contexto(nav, { ancho = 390, alto = 844, vol = false, sesion = null, movimiento = 'reduce', tactil } = {}) {
  const movil = ancho < 700;
  const c = await nav.newContext({
    viewport: { width: ancho, height: alto }, locale: 'es-MX', timezoneId: ZONA, reducedMotion: movimiento,
    hasTouch: tactil ?? movil, isMobile: false
  });
  if (vol) { const cuerpo = volumen(); await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' })); }
  if (sesion) await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* */ } }, sesion);
  const errores = [];
  c.on('page', (p) => {
    p.on('pageerror', (e) => errores.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    p.on('dialog', (d) => d.accept().catch(() => {}));
  });
  return { c, errores };
}

export async function quieto(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
}

// axe con WCAG 2.0, 2.1 y 2.2 A y AA más buenas prácticas. Devuelve [{id, impacto, n, nodos:[html]}]
export async function axe(page) {
  await quieto(page);
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(AXE);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'] });
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, nodos: v.nodes.slice(0, 6).map((x) => ({ html: x.html.slice(0, 220), objetivo: x.target.join(' '), resumen: (x.failureSummary || '').slice(0, 300) })) }));
  });
}

export function guarda(nombre, obj) { writeFileSync(join(EVID, nombre), JSON.stringify(obj, null, 2)); }

export const sol = (f) => datos.solicitud.find(f);
export const persona = (id) => datos.solicitante.find((p) => p.id === id);
