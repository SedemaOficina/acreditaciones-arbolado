// C5 · Cómo escribe cada ayuda de fechas del proyecto y del estándar el mismo instante (20/10/2026 18:05, Ciudad de México)
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID } from './comun.mjs';
const nav = await chromium.launch({ executablePath: CHROMIUM });
const page = await (await nav.newContext({ timezoneId: 'America/Mexico_City', locale: 'es-MX' })).newPage();
await page.goto(BASE + 'solicitud.html'); await page.waitForLoadState('networkidle');
const r = await page.evaluate(() => {
  const iso = '2026-10-20T18:05:00-06:00', dia = '2026-10-20';
  const U = (window.FormKit && FormKit.utilidades) || {};
  return {
    'APD.fecha': APD.fecha(iso), 'APD.fechaHora': APD.fechaHora(iso), 'APD.fechaConDia': APD.fechaConDia(dia), 'APD.diaMes': APD.diaMes(dia), 'APD.diaMes(año)': APD.diaMes(dia, true),
    'APD.rangoFechas (mismo año)': APD.rangoFechas('2026-10-19', '2026-10-23', '2026'), 'APD.rangoFechas (cruza año)': APD.rangoFechas('2026-12-28', '2027-01-01', '2026'),
    'grupos.js:361 (diaSemana + fecha.slice)': `${APD.diaSemana(dia)} ${APD.fecha(dia).slice(0, 5)}`,
    'citas.js:18 (encabezado del día)': new Date(`${dia}T12:00:00-06:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }),
    'FormKit.utilidades.fechaHora (acuse, borrador, resultado)': U.fechaHora ? U.fechaHora(new Date(iso)) : '(no existe)'
  };
});
await nav.close();
const t = Object.entries(r).map(([k, v]) => `${k}: «${v}»`).join('\n');
writeFileSync(`${EVID}/c5-fechas-muestra.txt`, t + '\n'); console.log(t);
