/* =========================================================
   examen.js · Examen en línea de la persona (examen.html), en el salón de cómputo del PILARES

   Pantallas, una a la vez: entrar con el código → ¿eres tú? → instrucciones → una
   pregunta por pantalla → revisar y enviar → resultado. La persona no entra con
   su cuenta: sólo con el código de un solo uso que le entrega quien aplica el
   examen (decisión 2026-10-17, P78).

   Todo lo que decide va al servidor (APD_EXAMEN_API; en la versión de prueba,
   simulado en app/examen-servidor.js): cada respuesta se guarda al elegirla,
   el tiempo lo lleva el servidor y la calificación la calcula el servidor. Si
   la página se recarga o la persona cambia de computadora, vuelve a entrar con
   el mismo código y sigue donde se quedó.

   A la persona se le habla de tú. Una sola acción principal por pantalla;
   «Anterior» y «Volver» son enlaces con flecha.

   Sin conexión (ajustes del equipo, 25/10/2026: no perder el avance del examen): si una respuesta o una marca no llega
   al servidor por falta de conexión, se queda en esta computadora (localStorage «apd.examen.pendiente.<código>.<pregunta>»)
   y la persona sigue contestando. Al volver la conexión (evento «online» y reintentos con espera creciente) se envía en
   el orden en que se eligió. Al volver a entrar con el mismo código en esta computadora (recarga o corte de luz), primero
   se envía lo pendiente y luego sigue donde se quedó; en otra computadora manda lo que tiene el servidor. «Enviar mis
   respuestas» no se permite con respuestas sin enviar. El tiempo lo sigue llevando el servidor.

   El reloj se detiene durante un corte (decisión de Liber del 25/10/2026): mientras el examen está en curso, la página
   manda al servidor una señal de vida con su código cada pocos segundos (senal_cada_ms, del servidor). Sin conexión, el
   reloj de la pantalla se detiene y lo dice; al volver, primero se envía lo pendiente y después la señal, con la que el
   servidor reanuda el tiempo. El tiempo que se muestra sale siempre de lo que responde el servidor.

   Lectura en voz alta (ajustes del equipo, 25/10/2026: lectura en voz alta): con speechSynthesis y una voz en español
   (es-MX o, si no hay, cualquier es-*), a velocidad un poco menor que la normal: la pregunta con sus opciones, cada
   opción sola, las instrucciones de entrada y de inicio, y «¿Eres tú?». Sin síntesis de voz o sin voz en español, los
   botones no aparecen y quien aplica lo ve en su pantalla.
   ========================================================= */
