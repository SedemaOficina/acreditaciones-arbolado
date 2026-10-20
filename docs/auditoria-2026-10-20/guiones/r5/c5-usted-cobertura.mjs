// C5 · ¿Qué textos del estándar (FORMKIT_CONFIG.mensajes, 1.5.1) quedan en tú en las pantallas del personal?
// Carga revision.html (que trae validaciones.config.js y mensajes-usted.js) y compara las claves.
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID } from './comun.mjs';
const nav = await chromium.launch({ executablePath: CHROMIUM });
const page = await nav.newPage();
await page.goto(BASE + 'cotejo.html'); await page.waitForLoadState('networkidle');
const r = await page.evaluate(() => {
  const usted = window.APD_MENSAJES_USTED || {};
  const M = (window.FormKit && FormKit.config && FormKit.config.mensajes) || {};
  return { claves: Object.keys(M).length, usted: Object.keys(usted).length, efectivos: M, usted0: usted };
});
await nav.close();
const tu = /(?<![\wáéíóúñ])(tú|tu|tus|te|ti|puedes|tienes|debes|escribiste|cargaste|Completa|Elige|Marca|Adjunta|Escribe|Usa|Revisa|Intenta|Vuelve|Prueba|Carga|Agrega|Quita|Selecciona|Verifica|Espera|Guarda|Toma|Corrige|Confirma|Abre|Cierra)(?![\wáéíóúñ])/;
const filas = Object.entries(r.efectivos).filter(([, v]) => typeof v === 'string' && tu.test(v));
const txt = [`Claves de mensajes efectivas en cotejo.html: ${r.claves}; claves en mensajes-usted.js: ${r.usted}; efectivas que quedan con marca de tú: ${filas.length}`, ...filas.map(([k, v]) => `${k}${k in r.usted0 ? ' (sobrescrita)' : ''}: ${v}`)].join('\n');
writeFileSync(`${EVID}/c5-usted-cobertura.txt`, txt + '\n');
console.log(txt);
