// Arnés común de r4 (auditoría 20/10/2026): navegador, escenario de volumen y medición de carga.
// Uso: import { ... } from './comun.mjs'. Base: http://localhost:8904/ (sitio de la copia aud20-r4).
import { chromium } from '/home/claude/trabajo/aud20-r4/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const RAIZ = '/home/claude/trabajo/aud20-r4';
export const EVID = '/home/claude/trabajo/evidencia-2026-10-20/r4';
export const BASE = process.env.BASE || 'http://localhost:8904/';
export const CAP = join(EVID, 'capturas');
export const TEL = { width: 390, height: 844 };
export const ESC = { width: 1440, height: 900 };
mkdirSync(CAP, { recursive: true });

const volArchivo = join(EVID, 'salidas', 'volumen.json');
export function volumen() {
  if (!existsSync(volArchivo)) {
    mkdirSync(join(EVID, 'salidas'), { recursive: true });
    execFileSync('node', [join(RAIZ, 'herramientas/escenario-volumen.mjs'), join(RAIZ, 'sitio/datos/ficticios.json'), volArchivo], { stdio: 'inherit' });
  }
  return readFileSync(volArchivo);
}
export const ficticios = () => JSON.parse(readFileSync(join(RAIZ, 'sitio/datos/ficticios.json'), 'utf8'));

let nav;
export async function navegador() {
  if (!nav) nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  return nav;
}
export async function cierra() { if (nav) await nav.close(); nav = null; }

/* Contexto limpio. opciones: { vp, vol (sirve escenario de volumen), sesion (id de persona), tactil } */
export async function contexto({ vp = TEL, vol = false, sesion = null, tactil } = {}) {
  const b = await navegador();
  const esTel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    hasTouch: tactil ?? esTel, isMobile: false, deviceScaleFactor: 1 });
  if (vol) { const cuerpo = volumen(); await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' })); }
  if (sesion) await ctx.addInitScript((id) => { try { if (!localStorage.getItem('apd.sesion')) localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) {} }, sesion);
  ctx.errores = [];
  ctx.on('page', (p) => { p.on('pageerror', (e) => ctx.errores.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') ctx.errores.push(m.text()); }); });
  return ctx;
}

export async function ir(pg, url, sel = 'main', espera = 400) {
  await pg.goto(BASE + url, { waitUntil: 'load' });
  if (sel) await pg.waitForSelector(sel, { state: 'attached', timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(espera);
}

/* Mide la carga de lo que se ve: palabras, controles visibles y alto del documento entre alto de la ventana.
   Excluye la franja y el menú de pruebas (lo que no existe en producción) si excluirPrueba. */
export async function mide(pg, { excluirPrueba = true } = {}) {
  return pg.evaluate((excluir) => {
    // Lo que está dentro de un <details> cerrado (fuera de su <summary>) no se ve, aunque Chromium le dé tamaño
    const enPlegado = (el) => { const d = el.closest('details:not([open])'); return Boolean(d) && !el.closest('summary'); };
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],dialog:not([open])') && !enPlegado(el); };
    const dePrueba = (el) => excluir && el.closest('.entorno-pruebas, .ubicacion-prueba, .aviso-prueba, dialog.menu-pruebas, .menu-pruebas-boton, .nota-interna, .interno-valor, #version-sia, .salto');
    const raiz = document.querySelector('main') || document.body;
    const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let palabras = 0; let n;
    while ((n = recorrido.nextNode())) {
      const p = n.parentElement; if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(p.tagName)) continue;
      if (!visible(p) || dePrueba(p)) continue;
      const t = n.textContent.trim(); if (t) palabras += t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    }
    const ctl = (sel) => [...document.querySelectorAll(sel)].filter((e) => visible(e) && !dePrueba(e));
    const campos = ctl('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea').length
      + new Set(ctl('input[type=radio]').map((r) => r.name)).size + ctl('input[type=checkbox]').length;
    const radios = ctl('input[type=radio]').length;
    const botones = ctl('button, input[type=submit], input[type=button], [role=button]').length;
    const enlaces = ctl('a[href]').length;
    const alto = document.documentElement.scrollHeight; const ventana = window.innerHeight;
    return { palabras, campos, opciones: radios, botones, enlaces, controles: campos + botones + enlaces, alto, ventana,
      pantallas: +(alto / ventana).toFixed(1), anchoDoc: document.documentElement.scrollWidth, ancho: window.innerWidth };
  }, excluirPrueba);
}

export async function captura(pg, nombre, completa = true) {
  const f = join(CAP, `${nombre}.png`);
  await pg.screenshot({ path: f, fullPage: completa });
  return f;
}
export const guarda = (nombre, obj) => writeFileSync(join(EVID, 'salidas', nombre), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
export const texto = (pg, sel = 'main') => pg.evaluate((s) => (document.querySelector(s) || document.body).innerText, sel);

/* Casos del menú de pruebas (persona por caso), calculados en la página con los datos que sirve el contexto */
export async function casos(pg) {
  return pg.evaluate(async () => {
    const d = await fetch('datos/ficticios.json').then((r) => r.json());
    return window.APD_CASOS_PRUEBA.lista(d).flatMap((g) => g.casos.map((c) => ({ clave: c.clave, texto: c.texto, grupo: g.grupo, perfil: g.perfil, persona: c.persona ? c.persona.id : null, curp: c.persona ? c.persona.curp : null, pantalla: c.pantalla || null })));
  });
}
