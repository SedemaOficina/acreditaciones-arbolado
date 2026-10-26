/* =========================================================
   apd.js · Lo común de todas las pantallas (persona solicitante y personal)

   Etapa 1 (cascarón): no hay servidor. Los datos vienen de
   datos/ficticios.json, que exporta la base de pruebas con las mismas
   tablas y campos que la real; la vigencia ya viene calculada por la base
   a la fecha de corte. El acceso es SIMULADO: no protege nada y se
   sustituye por el del backend en la etapa 3.

   Una sola fuente de los textos de estado: ESTADOS y VIGENCIA (por APD.vigencia), aquí.
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
    // Vencida pero renovable: te toca actuar (renovarla); vencida sin renovación: terminada (auditoría 2026-10-18, D6). Con
    // textos distintos, para que el color diga algo distinto porque el texto también (decisión de Liber del 21/10, C6-05 a);
    // «personal», de usted
    vencida_renovable: { texto: 'Vencida · puedes renovarla', personal: 'Vencida · puede renovarla', tono: 'pend' },
    vencida_no_renovable: { texto: 'Vencida', tono: 'cerrado' },
    // Cancelada por la Secretaría (P120, sesión de trabajo del 23/10/2026): terminada, en gris, como «Vencida»
    cancelada: { texto: 'Cancelada', tono: 'cerrado' },
    no_emitida: { texto: 'Todavía no vigente', tono: 'marcha' }
  };

  /* La etiqueta de vigencia de una acreditación ({ texto, tono }). renovable: false cuando la base la cuenta renovable pero
     ahora no se puede renovar (ya hay un trámite en curso, el dictaminador sin la poda vigente o no es la última de su
     tipo): entonces es «Vencida», en gris (C6-05 a). personal: el texto para el personal. */
  function vigencia(sit, { personal, renovable } = {}) {
    const v = sit === 'vencida_renovable' && renovable === false ? VIGENCIA.vencida_no_renovable : VIGENCIA[sit] || { texto: sit, tono: '' };
    return { texto: personal ? v.personal || v.texto : v.texto, tono: v.tono };
  }

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
  // Los datos no se entregan antes de que la página termine de cargar: el núcleo del estándar inicia sus formularios
  // (FormKit.pasos y demás) al terminar de leerse la página, y archivos-prueba.js va después de la página que llama. Si
  // los datos llegaban antes (una segunda pestaña con la política de contenido, bloque 6), la solicitud usaba
  // FormKit.pasos sin iniciar. Con la API pasaría igual con una respuesta rápida. El setTimeout deja correr antes a
  // todos los que esperan DOMContentLoaded.
  const paginaLista = new Promise((listo) => {
    const tras = () => setTimeout(listo, 0);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tras, { once: true }); else tras();
  });
  /* Los datos se piden con la versión de la página (?v=, la de <meta name="sia-version">) y con la caché normal del
     navegador (auditoría 2026-10-20, D4-01): una versión nueva los vuelve a pedir y, dentro de la misma versión, la
     pantalla siguiente los toma de la caché o los revalida (304) en vez de descargarlos completos en cada pantalla, como
     hacía «no-store». Lo registrado en este navegador no depende de esto: se mezcla en cada carga (abajo). */
  const VERSION_PAGINA = ((document.querySelector('meta[name="sia-version"]') || {}).content || '').trim();
  const URL_DATOS = `datos/ficticios.json${VERSION_PAGINA ? `?v=${encodeURIComponent(VERSION_PAGINA)}` : ''}`;
  function cargar() {
    if (!promesa) {
      promesa = fetch(URL_DATOS)
        .then((r) => { if (!r.ok) throw new Error('datos'); return r.json(); })
        .then(soloRegistros);
    }
    // Versión de prueba: lo registrado en este navegador (cuentas, solicitudes, documentos, cambios de perfil) se suma
    // cada vez, para que todas las pantallas vean lo último (app/archivos-prueba.js)
    // Antes, lo guardado hace más de 7 días sin uso se borra (alta 1 de la auditoría integral)
    // (se lee al resolver: archivos-prueba.js se carga después de la página que llama)
    // El material de estudio que subió el personal en este navegador, también (con la URL de cada archivo)
    return Promise.all([promesa, paginaLista]).then(([d]) => {
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
  /* Día y hora de un instante en la Ciudad de México, sin depender de cómo el navegador une las piezas (la coma de
     toLocaleString, P184) ni de su ciclo de horas (hourCycle h23: la medianoche es 00:00, nunca 24:00). Una fecha sola
     (AAAA-MM-DD) es ese mismo día, sin hora. */
  const RELOJ = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function partesCdmx(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [a, m, d] = v.split('-'); return { a, m, d, h: null }; }
    const t = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(t.getTime())) return null;
    const p = {};
    for (const x of RELOJ.formatToParts(t)) p[x.type] = x.value;
    return { a: p.year, m: p.month, d: p.day, h: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
  }
  /* La hora que acompaña a una fecha: opciones.hora = true toma la del mismo instante; un texto («09:00» o «09:00:00»,
     como hora_entrada o la hora elegida de una cita) se usa tal cual, en HH:MM */
  const horaPedida = (p, hora) => (hora === true ? p.h : hora ? String(hora).slice(0, 5) : null);
  /* LAS DOS FORMAS DE ESCRIBIR UNA FECHA (decisión de Liber del 20/10/2026, auditoría del 20/10, punto 16 b; C5-01).
     Todas las pantallas usan sólo estas dos; el acuse conserva la del estándar (FormKit.utilidades.fechaHora, punto 17 b).
     · fechaLarga: lo que la persona tiene que recordar (su cita, su curso, su examen) y, para el personal, el día y la
       hora de un grupo o de una cita cuando es un encabezado o un aviso. «martes 20 de octubre de 2026 a las 10:00»;
       sin hora, «martes 20 de octubre de 2026». El día de la semana en minúscula (al principio de un renglón, con
       mayúscula inicial, como cualquier oración: opciones.mayuscula).
     · fechaCorta: tablas y datos (listas, columnas, líneas de datos, vencimientos, fechas de registro). «20/10/2026»;
       con hora, «20/10/2026 10:00», sin coma ni «a las».
     El nombre de un grupo («del 13 al 17 de octubre», decisión 18/10) no es una fecha suelta: lo arma nombreGrupo. */
  function fechaLarga(v, opciones = {}) {
    const p = partesCdmx(v);
    if (!p) return '';
    const dia = DIAS[new Date(Date.UTC(+p.a, +p.m - 1, +p.d, 12)).getUTCDay()];
    const h = horaPedida(p, opciones.hora);
    const t = `${dia} ${Number(p.d)} de ${MESES[+p.m - 1]} de ${p.a}${h ? ` a las ${h}` : ''}`;
    return opciones.mayuscula ? t.charAt(0).toLocaleUpperCase('es-MX') + t.slice(1) : t;
  }
  function fechaCorta(v, opciones = {}) {
    const p = partesCdmx(v);
    if (!p) return '';
    const h = horaPedida(p, opciones.hora);
    return `${p.d}/${p.m}/${p.a}${h ? ` ${h}` : ''}`;
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
  /* Máximo de oportunidades para corregir (ajustes del equipo, 25/10/2026; la base: apd.correcciones_usadas y el parámetro
     oportunidades_correccion, 2). Cada revisión en línea con observaciones es una oportunidad; que el cotejo regrese la
     solicitud con observaciones no cuenta. Si la revisión de la última corrección vuelve a tener observaciones, la base
     cierra la solicitud como concluida sin atender, con este motivo. */
  const MOTIVO_SIN_OPORTUNIDADES = 'Se agotaron las oportunidades de corrección';
  const cerradaSinOportunidades = (s) => Boolean(s) && s.estado === 'concluida_sin_atender' && String(s.motivo_cierre || '').startsWith(MOTIVO_SIN_OPORTUNIDADES);
  const oportunidadesCorreccion = (datos) => parametro(datos, 'oportunidades_correccion') || 2;
  const correccionesUsadas = (datos, s) => datos.revision.filter((r) => r.solicitud_id === s.id && r.resultado === 'con_observaciones').length;
  /* ¿Las observaciones de ahora vienen de su cita de cotejo? La cita con resultado «con_observaciones», posterior a la
     última revisión, como lo deja la base (apd.cita) */
  function observadaEnCotejo(datos, s) {
    const ultimaRev = datos.revision.filter((r) => r.solicitud_id === s.id).map((r) => r.revisada_en || '').sort().pop() || '';
    return (datos.cita || []).some((c) => c.solicitud_id === s.id && c.resultado === 'con_observaciones'
      && aFecha(c.atendida_en || c.programada_en) > aFecha(ultimaRev || '1970-01-01'));
  }
  /* Lo que la persona ve de sus oportunidades mientras corrige, o null si no está corrigiendo: cuántas le quedan, contando
     la de ahora («Te quedan 2 oportunidades para corregir»), o que es la última. Lo del cotejo no cuenta y lo dice. */
  function oportunidades(datos, s) {
    if (!s || s.estado !== 'con_observaciones') return null;
    if (observadaEnCotejo(datos, s)) return { cotejo: true, texto: 'Corregir lo que no coincidió en tu cita de cotejo no cuenta entre tus oportunidades para corregir.' };
    const quedan = Math.max(1, oportunidadesCorreccion(datos) - correccionesUsadas(datos, s) + 1);
    return quedan === 1
      ? { quedan, ultima: true, texto: 'Esta es tu última oportunidad para corregir.', detalle: 'Si en la revisión siguen las observaciones, tu solicitud se cierra y tienes que iniciar una nueva.' }
      : { quedan, texto: `Te quedan ${quedan} oportunidades para corregir.` };
  }
  /* Para el personal: la solicitud enviada es la revisión de la última corrección (si algo sigue con observación, se cierra) */
  const revisionDeLaUltima = (datos, s) => Boolean(s) && s.estado === 'enviada' && correccionesUsadas(datos, s) >= oportunidadesCorreccion(datos);
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
    if (n > 0) return [['Vence el', fechaCorta(venceEn)], ['Vence en', dias(n)]];
    if (n === 0) return [['Vence el', `${fechaCorta(venceEn)} (hoy)`]];
    return [['Venció el', fechaCorta(venceEn)], ['Vencida hace', dias(-n)]];
  }
  /* «1 grupo», «3 grupos» (auditoría 2026-10-18, A 6.5: estaba repetida en cuatro pantallas del personal) */
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);
  /* Texto para buscar sin acentos ni mayúsculas (A 6.6: estaba repetida en la bandeja y en las citas) */
  const normalizaBusqueda = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  /* Hora de 24 horas (HH:MM) en la Ciudad de México; la medianoche es 00:00 */
  function hora(iso) { const p = partesCdmx(iso); return p && p.h ? p.h : ''; }

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
  /* Teléfono de 10 dígitos como se dicta: «55 1234 5678» (la consulta del personal, ventanilla.html) */
  const telefonoTexto = (t) => (/^\d{10}$/.test(String(t || '')) ? `${t.slice(0, 2)} ${t.slice(2, 6)} ${t.slice(6)}` : String(t || ''));

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
  /* Sin sesión (auditoría 2026-10-20, B6-01; decisión 8): la sesión terminó (caducó o se salió en otra pestaña: la página
     no lo distingue y la persona no necesita saberlo). «Otra pestaña» sólo cuando hay otra cuenta. Cada pantalla dice qué
     pasó con lo capturado (sinSesion), porque no todas lo conservan: la solicitud tiene borrador; «Mi perfil» y «Cargar el
     documento correcto», no. En la etapa 3, la respuesta 401 de la API usa el mismo texto. Las pantallas del personal (las
     que cargan mensajes-usted.js) lo leen de usted. */
  const SESION_AL_ABRIR = (() => { const s = leeSesion(); return s && s.id ? String(s.id) : null; })();
  function sesionCambio(sinSesion) {
    const s = leeSesion();
    const ahora = s && s.id ? String(s.id) : null;
    if (SESION_AL_ABRIR && ahora === SESION_AL_ABRIR) return null;
    const volver = { href: `entrar.html?volver=${encodeURIComponent(global.location.pathname.split('/').pop() + global.location.search)}` };
    const usted = Boolean(global.APD_MENSAJES_USTED);
    if (ahora) {
      return rechazo(usted ? 'Su sesión cambió en otra pestaña' : 'Tu sesión cambió en otra pestaña',
        `En otra pestaña se entró con otra cuenta. No se guardó nada, para no mezclar ${usted ? 'sus' : 'tus'} datos con los de otra persona.`,
        { ...volver, texto: usted ? 'Vuelva a entrar con su cuenta' : 'Vuelve a entrar con tu cuenta' }, 'sesion_cambio');
    }
    return rechazo(usted ? 'Su sesión terminó' : 'Tu sesión terminó',
      sinSesion || (usted ? 'No se guardó nada: vuelva a entrar y haga otra vez el cambio.' : 'No se guardó nada: vuelve a entrar y haz otra vez el cambio.'),
      { ...volver, texto: 'Entrar' }, 'sesion_cambio');
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

  /* ----- Regiones vivas: un anuncio por acción (auditoría 2026-10-20, B4-03) -----
     escribe(nodo, texto) cambia el texto de una región viva sólo si es otro: volver a escribir el mismo texto lo vuelve a
     anunciar (el nombre del mes en cada flecha del calendario, el resumen del cotejo en cada respuesta). */
  function escribe(nodo, texto) { if (nodo && nodo.textContent !== texto) nodo.textContent = texto; }

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
      // UNAM y Universidad Autónoma Chapingo, por su clave (Chapingo: sesión de trabajo del 23/10/2026)
      if (['unam', 'chapingo'].includes(d.institucion_educativa)) o = porClave(d.institucion_educativa); else nombre = d.institucion_educativa_otra;
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
  /* Un parámetro de texto (una hora «09:30», el horario de informes), tal cual */
  function parametroTexto(datos, clave) { const p = (datos.parametro || []).find((x) => x.clave === clave); return p ? String(p.valor) : null; }

  /* ----- Sesión de trabajo del 23/10/2026: edad, años de poda, días hábiles y horarios (la misma regla que la base) -----
     Fecha de nacimiento que dice la CURP (posiciones 5 a 10; el siglo, del carácter 17: dígito, 1900; letra, 2000), como
     apd.curp_nacimiento. La mayoría de edad (P138) se cumple el día del aniversario 18, como en la base. */
  function nacimientoDeCurp(curp) {
    const c = String(curp || '').toUpperCase();
    if (!/^[A-Z]{4}\d{6}/.test(c) || c.length !== 18) return null;
    const a = (/\d/.test(c[16]) ? 1900 : 2000) + Number(c.slice(4, 6));
    return `${a}-${c.slice(6, 8)}-${c.slice(8, 10)}`;
  }
  function cumpleEdad(curp, anios) { const n = nacimientoDeCurp(curp); return n ? sumaMeses(n, anios * 12) : null; }
  /* Desde cuándo tiene la persona la poda sin interrupción hasta ese día (apd.poda_continua_desde): se parte de la vigente
     y se va hacia atrás; la anterior cuenta si la siguiente se emitió a más tardar meses_despues_renovacion meses después
     de su vencimiento. null sin poda vigente. */
  function podaContinuaDesde(datos, persona, fecha) {
    const f = fecha || hoy(datos);
    const meses = parametro(datos, 'meses_despues_renovacion') || 12;
    const podas = (datos.acreditacion || []).filter((a) => a.solicitante_id === persona.id && a.tipo_acreditacion === 'poda' && a.emitida_en <= f)
      .sort((a, b) => b.emitida_en.localeCompare(a.emitida_en));
    let desde = null;
    for (const a of podas) {
      // Una cancelada corta la cuenta (P120): si es la de ese día, no hay poda vigente
      if (canceladaAl(a, f)) { if (!desde) return null; break; }
      if (!desde) { if (f > a.vence_en) return null; desde = a.emitida_en; continue; }
      if (desde <= sumaMeses(a.vence_en, meses)) { if (a.emitida_en < desde) desde = a.emitida_en; } else break;
    }
    return desde;
  }
  /* ----- Cancelación (P120) y reposición de la credencial (P140), sesión de trabajo del 23/10/2026 -----
     ¿Estaba cancelada ese día? (apd.cancelada_al: el día de la cancelación, en la Ciudad de México, ya cuenta) */
  function canceladaAl(a, fecha) { return Boolean(a && a.cancelada_en) && diaDe(a.cancelada_en) <= fecha; }
  /* Perfiles del personal que pueden cancelar (parámetro perfiles_cancelan_acreditacion: instructor y administración) */
  function perfilesCancelan(datos) { return String(parametroTexto(datos, 'perfiles_cancelan_acreditacion') || '').split(',').map((x) => x.trim()).filter(Boolean); }
  /* Perfiles que asignan o cambian la persona instructora y confirman un grupo (parámetro perfiles_asignan_instructor:
     capacitación y administración; ajustes del equipo, 25/10/2026) */
  function perfilesAsignan(datos) { return String(parametroTexto(datos, 'perfiles_asignan_instructor') || 'capacitacion,administracion').split(',').map((x) => x.trim()).filter(Boolean); }
  /* Cada paso de la reposición, como lo ve la persona (de tú) y el personal (de usted) */
  const REPOSICION = {
    solicitada: { texto: 'Reposición: acta en revisión', personal: 'Acta por revisar', tono: 'marcha', tonoPersonal: 'pend' },
    con_observaciones: { texto: 'Reposición: corrige tu acta', personal: 'Acta con observaciones', tono: 'pend', tonoPersonal: 'marcha' },
    acta_aceptada: { texto: 'Reposición: recoge tu credencial', personal: 'Por entregar', tono: 'pend', tonoPersonal: 'pend' },
    repuesta: { texto: 'Credencial repuesta', personal: 'Repuesta', tono: 'ok', tonoPersonal: 'ok' },
    cancelada: { texto: 'Reposición cancelada', personal: 'Reposición cancelada', tono: 'cerrado', tonoPersonal: 'cerrado' }
  };
  const REPOSICION_ABIERTA = ['solicitada', 'con_observaciones', 'acta_aceptada'];
  function estadoReposicion(r, paraPersonal) {
    const e = REPOSICION[r.estado] || { texto: r.estado, tono: '' };
    return estado(paraPersonal ? e.personal : e.texto, paraPersonal ? e.tonoPersonal : e.tono);
  }
  const reposicionesDe = (datos, a) => (datos.reposicion || []).filter((r) => r.acreditacion_id === a.id)
    .sort((x, y) => String(y.solicitada_en).localeCompare(String(x.solicitada_en)));
  const reposicionAbierta = (datos, a) => reposicionesDe(datos, a).find((r) => REPOSICION_ABIERTA.includes(r.estado)) || null;
  /* ¿Se puede pedir hoy la reposición de esta credencial? Vigente, no cancelada, ya entregada (las del registro anterior se
     entregaron fuera del sistema) y sin otra reposición abierta (apd.reposicion_alta). Devuelve el motivo si no. */
  function porQueNoReponer(datos, a) {
    const sit = situacion(datos, a);
    if (!['vigente', 'por_vencer'].includes(sit)) return 'no_vigente';
    if (a.origen === 'sistema' && !a.entregada_en) return 'sin_entrega';
    if (reposicionAbierta(datos, a)) return 'en_curso';
    return null;
  }
  /* La cuota de reposición vigente hoy (apd.cuota): { monto, texto } (texto «$88.00» o null si no hay monto vigente) */
  function cuotaReposicion(datos) {
    const c = (datos.cuota || []).find((x) => x.clave === 'reposicion_credencial') || {};
    const vigente = c.monto != null && c.vigente_desde && c.vigente_desde <= hoy(datos);
    return { monto: vigente ? Number(c.monto) : null, texto: vigente ? moneda(c.monto) : null, fundamento: c.fundamento || '', concepto: c.concepto || 'Reposición de la credencial' };
  }
  const moneda = (n) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  /* Sábados y domingos inhábiles (P150); el calendario de festivos de la Gaceta está pendiente */
  const esHabil = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };
  /* El quinto día del curso de primera vez es de repaso de conocimientos y examen final (sesión de trabajo del 23/10/2026);
     la renovación (un día) sigue siendo «curso y examen» */
  const DIA_FINAL_NUEVA = 'Repaso de conocimientos y examen final';
  const diaFinal = (c) => (c && c.modalidad === 'nueva' && c.dias_duracion > 1 ? DIA_FINAL_NUEVA : 'Examen');

  /* Sede única de la cita, el curso y la entrega (parámetros sede y sede_direccion de la base, decisión 2026-10-16).
     La dirección vacía (aún «[pendiente]») se muestra como «por confirmar»; con la dirección ya escrita (confirmada por
     Liber el 2026-10-23), la marca «[pendiente: …]» que queda en el valor son las referencias para llegar
     (referenciasPendientes). La ubicación en el mapa sale del parámetro sede_mapa, «latitud,longitud» en grados
     decimales (decisión 2026-10-23, P68): vacía o mal escrita, no hay mapa. */
  function sede(datos) {
    const valor = (c) => (datos.parametro.find((x) => x.clave === c) || {}).valor || '';
    const m = limpia(valor('sede_mapa')).match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
    const [lat, lng] = m ? [Number(m[1]), Number(m[2])] : [NaN, NaN];
    const mapa = Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: m[1], lng: m[2] } : null;
    const direccion = limpia(valor('sede_direccion'));
    return { nombre: valor('sede'), direccion, referenciasPendientes: /\[pendiente/i.test(valor('sede_direccion')), mapa };
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
      if (sit === 'vigente') { r[tipo] = { disponible: false, motivo: `Tu acreditación ${a.numero} vence el ${fechaCorta(a.vence_en)}. Podrás renovarla a partir del ${fechaCorta(sumaDias(a.vence_en, -diasAntes))}.` }; continue; }
      if (sit === 'no_emitida') { r[tipo] = { disponible: false, motivo: `Tu acreditación ${a.numero} todavía no entra en vigor.` }; continue; }
      const renovable = sit === 'por_vencer' || sit === 'vencida_renovable';
      r[tipo] = { disponible: true, modalidad: renovable ? 'renovacion' : 'nueva', anterior: renovable ? a.numero : null };
    }
    const poda = ultima('poda');
    const podaVigente = poda && ['vigente', 'por_vencer'].includes(situacion(datos, poda));
    if (r.dictaminador.disponible && !podaVigente) r.dictaminador = { disponible: false, motivo: 'Necesitas tener vigente tu acreditación de poda y derribo.' };
    /* Dictaminador por primera vez: la poda durante al menos anios_poda_dictaminador años consecutivos (sesión de trabajo
       del 23/10/2026; la base: poda_menos_de_dos_anios). La renovación de dictaminador sigue pidiendo sólo la poda vigente. */
    const anios = parametro(datos, 'anios_poda_dictaminador') || 2;
    if (r.dictaminador.disponible && r.dictaminador.modalidad === 'nueva') {
      const desde = podaContinuaDesde(datos, persona);
      const podra = desde ? sumaMeses(desde, anios * 12) : null;
      if (!desde || podra > hoy(datos)) {
        r.dictaminador = { disponible: false, clave: 'dos_anios', desde, podra,
          motivo: `Necesitas tener la acreditación de poda y derribo durante al menos ${anios === 2 ? 'dos' : anios} años consecutivos. Tienes la tuya sin interrupción desde el ${fechaCorta(desde)}: podrás solicitarla a partir del ${fechaCorta(podra)}.` };
      }
    }
    /* Mayoría de edad para las dos acreditaciones (P138): 18 años cumplidos el día de la solicitud, con la CURP (la base:
       menor_de_edad). Va al final: es lo primero que se le dice a la persona. */
    const edad = parametro(datos, 'edad_minima') || 18;
    const cumple = cumpleEdad(persona.curp, edad);
    if (cumple && cumple > hoy(datos)) {
      for (const tipo of ['poda', 'dictaminador']) {
        r[tipo] = { disponible: false, clave: 'menor_de_edad', motivo: `Necesitas tener ${edad} años cumplidos para solicitar una acreditación. Según tu CURP, los cumples el ${fechaCorta(cumple)}: podrás solicitarla desde ese día.` };
      }
    }
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
  /* ----- Avisos, etiquetas de estado y «qué sigue»: del estándar desde la 1.4.0, la 1.4.1 y la 1.4.2 (P115, P118, P119,
     P131) -----
     El proyecto sólo traduce sus tonos a las familias del estándar. Los avisos, también los que llevan pasos o un enlace,
     son FormKit.aviso (las páginas sin formulario cargan el núcleo para eso). La etiqueta de estado arma el marcado del
     contrato si la página no carga el módulo «estado». La confirmación es FormKit.confirma (módulo modal, P113) y el
     desenlace de una decisión, FormKit.resultado (módulo resultado, P113). */
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
    // Cerrada porque se agotaron las oportunidades de corrección (ajustes del equipo, 25/10/2026): no es «no se corrigió a tiempo»
    if (cerradaSinOportunidades(s)) return estado(paraPersonal ? 'Cerrada: sin más oportunidades de corrección' : 'Cerrada: se agotaron tus oportunidades para corregir', 'error');
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
  /* Los avisos son FormKit.aviso(lugar, { tono, titulo, texto, pasos, foco }) del núcleo (1.4.2, P131): texto puede ser
     un nodo y pasos, la secuencia «qué sigue». pintaAviso sólo vacía y muestra el contenedor de una respuesta a una
     acción y traduce el tono del proyecto al del estándar. */
  const TONO_AVISO = { ok: 'ok', error: 'bloqueo', pend: 'advertencia', info: 'neutro', marcha: 'neutro' };
  function pintaAviso(contenedor, tono, titulo, texto, enfoca) {
    contenedor.hidden = false;
    contenedor.replaceChildren();
    return global.FormKit.aviso(contenedor, { tono: TONO_AVISO[tono] || tono, titulo, texto: texto || '', foco: Boolean(enfoca) });
  }
  /* Título de una secuencia «qué sigue» dentro de un aviso (FormKit.aviso no lo pone): va en su texto, antes de los pasos */
  const tituloPasos = (t) => el('p', { class: 'secuencia-titulo', texto: t || 'Qué sigue' });
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

  /* Línea de datos («Folio … · enviada el … · 2.ª revisión»), con el marcado del estándar (1.4.4, P134):
     <p class="linea-datos"> con cada dato en <span class="linea-datos-item">, que no se parte (si no cabe, pasa completo al
     renglón siguiente), y los puntos medios en el texto. Una parte es texto o una lista de nodos; clase, la propia de la
     pantalla, si la lleva. */
  /* B4-06 (auditoría 2026-10-20; falla del estándar, P187): un dato que no cabe ni en una línea entera
     (con el espaciado de texto de WCAG 1.4.12 en 320 px) se marca [data-ancho] y se parte por dentro (app/apd.css); los
     demás siguen enteros. Se revisa cada vez que la línea cambia de tamaño. Se recuerda el ancho que pedía el dato entero
     para no marcarlo y desmarcarlo sin fin. */
  const anchoEntero = new WeakMap();
  const vigilaLinea = typeof ResizeObserver === 'function' ? new ResizeObserver((entradas) => {
    for (const { target: linea } of entradas) {
      // La línea puede ensancharse con su contenido (una rejilla que crece con lo que no se parte): se mide también contra
      // la ventana, con el mismo margen a los dos lados
      const izq = linea.getBoundingClientRect().left;
      const caja = Math.min(linea.clientWidth, document.documentElement.clientWidth - 2 * Math.max(0, izq));
      if (!linea.clientWidth || caja <= 0) continue;
      for (const i of linea.querySelectorAll('.linea-datos-item')) {
        const pide = i.hasAttribute('data-ancho') ? anchoEntero.get(i) || 0 : i.getBoundingClientRect().width;
        if (!i.hasAttribute('data-ancho') && pide > caja + 0.5) { anchoEntero.set(i, pide); i.setAttribute('data-ancho', ''); }
        else if (i.hasAttribute('data-ancho') && pide <= caja) i.removeAttribute('data-ancho');
      }
    }
  }) : null;
  function lineaDatos(partes, clase) {
    const hijos = [];
    partes.filter(Boolean).forEach((p, i) => {
      if (i) hijos.push(document.createTextNode(' · '));
      hijos.push(el('span', { class: 'linea-datos-item' }, typeof p === 'string' ? [document.createTextNode(p)] : p));
    });
    const linea = el('p', { class: clase ? `linea-datos ${clase}` : 'linea-datos' }, hijos);
    if (vigilaLinea) vigilaLinea.observe(linea);
    return linea;
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
    if (franja) franja.textContent = fechaCorta(datos.fecha_corte);
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
  // Con el horario de informes (sesión de trabajo del 23/10/2026, parámetro informes_horario; teléfono y correo: P132)
  const CORREO_EN_USO = 'Este correo ya está registrado en otra cuenta. Escribe otro; si es tuyo y no recuerdas esa cuenta, pide ayuda a la Secretaría (informes de lunes a viernes, de 9:00 a 15:00).';

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
  /* «13 de octubre» (con el año si se pide: «13 de octubre de 2026») */
  function diaMes(iso, conAnio) { const p = piezas(iso); return `${p.d} de ${MESES[p.m - 1]}${conAnio ? ` de ${p.a}` : ''}`; }
  /* «del 13 al 17 de octubre», «del 29 de octubre al 2 de noviembre»; el año sólo si no es el de anioRef. Sólo para el
     nombre de un grupo (decisión 18/10): cualquier otra fecha se escribe con fechaLarga o fechaCorta (decisión 20/10) */
  function rangoFechas(desde, hasta, anioRef) {
    const a = piezas(desde);
    const b = piezas(hasta || desde);
    const otroAnio = String(a.a) !== String(anioRef) || a.a !== b.a;
    if (!hasta || hasta === desde) return diaMes(desde, otroAnio);
    if (a.a === b.a && a.m === b.m) return `del ${a.d} al ${b.d} de ${MESES[a.m - 1]}${otroAnio ? ` de ${a.a}` : ''}`;
    if (a.a === b.a) return `del ${diaMes(desde)} al ${diaMes(hasta)}${otroAnio ? ` de ${a.a}` : ''}`;
    return `del ${diaMes(desde, true)} al ${diaMes(hasta, true)}`;
  }
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
  /* Sólo el control donde se escribe: el <input type="date"> oculto del calendario vive dentro del mismo campo y no se
     acomoda. Error 7 de la sesión del 23/10/2026: al elegir un día, el calendario del navegador manda «input» con
     AAAA-MM-DD; esto lo tomaba por una fecha pegada y le escribía dd/mm/aaaa, que un campo de fecha no admite: el valor
     quedaba vacío, el «change» ya no llegaba y el día elegido no se escribía en «Resultado de la revisión» (ni en el
     cotejo ni en la ficha del grupo). */
  const formatoDe = (c) => {
    if (!c || !c.closest || c.type === 'date' || (c.classList && c.classList.contains('control-calendario-nativo'))) return '';
    const campo = c.closest('[data-campo][data-formato]');
    return campo ? campo.dataset.formato : '';
  };
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

  /* ----- Visor: la caja de las hojas tiene nombre y no tiene rol (P171) -----
     El módulo «visor» 1.5.1 arma div.visor-hojas con tabindex y aria-label pero sin role: en un div genérico aria-label
     no está permitido (axe, aria-prohibited-attr; lo vio la revisión de accesibilidad del cotejo en escritorio). Es la
     zona desplazable de las hojas: se le da role="region", que sí admite el nombre. Se quita al resolverse en el estándar. */
  function rolHojas() { for (const h of document.querySelectorAll('[data-visor-hojas]:not([role])')) h.setAttribute('role', 'region'); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('script[src*="modulos/visor/"]')) return;
    rolHojas();
    new MutationObserver(rolHojas).observe(document.body, { childList: true, subtree: true });
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
  /* Plazos en días hábiles (de lunes a viernes; sin calendario de festivos todavía), como apd.suma_dias_habiles: el día que
     resulta de sumar n días hábiles a una fecha */
  function sumaHabiles(iso, n) {
    let d = String(iso).slice(0, 10);
    for (let k = 0; k < n;) { d = sumaDias(d, 1); if (esHabil(d)) k += 1; }
    return d;
  }
  /* La cita de cotejo se da dentro de los dias_habiles_cita días hábiles siguientes (P205, decisión de Liber del 26/10/2026;
     sustituye al límite de 6 meses): del siguiente día hábil después de «desde» (hoy, o el día de la cita perdida) al
     último del plazo, contado desde hoy. La base: cita_fuera_de_plazo. */
  function plazoCita(datos, desde) {
    const dias = parametro(datos, 'dias_habiles_cita') || 20;
    const h = hoy(datos);
    return { dias, desde: sumaHabiles(desde && desde > h ? desde : h, 1), hasta: sumaHabiles(h, dias) };
  }
  /* El último día para corregir las observaciones: dias_habiles_correccion días hábiles después de recibirlas (P199) */
  const limiteCorreccion = (datos, s) => sumaHabiles(diaDe(s.estado_desde), parametro(datos, 'dias_habiles_correccion') || 20);
  /* El último día de la revisión documental: dias_habiles_revision días hábiles después del envío o del reenvío (P199) */
  const limiteRevision = (datos, s) => sumaHabiles(diaDe(s.estado_desde), parametro(datos, 'dias_habiles_revision') || 10);

  global.APD = {
    fechaPegada, pdfConContrasena, formatoEnCombos, alCambiar, sumaHabiles, plazoCita, limiteCorreccion, limiteRevision, rechazo, muestraRechazo, sesionCambio, ocupa, escribe,
    textoNoGuardo, noGuardo, caducada,
    CONTRASENA_FICTICIA, ESTADOS, vigencia, TIPOS, MODALIDADES, FINALES,
    cursoLargo, MESES, ultimoDia, nombreGrupo, grupoTitulo,
    cargar, cargadoTras, fechaLarga, fechaCorta, hora, sumaDias, sumaMeses, hoy, diaDe, pausaVencida, cerradaPorInasistencia, diasParaVencer, vencimiento,
    MOTIVO_SIN_OPORTUNIDADES, cerradaSinOportunidades, oportunidadesCorreccion, correccionesUsadas, observadaEnCotejo, oportunidades, revisionDeLaUltima,
    plural, normalizaBusqueda, paraTi, observacionDe,
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, destinoPropio, nombreCompleto, nombreDeArchivo,
    solicitudesDe, acreditacionesDe, situacion, parametro, parametroTexto, curso, sede, activa, limpia, opciones,
    podaContinuaDesde, esHabil, diaFinal,
    perfilesCancelan, perfilesAsignan, REPOSICION_ABIERTA, estadoReposicion, reposicionesDe, reposicionAbierta, porQueNoReponer, cuotaReposicion, moneda,
    el, lineaDatos, estado, estadoSolicitud, nombrePersonal, sigueEn, hhmm, icono, pintaAviso, tituloPasos, datosLista, pintaSesion, pintaCorte, adscripcionPares, adscripcionDe,
    perfilAcademico, SUPERIORES, correoEnUso, CORREO_EN_USO, avisa, materialPublico, tamano,
    telefonoTexto
  };
}(window));
