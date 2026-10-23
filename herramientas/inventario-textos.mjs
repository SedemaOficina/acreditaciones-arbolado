// INVENTARIO DE TEXTOS (revisión de redacción, 2026-10-15): saca de cada página del sitio, sin ejecutar sus scripts,
// todo texto que ve la persona (títulos, preguntas, ayudas, opciones, avisos, botones) con su pantalla, sección y la
// condición en que aparece (data-si y bloques ocultos). Lo que pintan los scripts, el catálogo, la base y el estándar
// lo agrega herramientas/inventario-textos.py. Escribe docs/textos/estaticos.json.
//   node herramientas/inventario-textos.mjs [http://localhost:8765/]
import { chromium } from 'playwright';
import { navegadorSinGoogle } from './sin-google.mjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:8765/';
const PAGINAS = [
  ['index.html', 'Inicio'], ['cuenta.html', 'Crea tu cuenta'], ['entrar.html', 'Entrar'], ['datos.html', 'Mi perfil'],
  ['solicitud.html', 'Solicitud'], ['tramites.html', 'Mis trámites'], ['verificar.html', 'Verificar una acreditación'],
  // También las que se agregaron después de la lista (auditoría 2026-10-18, A 8.4)
  ['corregir.html', 'Cargar el documento correcto'], ['material.html', 'Material de estudio']
];
// Bloques que sólo aparecen en ciertos casos (atributo → condición en palabras)
const OCULTOS = {
  'data-acuse': 'Al enviar con éxito (acuse)',
  'data-estado-envio': 'Si falla el envío',
  'data-sin-opciones': 'Si la persona no puede iniciar ninguna solicitud',
  'data-observaciones': 'Al corregir una solicitud con observaciones',
  'data-perfil-no-cumple': 'Dictaminador cuyo perfil podría no cumplir los lineamientos',
  'data-ayuda-posgrado': 'Sólo con maestría o doctorado',
  'data-adscripcion-info': 'Siempre (muestra la adscripción de la persona)',
  'data-nueva': 'Al crear la cuenta con éxito',
  'data-franja-borrador': 'Si hay un borrador guardado en el navegador',
  'data-limite': 'Si se rebasan los envíos permitidos desde el dispositivo',
  'data-cuenta-historial': 'Si la CURP tiene acreditaciones anteriores (registro de Kobo)',
  'data-foto-cambio': 'Mientras la fotografía no está confirmada',
  'data-recordatorio': 'Después de elegir la acreditación (recordatorio arriba de cada paso)',
  'data-camara': 'En teléfono o equipo con cámara'
};