(function () {
  'use strict';
  const { el, datosLista } = APD;
  const API = APD_EXAMEN_API;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  /* El código abierto en esta pestaña, para que una recarga no saque a la persona de su examen */
  const SESION = 'apd.examen.abierto';
  /* Identificador de esta pantalla: un código abierto aquí no se abre en otra computadora mientras esta siga activa */
  const EQUIPO = (() => {
    try {
      let e = sessionStorage.getItem('apd.examen.equipo');
      if (!e) { e = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('apd.examen.equipo', e); }
      return e;
    } catch (err) { return Math.random().toString(36).slice(2); }
  })();
  const AVISOS_MIN = [15, 5, 1];

  let ex = null;          // el examen como lo da el servidor (sin clave de respuestas)
  let actual = 0;         // índice de la pregunta en pantalla
  let fin = 0;            // hora (ms) en que se acaba el tiempo, según el servidor
  let reloj = 0;
  let avisados = new Set();
  let enviando = false;

  /* ----- Lectura en voz alta ----- */
  const Voz = (() => {
    let s = null;
    try { s = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null; } catch (e) { s = null; }
    let voz = null;
    let decidido = !s;     // sin síntesis de voz ya se sabe que no puede
    const avisa = [];
    const elige = () => {
      try {
        const vs = s.getVoices() || [];
        voz = vs.find((v) => /^es[-_]mx$/i.test(v.lang)) || vs.find((v) => /^es([-_]|$)/i.test(v.lang)) || null;
      } catch (e) { voz = null; }
    };
    const cambia = () => { for (const fn of avisa) fn(); };
    if (s) {
      elige();
      if (voz) decidido = true;
      else {
        // Las voces pueden llegar después (voiceschanged); si en unos segundos no hay voz en español, no puede
        const llegan = () => { elige(); if (voz) { decidido = true; cambia(); } };
        try { s.addEventListener('voiceschanged', llegan); } catch (e) { /* navegador sin eventos de voz */ }
        setTimeout(() => { if (!decidido) { elige(); decidido = true; cambia(); } }, 3000);
      }
    }
    return {
      puede: () => Boolean(s && voz),
      /* true, false o null (todavía no se sabe): lo que se le dice al servidor */
      estado: () => (s && voz ? true : decidido ? false : null),
      alCambiar: (fn) => avisa.push(fn),
      lee(textos) {
        if (!s || !voz) return;
        s.cancel();
        for (const t of textos.filter(Boolean)) {
          const u = new window.SpeechSynthesisUtterance(t);
          u.voice = voz; u.lang = voz.lang; u.rate = 0.85; // un poco más lento que lo normal
          s.speak(u);
        }
      },
      detiene() { try { if (s) s.cancel(); } catch (e) { /* nada que detener */ } }
    };
  })();
  const info = () => ({ voz: Voz.estado() });

  /* ----- Lo que no llegó al servidor por falta de conexión: en esta computadora, por código y pregunta ----- */
  const PEND = 'apd.examen.pendiente.';
  const Pend = {
    lista(codigo) {
      if (!codigo) return [];
      const fuera = [];
      try {
        for (const k of Object.keys(localStorage)) {
          if (!k.startsWith(`${PEND}${codigo}.`)) continue;
          try { const v = JSON.parse(localStorage.getItem(k)); if (v && typeof v === 'object') fuera.push(Object.assign({}, v, { clave: k.slice(PEND.length + codigo.length + 1) })); } catch (e) { /* dañado: se ignora */ }
        }
      } catch (e) { return []; }
      return fuera.sort((a, b) => a.en - b.en);
    },
    /* cambio: { valor } o { marca }; devuelve false si esta computadora no deja guardarlo */
    pon(codigo, clave, cambio) {
      try {
        const k = `${PEND}${codigo}.${clave}`;
        let antes = {};
        try { antes = JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { antes = {}; }
        localStorage.setItem(k, JSON.stringify(Object.assign(antes, cambio, { en: Date.now() })));
        return true;
      } catch (e) { return false; }
    },
    /* Lo quita sólo si no cambió mientras se enviaba */
    /* Un examen enviado o suspendido ya no acepta nada: lo pendiente se descarta */
    borra(codigo) {
      try { for (const k of Object.keys(localStorage)) if (k.startsWith(`${PEND}${codigo}.`)) localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
    },
    quita(codigo, clave, en) {
      try {
        const k = `${PEND}${codigo}.${clave}`;
        const v = JSON.parse(localStorage.getItem(k) || 'null');
        if (!v || v.en === en) localStorage.removeItem(k);
      } catch (e) { /* sin almacenamiento */ }
    }
  };
  const deConexion = (e) => Boolean(e && e.motivo === 'conexion');
  const codigosDe = (v) => (v ? [v.repone_a, v.codigo].filter(Boolean) : []);
  const pendientes = (v = ex) => codigosDe(v).reduce((n, c) => n + Pend.lista(c).length, 0);
  /* Lo pendiente se ve en el examen como si ya estuviera guardado */
  function conPendientes(v) {
    for (const c of codigosDe(v)) {
      for (const p of Pend.lista(c)) {
        if (p.valor !== undefined) v.respuestas[p.clave] = p.valor;
        if (p.marca !== undefined) v.marcadas = v.marcadas.filter((k) => k !== p.clave).concat(p.marca ? [p.clave] : []);
      }
    }
    return v;
  }
  /* Envía lo pendiente, en orden. Falla (y se reintenta después) si todavía no hay conexión; lo que el servidor rechaza por
     sus reglas (se acabó el tiempo, examen suspendido o enviado) se descarta: manda el servidor. */
  let enviandoPend = null;
  function enviaPendientes(v = ex) {
    if (!v) return Promise.resolve(0);
    if (enviandoPend) return enviandoPend;
    const destino = v.codigo;
    const corre = async () => {
      let enviadas = 0;
      for (const c of codigosDe(v)) {
        for (const p of Pend.lista(c)) {
          try {
            if (p.valor !== undefined) await API.responder(destino, p.clave, p.valor);
            if (p.marca !== undefined) await API.marcar(destino, p.clave, p.marca);
            enviadas += 1;
          } catch (e) {
            if (deConexion(e) || (e && e.motivo === 'reemplazado')) throw e;
          }
          Pend.quita(c, p.clave, p.en);
        }
      }
      return enviadas;
    };
    enviandoPend = corre().finally(() => { enviandoPend = null; });
    return enviandoPend;
  }
  /* Reintento: al volver la conexión (online) y cada vez más espaciado (2 s, 4 s, 8 s… hasta 30 s) */
  let reintento = 0;
  let espera = 2000;
  let sinRed = false;              // la última llamada no llegó al servidor
  let terminarAlVolver = '';       // se acabó el tiempo sin conexión: se envía al volver
  let abrirAlVolver = '';          // recarga sin conexión: el código que se abre al volver
  function programaReintento() {
    if (reintento) return;
    reintento = setTimeout(reintenta, espera);
    espera = Math.min(espera * 2, 30000);
  }
  function reintenta() {
    clearTimeout(reintento); reintento = 0;
    if (!ex && abrirAlVolver) {
      API.entrar(abrirAlVolver, EQUIPO, info()).then((v) => { abrirAlVolver = ''; volvio(); entraCon(v, true); },
        (e) => { if (deConexion(e)) programaReintento(); else { abrirAlVolver = ''; guardaAbierto(null); $('[data-aviso-entrar]').hidden = true; } });
      return;
    }
    if (!ex) return;
    const alFinal = () => { if (terminarAlVolver) { const m = terminarAlVolver; terminarAlVolver = ''; termina(m); return true; } return false; };
    if (ex.situacion !== 'contestando') { alFinal(); return; }
    // Lo pendiente y después la señal, que reanuda el tiempo en el servidor (decisión del 25/10/2026)
    reanuda().then((n) => {
      volvio();
      const g = $('[data-guardado]');
      if (n || g.dataset.sinRed) g.textContent = 'Volvió la conexión: tus respuestas ya se enviaron.';
      delete g.dataset.sinRed;
      if (alFinal()) return;
      refresca();
      if (!$('[data-vista="revision"]').hidden) pintaRevision();
    }, (e) => { if (deConexion(e)) { sinRed = true; programaReintento(); } });
  }
  function volvio() { sinRed = false; espera = 2000; }

  /* ----- Señal de vida y reloj detenido durante un corte (decisión de Liber del 25/10/2026) ----- */
  const DETENIDO = 'Sin conexión: el tiempo de tu examen está detenido. Sigue contestando; vuelve a correr cuando regrese la conexión.';
  let senalCada = 0;
  /* Lo pendiente primero y después la señal: con ella el servidor reanuda el tiempo y dice cuánto queda */
  function reanuda() {
    if (!ex || ex.situacion !== 'contestando') return Promise.resolve(0);
    const codigo = ex.codigo;
    let enviadas = 0;
    return enviaPendientes().then((n) => { enviadas = n; return API.senal(codigo); }).then((v) => {
      if (ex && ex.codigo === codigo) tiempoDe(v);
      return enviadas;
    }, (e) => { if (deConexion(e)) detenReloj(); throw e; });
  }
  /* El tiempo que dice el servidor; si el examen ya no está en curso, la pantalla se pone al día */
  function tiempoDe(v) {
    if (!v || v.situacion !== 'contestando') { refresca(); return; }
    ex.restante_ms = v.restante_ms;
    ex.pausa = v.pausa;
    const aviso = $('[data-aviso-tiempo]');
    if (aviso.textContent === DETENIDO) aviso.textContent = '';
    arrancaReloj();
  }
  /* Sin conexión: el reloj de la pantalla se detiene (el servidor deja de contar sin señal) y se dice */
  function detenReloj() {
    sinRed = true;
    paraReloj();
    $('[data-aviso-tiempo]').textContent = DETENIDO;
    programaReintento();
  }
  function arrancaSenal(v) {
    const cada = (v && v.senal_cada_ms) || 12000;
    if (senalCada) clearInterval(senalCada);
    senalCada = setInterval(() => { if (ex && ex.situacion === 'contestando' && !sinRed) reanuda().catch(() => {}); }, cada);
  }
  window.addEventListener('online', () => { espera = 2000; reintenta(); });
  /* La línea tranquila de cuando no hay conexión, junto a la pregunta */
  function avisaSinRed() {
    sinRed = true;
    // Sin conexión, el tiempo se detiene (decisión de Liber del 25/10/2026)
    detenReloj();
    const g = $('[data-guardado]');
    g.textContent = 'Sin conexión por ahora: tu respuesta quedó en esta computadora y se enviará cuando vuelva la conexión. Puedes seguir contestando.';
    g.dataset.sinRed = '1';
    programaReintento();
  }

  const guardaAbierto = (c) => { try { if (c) sessionStorage.setItem(SESION, c); else sessionStorage.removeItem(SESION); } catch (e) { /* sin almacenamiento: una recarga pide el código otra vez */ } };
  const leeAbierto = () => { try { return sessionStorage.getItem(SESION); } catch (e) { return null; } };

  function muestra(vista, foco) {
    // Al cambiar de pantalla o de pregunta se detiene lo que se estaba leyendo
    Voz.detiene();
    for (const s of $$('[data-vista]')) s.hidden = s.dataset.vista !== vista;
    window.scrollTo(0, 0);
    const destino = foco || $(`[data-vista="${vista}"][tabindex]`);
    if (destino) destino.focus({ preventScroll: true });
  }
  const contestadas = () => ex.preguntas.filter((p) => ex.respuestas[p.clave]).length;
  const nombreExamen = () => `${APD.TIPOS[ex.examen.tipo]} · ${APD.MODALIDADES[ex.examen.modalidad].toLowerCase()}`;
  const decimal = (n) => Number(n).toFixed(1);

  /* ----- 1 · Entrar ----- */
  const form = $('#entrar');
  const instancia = FormKit.iniciar(form, {
    enviar(payload) { return API.entrar(payload.datos.codigo, EQUIPO, info()); },
    alEnviar(v) { entraCon(v, false); },
    alFallar(e) {
      const aviso = $('[data-estado-envio] .aviso-texto', form);
      if (e && e.campo) { instancia.ctx.marca(e.campo, e.mensaje); if (aviso) aviso.textContent = 'No se pudo abrir el examen. Revisa el mensaje junto al código.'; } else if (e && e.mensaje && aviso) aviso.textContent = e.mensaje;
    }
  });

  /* Al entrar con un código: si en esta computadora quedó algo sin enviar, primero se envía y luego se sigue */
  function entraCon(v, recarga) {
    if (!pendientes(v) || v.situacion !== 'contestando') return abre(v, recarga);
    enviaPendientes(v).then((n) => {
      const w = API.estado(v.codigo);
      abre(w ? Object.assign(w, { repone_a: v.repone_a }) : v, recarga);
      if (n) $('[data-guardado]').textContent = 'Se enviaron las respuestas que habían quedado en esta computadora. Continúas donde te quedaste.';
    }, (e) => {
      // Todavía sin conexión: se sigue con lo de esta computadora y se reintenta
      abre(conPendientes(v), recarga);
      if (deConexion(e)) avisaSinRed();
    });
    return undefined;
  }

  /* Abre un examen según su situación */
  function abre(v, recarga) {
    ex = conPendientes(v);
    $('[data-aviso-entrar]').hidden = true;
    guardaAbierto(v.codigo);
    if (['terminado', 'suspendido'].includes(v.situacion)) for (const c of codigosDe(v)) Pend.borra(c);
    if (v.situacion === 'terminado') return pintaResultado();
    if (v.situacion === 'suspendido') return pintaSuspendido();
    if (v.situacion === 'contestando') {
      arrancaReloj();
      // La señal de vida, ya con lo pendiente enviado: el servidor reanuda el tiempo si estaba detenido
      arrancaSenal(v);
      if (!sinRed) reanuda().catch(() => {});
      const libre = ex.preguntas.findIndex((p) => !ex.respuestas[p.clave]);
      pintaPregunta(libre < 0 ? ex.preguntas.length - 1 : libre);
      $('[data-guardado]').textContent = recarga ? '' : 'Continúas donde te quedaste: tus respuestas están guardadas.';
      return;
    }
    // Sin empezar: primero se confirma que es la persona
    $('[data-iniciales]').textContent = ex.persona.nombre.split(' ').slice(0, 2).map((t) => t[0]).join('');
    // Su fotografía (la confirmada en el cotejo): quien aplica la ve al pasar entre las computadoras
    const marco = $('[data-foto-persona]');
    for (const i of marco.querySelectorAll('img')) i.remove();
    APD_EXAMEN_GRUPO.fotoDe(ex.persona.curp, ex.persona.nombre).then((url) => {
      if (url) marco.append(el('img', { class: 'perfil-imagen', src: url, alt: `Fotografía de ${ex.persona.nombre}` }));
    });
    $('[data-persona]').replaceChildren(datosLista([
      ['Nombre', ex.persona.nombre],
      ['Examen', nombreExamen()],
      ['Grupo', ex.grupo.folio],
      ['Fecha', APD.fechaCorta(ex.grupo.examen_en)]
    ]));
    muestra('confirmar');
  }

  /* ----- 2 y 3 · ¿Eres tú? e instrucciones ----- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir-vista]');
    if (!b) return;
    if (b.dataset.irVista === 'instrucciones') {
      $('[data-total]').textContent = ex.preguntas.length;
      $('[data-minutos]').textContent = ex.minutos;
      $('[data-minima]').textContent = decimal(ex.minima);
      muestra('instrucciones');
    }
  });
  /* Lo que el navegador no guardó (auditoría «intentar romperlo», F4 A5): el aviso en la vista que se ve, con el
     mensaje del servidor («levanta la mano»); null lo quita */
  function avisoNoGuardo(vista, e) {
    const c = $(`[data-vista="${vista}"] [data-aviso-falla]`);
    if (!c) return;
    if (!e) { c.hidden = true; c.replaceChildren(); delete c.dataset.pendientes; return; }
    // Sin conexión y sin poder guardarla en esta computadora: levantar la mano
    const texto = deConexion(e) && vista === 'pregunta' ? 'No hay conexión y esta computadora no deja guardar tu respuesta: levanta la mano. Quien aplica el examen te ayuda.' : e.mensaje;
    APD.pintaAviso(c, 'error', deConexion(e) ? 'Sin conexión' : 'No se guardó', texto || 'Levanta la mano: quien aplica el examen te ayuda.', true);
  }
  const deAlmacenamiento = (e) => Boolean(e && e.motivo === 'almacenamiento');
  $('[data-empezar]').addEventListener('click', () => {
    avisoNoGuardo('instrucciones', null);
    API.iniciar(ex.codigo).then((v) => { ex = v; arrancaReloj(); arrancaSenal(v); pintaPregunta(0); }, (e) => avisoNoGuardo('instrucciones', e));
  });

  /* ----- 4 · Preguntas ----- */
  function pintaPregunta(k) {
    actual = Math.max(0, Math.min(k, ex.preguntas.length - 1));
    const p = ex.preguntas[actual];
    const n = ex.preguntas.length;
    $('[data-numero]').textContent = `Pregunta ${actual + 1} de ${n}`;
    pintaAvance();
    $('[data-enunciado]').textContent = p.texto;
    pintaOpciones();
    $('[data-marcar]').checked = ex.marcadas.includes(p.clave);
    // Con algo sin enviar, la línea tranquila sigue a la vista en cada pregunta
    const g = $('[data-guardado]');
    g.textContent = pendientes() ? 'Sin conexión por ahora: tus respuestas quedan en esta computadora y se enviarán cuando vuelva la conexión.' : '';
    avisoNoGuardo('pregunta', null);
    $('[data-anterior]').hidden = actual === 0;
    $('[data-siguiente]').textContent = actual === n - 1 ? 'Revisar y enviar' : 'Siguiente';
    pintaNumeros();
    muestra('pregunta', $('[data-tarjeta-pregunta]'));
    FormKit.anuncia(`Pregunta ${actual + 1} de ${n}.`);
  }
  /* Las opciones de la pregunta en pantalla; cada una con su botón «Escuchar» si esta computadora puede leer en voz alta.
     El botón va junto a la opción, fuera de su etiqueta, para no elegirla al escucharla. */
  function pintaOpciones() {
    const p = ex.preguntas[actual];
    $('[data-opciones]').replaceChildren(...p.opciones.map((o, j) => {
      const letra = 'abcd'[j];
      const radio = el('input', { class: 'opcion-fila-input', type: 'radio', name: 'respuesta', value: o.valor, autocomplete: 'off', checked: ex.respuestas[p.clave] === o.valor ? '' : null });
      const texto = el('span', { class: 'opcion-nombre' }, [el('span', { class: 'examen-letra', texto: `${letra})` }), document.createTextNode(` ${o.texto}`)]);
      const fila = el('label', { class: 'opcion-fila' }, [radio, el('span', {}, [texto])]);
      return el('div', { class: 'examen-opcion' }, [fila, Voz.puede()
        ? el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'data-leer-opcion': String(j), 'aria-label': `Escuchar la opción ${letra}`, texto: 'Escuchar' }) : null]);
    }));
  }
  /* Lo que se lee de cada pantalla */
  const textoOpcion = (o, j) => `Opción ${'abcd'[j]}: ${o.texto}`;
  const textosDe = {
    entrar: () => ['Entra a tu examen.', 'Escribe el código que te dio quien aplica el examen. Viene en un papel con tu nombre.',
      'Son 8 letras y números, en dos grupos de 4.', 'Si no tienes código o no funciona, levanta la mano: quien aplica el examen te ayuda.'],
    confirmar: () => ['¿Eres tú?', `Nombre: ${ex.persona.nombre}.`, `Examen: ${nombreExamen()}.`, `Fecha: ${APD.fechaLarga(ex.grupo.examen_en)}.`,
      'Si eres tú, presiona «Sí, soy yo».', 'Si no eres tú, no sigas: levanta la mano y avisa a quien aplica el examen.'],
    instrucciones: () => ['Antes de empezar.', ...$$('[data-vista="instrucciones"] .examen-reglas li').map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      'Cuando estés listo, presiona «Empezar el examen».'],
    pregunta: () => {
      const p = ex.preguntas[actual];
      return [`Pregunta ${actual + 1} de ${ex.preguntas.length}.`, p.texto, ...p.opciones.map(textoOpcion)];
    }
  };
  /* Botones de lectura: «Escuchar…» lee la pantalla; «Detener la lectura», detiene; los de cada opción, esa opción */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-leer], [data-detener], [data-leer-opcion]');
    if (!b) return;
    if (b.hasAttribute('data-detener')) { Voz.detiene(); return; }
    if (b.hasAttribute('data-leer-opcion')) { const j = Number(b.dataset.leerOpcion); Voz.lee([textoOpcion(ex.preguntas[actual].opciones[j], j)]); return; }
    const leer = textosDe[b.dataset.leer];
    if (leer) Voz.lee(leer());
  });
  /* Sin síntesis de voz o sin voz en español no hay botones de lectura */
  function pintaVoz() {
    for (const c of $$('[data-voz]')) c.hidden = !Voz.puede();
    if (ex && !$('[data-vista="pregunta"]').hidden) pintaOpciones();
  }
  Voz.alCambiar(() => { pintaVoz(); if (ex) API.latido(ex.codigo, EQUIPO, info()); });
  pintaVoz();
  function pintaAvance() {
    const n = ex.preguntas.length;
    const k = contestadas();
    $('[data-contestadas]').textContent = ` · ${k === 1 ? '1 contestada' : `${k} contestadas`}`;
    const barra = $('[data-progreso]');
    barra.max = n; barra.value = k;
    barra.setAttribute('aria-valuetext', `${k} de ${n} preguntas contestadas`);
  }
  function estadoDe(p) {
    if (ex.marcadas.includes(p.clave)) return ['marcada', 'marcada para revisar'];
    return ex.respuestas[p.clave] ? ['contestada', 'contestada'] : ['libre', 'sin contestar'];
  }
  function pintaNumeros() {
    $('[data-numeros]').replaceChildren(...ex.preguntas.map((p, k) => {
      const [clase, texto] = estadoDe(p);
      const b = el('button', { type: 'button', class: 'examen-numero', 'data-estado': clase, 'data-ir': String(k), 'aria-label': `Pregunta ${k + 1}, ${texto}`, 'aria-current': k === actual ? 'step' : null, texto: String(k + 1) });
      return el('li', {}, [b]);
    }));
  }
  /* Sin conexión, la respuesta se queda en esta computadora; si ni eso se puede, se dice como antes (levantar la mano) */
  function quedaAqui(p, cambio) {
    if (!Pend.pon(ex.codigo, p.clave, cambio)) return false;
    if (cambio.valor !== undefined) ex.respuestas[p.clave] = cambio.valor;
    avisoNoGuardo('pregunta', null);
    avisaSinRed();
    pintaAvance();
    pintaNumeros();
    return true;
  }
  $('[data-opciones]').addEventListener('change', (e) => {
    if (e.target.name !== 'respuesta') return;
    const p = ex.preguntas[actual];
    const valor = e.target.value;
    const guardado = $('[data-guardado]');
    // Con respuestas sin enviar, la nueva va detrás de ellas, en orden
    if (pendientes() && quedaAqui(p, { valor })) { reintenta(); return; }
    guardado.textContent = 'Guardando…';
    API.responder(ex.codigo, p.clave, valor).then(() => {
      ex.respuestas[p.clave] = valor;
      guardado.textContent = 'Respuesta guardada.';
      avisoNoGuardo('pregunta', null);
      pintaAvance();
      pintaNumeros();
    }, (err) => {
      if (deConexion(err) && quedaAqui(p, { valor })) return;
      if (!deAlmacenamiento(err) && !deConexion(err)) { refresca(); return; }
      // No quedó: la opción vuelve a la que estaba guardada y se dice, para que levante la mano
      guardado.textContent = '';
      for (const r of $$('[data-opciones] input[name="respuesta"]')) r.checked = ex.respuestas[p.clave] === r.value;
      avisoNoGuardo('pregunta', err);
    });
  });
  $('[data-marcar]').addEventListener('change', (e) => {
    const p = ex.preguntas[actual];
    const si = e.target.checked;
    const antes = ex.marcadas.slice();
    ex.marcadas = ex.marcadas.filter((k) => k !== p.clave).concat(si ? [p.clave] : []);
    if (pendientes() && quedaAqui(p, { marca: si })) { reintenta(); return; }
    API.marcar(ex.codigo, p.clave, si).then(null, (err) => {
      if (deConexion(err) && quedaAqui(p, { marca: si })) return;
      if (!deAlmacenamiento(err) && !deConexion(err)) return;
      ex.marcadas = antes;
      e.target.checked = antes.includes(p.clave);
      pintaNumeros();
      avisoNoGuardo('pregunta', err);
    });
    pintaNumeros();
  });
  $('[data-siguiente]').addEventListener('click', () => { if (actual === ex.preguntas.length - 1) pintaRevision(); else pintaPregunta(actual + 1); });
  $('[data-anterior]').addEventListener('click', () => pintaPregunta(actual - 1));
  $('[data-numeros]').addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) { $('.examen-mapa').open = false; pintaPregunta(Number(b.dataset.ir)); } });

  /* ----- 5 · Revisar y enviar ----- */
  const lista = (nums) => (nums.length > 1 ? `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}` : String(nums[0]));
  function pintaRevision() {
    const n = ex.preguntas.length;
    const k = contestadas();
    const faltan = ex.preguntas.map((p, j) => (ex.respuestas[p.clave] ? 0 : j + 1)).filter(Boolean);
    const marcadas = ex.preguntas.map((p, j) => (ex.marcadas.includes(p.clave) ? j + 1 : 0)).filter(Boolean);
    const partes = [`Contestaste ${k} de ${n} preguntas.`];
    if (faltan.length) partes.push(`${faltan.length === 1 ? 'Te falta la pregunta' : 'Te faltan las preguntas'} ${lista(faltan)}: una pregunta sin contestar cuenta como incorrecta.`);
    if (marcadas.length) partes.push(`Marcaste para revisar: ${lista(marcadas)}.`);
    $('[data-resumen]').textContent = partes.join(' ');
    avisoPendientes();
    $('[data-repaso]').replaceChildren(...ex.preguntas.map((p, j) => {
      const [clase, texto] = estadoDe(p);
      const ir = el('button', { type: 'button', class: 'btn-enlace', 'data-ir': String(j) }, [document.createTextNode(`Pregunta ${j + 1}`), el('span', { class: 'solo-lector', texto: `, ${texto}` })]);
      return el('li', { class: 'examen-repaso-fila', 'data-estado': clase }, [ir, el('span', { class: 'examen-repaso-texto', texto: p.texto }), APD.estado(texto.charAt(0).toUpperCase() + texto.slice(1), clase === 'libre' ? 'error' : clase === 'marcada' ? 'pend' : 'ok')]);
    }));
    muestra('revision');
  }
  $('[data-repaso]').addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) pintaPregunta(Number(b.dataset.ir)); });
  $('[data-volver-preguntas]').addEventListener('click', () => pintaPregunta(actual));
  /* En la revisión: si hay respuestas sin enviar, lo dice; sin pendientes, lo quita */
  function avisoPendientes(enfoca) {
    const n = pendientes();
    const c = $('[data-vista="revision"] [data-aviso-falla]');
    if (!n) { if (c.dataset.pendientes) { c.hidden = true; c.replaceChildren(); delete c.dataset.pendientes; } return; }
    APD.pintaAviso(c, 'pend', n === 1 ? 'Falta enviar 1 respuesta' : `Faltan enviar ${n} respuestas`,
      `${n === 1 ? 'Quedó' : 'Quedaron'} en esta computadora porque no hay conexión. Se ${n === 1 ? 'envía sola' : 'envían solas'} cuando vuelva; después puedes enviar tu examen. Si tarda, levanta la mano.`, enfoca);
    c.dataset.pendientes = '1';
  }
  $('[data-enviar]').addEventListener('click', (e) => {
    const boton = e.currentTarget;
    // No se envía con respuestas sin enviar: se intenta mandarlas y, si todavía no hay conexión, se explica
    if (pendientes()) {
      enviaPendientes().then(() => { volvio(); delete $('[data-guardado]').dataset.sinRed; pintaRevision(); confirmaEnvio(boton); },
        (err) => { if (deConexion(err)) { sinRed = true; programaReintento(); } avisoPendientes(true); });
      return;
    }
    confirmaEnvio(boton);
  });
  function confirmaEnvio(boton) {
    const faltan = ex.preguntas.length - contestadas();
    FormKit.confirma(boton, {
      titulo: '¿Enviar tus respuestas?',
      consecuencias: [faltan ? `Te ${faltan === 1 ? 'falta 1 pregunta' : `faltan ${faltan} preguntas`} sin contestar: ${faltan === 1 ? 'cuenta' : 'cuentan'} como incorrecta${faltan === 1 ? '' : 's'}.` : 'Contestaste todas las preguntas.',
        'Al enviar ves tu calificación.'],
      irreversible: true, si: 'Sí, enviar mis respuestas', no: 'Seguir revisando'
    }).then((si) => { if (si) termina('enviado'); });
  }
  function termina(motivo) {
    if (enviando) return;
    enviando = true;
    // Si no quedó registrado, no hay resultado: se dice en la revisión, con lo contestado (F4 A5)
    const codigo = ex.codigo;
    API.terminar(codigo, motivo).then((v) => {
      enviando = false;
      volvio();
      // Si mientras tanto la pantalla ya se puso al día (refresca) y la persona salió, no se vuelve a abrir el resultado
      if (!ex || ex.codigo !== codigo) return;
      // Al servidor todavía le queda tiempo (lo tuvo detenido durante un corte): el examen sigue con el que dice
      if (v.situacion === 'contestando') { ex = conPendientes(Object.assign(v, { repone_a: v.repone_a || ex.repone_a })); tiempoDe(v); return; }
      ex = v; for (const c of codigosDe(v)) Pend.borra(c); pintaResultado();
    }, (err) => {
      enviando = false;
      if (deConexion(err)) {
        // Sin conexión: al acabarse el tiempo, se envía solo cuando vuelva; si lo envió la persona, vuelve a presionar
        paraReloj();
        if (motivo !== 'tiempo') $('[data-aviso-tiempo]').textContent = DETENIDO;
        if (motivo === 'tiempo') terminarAlVolver = 'tiempo';
        sinRed = true;
        programaReintento();
        if ($('[data-vista="revision"]').hidden) pintaRevision();
        APD.pintaAviso($('[data-vista="revision"] [data-aviso-falla]'), 'pend', motivo === 'tiempo' ? 'Se acabó el tiempo' : 'Tu examen todavía no se envía',
          // Sin conexión el servidor detiene el tiempo (decisión del 25/10/2026): al volver dice si todavía queda
          motivo === 'tiempo' ? 'No hay conexión. Tus respuestas no se pierden: cuando vuelva la conexión, si todavía te queda tiempo sigues contestando; si no, tu examen se envía solo.'
            : 'No hay conexión. Tus respuestas no se pierden: cuando vuelva la conexión, presiona otra vez «Enviar mis respuestas».', true);
        return;
      }
      if (!deAlmacenamiento(err)) { refresca(); return; }
      // Al acabarse el tiempo, el reloj se detiene (no reintenta cada segundo); «Enviar mis respuestas» lo vuelve a intentar
      if (motivo === 'tiempo') paraReloj();
      if ($('[data-vista="revision"]').hidden) pintaRevision();
      avisoNoGuardo('revision', err);
    });
  }

  /* ----- 6 · Resultado ----- */
  function pintaResultado() {
    paraReloj();
    $('[data-por-tiempo]').hidden = ex.motivo_fin !== 'tiempo';
    $('[data-calificacion]').textContent = decimal(ex.calificacion);
    // El veredicto es el título, con su color e icono (propuesta «Avisos y confirmaciones», 2026-10-17): antes el título
    // era el mismo para quien aprobaba y para quien no
    const vista = $('[data-vista="resultado"]');
    vista.dataset.tono = ex.aprobado ? 'ok' : 'error';
    $('[data-resultado-titulo]').replaceChildren(APD.icono(ex.aprobado ? 'palomita' : 'cerrar', 'icono examen-veredicto-icono'), document.createTextNode(ex.aprobado ? 'Aprobaste' : 'No aprobaste'));
    $('[data-veredicto]').textContent = `La calificación mínima es ${decimal(ex.minima)} · ${ex.aciertos} de ${ex.total} correctas`;
    // Las respuestas correctas ya van en el veredicto (D27). La fecha del envío es la del examen, el último día del
    // curso, con la hora real: en la versión de prueba, un examen presentado antes se fecha ese día, como lo registra
    // la prueba en apd.examen (B14, D28)
    // Dato: dd/mm/aaaa con la hora, sin coma (decisión 16 b, 20/10/2026)
    $('[data-resultado-datos]').replaceChildren(datosLista([
      ['Nombre', ex.persona.nombre],
      ['Examen', nombreExamen()],
      ['Enviado', APD.fechaCorta(ex.grupo.examen_en, { hora: APD.hora(ex.terminado_en) })]
    ]));
    $('[data-resultado-sigue]').replaceChildren(ex.aprobado
      ? FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'ok', titulo: 'Recoge hoy tu credencial', texto: ['Se entrega hoy mismo, en la oficina del Vivero Nezahualcóyotl.', APD.tituloPasos()], pasos: ['Avisa a quien aplica el examen que aprobaste.', 'Ve a la oficina del Vivero: ahí te toman la fotografía que lleva tu credencial.', 'Al recibirla, firmas el comprobante de recepción.'] })
      : FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'neutro', titulo: 'Tu calificación quedó registrada', texto: ['No se puede cambiar.', APD.tituloPasos('Para intentarlo de nuevo')], pasos: ['Entra a tu cuenta e inicia una solicitud nueva.', 'Paga los derechos de la solicitud nueva.', 'Cuando la Secretaría te asigne un grupo, asiste al curso y presenta el examen.'] }));
    muestra('resultado');
  }
  function pintaSuspendido() {
    paraReloj();
    $('[data-motivo-suspension]').textContent = `Motivo: ${ex.suspendido.motivo}`;
    muestra('suspendido');
  }

  /* Terminar o salir: la computadora queda lista para la siguiente persona */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-salir]')) return;
    paraReloj();
    if (ex) API.suelta(ex.codigo, EQUIPO);
    ex = null;
    guardaAbierto(null);
    form.reset();
    instancia.ctx.limpia('codigo');
    muestra('entrar', $('#codigo'));
  });

  /* ----- El reloj: lo lleva el servidor; aquí sólo se muestra ----- */
  function arrancaReloj() {
    fin = Date.now() + ex.restante_ms;
    avisados = new Set(AVISOS_MIN.filter((m) => ex.restante_ms <= m * 60000));
    clearInterval(reloj);
    reloj = setInterval(tic, 1000);
    tic();
  }
  function paraReloj() { clearInterval(reloj); reloj = 0; }
  function tic() {
    const ms = Math.max(0, fin - Date.now());
    const s = Math.ceil(ms / 1000);
    const texto = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    for (const n of $$('[data-reloj-texto]')) n.textContent = texto;
    const tono = ms <= 60000 ? 'error' : ms <= 5 * 60000 ? 'pend' : '';
    for (const n of $$('.examen-reloj')) n.dataset.tono = tono;
    for (const m of AVISOS_MIN) {
      if (ms <= m * 60000 && !avisados.has(m)) { avisados.add(m); $('[data-aviso-tiempo]').textContent = m === 1 ? 'Queda 1 minuto.' : `Quedan ${m} minutos.`; }
    }
    if (ms === 0) termina('tiempo');
  }

  /* ----- Lo que cambia fuera de esta pantalla: quien aplica suspende, se repone el código, otra computadora envía ----- */
  function refresca() {
    if (!ex) return;
    // Avisa que esta pantalla sigue abierta; si el examen se abrió en otra computadora, ésta lo suelta
    if (['sin_empezar', 'contestando'].includes(ex.situacion) && API.latido(ex.codigo, EQUIPO, info()).otro) {
      paraReloj(); guardaAbierto(null); ex = null;
      muestra('entrar', $('#codigo'));
      const aviso = $('[data-aviso-entrar]');
      $('.aviso-texto', aviso).textContent = 'Tu examen se abrió en otra computadora. Si eres tú, sigue allá; si no, levanta la mano.';
      aviso.hidden = false;
      return;
    }
    const v = API.estado(ex.codigo);
    if (!v) return;
    if (v.situacion === ex.situacion && v.situacion !== 'contestando') return;
    const antes = ex.situacion;
    // Lo que sigue en esta computadora sin enviar se ve como contestado
    ex = conPendientes(Object.assign(v, { respuestas: v.respuestas, repone_a: v.repone_a || ex.repone_a }));
    if (v.situacion === 'suspendido' && antes !== 'suspendido') return pintaSuspendido();
    if (v.situacion === 'terminado' && $('[data-vista="resultado"]').hidden) return pintaResultado();
    if (v.situacion === 'reemplazado') {
      paraReloj(); guardaAbierto(null); ex = null;
      muestra('entrar', $('#codigo'));
      const aviso = $('[data-aviso-entrar]');
      $('.aviso-texto', aviso).textContent = 'Se te dio un código nuevo. Escríbelo para seguir con tu examen: tus respuestas están guardadas.';
      aviso.hidden = false;
      return;
    }
    if (v.situacion === 'contestando') { fin = Date.now() + v.restante_ms; if (antes === 'contestando') { pintaAvance(); } }
  }
  window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith(API.PREFIJO)) refresca(); });
  setInterval(refresca, 3000);
  /* Salir de la ventana del examen se le cuenta a quien aplica (no se bloquea: puede ser un aviso del sistema) */
  document.addEventListener('visibilitychange', () => { if (document.hidden && ex && ex.situacion === 'contestando') API.salida(ex.codigo).catch(() => {}); });
  window.addEventListener('pagehide', () => Voz.detiene());

  /* Una recarga vuelve al examen abierto en esta pestaña; si no hay conexión, se dice y se abre solo cuando vuelva */
  const abierto = leeAbierto();
  if (abierto) {
    API.entrar(abierto, EQUIPO, info()).then((v) => entraCon(v, true), (e) => {
      if (!deConexion(e)) { guardaAbierto(null); return; }
      abrirAlVolver = abierto;
      const aviso = $('[data-aviso-entrar]');
      $('.aviso-texto', aviso).textContent = 'Sin conexión por ahora. Tu examen y las respuestas que quedaron en esta computadora están a salvo: se abre solo cuando vuelva la conexión.';
      aviso.hidden = false;
      programaReintento();
    });
  }

  /* ----- Menú de pruebas: «En esta pantalla» (app/pruebas.js) ----- */
  window.APD_PRUEBAS_AQUI = (datos) => {
    const G = APD_EXAMEN_GRUPO;
    const enCurso = () => (ex && ex.situacion === 'contestando' ? ex.codigo : null);
    const reabre = (codigo, texto) => { API.entrar(codigo, EQUIPO).then((v) => abre(v, true)); return texto; };
    return [
      ['Usar el código de alguien del grupo en curso', async () => {
        if (ex) return 'Ya hay un examen abierto. Presiona «Terminar» o «Salir» primero.';
        const g = G.grupos(datos)[0];
        if (!g) return 'No hay un grupo en curso en los datos ficticios.';
        const usados = new Set(API.delGrupo(g.id).filter((r) => r.situacion !== 'sin_empezar').map((r) => r.inscripcion_id));
        const fila = G.personas(datos, g).find((f) => f.puede && !f.examen && !usados.has(f.inscripcion.id));
        if (!fila) return 'Todas las personas con derecho a examen ya lo empezaron. Borra lo guardado para volver a probar.';
        const r = await G.pasarLista(datos, g, fila, true, 'menu.pruebas');
        const c = $('#codigo');
        c.value = r.codigo;
        c.dispatchEvent(new Event('input', { bubbles: true }));
        return `Código de ${APD.nombreCompleto(fila.persona)}: ${r.codigo}. Presiona «Entrar al examen».`;
      }],
      ['Contestar todas bien', async () => (enCurso() && API.pruebas.contestar(ex.codigo, 'bien') ? reabre(ex.codigo, 'Todas contestadas bien. Ve a la última pregunta y envía.') : 'Primero empieza un examen.')],
      ['Contestar para no aprobar', async () => (enCurso() && API.pruebas.contestar(ex.codigo, 'reprobar') ? reabre(ex.codigo, 'Una de cada tres bien: no alcanza la mínima.') : 'Primero empieza un examen.')],
      ['Dejar 1 minuto en el reloj', async () => (enCurso() && API.pruebas.dejarMinutos(ex.codigo, 1) ? reabre(ex.codigo, 'Queda 1 minuto. Al llegar a cero, el examen se envía solo.') : 'Primero empieza un examen.')],
      // Falta de conexión (ajustes del equipo, 25/10/2026): sólo esta pestaña; sigue al recargar
      API.pruebas.sinConexion()
        ? ['Simular que vuelve el internet', async () => { API.pruebas.conexion(true); return 'Volvió la conexión: lo que quedó en esta computadora se envía.'; }]
        : ['Simular que se va el internet', async () => { API.pruebas.conexion(false); return 'Sin conexión en esta pestaña (también si la recargas): contesta y mira lo que pasa.'; }]
    ];
  };
}());
