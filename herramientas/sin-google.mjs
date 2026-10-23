// EL MAPA DE GOOGLE EN LAS PRUEBAS (decisión de Liber del 23/10/2026, P68). «Mis trámites» lleva un mapa de Google
// dentro de la página (un marco de maps.google.com). En las pruebas no se llama a Google: aquí la red está cerrada (la
// petición fallaría) y en la verificación de GitHub el mapa real tardaría, cambiaría las capturas y escribiría en la
// consola. Cada contexto del navegador contesta las peticiones a Google con una página mínima, la misma siempre.
//
// Uso: import { navegadorSinGoogle } from './sin-google.mjs';  navegadorSinGoogle(await chromium.launch(…));
//   desde ahí, navegador.newContext() y navegador.newPage() ya traen la página mínima en lugar de Google.

export const GOOGLE = /^https:\/\/(?:www|maps)\.google\.com\//;
// La página mínima: sin scripts ni recursos externos; dice que es de prueba para que no se confunda en una captura
export const PAGINA_MAPA = '<!DOCTYPE html><html lang="es-MX"><head><meta charset="utf-8"><title>Mapa de prueba</title></head>'
  + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#e8edef;color:#55585a;font:16px/1.4 sans-serif;text-align:center">'
  + '<p data-mapa-prueba>Mapa de Google<br>(en las pruebas, una página mínima)</p></body></html>';

export async function sinGoogle(contexto) {
  await contexto.route(GOOGLE, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGINA_MAPA }));
}

export function navegadorSinGoogle(navegador) {
  const nuevoContexto = navegador.newContext.bind(navegador);
  const nuevaPagina = navegador.newPage.bind(navegador);
  navegador.newContext = async (opciones) => { const c = await nuevoContexto(opciones); await sinGoogle(c); return c; };
  navegador.newPage = async (opciones) => { const p = await nuevaPagina(opciones); await sinGoogle(p.context()); return p; };
  return navegador;
}
