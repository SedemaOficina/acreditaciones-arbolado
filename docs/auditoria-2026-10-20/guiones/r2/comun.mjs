// Común a los guiones de r2 (auditoría 20/10/2026, B1 y B6). Solo lectura: no escribe nada en el proyecto.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const COPIA = '/home/claude/trabajo/aud20-r2';
export const EVID = '/home/claude/trabajo/evidencia-2026-10-20/r2';
export const BASE = (process.env.BASE || 'http://localhost:8902/').replace(/\/?$/, '/');
export const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

// Tamaños pedidos en el encargo. «zoom200» = escritorio de 1440 × 900 con el navegador al 200 %: el viewport en px CSS
// queda en 720 × 450 y la pantalla dibuja con deviceScaleFactor 2 (lo mismo que hace el zoom del navegador).
export const VISTAS = {
  tel360: { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
  tel390: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
  tel430: { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
  telH: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
  tableta: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  escritorio: { viewport: { width: 1440, height: 900 } },
  zoom200: { viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 }
};

export async function navegador() { return chromium.launch({ executablePath: CHROMIUM }); }

let volumen = null;
export function datosVolumen() {
  if (volumen) return volumen;
  const salida = join(EVID, 'volumen.json');
  if (!existsSync(salida)) execFileSync('node', [join(COPIA, 'herramientas/escenario-volumen.mjs'), join(COPIA, 'sitio/datos/ficticios.json'), salida], { stdio: 'inherit' });
  volumen = readFileSync(salida);
  return volumen;
}

// Contexto nuevo: zona de la Ciudad de México, español, sesión simulada opcional (como el menú de pruebas) y datos de
// volumen opcionales (como herramientas/probar-volumen.mjs)
export async function contexto(nav, vista, { sesion = null, datos = 'ficticios', sesionUnaVez = false } = {}) {
  const c = await nav.newContext({ ...VISTAS[vista], locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  if (datos === 'volumen') { const cuerpo = datosVolumen(); await c.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' })); }
  if (sesion) {
    if (sesionUnaVez) await c.addInitScript((id) => { try { if (!sessionStorage.getItem('r2.sesion')) { localStorage.setItem('apd.sesion', JSON.stringify({ id })); sessionStorage.setItem('r2.sesion', '1'); } } catch (e) { /* */ } }, sesion);
    else await c.addInitScript((id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* */ } }, sesion);
  }
  return c;
}

export function vigila(page, BASEURL = BASE) {
  const log = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`excepción: ${e.message}`));
  page.on('requestfailed', (q) => { const f = q.failure() && q.failure().errorText; if (f !== 'net::ERR_ABORTED') log.push(`no cargó: ${q.url().replace(BASEURL, '')} (${f})`); });
  page.on('response', (q) => { if (q.status() >= 400) log.push(`HTTP ${q.status()}: ${q.url().replace(BASEURL, '')}`); });
  return log;
}

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));
export function carpeta(...p) { const d = join(EVID, ...p); mkdirSync(d, { recursive: true }); return d; }
