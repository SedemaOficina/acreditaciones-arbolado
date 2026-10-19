/* =========================================================
   apd.js · Lo común de todas las pantallas (persona solicitante y personal)

   Etapa 1 (cascarón): no hay servidor. Los datos vienen de
   datos/ficticios.json, que exporta la base de pruebas con las mismas
   tablas y campos que la real; la vigencia ya viene calculada por la base
   a la fecha de corte. El acceso es SIMULADO: no protege nada y se
   sustituye por el del backend en la etapa 3.

   Una sola fuente de los textos de estado: ESTADOS y VIGENCIA, aquí.
   ========================================================= */
(function (global) {
  'use strict';

  const CLAVE_SESION = 'apd.sesion';
  const CONTRASENA_FICTICIA = 'Prueba-ficticia-2026'; // sólo para el acceso simulado con datos ficticios

  /* Qué ve la persona en cada estado de su solicitud y qué sigue. La etiqueta va por familia (propuesta «Avisos y
     confirmaciones», aprobada por Liber el 2026-10-17): pend = te toca, marcha = en marcha, ok = logro, error = cerrada
     sin acreditación, cerrado = cerrada por decisión propia. Cada familia lleva su icono; «personal» es el nombre que
     ve el personal cuando el de la persona le habla a ella («Acude a tu cita»). */
  const ESTADOS = {
    borrador: { texto: 'Borrador', tono: 'pend', sigue: 'Termina de cargar tus documentos y envía tu solicitud.' },
    // Qué sigue mientras se revisa (auditoría 2026-10-18, D12): la revisión, su resultado y dónde se ve; el plazo es P02
    enviada: { texto: 'En revisión documental', tono: 'marcha', sigue: { texto: 'La Secretaría revisa que tus documentos estén completos y correctos.', pasos: ['La Secretaría revisa tus documentos.', 'Si algo falta, te indica qué corregir; si todo está completo, te asigna una cita de cotejo.', 'Lo ves aquí, en «Mis trámites».'] } },
    // Hay un plazo para corregir (P02: lo fija la Dirección); mientras no esté, se dice que existe (auditoría integral, alta 10)
    con_observaciones: { texto: 'Corrige y reenvía', personal: 'Con observaciones', tono: 'pend', sigue: { texto: 'Hay un plazo para corregir: si no reenvías tu solicitud a tiempo, se cierra.', pasos: ['Corrige lo que se indica arriba.', 'Vuelve a enviar tu solicitud.', 'La Secretaría la revisa otra vez.'] } },
    validada_en_linea: { texto: 'Acude a tu cita', personal: 'Cita asignada', tono: 'pend', sigue: { pasos: ['Imprime los mismos documentos que cargaste.', 'Paga los derechos e imprime tu comprobante de pago.', 'Acude a tu cita con tus documentos y tu comprobante.'] } },
    // La persona espera el curso; el personal arma grupos con esa lista (decisión 2026-10-18)
    lista_para_curso: { texto: 'En espera de curso', personal: 'En espera de grupo', tono: 'marcha', sigue: { texto: 'Tu cotejo terminó.', pasos: ['La Secretaría te asigna un grupo del curso.', 'Te avisa las fechas, la hora de entrada y la sede.', 'Asistes al curso y, el último día, presentas el examen.'] } },
    // Con grupo el curso está en marcha (por empezar o en curso), no terminado (auditoría 2026-10-18, D6)
    inscrita: { texto: 'Con grupo asignado', tono: 'marcha', sigue: 'Asiste a tu curso en las fechas indicadas.' },
    aprobada: { texto: 'Aprobada', tono: 'ok', sigue: 'La Secretaría emite tu acreditación.' },
    acreditada: { texto: 'Acreditación emitida', tono: 'ok', sigue: 'Recoge tu credencial en persona.' },
    no_acreditada: { texto: 'No acreditada', tono: 'error', sigue: 'No alcanzaste la calificación mínima. Puedes iniciar una solicitud nueva.' },
    sin_derecho_examen: { texto: 'Sin derecho a examen', tono: 'error', sigue: 'No alcanzaste la asistencia mínima. Puedes iniciar una solicitud nueva.' },
    // Como las demás cerradas, dice qué puede hacer (auditoría 2026-10-18, D14)
    cancelada: { texto: 'Cancelada', tono: 'cerrado', sigue: 'Esta solicitud se canceló. Puedes iniciar una solicitud nueva.' },
    concluida_sin_atender: { texto: 'Cerrada: no se corrigió a tiempo', tono: 'error', sigue: 'Las observaciones no se atendieron a tiempo. Puedes iniciar una solicitud nueva.' },
    rechazada: { texto: 'Rechazada', tono: 'error', sigue: 'Tu perfil no cumple los requisitos de esta acreditación. Abajo está el motivo.' }
  };
  /* El nombre del estado para el personal */
  const nombrePersonal = (estado) => { const e = ESTADOS[estado]; return e ? e.personal || e.texto : estado; };
  const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'];

  /* Situación de una acreditación, tal como la calcula la base. */
  const VIGENCIA = {
    vigente: { texto: 'Vigente', tono: 'ok' },
    por_vencer: { texto: 'Vigente · por vencer', tono: 'pend' },
    // Vencida pero renovable: te toca actuar (renovarla); vencida sin renovación: terminada (auditoría 2026-10-18, D6)
    vencida_renovable: { texto: 'No vigente', tono: 'pend' },
    vencida_no_renovable: { texto: 'No vigente', tono: 'cerrado' },
    no_emitida: { texto: 'Todavía no vigente', tono: 'marcha' }
  };

  const TIPOS = { poda: 'Poda y derribo', dictaminador: 'Dictaminador técnico' };
  const MODALIDADES = { nueva: 'Solicitud nueva', renovacion: 'Renovación' };

  let promesa = null;
  /* En cada tabla de los datos, sólo lo que tiene forma de registro (un objeto): un null o un valor suelto se salta, en vez
     de tumbar las pantallas que la recorren (auditoría 2026-10-19, B5-04; lo mismo que hace la mezcla con lo guardado en
     el navegador, F4 A6). Una tabla que falta sigue siendo un error de carga. */
  const esRegistro = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  function soloRegistros(d) {
    if (!esRegistro(d)) throw new Error('datos');
    for (const [k, v] of Object.entries(d)) if (Array.isArray(v) && v.some((x) => !esRegistro(x))) d[k] = v.filter(esRegistro);
    return d;
  }
  function cargar() {
    if (!promesa) {
      promesa = fetch('datos/ficticios.json', { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('datos'); return r.json(); })
        .then(soloRegistros);
    }
    // Versión de prueba: lo registrado en este navegador (cuentas, solicitudes, documentos, cambios de perfil) se suma
    // cada vez, para que todas las pantallas vean lo último (app/archivos-prueba.js)
    // Antes, lo guardado hace más de 7 días sin uso se borra (alta 1 de la auditoría integral)
    // (se lee al resolver: archivos-prueba.js se carga después de la página que llama)
    // El material de estudio que subió el personal en este navegador, también (con la URL de cada archivo)
    return promesa.then((d) => {
      const P = global.APD_ARCHIVOS_PRUEBA;
      const b = desdeCitas(d);
      if (!P) return Object.assign({}, b, { material_estudio: (b.material_estudio || []).map((m) => Object.assign({}, m, { url: m.archivo_clave })) });
      // Si lo guardado caducó, la página lo dice una vez (auditoría «intentar romperlo», F4 B3: la persona caía en «Entrar»
      // sin saber por qué); la marca vive en esta pestaña y la lee el menú de pruebas (app/pruebas.js)
      return P.caduca().then((vencida) => { if (vencida) marcaCaducada(); return P.mezcla(b); }).then((x) => P.mezclaMaterial(x));
    });
  }
  /* ----- Lo guardado en la prueba caducó (F4 B3) -----
     caduca() lo borra todo, también lo de esta pestaña, y devuelve si venció. La marca va en sessionStorage, para que la
     vea la pantalla a la que lleva la página (sin sesión, «Entrar»), y en memoria, por si sessionStorage está bloqueado.
     Se marca una sola vez por página; caducada() la lee y la quita un momento después (si la página se va enseguida a
     «Entrar», la marca llega a ésa): el aviso sale una vez. */
  const CLAVE_CADUCADA = 'apd.prueba.caducada';
  let caducadaAqui = false;
  let caducadaMarcada = false;
  function marcaCaducada() {
    if (caducadaMarcada) return;
    caducadaMarcada = true;
    caducadaAqui = true;
    try { global.sessionStorage.setItem(CLAVE_CADUCADA, '1'); } catch (e) { /* sin almacenamiento: queda la marca en memoria */ }
  }
  function caducada() {
    let si = caducadaAqui;
    try { si = si || global.sessionStorage.getItem(CLAVE_CADUCADA) === '1'; } catch (e) { /* sin almacenamiento */ }
    caducadaAqui = false;
    if (si) setTimeout(() => { try { global.sessionStorage.removeItem(CLAVE_CADUCADA); } catch (e) { /* sin almacenamiento */ } }, 1500);
    return si;
  }

  /* ----- El navegador no permitió guardar (auditoría «intentar romperlo», bloque 3) -----
     En la versión de prueba todo se guarda en este navegador; si está en modo privado, con el almacenamiento bloqueado o
     lleno, lo que se iba a guardar no queda. Ninguna pantalla lo da por guardado: dice esto, con el trato de quien lo lee
     («tú» para la persona solicitante, «usted» para el personal). Es el texto que ya daba «Crea tu cuenta» (2026-10-17).
     En la etapa 3 no aplica: lo guarda la API. */
  function textoNoGuardo(que, trato) {
    const usted = trato === 'usted';
    return `Este navegador no permitió guardar ${que} (puede estar en modo privado o con el almacenamiento bloqueado o lleno). ${usted ? 'Pruebe' : 'Prueba'} en una ventana normal o en otro navegador.`;
  }
  /* El mismo aviso como rechazo de la API, para APD.muestraRechazo: título, texto y código «almacenamiento» */
  function noGuardo(titulo, que, trato) { return rechazo(titulo, textoNoGuardo(que, trato), null, 'almacenamiento'); }

  /* Lo que las pantallas leen de la solicitud y la base guarda en sus citas (apd.cita): la cita nueva y su motivo (no se
     presentó o no llevó el comprobante), la pausa y las inasistencias. Parte del contrato de la API (auditoría integral,
     alta 5): GET /apd/mis-tramites lo entregará así. Lo hecho en la prueba (archivos-prueba.js) se aplica después. */
  function desdeCitas(d) {
    if (!d || !Array.isArray(d.cita) || !d.cita.length) return d;
    const porSol = {};
    for (const c of d.cita) (porSol[c.solicitud_id] = porSol[c.solicitud_id] || []).push(c);
    const solicitud = d.solicitud.map((s) => {
      const cs = (porSol[s.id] || []).slice().sort((a, b) => String(a.programada_en).localeCompare(String(b.programada_en)));
      if (!cs.length) return s;
      const x = Object.assign({}, s, { inasistencias: cs.filter((c) => c.resultado === 'no_se_presento').length });
      const actual = cs[cs.length - 1];
      const previa = cs[cs.length - 2];
      if (s.estado === 'validada_en_linea' && actual.resultado === 'pendiente' && previa && ['no_se_presento', 'sin_pago'].includes(previa.resultado)) {
        x.cita_motivo = previa.resultado === 'sin_pago' ? 'sin_pago' : 'inasistencia';
        x.cita_anterior = previa.programada_en;
      }
      if (s.estado === 'validada_en_linea' && actual.resultado === 'en_pausa') {
        const docs = d.documento.filter((doc) => doc.solicitud_id === s.id && doc.vigente && doc.estado === 'con_observacion').map((doc) => doc.requisito);
        x.cotejo_pausa = { desde: actual.pausada_en, real: actual.pausada_en, cita_en: actual.programada_en, docs };
      }
      return x;
    });
    return Object.assign({}, d, { solicitud });
  }

  /* ¿Este documento se cargó después de poner la cita en pausa? (en la prueba, la hora real de carga; en la base, cargado_en) */
  const cargadoTras = (doc, pausa) => Boolean(pausa && pausa.real) && new Date(doc.cargado_real || doc.cargado_en) > new Date(pausa.real);

  /* ----- Fechas: todo en hora de la Ciudad de México ----- */
  function aFecha(iso) { return iso ? new Date(iso.length === 10 ? `${iso}T12:00:00-06:00` : iso) : null; }
  function fecha(iso) {
    const d = aFecha(iso);
    return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' }) : '';
  }
  function fechaHora(iso) {
    const d = aFecha(iso);
    // Hora de 24 horas, como en todo el sistema (decisión 2026-10-17); sin «a.m.», que dejaba «a.m..» al final de una frase
    return d ? d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }) : '';
  }
  function sumaDias(iso, dias) { const d = aFecha(iso); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
  /* N meses después de una fecha AAAA-MM-DD, como la base (date + interval 'N months'): si el día no existe en el mes de
     llegada, el último del mes. 29/02/2028 + 12 meses = 28/02/2029 (auditoría 2026-10-19, B8-01; decisión 11). Sin el
     reloj del navegador: el mismo resultado en cualquier zona horaria. */
  function sumaMeses(iso, meses) {
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    const t = a * 12 + (m - 1) + meses;
    const a2 = Math.floor(t / 12);
    const m2 = t - a2 * 12 + 1;
    const ultimo = new Date(Date.UTC(a2, m2, 0)).getUTCDate();
    const dd = (n) => String(n).padStart(2, '0');
    return `${a2}-${dd(m2)}-${dd(Math.min(d, ultimo))}`;
  }

  /* El día (AAAA-MM-DD, Ciudad de México) de una fecha y hora; una fecha sola (AAAA-MM-DD) es ese mismo día */
  const diaDe = (iso) => (iso ? aFecha(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) : null);
  /* Una cita en pausa sólo dura su día: después ya no se retoma y la solicitud regresa con observaciones (P80) */
  function pausaVencida(datos, s) {
    return Boolean(s && s.cotejo_pausa) && diaDe(s.cotejo_pausa.cita_en || s.cita_en) < hoy(datos);
  }
  /* Cerrada por no presentarse dos veces a la cita de cotejo: se distingue por el motivo que guarda la base
     («No se presentó a su cita de cotejo N veces.», 03-apd-reglas.sql), no por un dato propio de la prueba (alta 5) */
  const cerradaPorInasistencia = (s) => s && s.estado === 'concluida_sin_atender' && /^No se presentó a su cita de cotejo/.test(s.motivo_cierre || '');
  /* Hoy, como fecha AAAA-MM-DD en la Ciudad de México. En la versión de prueba es la fecha simulada de los ficticios
     (datos.fecha_corte, la de la franja amarilla), para que cada caso siga en su situación; con la API (etapa 3) no
     hay fecha de corte y es el día real. */
  function hoy(datos) {
    if (datos && datos.fecha_corte) return datos.fecha_corte;
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  }
  /* Días naturales que faltan para que venza (negativo si ya venció), contados desde hoy (decisión 2026-10-17) */
  function diasParaVencer(datos, venceEn) {
    return Math.round((aFecha(venceEn) - aFecha(hoy(datos))) / 86400000);
  }
  /* Las filas de vencimiento de una ficha, con el rótulo según el caso (auditoría 2026-10-18, D10: «Para vencer» con
     «Venció hace 523 días» se leía al revés): vigente, «Vence el» y «Vence en»; vencida, «Venció el» y «Vencida hace». */
  function vencimiento(datos, venceEn) {
    const n = diasParaVencer(datos, venceEn);
    const dias = (k) => (k === 1 ? '1 día' : `${k.toLocaleString('es-MX')} días`);
    if (n > 0) return [['Vence el', fecha(venceEn)], ['Vence en', dias(n)]];
    if (n === 0) return [['Vence el', `${fecha(venceEn)} (hoy)`]];
    return [['Venció el', fecha(venceEn)], ['Vencida hace', dias(-n)]];
  }
  /* «1 grupo», «3 grupos» (auditoría 2026-10-18, A 6.5: estaba repetida en cuatro pantallas del personal) */
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);
  /* Texto para buscar sin acentos ni mayúsculas (A 6.6: estaba repetida en la bandeja y en las citas) */
  const normalizaBusqueda = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  /* Hora de 24 horas (HH:MM) en la Ciudad de México */
  function hora(iso) {
    const d = aFecha(iso);
    return d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }) : '';
  }

  /* ----- Sesión simulada ----- */
  /* La sesión simulada se guarda en este navegador (localStorage) y sobrevive a recargar u otra pestaña
     (decisión 2026-10-17): sólo dice quién entró, { id } */
  function leeSesion() { try { return JSON.parse(global.localStorage.getItem(CLAVE_SESION) || 'null'); } catch (e) { return null; } }
  function guardaSesion(s) { try { global.localStorage.setItem(CLAVE_SESION, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function cierraSesion() { try { global.localStorage.removeItem(CLAVE_SESION); } catch (e) { /* sin almacenamiento: nada que borrar */ } }

  /* La persona de la sesión: del padrón ficticio o una cuenta creada en la prueba (las dos ya vienen en datos, con los
     cambios de «Mi perfil» aplicados por APD.cargar). */
  function personaDeSesion(datos) {
    const s = leeSesion();
    if (!s || !s.id) return null;
    return datos.solicitante.find((x) => x.id === s.id && x.estado === 'activa') || null;
  }

  /* ===== Dos pestañas, dos personas a la vez y doble clic (auditoría «intentar romperlo», bloque 2) =====
     En el sistema la base y la API detienen casi todo esto; la versión de prueba se comporta igual: cada pantalla vuelve
     a leer lo guardado justo antes de guardar y, si el cambio ya no procede, no lo guarda y lo dice con el mensaje que
     daría la API; después de guardar comprueba que se aplicó. Nunca un éxito falso. */

  /* Un rechazo como el que daría la API (409 o 422): título, texto, enlace opcional { href, texto }, el código de la
     regla y, si es de un campo, errores [{ campo, mensaje }] (el núcleo los pinta junto al campo). */
  function rechazo(titulo, texto, enlace, codigo, errores) {
    return Object.assign(new Error(`${titulo}. ${texto}`), { rechazo: true, titulo, texto, enlace: enlace || null, codigo: codigo || 'conflicto',
      mensaje: `${titulo}. ${texto}`, errores: errores || undefined });
  }
  /* Pinta un rechazo en el aviso de envío del formulario ([data-estado-envio]), en lugar del «No se pudo enviar» general
     del núcleo, con su enlace. Devuelve true si lo pintó. */
  function muestraRechazo(e, form) {
    if (!e || !e.rechazo) return false;
    const a = form && form.querySelector('[data-estado-envio]');
    const t = a && a.querySelector('.aviso-texto');
    if (!t) return false;
    t.replaceChildren(el('strong', { texto: `${e.titulo}. ` }), document.createTextNode(e.texto),
      ...(e.enlace ? [document.createTextNode(' '), el('a', { href: e.enlace.href, texto: e.enlace.texto })] : []));
    a.hidden = false;
    a.focus();
    return true;
  }

  /* ----- La sesión con la que se abrió la página (F1 1 y 2) -----
     La sesión simulada vive en este navegador y la comparten todas las pestañas: si en otra se salía o se entraba con otra
     cuenta, una pestaña abierta enviaba la solicitud (o «Mi perfil») a nombre de quien entró después, o de nadie. Cada
     página recuerda con quién se abrió y, antes de guardar a nombre de la sesión, comprueba que siga siendo la misma
     persona. En la etapa 3 la página manda la persona que espera (solicitante_id) y la API la compara con la de la
     cookie: si no coincide, 409 y no guarda. */
  const SESION_AL_ABRIR = (() => { const s = leeSesion(); return s && s.id ? String(s.id) : null; })();
  function sesionCambio() {
    const s = leeSesion();
    const ahora = s && s.id ? String(s.id) : null;
    if (SESION_AL_ABRIR && ahora === SESION_AL_ABRIR) return null;
    const volver = encodeURIComponent(global.location.pathname.split('/').pop() + global.location.search);
    return rechazo(ahora ? 'Tu sesión cambió en otra pestaña' : 'Tu sesión se cerró en otra pestaña',
      ahora ? 'En otra pestaña se entró con otra cuenta. No se guardó nada, para no mezclar tus datos con los de otra persona.'
        : 'En otra pestaña se salió de tu cuenta. No se guardó nada.',
      { href: `entrar.html?volver=${volver}`, texto: 'Vuelve a entrar con tu cuenta' }, 'sesion_cambio');
  }

  /* ----- Doble clic: un botón propio que guarda queda deshabilitado mientras guarda -----
     El estándar ya bloquea el botón de envío de sus formularios ([data-accion="enviar"]) mientras envía; los botones
     propios del proyecto (los de «Grupos», el segundo botón de «Programar», «Guardar la asistencia», «Publicar»…) no.
     ocupa(boton) lo marca ocupado (aria-disabled y aria-busy) y devuelve la función que lo libera; si ya estaba ocupado
     devuelve null y la página no guarda otra vez. Al guardar con éxito la página cambia de dirección y no lo libera. */
  const OCUPADOS = new WeakSet();
  function ocupa(...botones) {
    const bs = botones.flat().filter(Boolean);
    if (bs.some((b) => OCUPADOS.has(b) || b.getAttribute('aria-disabled') === 'true')) return null;
    for (const b of bs) { OCUPADOS.add(b); b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-busy', 'true'); }
    return () => { for (const b of bs) { OCUPADOS.delete(b); b.removeAttribute('aria-disabled'); b.removeAttribute('aria-busy'); } };
  }

  /* ----- Adscripción (decisiones 2026-10-15): es de la persona; cada solicitud copia la que tenga al enviarse ----- */
  const ADSCRIPCIONES = {
    independiente: 'Independiente', privada: 'Empresa, consultoría o particular',
    dependencia_cdmx: 'Dependencia del Gobierno de la Ciudad de México', alcaldia: 'Alcaldía',
    dependencia_federal: 'Dependencia del Gobierno Federal', educativa: 'Institución educativa'
  };
  function nombreInstitucion(datos, p) {
    if (p.organizacion_nombre) return p.organizacion_nombre;
    const o = p.organizacion_id ? datos.organizacion.find((x) => x.id === p.organizacion_id) : null;
    return o ? o.nombre : '';
  }
  /* La adscripción como rótulo y valor, cada dato en su renglón (2026-10-18: el texto corrido «Tipo: nombre.» se leía
     todo en negritas en un solo renglón). rotuloTipo: «Tipo» en «Mi perfil» y la solicitud; «Adscripción» en las
     fichas del personal. */
  const ROTULO_NOMBRE = { privada: 'Nombre o razón social', alcaldia: 'Alcaldía', dependencia_federal: 'Dependencia',
    educativa: 'Institución', dependencia_cdmx: 'Dependencia' };
  function adscripcionPares(datos, p, rotuloTipo = 'Tipo') {
    if (!p || !p.adscripcion) return [];
    if (p.adscripcion === 'independiente') return [[rotuloTipo, 'Independiente']];
    const nombre = nombreInstitucion(datos, p).replace(/\.$/, '');
    const pares = [[rotuloTipo, ADSCRIPCIONES[p.adscripcion]]];
    const sedema = p.adscripcion === 'dependencia_cdmx' && nombre.match(/^SEDEMA · (.+)$/);
    if (sedema) pares.push(['Dependencia', 'SEDEMA'], ['Dirección General', sedema[1]]);
    else pares.push([ROTULO_NOMBRE[p.adscripcion] || 'Nombre', nombre]);
    return pares;
  }
  /* De las respuestas del formulario a {adscripcion, organizacion_id, organizacion_nombre}, como lo hará la API:
     por clave si es una opción del catálogo, por nombre si se escribió (si no existe, la API la agrega). */
  function adscripcionDe(datos, d) {
    if (d.adscrito !== 'si') return { adscripcion: 'independiente', organizacion_id: null, organizacion_nombre: '' };
    const porClave = (c) => datos.organizacion.find((o) => o.clave === c);
    const porNombre = (n) => datos.organizacion.find((o) => o.nombre_normalizado === normaliza(n));
    let o = null; let nombre = '';
    if (d.tipo_adscripcion === 'privada') nombre = d.empresa_nombre;
    else if (d.tipo_adscripcion === 'alcaldia') o = porClave(d.alcaldia);
    else if (d.tipo_adscripcion === 'dependencia_federal') {
      if (d.dependencia_federal === 'cfe') o = porClave('cfe'); else nombre = d.dependencia_federal_otra;
    } else if (d.tipo_adscripcion === 'educativa') {
      if (d.institucion_educativa === 'unam') o = porClave('unam'); else nombre = d.institucion_educativa_otra;
    } else if (d.dependencia_cdmx === 'sedema') o = porClave(`sedema_${d.direccion_sedema}`);
    else if (d.dependencia_cdmx && d.dependencia_cdmx !== 'otro') o = porClave(d.dependencia_cdmx);
    else nombre = d.dependencia_cdmx_otra;
    o = o || (nombre ? porNombre(nombre) : null);
    // Un nombre escrito que no está en el catálogo: la API agrega la organización (por nombre normalizado, sin duplicar) y
    // la base exige su organizacion_id (solicitante_adscripcion_organizacion_ck). En la prueba se le da un id propio por
    // nombre normalizado: dos personas de la misma empresa nueva quedan en la misma (auditoría 2026-10-18, C 3.5).
    const escrito = String(nombre || '').trim();
    const id = o ? o.id : escrito ? `prueba-org:${normaliza(escrito)}` : null;
    return { adscripcion: d.tipo_adscripcion, organizacion_id: id, organizacion_nombre: o ? o.nombre : escrito };
  }
  /* Perfil del dictaminador: la regla está en app/perfil-academico.js (sin navegador), para que la use también el
     servidor. */
  const { normaliza, perfilAcademico, SUPERIORES } = global.APD_PERFIL_ACADEMICO;
  function requiereSesion(datos) {
    const p = personaDeSesion(datos);
    // Con su consulta (?folio=, ?tipo=): quien llega de un enlace sin sesión vuelve a lo que pidió (auditoría 2026-10-18, B7)
    if (!p) { global.location.replace(`entrar.html?volver=${encodeURIComponent(global.location.pathname.split('/').pop() + global.location.search)}`); return null; }
    return p;
  }
  /* A dónde regresar (?volver=): sólo a una pantalla de este sitio, con su consulta (?folio=, ?tipo=). Devuelve
     «pagina.html?…» o '' (auditoría 2026-10-18, B6 y B7). */
  function destinoPropio(volver) {
    if (!volver) return '';
    try {
      const u = new URL(volver, global.location.href);
      const pagina = u.pathname.split('/').pop();
      const aqui = global.location.pathname.replace(/[^/]*$/, '');
      if (u.origin !== global.location.origin || u.pathname !== aqui + pagina || !/^[a-z-]+\.html$/.test(pagina)) return '';
      return pagina + u.search;
    } catch (e) { return ''; }
  }
  function nombreCompleto(p) { return [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '); }
  /* Nombre con que se guarda un archivo: el mismo cálculo que apd.nombre_de_archivo en la base (decisión
     2026-10-15): TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext, en mayúsculas, sin acentos salvo la Ñ, sin caracteres
     que un sistema de archivos no admite. La extensión sale del archivo elegido. */
  function nombreDeArchivo(tipo, persona, original) {
    const ext = /\.png$/i.test(original || '') ? '.png' : /\.jpe?g$/i.test(original || '') ? '.jpg' : '.pdf';
    return `${tipo}_${nombreCompleto(persona)}`.toLocaleUpperCase('es-MX')
      .replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'Ñ')
      .replace(/[\\/:*?"<>|]/g, '') + ext;
  }

  /* ----- Consultas sobre los datos exportados ----- */
  const deTabla = (datos, tabla, campo, valor) => datos[tabla].filter((f) => f[campo] === valor);
  function solicitudesDe(datos, persona) { return deTabla(datos, 'solicitud', 'solicitante_id', persona.id).sort((a, b) => (b.creada_en || '').localeCompare(a.creada_en || '')); }
  function acreditacionesDe(datos, persona) { return deTabla(datos, 'acreditacion', 'solicitante_id', persona.id).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en)); }
  function situacion(datos, acreditacion) { return datos.estado_acreditacion[acreditacion.numero]; }
  function parametro(datos, clave) { const p = datos.parametro.find((x) => x.clave === clave); return p ? Number(p.valor) : null; }
  /* Sede única de la cita, el curso y la entrega (parámetros sede y sede_direccion de la base, decisión 2026-10-16).
     La dirección vacía (aún «[pendiente]») se muestra como «por confirmar». */
  function sede(datos) {
    const valor = (c) => (datos.parametro.find((x) => x.clave === c) || {}).valor || '';
    return { nombre: valor('sede'), direccion: limpia(valor('sede_direccion')) };
  }
  function curso(datos, tipo, modalidad) { return datos.curso.find((c) => c.tipo_acreditacion === tipo && c.modalidad === modalidad); }
  function activa(solicitud) { return !FINALES.includes(solicitud.estado); }
  /* Las marcas internas de los catálogos y los motivos («[pendiente: …]») son para la Secretaría, no para la persona. */
  function limpia(texto) { return String(texto || '').replace(/\s*\[pendiente[^\]]*\][^.]*\.?/gi, '').trim(); }
  /* Lo que escribió el personal en tercera persona («que cargó», «La persona desistió…»), como se le dice a la persona
     solicitante, de tú (auditoría 2026-10-18, D11). Sólo cambia en pantalla las formas conocidas; el registro no cambia.
     Pedido al personal (F3): que los motivos frecuentes ya se escriban de tú. */
  const A_TI = [
    ['La persona desistió', 'Desististe'], ['la persona desistió', 'desististe'],
    ['No se presentó a su cita', 'No te presentaste a tu cita'], ['no se presentó a su cita', 'no te presentaste a tu cita'],
    ['No presentó', 'No presentaste'], ['no presentó', 'no presentaste'],
    ['que cargó', 'que cargaste'], ['que llevó', 'que llevaste'], ['que subió', 'que subiste'],
    ['lo trae hoy mismo', 'lo traes hoy mismo'], ['la trae hoy mismo', 'la traes hoy mismo']
  ].map(([de, a]) => [new RegExp(`(?<!\\p{L})${de}(?!\\p{L})`, 'gu'), a]);
  function paraTi(texto) { return A_TI.reduce((t, [de, a]) => t.replace(de, a), limpia(texto)); }
  /* «Documento: observación» sin repetir el documento y con minúscula después de los dos puntos (D11): «Constancia de
     situación fiscal: La constancia de situación fiscal no está actualizada» → «Constancia de situación fiscal: no está
     actualizada». Una sigla al inicio («CURP …») se respeta. */
  /* Sólo se pasa a minúscula una palabra común al inicio de una frase (artículo, verbo, adverbio); un nombre propio
     («Juárez no es tu alcaldía…») se queda como lo escribió el personal (auditoría «intentar romperlo», F2 B3). */
  const INICIOS_COMUNES = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'no', 'se', 'si', 'sí', 'es', 'está', 'están',
    'esta', 'este', 'estos', 'estas', 'ese', 'esa', 'su', 'sus', 'tu', 'tus', 'le', 'les', 'hay', 'falta', 'faltan', 'tiene', 'tienen',
    'debe', 'deben', 'corresponde', 'aparece', 'aparecen', 'viene', 'vienen', 'muestra', 'dice', 'trae', 'carga', 'cargaste', 'sube',
    'corrige', 'revisa', 'vuelve', 'envía', 'agrega', 'incluye', 'por', 'para', 'con', 'sin', 'de', 'del', 'en', 'al', 'ya', 'solo',
    'sólo', 'pertenece', 'presenta', 'presentaste', 'necesita', 'necesitas', 'puede', 'puedes', 'fue', 'son', 'era', 'parece']);
  function observacionDe(nombreDoc, texto) {
    let t = paraTi(texto);
    const n = normaliza(nombreDoc);
    const sin = t.match(/^(?:el|la|los|las)\s+(.*)$/i);
    if (sin && n && normaliza(sin[1]).startsWith(`${n} `)) t = sin[1].slice(nombreDoc.length).trim();
    const primera = (t.match(/^\p{L}+/u) || [''])[0];
    if (/^\p{Lu}\p{Ll}/u.test(t) && INICIOS_COMUNES.has(primera.toLocaleLowerCase('es-MX'))) t = t.charAt(0).toLocaleLowerCase('es-MX') + t.slice(1);
    return t ? `${nombreDoc}: ${t}` : nombreDoc;
  }

  /* ----- Qué puede solicitar la persona hoy -----
     Mismo criterio que apd.comprobar_elegibilidad() en la base (03-apd-reglas.sql); la pantalla sólo
     orienta, la base decide. Devuelve, por tipo: {disponible, modalidad, anterior, motivo}. */
  function opciones(datos, persona, extras) {
    const sols = solicitudesDe(datos, persona).concat(extras || []);
    const acs = acreditacionesDe(datos, persona);
    const ultima = (tipo) => acs.find((a) => a.tipo_acreditacion === tipo) || null;
    const diasAntes = parametro(datos, 'dias_antes_renovacion') || 30;
    const r = {};
    for (const tipo of ['poda', 'dictaminador']) {
      const enCurso = sols.find((s) => s.tipo_acreditacion === tipo && activa(s));
      const a = ultima(tipo);
      const sit = a ? situacion(datos, a) : null;
      if (enCurso) { r[tipo] = { disponible: false, motivo: `Ya tienes un trámite en curso (folio ${enCurso.folio}).` }; continue; }
      if (sit === 'vigente') { r[tipo] = { disponible: false, motivo: `Tu acreditación ${a.numero} vence el ${fecha(a.vence_en)}. Podrás renovarla a partir del ${fecha(sumaDias(a.vence_en, -diasAntes))}.` }; continue; }
      if (sit === 'no_emitida') { r[tipo] = { disponible: false, motivo: `Tu acreditación ${a.numero} todavía no entra en vigor.` }; continue; }
      const renovable = sit === 'por_vencer' || sit === 'vencida_renovable';
      r[tipo] = { disponible: true, modalidad: renovable ? 'renovacion' : 'nueva', anterior: renovable ? a.numero : null };
    }
    const poda = ultima('poda');
    const podaVigente = poda && ['vigente', 'por_vencer'].includes(situacion(datos, poda));
    if (r.dictaminador.disponible && !podaVigente) r.dictaminador = { disponible: false, motivo: 'Necesitas tener vigente tu acreditación de poda y derribo.' };
    return r;
  }

  /* ----- Pintado ----- */
  function el(etiqueta, attrs, hijos) {
    const e = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'texto') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const h of [].concat(hijos || [])) if (h) e.append(h);
    return e;
  }
  /* ----- Avisos, etiquetas de estado y «qué sigue»: del estándar desde la 1.4.0 y la 1.4.1 (P115, P118, P119) -----
     El proyecto sólo traduce sus tonos a las familias del estándar y arma el marcado del contrato cuando la página no
     carga el núcleo («Mis trámites», el inicio) o cuando un aviso lleva pasos. La confirmación es FormKit.confirma
     (módulo modal, P113) y el desenlace de una decisión, FormKit.resultado (módulo resultado, P113). */
  // Tono del proyecto → familia del estándar: hecho, te toca actuar, en marcha, cerrado sin éxito, terminado
  const FAMILIA = { ok: 'ok', pend: 'atencion', marcha: 'proceso', error: 'rechazo', cerrado: 'terminado' };
  const ICONO_FAMILIA = { ok: 'ok', atencion: 'alerta', proceso: 'reloj', rechazo: 'error', terminado: 'archivo' };
  const familia = (tono) => FAMILIA[tono] || (ICONO_FAMILIA[tono] ? tono : 'terminado');
  function icono(nombre, clase) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', clase || 'icono');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(ns, 'use');
    u.setAttribute('href', `#i-${nombre}`);
    s.appendChild(u);
    return s;
  }
  /* Etiqueta de estado del módulo «estado»: <span class="estado estado-proceso">; el icono lo pone el módulo */
  function estado(texto, tono) {
    const f = familia(tono);
    const s = el('span', { class: `estado estado-${f}` }, [document.createTextNode(texto)]);
    if (global.FormKit && global.FormKit.estado) return global.FormKit.estado(s, { tono: f });
    s.prepend(icono(ICONO_FAMILIA[f], 'icono icono-sm'));
    return s;
  }
  /* Etiqueta del estado de una solicitud; para el personal, con su nombre de personal */
  function estadoSolicitud(s, paraPersonal) {
    const e = ESTADOS[s.estado] || { texto: s.estado, tono: '' };
    return estado(paraPersonal ? e.personal || e.texto : e.texto, e.tono);
  }
  /* «Qué sigue» (P119): cuando lo que sigue son varias acciones en orden, van en la secuencia del núcleo
     (<ol class="secuencia">), no encadenadas en un párrafo. Recibe un texto, una lista de pasos o { texto, pasos }. */
  function sigueEn(x) {
    if (!x) return [];
    if (typeof x === 'string') return [el('p', { texto: x })];
    const o = Array.isArray(x) ? { pasos: x } : x;
    const pasos = (o.pasos || []).filter(Boolean);
    return [
      o.texto ? el('p', { texto: o.texto }) : null,
      pasos.length ? el('p', { class: 'secuencia-titulo', texto: o.titulo || 'Qué sigue' }) : null,
      pasos.length ? el('ol', { class: 'secuencia' }, pasos.map((t) => el('li', { class: 'secuencia-item', texto: t }))) : null
    ].filter(Boolean);
  }
  /* Aviso del núcleo (P115): tono del proyecto → tono del estándar, título en <strong class="aviso-titulo">, icono del
     tono. Devuelve el elemento, con el marcado del contrato, para las páginas sin núcleo y los avisos con pasos. */
  const TONO_AVISO = { ok: 'ok', error: 'bloqueo', pend: 'advertencia', info: 'neutro', marcha: 'neutro' };
  const CLASE_AVISO = { ok: 'aviso-ok', bloqueo: 'aviso-bloqueo', advertencia: 'aviso-advertencia', neutro: '' };
  const ICONO_AVISO = { ok: 'ok', bloqueo: 'error', advertencia: 'alerta', neutro: 'info' };
  function aviso(tono, titulo, texto, extra) {
    const t = TONO_AVISO[tono] || tono;
    return el('div', { class: `aviso ${CLASE_AVISO[t] || ''}`.trim() }, [
      icono(ICONO_AVISO[t] || 'info'),
      el('div', { class: 'aviso-texto' }, [titulo ? el('strong', { class: 'aviso-titulo', texto: titulo }) : null].concat(sigueEn(texto), extra || []))
    ]);
  }
  /* Pinta un aviso en un contenedor: FormKit.aviso cuando es sólo texto; con pasos, el marcado del contrato */
  function pintaAviso(contenedor, tono, titulo, texto, enfoca) {
    const t = TONO_AVISO[tono] || tono;
    contenedor.hidden = false;
    if (global.FormKit && global.FormKit.aviso && (typeof texto === 'string' || !texto)) {
      contenedor.replaceChildren();
      return global.FormKit.aviso(contenedor, { tono: t, titulo, texto: texto || '', foco: Boolean(enfoca) });
    }
    const a = aviso(tono, titulo, texto);
    if (t === 'bloqueo') a.setAttribute('role', 'alert'); else if (t === 'ok') a.setAttribute('role', 'status');
    a.tabIndex = -1;
    contenedor.replaceChildren(a);
    if (enfoca) a.focus();
    return a;
  }
  /* Hora de la base (time: «09:00:00») como se escribe y se elige: «09:00» (auditoría de tareas, A5) */
  const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
  /* Pares [etiqueta, valor, porConfirmar]: con el tercero, el valor se marca en amarillo (.pendiente del estándar)
     con lo que falta confirmar; así se ve en cualquier versión hasta que la Secretaría lo confirme. El valor es un texto o
     un nodo (el nombre del grupo con su folio, APD.grupoTitulo). */
  function datosLista(pares) {
    return el('dl', { class: 'datos' }, pares.filter((p) => p[1]).map(([etq, valor, porConfirmar]) =>
      el('div', { class: 'datos-par' }, [
        el('dt', { class: 'datos-etq', texto: etq }),
        porConfirmar
          ? el('dd', { class: 'datos-valor datos-por-confirmar pendiente' }, [valor, el('span', { class: 'datos-nota', texto: `Por confirmar: ${porConfirmar}` })])
          : typeof valor === 'string' ? el('dd', { class: 'datos-valor', texto: valor }) : el('dd', { class: 'datos-valor' }, [valor])
      ])));
  }

  /* Línea de datos de una cabecera («Folio … · enviada el … · 2.ª revisión»): cada parte se queda entera en su renglón;
     si no cabe, pasa completa al siguiente (2026-10-18). Una parte es texto o una lista de nodos. */
  function meta(partes) {
    const out = [];
    partes.filter(Boolean).forEach((p, i) => {
      if (i) out.push(document.createTextNode(' · '));
      out.push(el('span', { class: 'sin-corte' }, typeof p === 'string' ? [document.createTextNode(p)] : p));
    });
    return out;
  }

  /* Cabecera de sesión en las pantallas con cuenta */
  function pintaSesion(contenedor, persona) {
    if (!contenedor) return;
    const salir = el('button', { type: 'button', class: 'btn-enlace', texto: 'Salir' });
    salir.addEventListener('click', () => { cierraSesion(); global.location.href = 'index.html'; });
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre', texto: nombreCompleto(persona) }),
      el('div', { class: 'sesion-enlaces' }, [
        el('a', { class: 'btn-enlace', href: 'tramites.html', texto: 'Mis trámites' }),
        el('a', { class: 'btn-enlace', href: 'datos.html', texto: 'Mi perfil' }),
        salir
      ])
    );
  }

  /* Fecha simulada visible en la franja de entorno */
  function pintaCorte(datos) {
    const franja = document.querySelector('[data-corte]');
    if (franja) franja.textContent = fecha(datos.fecha_corte);
  }

  /* Iconos del estándar en las pantallas sin formulario: el mismo sprite y la misma marca que usa el
     núcleo, de modo que nunca se inyecta dos veces. */
  function ponIconos() {
    if (!global.FORMKIT_ICONOS || document.querySelector('[data-sprite-iconos]')) return;
    const cont = document.createElement('div');
    cont.setAttribute('data-sprite-iconos', '');
    cont.hidden = true;
    cont.innerHTML = global.FORMKIT_ICONOS;
    document.body.prepend(cont);
  }
  document.addEventListener('DOMContentLoaded', () => {
    ponIconos();
    cargar().then(pintaCorte).catch(() => { /* sin datos: cada pantalla lo dice en su lugar */ });
  });

  /* ----- Un correo, una cuenta (decisión 2026-10-17, Liber) -----
     Además de la CURP, el correo no se repite entre cuentas activas. Las personas del registro anterior que todavía no
     crean su cuenta (sin_activar) no cuentan: su correo del padrón puede ser viejo o compartido. Mismo criterio que la
     base (apd.solicitante, índice solicitante_correo_uk y regla correo_registrado). */
  function correoEnUso(datos, correo, propia) {
    const c = String(correo || '').trim().toLowerCase();
    return Boolean(c) && datos.solicitante.some((p) => p.estado !== 'sin_activar' && String(p.correo || '').toLowerCase() === c
      && (!propia || (p.id !== propia.id && p.curp !== propia.curp)));
  }
  const CORREO_EN_USO = 'Este correo ya está registrado en otra cuenta. Escribe otro; si es tuyo y no recuerdas esa cuenta, pide ayuda a la Secretaría.';

  /* Avisa al núcleo que la página cambió el valor de un control (input y change, como al escribir). Desde la 1.3.3 el
     combo del estándar ya no abre su lista cuando la página llena el campo (P99). */
  function avisa(c) {
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Material de estudio (decisión 2026-10-18): lo publicado y vigente, en su orden (como la vista apd.material_publico);
     y el tamaño de un archivo como lo lee una persona («12.3 MB», «376 KB»). */
  function materialPublico(datos) {
    return (datos.material_estudio || []).filter((m) => m.vigente && m.publicado)
      .sort((a, b) => (a.orden - b.orden) || String(a.titulo).localeCompare(String(b.titulo), 'es'));
  }
  function tamano(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1048576) return `${(n / 1048576).toLocaleString('es-MX', { maximumFractionDigits: 1 })} MB`;
    return `${Math.max(1, Math.round(n / 1024))} KB`;
  }

  /* ----- Calendario de los campos de fecha (Liber, 18/10/2026) -----
     Las fechas que elige el personal (cita de cotejo, primer día del curso) se escriben día/mes/año con el formato
     «fecha-dma» del estándar o se eligen en el calendario del navegador. El calendario es un <input type="date">
     oculto junto al campo: toma el mínimo y el máximo del campo (data-min, data-max en AAAA-MM-DD) y, al elegir, escribe
     la fecha en dd/mm/aaaa y avisa al estándar para que la valide. Así la fecha siempre se ve como día/mes/año, aunque
     el navegador muestre su calendario en otro orden. La fecha de nacimiento no lo lleva. */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-calendario]');
    if (!b) return;
    const txt = document.getElementById(b.dataset.calendario);
    const nat = b.parentElement.querySelector('.control-calendario-nativo');
    const campo = txt && txt.closest('[data-campo]');
    if (!nat || !campo) return;
    const V = window.FORMKIT_VALIDACIONES;
    nat.min = campo.dataset.min || '';
    nat.max = campo.dataset.max || '';
    nat.value = (V && V.isoDeDma(txt.value)) || '';
    try { nat.showPicker(); } catch (err) { nat.focus(); nat.click(); }
  });
  document.addEventListener('change', (e) => {
    const nat = e.target;
    if (!nat.matches || !nat.matches('.control-calendario-nativo') || !nat.value) return;
    const b = nat.parentElement.querySelector('[data-calendario]');
    const txt = b && document.getElementById(b.dataset.calendario);
    const V = window.FORMKIT_VALIDACIONES;
    if (!txt || !V) return;
    txt.value = V.dmaDeIso(nat.value);
    txt.dispatchEvent(new Event('input', { bubbles: true }));
    txt.dispatchEvent(new Event('change', { bubbles: true }));
    txt.focus();
  });

  /* ----- Nombre de un grupo (propuesta D, aprobada por Liber el 2026-10-18) -----
     Quien da el curso piensa en «el de Iztapalapa del 13 al 17», no en «APD-G-2026-003». El nombre se calcula con el
     curso, las fechas y, si el grupo es de una organización, cuál: «Poda nueva · del 13 al 17 de octubre · Iztapalapa»;
     un curso de un día, «Poda renovación · 3 de noviembre»; sin fecha, «Poda nueva · sin fecha». Cambia solo si cambia la
     fecha. El folio (APD-G-AAAA-NNN) no cambia: queda en expedientes, constancias y bitácora, y se muestra en chico
     debajo del nombre (APD.grupoTitulo).
     Convención de los nombres de curso:
       · completo, donde hay espacio (títulos, selector de cursos, resúmenes): «Poda y derribo · nueva», «Poda y derribo ·
         renovación», «Dictaminador técnico · nueva», «Dictaminador técnico · renovación» (cursoLargo);
       · corto, en el nombre del grupo y en las tarjetas: «Poda nueva», «Poda renovación», «Dictaminación nueva»,
         «Dictaminación renovación» (cursoCorto): la actividad, como en «Acreditaciones de Poda y Dictaminación», con su
         adjetivo en femenino. */
  const CURSO_CORTO = { poda: 'Poda', dictaminador: 'Dictaminación' };
  const cursoCorto = (t, m) => `${CURSO_CORTO[t] || TIPOS[t] || t} ${m === 'renovacion' ? 'renovación' : 'nueva'}`;
  const cursoLargo = (t, m) => `${TIPOS[t] || t} · ${m === 'renovacion' ? 'renovación' : 'nueva'}`;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const piezas = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return { a, m, d }; };
  /* Día de la semana de una fecha AAAA-MM-DD («lunes») */
  const diaSemana = (iso) => DIAS[aFecha(String(iso).slice(0, 10)).getUTCDay()];
  /* «13 de octubre» (con el año si se pide: «13 de octubre de 2026») */
  function diaMes(iso, conAnio) { const p = piezas(iso); return `${p.d} de ${MESES[p.m - 1]}${conAnio ? ` de ${p.a}` : ''}`; }
  /* «del 13 al 17 de octubre», «del 29 de octubre al 2 de noviembre»; el año sólo si no es el de anioRef */
  function rangoFechas(desde, hasta, anioRef) {
    const a = piezas(desde);
    const b = piezas(hasta || desde);
    const otroAnio = String(a.a) !== String(anioRef) || a.a !== b.a;
    if (!hasta || hasta === desde) return diaMes(desde, otroAnio);
    if (a.a === b.a && a.m === b.m) return `del ${a.d} al ${b.d} de ${MESES[a.m - 1]}${otroAnio ? ` de ${a.a}` : ''}`;
    if (a.a === b.a) return `del ${diaMes(desde)} al ${diaMes(hasta)}${otroAnio ? ` de ${a.a}` : ''}`;
    return `del ${diaMes(desde, true)} al ${diaMes(hasta, true)}`;
  }
  /* «miércoles 14/10/2026» */
  const fechaConDia = (iso) => `${diaSemana(iso)} ${fecha(iso)}`;
  /* Último día de un grupo (el del examen), según la duración de su curso */
  function ultimoDia(datos, g) {
    const c = datos ? curso(datos, g.tipo_acreditacion, g.modalidad) : null;
    const dur = c ? c.dias_duracion : (g.modalidad === 'renovacion' ? 1 : 5);
    return g.fecha_inicio ? sumaDias(g.fecha_inicio, dur - 1) : null;
  }
  /* El nombre calculado. opciones.sinCurso: sin el curso, donde ya se sabe cuál es (la columna de un curso) */
  function nombreGrupo(g, datos, opciones = {}) {
    const anio = String(hoy(datos)).slice(0, 4);
    const fin = ultimoDia(datos, g);
    const cuando = g.fecha_inicio ? rangoFechas(g.fecha_inicio, fin, anio) : 'sin fecha';
    const org = g.integracion === 'especifico' && g.organizacion_id && datos
      ? ((datos.organizacion || []).find((o) => o.id === g.organizacion_id) || {}).nombre || '' : '';
    if (opciones.sinCurso) {
      const t = [cuando, org].filter(Boolean).join(' · ');
      return t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1);
    }
    return [cursoCorto(g.tipo_acreditacion, g.modalidad), cuando, org].filter(Boolean).join(' · ');
  }
  /* Nombre del grupo y, debajo, su folio en chico (mono): en Grupos, la ficha del grupo, Asistencia y Aplicar el examen */
  function grupoTitulo(g, datos, opciones = {}) {
    return el('span', { class: 'grupo-titulo' }, [
      el('span', { class: 'grupo-nombre', texto: nombreGrupo(g, datos, opciones) }),
      el('span', { class: 'grupo-folio mono', texto: g.folio })
    ]);
  }

  /* ===== Lo que el proyecto rodea del estándar 1.4.1 (auditoría «intentar romperlo», 18/10/2026) =====
     Cada pieza dice qué hallazgo atiende; el arreglo de fondo queda pedido al estándar. */

  /* ----- Lo que se pega o pone el autocompletado, antes de la escritura guiada y del maxlength (F2 A1, B2, M2; F1 11) -----
     La escritura guiada de «fecha-dma» corre en cada «input» con el cursor al final, también al pegar: «2026-10-20» se
     volvía 20/02/6102. Y el maxlength corta lo pegado antes de que el formato quite espacios y guiones («MUPA 800101 AB1»
     quedaba en MUPA800101A; una CURP con un espacio perdía su último carácter). Aquí, en la fase de captura (antes que el
     estándar), lo pegado se limpia como lo haría su formato y la fecha AAAA-MM-DD, con espacios o con guiones, se vuelve
     dd/mm/aaaa. El largo lo revisa la validación del formato, ya con el texto limpio. */
  const dos = (n) => String(n).padStart(2, '0');
  function fechaPegada(texto) {
    const t = String(texto || '').trim();
    let m = t.match(/^(\d{4})\s*[-/.\s]\s*(\d{1,2})\s*[-/.\s]\s*(\d{1,2})$/);
    if (m) return `${dos(m[3])}/${dos(m[2])}/${m[1]}`;
    m = t.match(/^(\d{1,2})\s*[-/.\s]\s*(\d{1,2})\s*[-/.\s]\s*(\d{4})$/);
    if (m) return `${dos(m[1])}/${dos(m[2])}/${m[3]}`;
    return t.replace(/\s+/g, '');
  }
  const PEGADO = {
    'fecha-dma': fechaPegada,
    curp: (t) => String(t).replace(/\s+/g, ''),
    rfc: (t) => String(t).replace(/[\s-]+/g, ''),
    'folio-fiscal': (t) => String(t).replace(/\s+/g, ''),
    'numero-acreditacion': (t) => String(t).trim()
  };
  const formatoDe = (c) => { const campo = c && c.closest && c.closest('[data-campo][data-formato]'); return campo ? campo.dataset.formato : ''; };
  document.addEventListener('paste', (e) => {
    const c = e.target;
    if (!(c instanceof global.HTMLInputElement)) return;
    const f = PEGADO[formatoDe(c)];
    const texto = e.clipboardData ? e.clipboardData.getData('text') : null;
    if (!f || texto == null) return;
    e.preventDefault();
    const ini = c.selectionStart == null ? c.value.length : c.selectionStart;
    const fin = c.selectionEnd == null ? c.value.length : c.selectionEnd;
    let v = c.value.slice(0, ini) + f(texto) + c.value.slice(fin);
    if (formatoDe(c) === 'fecha-dma') v = fechaPegada(v);
    c.value = v;
    try { c.setSelectionRange(v.length, v.length); } catch (err) { /* control sin selección */ }
    c.dispatchEvent(new global.InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);
  // El autocompletado, el dictado o arrastrar texto ponen la fecha completa de una vez (a veces como AAAA-MM-DD o con
  // espacios): se acomoda antes de la escritura guiada. El maxlength de estos campos deja lugar a los espacios.
  document.addEventListener('input', (e) => {
    const c = e.target;
    if (!(c instanceof global.HTMLInputElement) || formatoDe(c) !== 'fecha-dma' || (e.inputType && e.inputType.startsWith('delete'))) return;
    const deUnaVez = e.inputType && e.inputType.startsWith('insert') && e.inputType !== 'insertText' ? true : Boolean(e.data && e.data.length > 1);
    if (deUnaVez || /^\s*\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}\s*$/.test(c.value)) {
      const v = fechaPegada(c.value);
      if (v !== c.value) { c.value = v; try { c.setSelectionRange(v.length, v.length); } catch (err) { /* sin selección */ } }
    }
  }, true);

  /* ----- El foco después de cargar un archivo (F1 13) -----
     El módulo «archivos» vuelve a pintar la lista cuando el archivo queda listo y quita el botón que tenía el foco (su
     «Quitar»): el foco caía en <body> y el lector de pantalla perdía la posición. Si eso pasa, el foco vuelve al «Quitar»
     del archivo recién cargado (o a «Elegir archivo» si ya no hay archivo). */
  let ultimoFoco = null;
  let ultimaZona = null;
  document.addEventListener('focusin', (e) => { ultimoFoco = e.target; ultimaZona = e.target.closest ? e.target.closest('[data-archivos]') : null; });
  function vigilaFocoArchivos(zona) {
    new MutationObserver(() => setTimeout(() => {
      const perdido = !document.activeElement || document.activeElement === document.body;
      if (!perdido || ultimaZona !== zona || (ultimoFoco && ultimoFoco.isConnected && ultimoFoco.offsetParent !== null)) return;
      const quitar = Array.from(zona.querySelectorAll('.arch-quitar')).pop();
      const elegir = zona.querySelector('.zona-carga');
      const destino = quitar || (elegir && elegir.offsetParent !== null ? elegir : null);
      if (destino) destino.focus();
    })).observe(zona, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-lleno', 'data-estado'] });
  }

  /* ----- PDF con contraseña (F1 8) -----
     El módulo «archivos» sólo revisa la firma %PDF: un PDF protegido se aceptaba y el personal no lo podía abrir en la
     revisión. Un PDF que trae /Encrypt (contraseña para abrirlo o para cambiarlo) se rechaza al cargarlo, con su mensaje
     en la lista del campo; el envío simulado lo vuelve a revisar (la API deberá repetirlo en el servidor). */
  function pdfConContrasena(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function') return Promise.resolve(false);
    return blob.arrayBuffer().then((b) => new TextDecoder('latin1').decode(new Uint8Array(b)).includes('/Encrypt')).catch(() => false);
  }
  const revisados = new WeakSet();
  function vigilaContrasena(zona) {
    const campo = zona.closest('[data-campo]');
    if (!campo) return;
    new MutationObserver(() => {
      if (!global.FormKit || !global.FormKit.archivos) return;
      const lista = global.FormKit.archivos.de(campo);
      lista.forEach((a) => {
        if (a.estado !== 'listo' || !a.blob || revisados.has(a.blob) || !/\.pdf$/i.test(a.nombre || '')) return;
        revisados.add(a.blob);
        pdfConContrasena(a.blob).then((protegido) => {
          if (!protegido) return;
          const i = global.FormKit.archivos.de(campo).indexOf(a);
          const quitar = i >= 0 ? zona.querySelector(`[data-quitar="${i}"]`) : null;
          if (quitar) quitar.click();
          const M = (global.FormKit.config && global.FormKit.config.mensajes) || {};
          const usted = Boolean(global.APD_MENSAJES_USTED);
          const motivo = usted ? 'el PDF tiene contraseña o protección. Guárdelo sin protección (por ejemplo, imprímalo como PDF) y vuelva a cargarlo.'
            : 'tu PDF tiene contraseña o protección. Guárdalo sin protección (por ejemplo, imprímelo como PDF) y vuelve a cargarlo.';
          const dest = zona.querySelector('[data-rechazos]');
          if (!dest) return;
          const titulo = (M.archRechazoTitulo || 'No se agregó «{nombre}»:').replace('{nombre}', a.nombre);
          dest.replaceChildren(el('p', { class: 'arch-rechazo', role: 'alert' }, [icono('error', 'icono icono-sm'), el('strong', { texto: titulo }), document.createTextNode(` ${motivo}`)]));
        });
      });
    }).observe(zona.querySelector('.lista-arch') || zona, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-estado'] });
  }
  document.addEventListener('DOMContentLoaded', () => {
    for (const zona of document.querySelectorAll('[data-archivos]')) { vigilaFocoArchivos(zona); vigilaContrasena(zona); }
  });

  /* ----- Formato de un combo libre (F1 12) -----
     El tipo «combo» del estándar no aplica data-formato: con data-libre acepta cualquier texto («🌳🌳🌳»). Después de
     FormKit.iniciar, la página pasa su contexto y el combo también revisa su formato, como un campo de texto. */
  function formatoEnCombos(ctx) {
    const t = ctx && ctx.tipos && ctx.tipos.get('combo');
    if (!t || t.apdFormato) return;
    const original = t.valida;
    t.valida = (envoltura, v, a) => {
      const m = original ? original(envoltura, v, a) : '';
      const f = !m && envoltura.dataset.formato && ctx.cfg.formatos[envoltura.dataset.formato];
      return m || (f ? f.valida(f.normaliza(v), a || {}, ctx.cfg) : '');
    };
    t.apdFormato = true;
  }

  /* Lo guardado cambió en otra pestaña o la pestaña volvió a tener el foco (versión de prueba: APD_ARCHIVOS_PRUEBA;
     con la API, al volver el foco). F2 B1 y A7. */
  function alCambiar(fn) {
    if (global.APD_ARCHIVOS_PRUEBA && global.APD_ARCHIVOS_PRUEBA.alCambiar) return global.APD_ARCHIVOS_PRUEBA.alCambiar(fn);
    global.addEventListener('focus', fn);
    return undefined;
  }
  /* Los meses de anticipación máxima de una cita de cotejo (parámetro meses_adelanto_cita; F2 M4) */
  const mesesCita = (datos) => parametro(datos, 'meses_adelanto_cita') || 6;

  global.APD = {
    fechaPegada, pdfConContrasena, formatoEnCombos, alCambiar, mesesCita, rechazo, muestraRechazo, sesionCambio, ocupa,
    textoNoGuardo, noGuardo, caducada,
    CONTRASENA_FICTICIA, ESTADOS, VIGENCIA, TIPOS, MODALIDADES, FINALES,
    cursoCorto, cursoLargo, MESES, diaSemana, diaMes, rangoFechas, fechaConDia, ultimoDia, nombreGrupo, grupoTitulo,
    cargar, cargadoTras, fecha, fechaHora, hora, sumaDias, sumaMeses, hoy, diaDe, pausaVencida, cerradaPorInasistencia, diasParaVencer, vencimiento,
    plural, normalizaBusqueda, paraTi, observacionDe,
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, destinoPropio, nombreCompleto, nombreDeArchivo,
    solicitudesDe, acreditacionesDe, situacion, parametro, curso, sede, activa, limpia, opciones,
    el, meta, estado, estadoSolicitud, nombrePersonal, sigueEn, hhmm, icono, aviso, pintaAviso, datosLista, pintaSesion, pintaCorte, adscripcionPares, adscripcionDe,
    perfilAcademico, SUPERIORES, correoEnUso, CORREO_EN_USO, avisa, materialPublico, tamano
  };
}(window));
