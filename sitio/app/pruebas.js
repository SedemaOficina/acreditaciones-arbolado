/* =========================================================
   pruebas.js · Menú de pruebas (sólo en la versión de prueba)

   Un botón fijo abre un panel para revisar las pantallas rápido:
     · entrar como cualquier persona ficticia (una por situación del trámite)
       o como persona nueva, y salir;
     · activar o desactivar las preguntas obligatorias (para avanzar sin
       llenar); los formatos y las validaciones cruzadas siguen activos;
     · llenar el formulario de la pantalla con datos ficticios;
     · saltar a cualquier paso de la solicitud;
     · simular un fallo de envío, el límite o un envío lento;
     · ir a cualquier pantalla.

   Sólo aparece si la página tiene la franja de entorno de pruebas y el
   archivo VERSION es 0.N. Desaparece al pasar al SIA (versión 1): ahí se
   quita este archivo de las páginas, junto con el acceso simulado.
   ========================================================= */
(function () {
  'use strict';
  const CLAVE = 'apd.pruebas.sinObligatorias';
  const esPrueba = Boolean(document.querySelector('.entorno-pruebas'));
  if (!esPrueba) return;

  /* 0. Datos internos ([data-interno]): lo que calcula el sistema y va a la base no lo ve la persona; aquí se
        muestra en amarillo con su nota y, si es un campo oculto, con su valor al momento. */
  document.documentElement.classList.add('modo-pruebas');
  function refrescaInternos() {
    refrescaNombres();
    for (const o of document.querySelectorAll('[data-interno-valor]')) {
      if (o.closest('[data-nombre-archivo]')) continue;
      const i = o.closest('[data-interno]').querySelector('input[type="hidden"]');
      const v = i && i.value ? i.value : '(vacío)';
      if (o.textContent !== v) o.textContent = v; // sin cambio no se toca: el observador no se vuelve a disparar
    }
  }
  /* Nombre con que se guardará cada archivo: el mismo cálculo que apd.nombre_de_archivo en la base
     (TIPO_NOMBRE COMPLETO en mayúsculas, sin acentos salvo la Ñ, sin caracteres prohibidos). */
  let persona = null;
  APD.cargar().then((d) => { persona = APD.personaDeSesion(d); refrescaInternos(); }).catch(() => { /* sin datos: queda «(sin sesión)» */ });
  const sinAcentos = (t) => t.replace(/[ÁÀ]/g, 'A').replace(/[ÉÈ]/g, 'E').replace(/[ÍÌ]/g, 'I').replace(/[ÓÒ]/g, 'O').replace(/[ÚÙÜ]/g, 'U');
  function nombreDeArchivo(tipo, ext) {
    if (!persona) return '(sin sesión)';
    return sinAcentos(`${tipo}_${APD.nombreCompleto(persona)}`.toUpperCase()).replace(/[\\/:*?"<>|]/g, '') + ext;
  }
  function refrescaNombres() {
    for (const caja of document.querySelectorAll('[data-nombre-archivo]')) {
      const o = caja.querySelector('[data-interno-valor]');
      if (!o) continue;
      const a = caja.closest('.campo').querySelector('.arch:not([data-estado="error"]) .arch-nombre');
      const ext = a ? (/\.(png|jpe?g)$/i.test(a.textContent) ? (/png$/i.test(a.textContent) ? '.png' : '.jpg') : '.pdf') : '';
      const v = a ? nombreDeArchivo(caja.dataset.nombreArchivo, ext) : '(todavía no subes el archivo)';
      if (o.textContent !== v) o.textContent = v;
    }
  }
  function marcaInternos() {
    for (const caja of document.querySelectorAll('[data-interno]')) {
      if (caja.querySelector(':scope > .nota-interna')) continue;
      if (caja.querySelector('input[type="hidden"]') || caja.hasAttribute('data-nombre-archivo')) {
        caja.prepend(APD.el('p', { class: 'etiqueta', texto: caja.dataset.internoEtiqueta || caja.dataset.campo || 'Dato interno' }));
        caja.append(APD.el('output', { class: 'interno-valor', 'data-interno-valor': '' }));
      }
      caja.append(APD.el('p', { class: 'nota-interna', texto: `Sólo en la versión de prueba; en producción no se muestra. ${caja.dataset.interno}` }));
    }
    refrescaInternos();
  }
  let pendiente = 0;
  new MutationObserver(() => { clearTimeout(pendiente); pendiente = setTimeout(marcaInternos, 50); })
    .observe(document.documentElement, { childList: true, subtree: true });
  for (const ev of ['input', 'change']) document.addEventListener(ev, () => setTimeout(refrescaInternos));
  document.addEventListener('DOMContentLoaded', marcaInternos);

  const lee = () => { try { return window.sessionStorage.getItem(CLAVE) === 'si'; } catch (e) { return false; } };
  const escribe = (v) => { try { window.sessionStorage.setItem(CLAVE, v ? 'si' : ''); } catch (e) { /* sin almacenamiento: no se recuerda */ } };
  const pagina = (location.pathname.split('/').pop() || 'index.html');
  const form = document.querySelector('form[data-formkit]');

  /* 1. Sin obligatorias: se quita la marca ANTES de que arranque el núcleo (este archivo corre antes de
        DOMContentLoaded), así no se pintan asteriscos ni se exige nada. Recargar devuelve el HTML original. */
  const sinObligatorias = lee();
  if (sinObligatorias && form) {
    for (const c of form.querySelectorAll('[data-requerido]')) c.removeAttribute('data-requerido');
    for (const c of form.querySelectorAll('[required]')) c.removeAttribute('required');
    for (const l of document.querySelectorAll('.leyenda-oblig')) l.hidden = true;
    const main = document.querySelector('main');
    if (main) main.prepend(APD.el('p', { class: 'aviso aviso-advertencia', role: 'status', texto: 'Modo de prueba: las preguntas obligatorias están desactivadas. Los formatos y las comprobaciones de la CURP siguen activos.' }));
  }

  /* ----- Utilidades de llenado ----- */
  const avisa = (c) => { c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); };
  function pon(id, valor) { const c = document.getElementById(id); if (c && !c.readOnly && !c.disabled) { c.value = valor; avisa(c); } }
  function elige(nombre, valor) {
    const r = form.querySelector(`input[name="${nombre}"]${valor ? `[value="${valor}"]` : ''}:not(:disabled)`);
    if (r && !r.checked) { r.checked = true; avisa(r); }
  }
  function marca(nombre) { const c = form.querySelector(`input[name="${nombre}"]`); if (c && !c.checked) { c.checked = true; avisa(c); } }
  function adjunta(campo) {
    const input = campo.querySelector('[data-archivos] > input[type="file"]');
    if (!input || campo.querySelector('.lista-arch li')) return;
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4\n% documento ficticio de prueba\n%%EOF\n'], 'documento-ficticio.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    avisa(input);
  }
  /* Fotografía ficticia: una silueta dibujada en el navegador, 480 × 600 px (no es la foto de nadie). */
  function adjuntaFoto(campo) {
    const input = campo && campo.querySelector('[data-archivos] > input[type="file"]:not([data-entrada-camara])');
    if (!input || campo.querySelector('.lista-arch li')) return;
    const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const lienzo = document.createElement('canvas');
    lienzo.width = 480; lienzo.height = 600;
    const g = lienzo.getContext('2d');
    g.fillStyle = token('--fondo'); g.fillRect(0, 0, 480, 600);
    g.fillStyle = token('--gris-cl');
    g.beginPath(); g.arc(240, 230, 110, 0, 2 * Math.PI); g.fill();
    g.beginPath(); g.ellipse(240, 600, 200, 190, 0, Math.PI, 2 * Math.PI); g.fill();
    g.fillStyle = token('--guinda'); g.font = '24px sans-serif'; g.textAlign = 'center';
    g.fillText('Fotografía ficticia', 240, 40);
    lienzo.toBlob((blob) => {
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'foto-ficticia.png', { type: 'image/png' }));
      input.files = dt.files;
      avisa(input);
    }, 'image/png');
  }
  const visible = (e) => e.offsetParent !== null;
  const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };

  /* Una persona nueva ficticia, con CURP coherente con su nombre y su fecha (misma regla del formulario). */
  function personaNueva() {
    const nombres = ['Nadia', 'Óscar', 'Paula', 'Raúl', 'Sofía', 'Tomás'];
    const n = Math.floor(Math.random() * nombres.length);
    const p = { nombre: nombres[n], primer: 'Ejemplo', segundo: 'Simulado', fecha: `199${n}-0${n + 1}-1${n}`, sexo: n % 2 ? 'H' : 'M' };
    p.curp = window.APD_CURP ? conDigito(APD_CURP.prefijo({ nombre: p.nombre, primer: p.primer, segundo: p.segundo }, p.fecha, p.sexo, 'NE') + '0') : '';
    return p;
  }

  function llena(datos) {
    if (!form) return 'Esta pantalla no tiene formulario.';
    if (pagina === 'cuenta.html') {
      const p = personaNueva();
      pon('nombre', p.nombre); pon('primer_apellido', p.primer); pon('segundo_apellido', p.segundo);
      pon('fecha_nacimiento', p.fecha); pon('curp', p.curp);
      pon('correo', 'prueba@ejemplo.local'); pon('correo2', 'prueba@ejemplo.local'); pon('telefono', '0000000099');
      pon('contrasena', 'una frase larga de prueba'); pon('contrasena2', 'una frase larga de prueba');
      adjuntaFoto(form.querySelector('[data-campo="foto"]'));
      elige('adscrito', 'no');
    } else if (pagina === 'entrar.html') {
      const p = datos.solicitante.find((x) => x.estado === 'activa');
      pon('curp', p.curp); pon('contrasena', APD.CONTRASENA_FICTICIA);
    } else if (pagina === 'verificar.html') {
      pon('numero', datos.verificacion_publica[0].numero);
    } else if (pagina === 'solicitud.html') {
      if (!form.querySelector('input[name="tipo"]:checked')) elige('tipo');
      elige('perfil_academico', 'titulo'); pon('carrera', 'Biología'); pon('anios_experiencia', '3');
      for (const c of form.querySelectorAll('[data-campo^="doc_"]')) if (visible(c)) adjunta(c);
    }
    marca('aviso'); marca('humano');
    return 'Formulario llenado con datos ficticios.';
  }

  /* Avanza hasta el paso pedido pulsando «Continuar»; se detiene si un paso no deja pasar. */
  async function irAlPaso(k) {
    const pasos = Array.from(form.querySelectorAll('section[data-paso]'));
    for (let vuelta = 0; vuelta < pasos.length; vuelta++) {
      const actual = pasos.findIndex((p) => !p.hidden);
      if (actual === k) return '';
      const boton = pasos[actual].querySelector(actual < k ? '[data-accion="siguiente"]' : '[data-accion="atras"]');
      if (!boton) return 'No se pudo cambiar de paso.';
      boton.click();
      await new Promise((r) => setTimeout(r, 120));
      if (pasos.findIndex((p) => !p.hidden) === actual) return 'Un dato no deja avanzar: revisa el mensaje del formulario (o llena con datos ficticios).';
    }
    return '';
  }

  /* ----- El panel ----- */
  const { el } = APD;
  function panel(datos) {
    const dialogo = el('dialog', { class: 'menu-pruebas', 'aria-labelledby': 'menu-pruebas-titulo' });
    const estado = el('p', { class: 'menu-pruebas-estado', role: 'status' });
    const di = (t) => { estado.textContent = t; };
    const seccion = (titulo, hijos) => el('section', { class: 'menu-pruebas-seccion' }, [el('h3', { class: 'menu-pruebas-subtitulo', texto: titulo }), ...hijos]);
    const boton = (texto, accion, clase = 'btn btn-secundario') => { const b = el('button', { type: 'button', class: clase, texto }); b.addEventListener('click', accion); return b; };

    // Personas: una por situación, como la caja de «Entrar»
    const opciones = [el('option', { value: '', texto: 'Elige una opción' }), el('option', { value: 'nueva', texto: 'Persona nueva, sin trámites' })];
    const vistas = new Set();
    for (const p of datos.solicitante.filter((x) => x.estado === 'activa')) {
      const s = APD.solicitudesDe(datos, p)[0];
      const a = APD.acreditacionesDe(datos, p)[0];
      const clave = s ? `s:${s.estado}:${s.tipo_acreditacion}` : a ? `a:${APD.situacion(datos, a)}` : 'sin';
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const texto = s ? `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.ESTADOS[s.estado].texto}` : a ? `${APD.TIPOS[a.tipo_acreditacion]} · ${APD.VIGENCIA[APD.situacion(datos, a)].texto}` : 'Sin trámites';
      opciones.push(el('option', { value: p.id, texto: `${texto} — ${APD.nombreCompleto(p)}` }));
    }
    const select = el('select', { class: 'control control-select', id: 'menu-pruebas-persona' }, opciones);
    const sesion = APD.leeSesion();
    const quien = sesion ? (sesion.nueva ? 'una persona nueva' : APD.nombreCompleto(datos.solicitante.find((p) => p.id === sesion.id) || { nombre: '—' })) : 'nadie';

    const interruptor = el('button', { type: 'button', class: 'btn btn-secundario', 'aria-pressed': sinObligatorias ? 'true' : 'false',
      texto: sinObligatorias ? 'Activar las preguntas obligatorias' : 'Desactivar las preguntas obligatorias' });
    interruptor.addEventListener('click', () => { escribe(!sinObligatorias); location.reload(); });

    const hijos = [
      el('div', { class: 'menu-pruebas-cabeza' }, [
        el('h2', { class: 'titulo-bloque', id: 'menu-pruebas-titulo', texto: 'Menú de pruebas' }),
        boton('Cerrar', () => dialogo.close(), 'btn-enlace')
      ]),
      el('p', { class: 'texto-gris', texto: 'Sólo existe en la versión de prueba. Todo es ficticio y nada sale de esta pestaña.' }),
      seccion('Persona', [
        el('p', { texto: `Sesión actual: ${quien}.` }),
        el('div', { class: 'menu-pruebas-campo' }, [
          el('label', { class: 'etiqueta', for: 'menu-pruebas-persona', texto: 'Entrar como' }),
          el('div', { class: 'select' }, [select])
        ]),
        el('div', { class: 'menu-pruebas-acciones' }, [
          boton('Entrar como esta persona', () => {
            if (!select.value) return di('Elige una persona.');
            APD.guardaSesion(select.value === 'nueva' ? { nueva: { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado' } } : { id: select.value });
            location.href = 'tramites.html';
          }),
          boton('Salir', () => { APD.cierraSesion(); location.href = 'index.html'; })
        ])
      ]),
      seccion('Formulario de esta pantalla', [
        el('p', { texto: sinObligatorias ? 'Preguntas obligatorias: desactivadas.' : 'Preguntas obligatorias: activadas.' }),
        el('div', { class: 'menu-pruebas-acciones' }, [
          interruptor,
          form ? boton('Llenar con datos ficticios', () => di(llena(datos))) : null
        ])
      ])
    ];
    if (form && form.querySelector('section[data-paso]')) {
      const pasos = Array.from(form.querySelectorAll('section[data-paso]'));
      hijos.push(seccion('Ir al paso', [el('div', { class: 'menu-pruebas-acciones' }, pasos.map((p, k) =>
        boton(`${k + 1}. ${p.dataset.titulo}`, async () => { const m = await irAlPaso(k); if (m) di(m); else dialogo.close(); })))]));
    }
    if (form) {
      const url = (modo) => { const u = new URL(location.href); if (modo) u.searchParams.set('simular', modo); else u.searchParams.delete('simular'); return u.pathname.split('/').pop() + u.search; };
      hijos.push(seccion('Simular el envío', [el('ul', { class: 'menu-pruebas-lista' }, [
        ['Envío normal', ''], ['Falla el envío', 'error'], ['Límite de envíos', 'limite'], ['Envío lento', 'lento']
      ].map(([t, m]) => el('li', {}, [el('a', { href: url(m), texto: t })])))]));
    }
    hijos.push(seccion('Pantallas', [el('ul', { class: 'menu-pruebas-lista' }, [
      ['index.html', 'Inicio'], ['cuenta.html', 'Crear cuenta'], ['entrar.html', 'Entrar'], ['tramites.html', 'Mis trámites'],
      ['datos.html', 'Mis datos'], ['solicitud.html', 'Solicitud'], ['verificar.html', 'Verificar una acreditación']
    ].map(([h, t]) => el('li', {}, [el('a', { href: h, texto: t, 'aria-current': h === pagina ? 'page' : null })])))]));
    hijos.push(estado);
    for (const h of hijos) if (h) dialogo.append(h);
    return dialogo;
  }

  function monta() {
    fetch('VERSION', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((v) => {
      if (!/^0\./.test(v.trim())) return;
      return APD.cargar().then((datos) => {
        const dialogo = panel(datos);
        const abre = el('button', { type: 'button', class: 'btn btn-secundario menu-pruebas-boton', 'aria-haspopup': 'dialog', texto: 'Menú de pruebas' });
        abre.addEventListener('click', () => dialogo.showModal());
        const pie = document.querySelector('footer') || document.body;
        pie.append(abre, dialogo);
      });
    }).catch(() => { /* sin VERSION o sin datos: no hay menú */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
}());
