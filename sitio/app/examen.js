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

  const guardaAbierto = (c) => { try { if (c) sessionStorage.setItem(SESION, c); else sessionStorage.removeItem(SESION); } catch (e) { /* sin almacenamiento: una recarga pide el código otra vez */ } };
  const leeAbierto = () => { try { return sessionStorage.getItem(SESION); } catch (e) { return null; } };

  function muestra(vista, foco) {
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
    enviar(payload) { return API.entrar(payload.datos.codigo, EQUIPO); },
    alEnviar(v) { abre(v, false); },
    alFallar(e) {
      const aviso = $('[data-estado-envio] .aviso-texto', form);
      if (e && e.campo) { instancia.ctx.marca(e.campo, e.mensaje); if (aviso) aviso.textContent = 'No se pudo abrir el examen. Revisa el mensaje junto al código.'; } else if (e && e.mensaje && aviso) aviso.textContent = e.mensaje;
    }
  });

  /* Abre un examen según su situación */
  function abre(v, recarga) {
    ex = v;
    $('[data-aviso-entrar]').hidden = true;
    guardaAbierto(v.codigo);
    if (v.situacion === 'terminado') return pintaResultado();
    if (v.situacion === 'suspendido') return pintaSuspendido();
    if (v.situacion === 'contestando') {
      arrancaReloj();
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
      ['Fecha', APD.fecha(ex.grupo.examen_en)]
    ]));
    muestra('confirmar');
  }

  /* ----- 2 y 3 · ¿Eres tú? e instrucciones ----- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir-vista]');
    if (!b) return;
    if (b.dataset.irVista === 'instrucciones') {
      $('[data-total]').textContent = ex.preguntas.length;
      $('[data-con-casos]').hidden = !ex.preguntas.some((p) => p.caso);
      $('[data-minutos]').textContent = ex.minutos;
      $('[data-minima]').textContent = decimal(ex.minima);
      muestra('instrucciones');
    }
  });
  $('[data-empezar]').addEventListener('click', () => {
    API.iniciar(ex.codigo).then((v) => { ex = v; arrancaReloj(); pintaPregunta(0); });
  });

  /* ----- 4 · Preguntas ----- */
  function pintaPregunta(k) {
    actual = Math.max(0, Math.min(k, ex.preguntas.length - 1));
    const p = ex.preguntas[actual];
    const n = ex.preguntas.length;
    $('[data-numero]').textContent = `Pregunta ${actual + 1} de ${n}`;
    pintaAvance();
    pintaCaso(p);
    $('[data-enunciado]').textContent = p.texto;
    $('[data-opciones]').replaceChildren(...p.opciones.map((o, j) => {
      const letra = 'abcdefgh'[j];
      const radio = el('input', { class: 'opcion-fila-input', type: 'radio', name: 'respuesta', value: o.valor, autocomplete: 'off', checked: ex.respuestas[p.clave] === o.valor ? '' : null });
      const texto = o.imagen
        ? el('span', { class: 'examen-opcion-imagen' }, [el('span', { class: 'opcion-nombre', texto: `${letra})` }), el('img', { src: o.imagen, alt: `Imagen de la opción ${letra}`, width: '160', height: '120' })])
        : el('span', { class: 'opcion-nombre' }, [el('span', { class: 'examen-letra', texto: `${letra})` }), document.createTextNode(` ${o.texto}`)]);
      return el('label', { class: 'opcion-fila' }, [radio, el('span', {}, [texto])]);
    }));
    $('[data-marcar]').checked = ex.marcadas.includes(p.clave);
    $('[data-guardado]').textContent = '';
    $('[data-anterior]').hidden = actual === 0;
    $('[data-siguiente]').textContent = actual === n - 1 ? 'Revisar y enviar' : 'Siguiente';
    pintaNumeros();
    muestra('pregunta', $('[data-tarjeta-pregunta]'));
    FormKit.anuncia(`Pregunta ${actual + 1} de ${n}.`);
  }
  /* Caso: el enunciado y las tablas que comparten varias preguntas seguidas, arriba de cada una. Las tablas son
     datos (no imágenes) y usan la tabla del estándar: en el teléfono cada fila se lee como una ficha. */
  function pintaCaso(p) {
    const bloque = $('[data-caso]');
    const caso = p.caso && ex.casos && ex.casos[p.caso];
    bloque.hidden = !caso;
    if (!caso) return;
    $('[data-caso-titulo]').textContent = caso.titulo;
    $('[data-caso-parte]').textContent = `Pregunta ${p.parte} de ${p.de} de este caso`;
    // tabindex: si la tabla no cabe a lo ancho, el marco se desplaza también con el teclado
    const tablas = (caso.tablas || []).map((t) => el('div', { class: 'tabla-marco', tabindex: '0', role: 'region', 'aria-label': t.titulo }, [
      el('table', { class: 'tabla' }, [
        el('caption', { class: 'tabla-titulo', texto: t.titulo }),
        el('thead', {}, [el('tr', {}, t.encabezados.map((h) => el('th', { scope: 'col', texto: h })))]),
        el('tbody', {}, t.filas.map((f) => el('tr', {}, f.map((v, j) => el('td', { 'data-etiqueta': t.encabezados[j], texto: v })))))
      ])
    ]));
    $('[data-caso-cuerpo]').replaceChildren(...(caso.enunciado || []).map((t) => el('p', { texto: t })), ...tablas);
  }
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
  $('[data-opciones]').addEventListener('change', (e) => {
    if (e.target.name !== 'respuesta') return;
    const p = ex.preguntas[actual];
    const valor = e.target.value;
    const guardado = $('[data-guardado]');
    guardado.textContent = 'Guardando…';
    API.responder(ex.codigo, p.clave, valor).then(() => {
      ex.respuestas[p.clave] = valor;
      guardado.textContent = 'Respuesta guardada.';
      pintaAvance();
      pintaNumeros();
    }, () => refresca());
  });
  $('[data-marcar]').addEventListener('change', (e) => {
    const p = ex.preguntas[actual];
    const si = e.target.checked;
    ex.marcadas = ex.marcadas.filter((k) => k !== p.clave).concat(si ? [p.clave] : []);
    API.marcar(ex.codigo, p.clave, si);
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
    $('[data-repaso]').replaceChildren(...ex.preguntas.map((p, j) => {
      const [clase, texto] = estadoDe(p);
      const ir = el('button', { type: 'button', class: 'btn-enlace', 'data-ir': String(j) }, [document.createTextNode(`Pregunta ${j + 1}`), el('span', { class: 'solo-lector', texto: `, ${texto}` })]);
      return el('li', { class: 'examen-repaso-fila', 'data-estado': clase }, [ir, el('span', { class: 'examen-repaso-texto', texto: p.texto }), APD.estado(texto.charAt(0).toUpperCase() + texto.slice(1), clase === 'libre' ? 'error' : clase === 'marcada' ? 'pend' : 'ok')]);
    }));
    muestra('revision');
  }
  $('[data-repaso]').addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) pintaPregunta(Number(b.dataset.ir)); });
  $('[data-volver-preguntas]').addEventListener('click', () => pintaPregunta(actual));
  $('[data-enviar]').addEventListener('click', (e) => {
    const faltan = ex.preguntas.length - contestadas();
    FormKit.confirma(e.currentTarget, {
      titulo: '¿Enviar tus respuestas?',
      texto: `${faltan ? `Te ${faltan === 1 ? 'falta 1 pregunta' : `faltan ${faltan} preguntas`} sin contestar: ${faltan === 1 ? 'cuenta' : 'cuentan'} como incorrecta${faltan === 1 ? '' : 's'}. ` : ''}Después de enviar ya no puedes cambiar tus respuestas.`,
      si: 'Enviar mis respuestas', no: 'Seguir revisando'
    }).then((si) => { if (si) termina('enviado'); });
  });
  function termina(motivo) {
    if (enviando) return;
    enviando = true;
    API.terminar(ex.codigo, motivo).then((v) => { ex = v; enviando = false; pintaResultado(); }, () => { enviando = false; refresca(); });
  }

  /* ----- 6 · Resultado ----- */
  function pintaResultado() {
    paraReloj();
    $('[data-por-tiempo]').hidden = ex.motivo_fin !== 'tiempo';
    $('[data-calificacion]').textContent = decimal(ex.calificacion);
    $('[data-veredicto]').replaceChildren(
      APD.estado(ex.aprobado ? 'Aprobado' : 'No aprobado', ex.aprobado ? 'ok' : 'error'),
      document.createTextNode(` La calificación mínima es ${decimal(ex.minima)}.`)
    );
    $('[data-resultado-datos]').replaceChildren(datosLista([
      ['Nombre', ex.persona.nombre],
      ['Examen', nombreExamen()],
      ['Respuestas correctas', `${ex.aciertos} de ${ex.total}`],
      ['Enviado', APD.fechaHora(ex.terminado_en)]
    ]));
    $('[data-resultado-sigue]').textContent = ex.aprobado
      ? 'Tu calificación quedó registrada. Avisa a quien aplica el examen: hoy mismo, en la sede, se te toma la fotografía de tu credencial y se te entrega.'
      : 'Tu calificación quedó registrada y no se puede cambiar. Para intentarlo de nuevo, inicia una solicitud nueva desde tu cuenta, con su pago de derechos.';
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
    if (['sin_empezar', 'contestando'].includes(ex.situacion) && API.latido(ex.codigo, EQUIPO).otro) {
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
    ex = Object.assign(v, { respuestas: v.respuestas });
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && ex && ex.situacion === 'contestando') API.salida(ex.codigo); });

  /* Una recarga vuelve al examen abierto en esta pestaña */
  const abierto = leeAbierto();
  if (abierto) API.entrar(abierto, EQUIPO).then((v) => abre(v, true), () => guardaAbierto(null));

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
        const fila = G.personas(datos, g).find((f) => f.puede && !usados.has(f.inscripcion.id));
        if (!fila) return 'Todas las personas con derecho a examen ya lo empezaron. Borra lo guardado para volver a probar.';
        const r = await G.pasarLista(datos, g, fila, true, 'menu.pruebas');
        const c = $('#codigo');
        c.value = r.codigo;
        c.dispatchEvent(new Event('input', { bubbles: true }));
        return `Código de ${APD.nombreCompleto(fila.persona)}: ${r.codigo}. Presiona «Entrar al examen».`;
      }],
      ['Contestar todas bien', async () => (enCurso() && API.pruebas.contestar(ex.codigo, 'bien') ? reabre(ex.codigo, 'Todas contestadas bien. Ve a la última pregunta y envía.') : 'Primero empieza un examen.')],
      ['Contestar para no aprobar', async () => (enCurso() && API.pruebas.contestar(ex.codigo, 'reprobar') ? reabre(ex.codigo, 'Una de cada tres bien: no alcanza la mínima.') : 'Primero empieza un examen.')],
      ['Dejar 1 minuto en el reloj', async () => (enCurso() && API.pruebas.dejarMinutos(ex.codigo, 1) ? reabre(ex.codigo, 'Queda 1 minuto. Al llegar a cero, el examen se envía solo.') : 'Primero empieza un examen.')]
    ];
  };
}());