// El mapa de Google de «Mis trámites» (P68) se contesta con una página mínima: herramientas/sin-google.mjs
const navegador = navegadorSinGoogle(await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}));
const contexto = await navegador.newContext({ javaScriptEnabled: false });
const filas = [
  { pantalla: 'Todas las pantallas', archivo: '*.html', seccion: 'Cabecera', tipo: 'Título del sistema', cuando: 'Siempre', texto: 'Acreditaciones de arbolado urbano' },
  { pantalla: 'Todas las pantallas', archivo: '*.html', seccion: 'Pie', tipo: 'Texto', cuando: 'Siempre', texto: 'Secretaría del Medio Ambiente de la Ciudad de México · Sistema de Información Ambiental.' },
  { pantalla: 'Todas las pantallas', archivo: '*.html', seccion: 'Acceso con teclado', tipo: 'Enlace', cuando: 'Al navegar con teclado', texto: 'Ir al contenido' }
];
for (const [archivo, pantalla] of PAGINAS) {
  const page = await contexto.newPage();
  await page.goto(BASE + archivo);
  const encontradas = await page.evaluate(({ OCULTOS }) => {
    const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    // Texto propio de un elemento, sin la ayuda emergente que lleva dentro (va en su propia fila)
    const propio = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.tooltip, .solo-lector').forEach((x) => x.remove()); return limpio(c.textContent); };
    const fuera = '[data-interno], .entorno-pruebas, script, style, template, svg, [aria-hidden="true"], [data-trampa], .solo-lector, .cabecera, .pie, .salto, section.pruebas';
    // Etiqueta y opciones de cada campo, para poner las condiciones en palabras
    const etiquetaDe = (campo) => {
      const c = document.querySelector(`[data-campo="${campo}"]`);
      const e = c && c.querySelector('.etiqueta');
      return e ? limpio(e.textContent).replace(/\s*\*$/, '') : campo;
    };
    const opcionDe = (campo, valor) => {
      const r = document.querySelector(`input[name="${campo}"][value="${valor}"]`);
      if (r) { const l = r.closest('label'); const n = l.querySelector('.opcion-nombre') || l.querySelector('.casilla-texto') || l; return limpio(n.textContent); }
      const o = document.querySelector(`select[name="${campo}"] option[value="${valor}"]`);
      if (o) return limpio(o.textContent);
      if (campo === 'tramite') return { poda_nueva: 'poda y derribo, solicitud nueva', poda_renovacion: 'poda y derribo, renovación', dictaminador_nueva: 'dictaminador técnico, solicitud nueva', dictaminador_renovacion: 'dictaminador técnico, renovación' }[valor] || valor;
      return valor === '' ? '(vacío)' : valor;
    };
    const condicionSi = (expr) => {
      const [campo, valores] = expr.split('=');
      const ops = (valores || '').split('|').map((v) => `«${opcionDe(campo, v)}»`);
      const etq = campo === 'tramite' ? 'Trámite' : etiquetaDe(campo);
      return `Si «${etq}» es ${ops.join(' o ')}`;
    };
    const condicion = (el) => {
      const partes = [];
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        if (a.hasAttribute('data-si')) partes.unshift(condicionSi(a.getAttribute('data-si')));
        for (const [attr, txt] of Object.entries(OCULTOS)) if (a.hasAttribute(attr)) partes.unshift(txt);
        if (a.tagName === 'DIALOG') partes.unshift('Al abrir la ventana «' + limpio((a.querySelector('h2, h3') || a).textContent).slice(0, 60) + '»');
      }
      return partes.join('; ') || 'Siempre';
    };
    const seccionDe = (el) => {
      const paso = el.closest('[data-paso]');
      const sec = paso ? paso.getAttribute('data-titulo') : '';
      // último título h2/h3 antes del elemento, dentro de su paso o de la página
      const raiz = paso || document.body;
      let ultimo = '';
      for (const h of raiz.querySelectorAll('h2, h3, legend.titulo-grupo')) {
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h === el) ultimo = limpio(h.textContent);
      }
      return [sec, ultimo].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
    };
    const reglas = [
      ['h1', 'Título de la pantalla'], ['h2', 'Título'], ['h3, h4', 'Subtítulo'], ['.bajada', 'Introducción'],
      ['[data-campo] .etiqueta, [data-campo] legend', 'Pregunta'], ['.tooltip-texto', 'Ayuda emergente (ícono ?)'],
      ['.ayuda', 'Ayuda'], ['.destacado-ayuda', 'Ayuda'],
      ['.opcion-fila, .opcion', 'Opción'], ['select option', 'Opción de lista'],
      ['.aviso', 'Aviso'], ['.leyenda-oblig', 'Nota'], ['.recordatorio', 'Recordatorio'], ['button, a.btn, a.btn-atras, .btn-enlace', 'Botón o enlace'],
      ['dt', 'Etiqueta de dato'], ['th', 'Encabezado de tabla'], ['summary', 'Título desplegable'],
      ['p, li, a', 'Texto']
    ];
    const vistos = new Set();
    const out = [];
    for (const [sel, tipo] of reglas) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.closest(fuera)) continue;
        if (tipo !== 'Ayuda emergente (ícono ?)' && [...vistos].some((v) => v.contains(el) || (tipo === 'Texto' && el.contains(v)))) continue;
        let texto;
        if (tipo === 'Opción') {
          const n = el.querySelector('.opcion-nombre'); const d = el.querySelector('.opcion-desc');
          texto = limpio(n ? n.textContent : el.textContent) + (d ? ` — ${limpio(d.textContent)}` : '');
        } else if (tipo === 'Pregunta') texto = propio(el).replace(/\s*\*$/, '');
        else if (tipo === 'Ayuda emergente (ícono ?)') texto = limpio(el.textContent);
        else texto = propio(el);
        if (!texto || /^[\d\W]*$/.test(texto)) continue;
        if (tipo === 'Opción de lista' && el.value === '') { out.push({ tipo: 'Indicación de lista', texto, cuando: condicion(el), seccion: seccionDe(el), orden: 0, el }); vistos.add(el); continue; }
        vistos.add(el);
        const doc = el.closest('[data-campo^="doc_"]');
        const origen = doc && ['Pregunta', 'Ayuda'].includes(tipo) ? 'Catálogo de requisitos (base)' : '';
        out.push({ tipo, texto, cuando: condicion(el), seccion: seccionDe(el), origen, el });
      }
    }
    // orden de aparición en la página
    out.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return out.map(({ el, orden, ...r }) => r);
  }, { OCULTOS });
  // Un mismo texto que se repite en la misma sección (p. ej. los requisitos de cada trámite) va en una fila con sus condiciones juntas
  for (const r of encontradas) {
    const igual = filas.find((f) => f.pantalla === pantalla && f.seccion === r.seccion && f.tipo === r.tipo && f.texto === r.texto);
    if (!igual) { filas.push({ pantalla, archivo, ...r }); continue; }
    if (igual.cuando === r.cuando || igual.cuando === 'Siempre') continue;
    const t = (c) => c.replace(/^Si «Trámite» es /, '');
    igual.cuando = igual.cuando.startsWith('Si «Trámite» es ') && r.cuando.startsWith('Si «Trámite» es ')
      ? `Si «Trámite» es ${t(igual.cuando)} o ${t(r.cuando)}` : `${igual.cuando} | ${r.cuando}`;
  }
  await page.close();
}
await navegador.close();
writeFileSync(join(raiz, 'docs/textos/estaticos.json'), JSON.stringify(filas, null, 1));
console.log(`${filas.length} textos de ${PAGINAS.length} pantallas → docs/textos/estaticos.json`);
