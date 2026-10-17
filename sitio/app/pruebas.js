/* =========================================================
   pruebas.js · Menú de pruebas (sólo en la versión de prueba)

   Un botón fijo abre un panel con cinco bloques, siempre en el mismo orden
   (maqueta aprobada el 2026-10-16, maquetas/menu-pruebas/):
     1. Estás como: quién eres, qué caso es y en qué pantalla estás; «Salir».
     2. En esta pantalla: sólo lo que sirve aquí (llenar con datos ficticios,
        ir al paso, cómo responde el envío, llenar «Entrar» con un caso,
        crear la cuenta con una CURP del registro anterior). Si nada aplica,
        el bloque no aparece.
     3. Entrar como: los casos de prueba con nombre (app/casos-prueba.js),
        agrupados por etapa del trámite, y el personal de la Secretaría.
     4. Ir a otra pantalla: agrupadas por quién la usa.
     5. Ajustes de la prueba: preguntas obligatorias, lo guardado en este
        navegador y «Empezar de cero».

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
    for (const o of document.querySelectorAll('[data-interno-valor]')) {
      const calculado = o.closest('[data-interno-texto]');
      if (calculado) { const v = calculado.dataset.internoTexto || '(faltan respuestas)'; if (o.textContent !== v) o.textContent = v; continue; }
      const i = o.closest('[data-interno]').querySelector('input[type="hidden"]');
      const v = i && i.value ? i.value : '(vacío)';
      if (o.textContent !== v) o.textContent = v; // sin cambio no se toca: el observador no se vuelve a disparar
    }
  }
  function marcaInternos() {
    for (const caja of document.querySelectorAll('[data-interno]')) {
      if (caja.querySelector(':scope > .nota-interna')) continue;
      if (caja.querySelector('input[type="hidden"]') || caja.hasAttribute('data-interno-texto')) {
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
    for (const c of document.querySelectorAll('form [data-requerido]')) c.removeAttribute('data-requerido');
    for (const c of document.querySelectorAll('form [required]')) c.removeAttribute('required');
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
    const al = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    // Fecha al azar: cada persona nueva tiene otra CURP (las cuentas de la prueba se guardan en este navegador)
    const p = { nombre: nombres[n], primer: 'Ejemplo', segundo: 'Simulado', fecha: `${al(1960, 2002)}-${String(al(1, 12)).padStart(2, '0')}-${String(al(1, 28)).padStart(2, '0')}`, sexo: n % 2 ? 'H' : 'M' };
    // Posición 17 de la CURP: un dígito si nació antes de 2000, una letra desde 2000 (la cruzada CURP ↔ fecha lo revisa)
    p.curp = window.APD_CURP ? conDigito(APD_CURP.prefijo({ nombre: p.nombre, primer: p.primer, segundo: p.segundo }, p.fecha, p.sexo, 'NE') + (p.fecha < '2000' ? '0' : 'A')) : '';
    return p;
  }

  /* Correo ficticio propio de cada persona de prueba: un correo, una cuenta (decisión 2026-10-17) */
  const correoDe = (curp) => `prueba.${String(curp).toLowerCase()}@ejemplo.local`;

  /* Fecha de nacimiento dentro de la CURP, como día/mes/año */
  function fechaDeCurp(curp) {
    const siglo = /\d/.test(curp[16]) ? '19' : '20';
    return `${curp.slice(8, 10)}/${curp.slice(6, 8)}/${siglo}${curp.slice(4, 6)}`;
  }
  /* Cuenta de una persona del registro anterior: sus datos del padrón y lo demás ficticio */
  function llenaMigrada(m) {
    pon('nombre', m.nombre); pon('primer_apellido', m.primer_apellido); pon('segundo_apellido', m.segundo_apellido || '');
    pon('fecha_nacimiento', fechaDeCurp(m.curp)); pon('curp', m.curp);
    pon('correo', correoDe(m.curp)); pon('correo2', correoDe(m.curp)); pon('telefono', '0000000099');
    pon('contrasena', 'una frase larga de prueba'); pon('contrasena2', 'una frase larga de prueba');
    adjuntaFoto(form.querySelector('[data-campo="foto"]'));
    elige('adscrito', 'no');
    marca('aviso'); marca('humano');
    return `Formulario llenado con la CURP de ${APD.nombreCompleto(m)}. Presiona «Crear cuenta» para ver cómo se activa.`;
  }
  /* «Entrar» con un caso: llena CURP y contraseña y deja presionar «Entrar» */
  function llenaEntrar(p) {
    pon('curp', p.curp); pon('contrasena', APD.CONTRASENA_FICTICIA);
    return `CURP y contraseña de ${APD.nombreCompleto(p)}. Presiona «Entrar».`;
  }

  function llena(datos) {
    if (!form) return 'Esta pantalla no tiene formulario.';
    if (pagina === 'cuenta.html') {
      const p = personaNueva();
      pon('nombre', p.nombre); pon('primer_apellido', p.primer); pon('segundo_apellido', p.segundo);
      pon('fecha_nacimiento', p.fecha.split('-').reverse().join('/')); pon('curp', p.curp);
      pon('correo', correoDe(p.curp)); pon('correo2', correoDe(p.curp)); pon('telefono', '0000000099');
      pon('contrasena', 'una frase larga de prueba'); pon('contrasena2', 'una frase larga de prueba');
      adjuntaFoto(form.querySelector('[data-campo="foto"]'));
      elige('adscrito', 'no');
    } else if (pagina === 'verificar.html') {
      pon('numero', datos.verificacion_publica[0].numero);
    } else if (pagina === 'solicitud.html') {
      if (!form.querySelector('input[name="tipo"]:checked')) elige('tipo');
      pon('nivel_estudios', 'licenciatura'); pon('carrera', 'Biología'); elige('estatus_estudios', 'titulado'); pon('anios_experiencia', '3');
      for (const c of form.querySelectorAll('[data-campo^="doc_"]')) if (visible(c)) adjunta(c);
    }
    marca('protesta'); marca('aviso'); marca('humano');
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
  const PANTALLAS = [
    ['Público', [['index.html', 'Inicio'], ['verificar.html', 'Verificar una acreditación']]],
    ['Persona solicitante', [['cuenta.html', 'Crear cuenta'], ['entrar.html', 'Entrar'], ['tramites.html', 'Mis trámites'], ['datos.html', 'Mi perfil'], ['solicitud.html', 'Solicitud']]],
    ['Personal', [['revision.html', 'Solicitudes por revisar'], ['citas.html', 'Citas de cotejo'], ['aplicar.html', 'Aplicar el examen']]],
    ['Salón de cómputo', [['examen.html', 'Examen en línea']]]
  ];
  const NOMBRES = Object.assign({ 'revisar.html': 'Revisar una solicitud', 'cotejo.html': 'Atender una cita de cotejo', 'corregir.html': 'Cargar el documento correcto' }, Object.fromEntries(PANTALLAS.flatMap(([, l]) => l)));
  const DEL_PERSONAL = ['revision.html', 'revisar.html', 'citas.html', 'cotejo.html', 'aplicar.html'];
  const LLENA = ['cuenta.html', 'solicitud.html', 'verificar.html'];           // «Llenar con datos ficticios»
  const ENVIO = ['cuenta.html', 'datos.html', 'entrar.html', 'solicitud.html']; // aceptan ?simular= (config-*.js)
  const PREFIJO = 'apd.';                                                      // todo lo que guarda el sitio en la pestaña
  /* Mapa del trámite («Quién hace qué, fase por fase»): siempre a la mano para ubicarse (decisión 2026-10-17) */
  const MAPA = 'https://claude.ai/artifact/UzM6bcm2uZz6rKMwLTKrzc';
  const FASES = ['Cuenta y solicitud', 'Revisión en línea', 'Cotejo y pago', 'Bandeja y grupos', 'Curso y examen', 'Emisión y entrega', 'Vigencia y renovación'];
  const FASE_PANTALLA = { 'index.html': 1, 'cuenta.html': 1, 'entrar.html': 1, 'datos.html': 1, 'solicitud.html': 1, 'revision.html': 2, 'revisar.html': 2, 'citas.html': 3, 'cotejo.html': 3, 'corregir.html': 3, 'aplicar.html': 5, 'examen.html': 5, 'verificar.html': 7 };
  const FASE_ESTADO = { borrador: 1, enviada: 2, con_observaciones: 2, rechazada: 2, cancelada: 1, concluida_sin_atender: 2, validada_en_linea: 3,
    lista_para_curso: 4, inscrita: 4, aprobada: 5, no_acreditada: 5, sin_derecho_examen: 5, acreditada: 6 };

  /* Lo guardado en este navegador: solicitudes enviadas en la prueba (IndexedDB), revisiones y citas atendidas */
  function cuentaLista(clave) {
    try { return Object.values(JSON.parse(window.localStorage.getItem(clave) || '{}')).reduce((n, v) => n + (Array.isArray(v) ? v.length : 1), 0); } catch (e) { return 0; }
  }
  function guardado() {
    const revisiones = cuentaLista('apd.personal.revisiones');
    const cotejos = cuentaLista('apd.personal.cotejos');
    const examenes = cuentaLista('apd.examen.codigos');
    if (typeof APD_ARCHIVOS_PRUEBA === 'undefined') return Promise.resolve({ cuentas: 0, envios: 0, fotos: 0, revisiones, cotejos, examenes });
    return APD_ARCHIVOS_PRUEBA.guardado().then((g) => Object.assign(g, { revisiones, cotejos, examenes }));
  }
  function textoGuardado({ cuentas, envios, fotos, revisiones, cotejos, examenes }) {
    const partes = [];
    if (cuentas) partes.push(cuentas === 1 ? '1 cuenta' : `${cuentas} cuentas`);
    if (fotos) partes.push(fotos === 1 ? '1 fotografía de perfil' : `${fotos} fotografías de perfil`);
    if (envios) partes.push(envios === 1 ? '1 solicitud enviada con sus documentos' : `${envios} solicitudes enviadas con sus documentos`);
    if (revisiones) partes.push(revisiones === 1 ? '1 revisión' : `${revisiones} revisiones`);
    if (cotejos) partes.push(cotejos === 1 ? '1 cita de cotejo atendida' : `${cotejos} citas de cotejo atendidas`);
    if (examenes) partes.push(examenes === 1 ? '1 código de examen' : `${examenes} códigos de examen`);
    return partes.length ? `${partes.slice(0, -1).join(', ')}${partes.length > 1 ? ' y ' : ''}${partes[partes.length - 1]}` : 'nada';
  }
  function borraPestana() {
    try {
      for (const almacen of [window.sessionStorage, window.localStorage]) {
        for (const k of Object.keys(almacen)) if (k.startsWith(PREFIJO)) almacen.removeItem(k);
      }
    } catch (e) { /* sin almacenamiento: nada que borrar */ }
  }

  function panel(datos) {
    const dialogo = el('dialog', { class: 'menu-pruebas', 'aria-labelledby': 'menu-pruebas-titulo' });
    const estado = el('p', { class: 'menu-pruebas-estado', role: 'status' });
    const di = (t) => { estado.textContent = t; };
    const seccion = (titulo, hijos) => el('section', { class: 'menu-pruebas-seccion' }, [el('h3', { class: 'menu-pruebas-subtitulo', texto: titulo }), ...hijos.filter(Boolean)]);
    const boton = (texto, accion, clase = 'btn btn-secundario') => { const b = el('button', { type: 'button', class: clase, texto }); b.addEventListener('click', accion); return b; };
    const acciones = (...b) => el('div', { class: 'menu-pruebas-acciones' }, b.filter(Boolean));
    const ayuda = (texto) => el('p', { class: 'menu-pruebas-ayuda', texto });
    const rotulo = (texto) => el('p', { class: 'menu-pruebas-rotulo', texto });
    const grupos = APD_CASOS_PRUEBA.lista(datos);
    const casos = grupos.flatMap((g) => g.casos);

    /* 1 · Estás como */
    const sesion = APD.leeSesion();
    const enPersonal = DEL_PERSONAL.includes(pagina);
    const persona = sesion && sesion.id ? datos.solicitante.find((p) => p.id === sesion.id) : null;
    const actual = enPersonal ? casos.find((c) => c.clave === 'personal')
      : persona ? casos.find((c) => c.persona && c.persona.id === persona.id) : null;
    const quien = pagina === 'aplicar.html' ? 'Laura Ejemplo Instructora · personal, instructor (aplica el examen)'
      : pagina === 'examen.html' ? 'persona en el salón de cómputo (entra con su código, sin cuenta)'
      : enPersonal ? `${APD_PERSONAL_NOMBRE()} · personal, revisión documental`
      : persona ? `${APD.nombreCompleto(persona)} · persona solicitante${persona.de_prueba ? ' (cuenta creada en la prueba)' : ''}` : 'nadie (sin sesión)';
    const ahora = el('div', { class: 'menu-pruebas-ahora' }, [
      el('div', { class: 'menu-pruebas-fila' }, [
        el('p', {}, [el('strong', { texto: 'Estás como: ' }), document.createTextNode(quien)]),
        enPersonal || sesion ? boton('Salir', () => { APD.cierraSesion(); location.href = 'index.html'; }, 'btn-enlace') : null
      ].filter(Boolean)),
      ayuda(actual && actual.clave !== 'personal' ? `Caso: ${actual.texto}.` : 'Dónde estás en el trámite: en la franja de arriba de la página.')
    ]);

    /* 2 · En esta pantalla: sólo lo que aplica */
    const aqui = [];
    if (form && LLENA.includes(pagina)) aqui.push(acciones(boton('Llenar con datos ficticios', () => di(llena(datos)))));
    /* Acciones propias de una pantalla (examen.html, aplicar.html): [texto, función async que devuelve el aviso] */
    if (typeof window.APD_PRUEBAS_AQUI === 'function') {
      aqui.push(acciones(...window.APD_PRUEBAS_AQUI(datos).map(([texto, hace]) => boton(texto, () => {
        Promise.resolve().then(hace).then((m) => di(m || 'Listo.'), () => di('No se pudo hacer en este navegador.'));
      }))));
    }
    if (form && pagina === 'cuenta.html') {
      const migradas = APD_CASOS_PRUEBA.migradas(datos);
      if (migradas.length) {
        const sel = el('select', { class: 'control control-select', id: 'menu-pruebas-migrada' },
          [el('option', { value: '', texto: 'Elige una persona' }), ...migradas.map((m) => {
            const acs = APD.acreditacionesDe(datos, m).map((a) => `${APD.TIPOS[a.tipo_acreditacion]} ${APD.VIGENCIA[APD.situacion(datos, a)].texto.toLowerCase()}`).join('; ');
            return el('option', { value: m.id, texto: `${APD.nombreCompleto(m)} — ${acs}` });
          })]);
        aqui.push(el('div', { class: 'menu-pruebas-campo' }, [
          el('label', { class: 'etiqueta', for: 'menu-pruebas-migrada', texto: 'Crear la cuenta de alguien del registro anterior' }),
          el('div', { class: 'select' }, [sel])
        ]), acciones(boton('Llenar con su CURP', () => {
          const m = migradas.find((x) => x.id === sel.value);
          di(m ? llenaMigrada(m) : 'Elige una persona.');
        })), ayuda('Todavía no tienen cuenta: al crearla con su CURP se activa y se ven sus acreditaciones anteriores.'));
      }
    }
    if (form && pagina === 'entrar.html') {
      const sel = selectCasos('menu-pruebas-llenar', grupos, (c) => c.persona, '');
      aqui.push(el('div', { class: 'menu-pruebas-campo' }, [
        el('label', { class: 'etiqueta', for: 'menu-pruebas-llenar', texto: 'Llenar con un caso de prueba' }),
        el('div', { class: 'select' }, [sel])
      ]), acciones(boton('Llenar CURP y contraseña', () => {
        const c = casos.find((x) => x.clave === sel.value);
        di(c ? llenaEntrar(c.persona) : 'Elige un caso.');
      })), ayuda('Llena el formulario y te deja presionar «Entrar», para probar la pantalla misma. Para entrar directo, usa «Entrar como».'));
    }
    if (form && form.querySelector('section[data-paso]')) {
      const pasos = Array.from(form.querySelectorAll('section[data-paso]'));
      aqui.push(rotulo('Ir al paso'), acciones(...pasos.map((p, k) =>
        boton(`${k + 1}. ${p.dataset.titulo}`, async () => { const m = await irAlPaso(k); if (m) di(m); else dialogo.close(); }))));
    }
    if (form && ENVIO.includes(pagina)) {
      const modo = new URLSearchParams(location.search).get('simular') || '';
      const url = (m) => { const u = new URL(location.href); if (m) u.searchParams.set('simular', m); else u.searchParams.delete('simular'); return u.pathname.split('/').pop() + u.search; };
      aqui.push(rotulo('Cómo responde el envío'), el('ul', { class: 'menu-pruebas-envio' }, [
        ['Normal', ''], ['Falla', 'error'], ['Límite de envíos', 'limite'], ['Lento', 'lento']
      ].map(([t, m]) => el('li', {}, [el('a', { href: url(m), texto: t, 'aria-current': m === modo ? 'true' : null })]))));
    }

    /* 3 · Entrar como */
    const elegir = selectCasos('menu-pruebas-persona', grupos, () => true, actual ? actual.clave : '');
    const queProbar = ayuda('');
    const describe = () => { const c = casos.find((x) => x.clave === elegir.value); queProbar.textContent = c ? `Qué puedes probar: ${c.prueba}` : ''; queProbar.hidden = !c; };
    elegir.addEventListener('change', describe);
    describe();
    queProbar.classList.add('menu-pruebas-caso');

    /* 5 · Ajustes de la prueba */
    const conRequeridas = Boolean(form && form.querySelector('[data-requerido], [required]'));
    const interruptor = conRequeridas || sinObligatorias ? el('div', { class: 'menu-pruebas-ajuste' }, [
      el('p', {}, [el('strong', { texto: 'Preguntas obligatorias: ' }), document.createTextNode(sinObligatorias ? 'desactivadas' : 'activadas')]),
      ayuda('Desactívalas para avanzar sin llenar; los formatos y la CURP se siguen revisando.'),
      acciones((() => {
        const b = boton(sinObligatorias ? 'Activar las preguntas obligatorias' : 'Desactivar las preguntas obligatorias', () => { escribe(!sinObligatorias); location.reload(); });
        b.setAttribute('aria-pressed', sinObligatorias ? 'true' : 'false');
        return b;
      })())
    ]) : null;
    const cuenta = el('p', {}, [el('strong', { texto: 'Guardado en este navegador: ' }), el('span', { 'data-guardado': '', texto: '…' })]);
    const borrar = boton('Borrar lo guardado', () => {
      const docs = typeof APD_ARCHIVOS_PRUEBA === 'undefined' ? Promise.resolve() : APD_ARCHIVOS_PRUEBA.borraTodo();
      for (const k of ['apd.personal.revisiones', 'apd.personal.cotejos', 'apd.examen.codigos']) {
        try { window.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
      }
      docs.then(() => { di('Se borró lo guardado en este navegador.'); pintaGuardado(); }, () => di('No se pudo borrar.'));
    });
    function pintaGuardado() { guardado().then((g) => { cuenta.querySelector('[data-guardado]').textContent = textoGuardado(g); borrar.hidden = !g.cuentas && !g.envios && !g.fotos && !g.revisiones && !g.cotejos && !g.examenes; }); }
    pintaGuardado();

    const hijos = [
      el('div', { class: 'menu-pruebas-cabeza' }, [
        el('h2', { class: 'titulo-bloque', id: 'menu-pruebas-titulo', texto: 'Menú de pruebas' }),
        boton('Cerrar', () => dialogo.close(), 'btn-enlace')
      ]),
      ahora,
      aqui.length ? seccion('En esta pantalla', aqui) : null,
      seccion('Entrar como', [
        el('div', { class: 'menu-pruebas-campo' }, [
          el('label', { class: 'etiqueta', for: 'menu-pruebas-persona', texto: 'Caso de prueba' }),
          el('div', { class: 'select' }, [elegir])
        ]),
        queProbar,
        acciones(boton('Entrar', () => {
          const c = casos.find((x) => x.clave === elegir.value);
          if (!c) return di('Elige un caso.');
          if (c.clave === 'personal') { location.href = 'revision.html'; return; }
          if (c.clave !== 'nueva') { APD.guardaSesion({ id: c.persona.id }); location.href = 'tramites.html'; return; }
          // Persona nueva: se le crea una cuenta de prueba (con la contraseña común de prueba), guardada en este navegador
          const n = personaNueva();
          const id = `prueba:${n.curp}`;
          APD_ARCHIVOS_PRUEBA.guardaCuenta({ curp: n.curp, id, contrasena: APD.CONTRASENA_FICTICIA,
            persona: { nombre: n.nombre.toLocaleUpperCase('es-MX'), primer_apellido: n.primer.toLocaleUpperCase('es-MX'), segundo_apellido: n.segundo.toLocaleUpperCase('es-MX'),
              sexo: n.sexo, correo: correoDe(n.curp), telefono: '0000000099', adscripcion: 'independiente', organizacion_id: null, organizacion_nombre: '' } })
            .then(() => { APD.guardaSesion({ id }); location.href = 'tramites.html'; }, () => di('No se pudo crear la persona nueva en este navegador.'));
        }))
      ]),
      seccion('Ir a otra pantalla', [el('div', { class: 'menu-pruebas-grupos' }, PANTALLAS.map(([grupo, lista]) => el('div', {}, [
        el('h4', { class: 'menu-pruebas-grupo', texto: grupo }),
        el('ul', { class: 'menu-pruebas-lista' }, lista.map(([h, t]) => el('li', {}, [el('a', { href: h, texto: t, 'aria-current': h === pagina ? 'page' : null })])))
      ])))]),
      seccion('Ajustes de la prueba', [
        ayuda('Lo guardado (cuentas, solicitudes, documentos, fotografías, revisiones, citas de cotejo, códigos de examen) queda en este navegador aunque lo cierres; las preguntas obligatorias, sólo en esta pestaña.'),
        interruptor,
        el('div', { class: 'menu-pruebas-ajuste' }, [cuenta, acciones(borrar)]),
        acciones(boton('Empezar de cero', () => {
          const docs = typeof APD_ARCHIVOS_PRUEBA === 'undefined' ? Promise.resolve() : APD_ARCHIVOS_PRUEBA.borraTodo();
          borraPestana();
          docs.catch(() => {}).then(() => { location.href = 'index.html'; });
        })),
        ayuda('«Empezar de cero» cierra la sesión, borra lo guardado, activa las preguntas obligatorias y te lleva al inicio.')
      ]),
      estado
    ];
    for (const h of hijos) if (h) dialogo.append(h);
    return dialogo;
  }

  /* Lista de casos agrupada (optgroup por etapa); «filtra» decide qué casos se ofrecen */
  function selectCasos(id, grupos, filtra, elegido) {
    const opciones = [el('option', { value: '', texto: 'Elige un caso' })];
    for (const g of grupos) {
      const casos = g.casos.filter(filtra);
      if (!casos.length) continue;
      const og = el('optgroup', { label: g.grupo });
      for (const c of casos) og.append(el('option', { value: c.clave, texto: c.persona ? `${c.texto} — ${APD.nombreCompleto(c.persona)}` : c.texto, selected: c.clave === elegido ? '' : null }));
      opciones.push(og);
    }
    return el('select', { class: 'control control-select', id }, opciones);
  }
  /* Nombre de quien revisa: el perfil ficticio del personal (personal.js sólo se carga en sus pantallas) */
  function APD_PERSONAL_NOMBRE() { return typeof APD_PERSONAL !== 'undefined' ? APD_PERSONAL.REVISORA.nombre : 'María Ejemplo Revisora'; }
  /* Ubicación siempre a la vista (decisión 2026-10-17): bajo la franja de la versión de prueba, la pantalla, la fase del
     trámite (en «Mis trámites», la de la solicitud más reciente de la persona) y el enlace al mapa del trámite */
  function ubicacion(datos) {
    let n = FASE_PANTALLA[pagina] || 0;
    if (pagina === 'tramites.html') {
      const persona = APD.personaDeSesion(datos);
      const s = persona ? APD.solicitudesDe(datos, persona)[0] : null;
      n = s ? FASE_ESTADO[s.estado] || 1 : 1;
    }
    const nombre = NOMBRES[pagina] || pagina;
    return el('nav', { class: 'ubicacion-prueba', 'aria-label': 'Dónde estás en el trámite (versión de prueba)' }, [
      el('p', { class: 'ubicacion-prueba-int' }, [
        el('strong', { texto: `Pantalla: ${nombre}` }),
        n ? document.createTextNode(` · Fase ${n} de 7: ${FASES[n - 1]} · `) : document.createTextNode(' · '),
        el('a', { href: MAPA, target: '_blank', rel: 'noopener' }, [document.createTextNode('Ver el mapa del trámite: quién hace qué, fase por fase'),
          el('span', { class: 'solo-lector', texto: ' (se abre en otra pestaña)' })])
      ])
    ]);
  }

  function monta() {
    fetch('VERSION', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((v) => {
      if (!/^0\./.test(v.trim())) return;
      return APD.cargar().then((datos) => {
        const dialogo = panel(datos);
        const franja = document.querySelector('.entorno-pruebas');
        if (franja) franja.after(ubicacion(datos));
        const abre = el('button', { type: 'button', class: 'btn btn-secundario menu-pruebas-boton', 'aria-haspopup': 'dialog', texto: 'Menú de pruebas' });
        abre.addEventListener('click', () => dialogo.showModal());
        const pie = document.querySelector('footer') || document.body;
        pie.append(abre, dialogo);
      });
    }).catch(() => { /* sin VERSION o sin datos: no hay menú */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
}());
