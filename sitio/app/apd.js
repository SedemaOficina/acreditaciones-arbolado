/* =========================================================
   apd.js · Lo común de las pantallas de la persona solicitante

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
    enviada: { texto: 'En revisión documental', tono: 'marcha', sigue: 'La Secretaría hace la revisión documental de tu solicitud: revisa que tus documentos estén completos y correctos.' },
    // Hay un plazo para corregir (P02: lo fija la Dirección); mientras no esté, se dice que existe (auditoría integral, alta 10)
    con_observaciones: { texto: 'Corrige y reenvía', personal: 'Con observaciones', tono: 'pend', sigue: { texto: 'Hay un plazo para corregir: si no reenvías tu solicitud a tiempo, se cierra.', pasos: ['Corrige lo que se indica arriba.', 'Vuelve a enviar tu solicitud.', 'La Secretaría la revisa otra vez.'] } },
    validada_en_linea: { texto: 'Acude a tu cita', personal: 'Cita asignada', tono: 'pend', sigue: { pasos: ['Imprime los mismos documentos que cargaste.', 'Paga los derechos e imprime tu comprobante de pago.', 'Acude a tu cita con tus documentos y tu comprobante.'] } },
    // La persona espera el curso; el personal arma grupos con esa lista (decisión 2026-10-18)
    lista_para_curso: { texto: 'En espera de curso', personal: 'En espera de grupo', tono: 'marcha', sigue: { texto: 'Tu cotejo terminó.', pasos: ['La Secretaría te asigna un grupo del curso.', 'Te avisa las fechas, la hora de entrada y la sede.', 'Asistes al curso y, el último día, presentas el examen.'] } },
    inscrita: { texto: 'Con grupo asignado', tono: 'ok', sigue: 'Asiste a tu curso en las fechas indicadas.' },
    aprobada: { texto: 'Aprobada', tono: 'ok', sigue: 'La Secretaría emite tu acreditación.' },
    acreditada: { texto: 'Acreditación emitida', tono: 'ok', sigue: 'Recoge tu credencial en persona.' },
    no_acreditada: { texto: 'No acreditada', tono: 'error', sigue: 'No alcanzaste la calificación mínima. Puedes iniciar una solicitud nueva.' },
    sin_derecho_examen: { texto: 'Sin derecho a examen', tono: 'error', sigue: 'No alcanzaste la asistencia mínima. Puedes iniciar una solicitud nueva.' },
    cancelada: { texto: 'Cancelada', tono: 'cerrado', sigue: '' },
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
    vencida_renovable: { texto: 'No vigente', tono: 'error' },
    vencida_no_renovable: { texto: 'No vigente', tono: 'error' },
    no_emitida: { texto: 'Todavía no vigente', tono: 'marcha' }
  };

  const TIPOS = { poda: 'Poda y derribo', dictaminador: 'Dictaminador técnico' };
  const MODALIDADES = { nueva: 'Solicitud nueva', renovacion: 'Renovación' };

  let promesa = null;
  function cargar() {
    if (!promesa) {
      promesa = fetch('datos/ficticios.json', { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('datos'); return r.json(); });
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
      return P.caduca().then(() => P.mezcla(b)).then((x) => P.mezclaMaterial(x));
    });
  }

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
  function sumaMeses(iso, meses) { const d = aFecha(iso); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); }

  /* Hoy, como fecha AAAA-MM-DD en la Ciudad de México. En la versión de prueba es la fecha simulada de los ficticios
     (datos.fecha_corte, la de la franja amarilla), para que cada caso siga en su situación; con la API (etapa 3) no
     hay fecha de corte y es el día real. */
  /* El día (AAAA-MM-DD, Ciudad de México) de una fecha y hora */
  const diaDe = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) : null);
  /* Una cita en pausa sólo dura su día: después ya no se retoma y la solicitud regresa con observaciones (P80) */
  function pausaVencida(datos, s) {
    return Boolean(s && s.cotejo_pausa) && diaDe(s.cotejo_pausa.cita_en || s.cita_en) < hoy(datos);
  }
  /* Cerrada por no presentarse dos veces a la cita de cotejo: se distingue por el motivo que guarda la base
     («No se presentó a su cita de cotejo N veces.», 03-apd-reglas.sql), no por un dato propio de la prueba (alta 5) */
  const cerradaPorInasistencia = (s) => s && s.estado === 'concluida_sin_atender' && /^No se presentó a su cita de cotejo/.test(s.motivo_cierre || '');
  function hoy(datos) {
    if (datos && datos.fecha_corte) return datos.fecha_corte;
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  }
  /* Días naturales que faltan para que venza (negativo si ya venció), contados desde hoy (decisión 2026-10-17) */
  function diasParaVencer(datos, venceEn) {
    return Math.round((aFecha(venceEn) - aFecha(hoy(datos))) / 86400000);
  }
  function textoVence(n) {
    if (n > 1) return `Faltan ${n.toLocaleString('es-MX')} días`;
    if (n === 1) return 'Falta 1 día';
    if (n === 0) return 'Vence hoy';
    return n === -1 ? 'Venció hace 1 día' : `Venció hace ${(-n).toLocaleString('es-MX')} días`;
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
  function adscripcionTexto(datos, p) {
    if (!p || !p.adscripcion) return '';
    if (p.adscripcion === 'independiente') return 'Independiente: no trabajas para ninguna empresa, institución o dependencia.';
    const nombre = nombreInstitucion(datos, p);
    return `${ADSCRIPCIONES[p.adscripcion]}: ${nombre}${/\.$/.test(nombre) ? '' : '.'}`;
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
    return { adscripcion: d.tipo_adscripcion, organizacion_id: o ? o.id : null, organizacion_nombre: o ? o.nombre : String(nombre || '').trim() };
  }
  /* Perfil del dictaminador: la regla está en app/perfil-academico.js (sin navegador), para que la use también el
     servidor. */
  const { normaliza, perfilAcademico, SUPERIORES } = global.APD_PERFIL_ACADEMICO;
  function requiereSesion(datos) {
    const p = personaDeSesion(datos);
    if (!p) { global.location.replace(`entrar.html?volver=${encodeURIComponent(global.location.pathname.split('/').pop())}`); return null; }
    return p;
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
     con lo que falta confirmar; así se ve en cualquier versión hasta que la Secretaría lo confirme. */
  function datosLista(pares) {
    return el('dl', { class: 'datos' }, pares.filter((p) => p[1]).map(([etq, valor, porConfirmar]) =>
      el('div', { class: 'datos-par' }, [
        el('dt', { class: 'datos-etq', texto: etq }),
        porConfirmar
          ? el('dd', { class: 'datos-valor datos-por-confirmar pendiente' }, [valor, el('span', { class: 'datos-nota', texto: `Por confirmar: ${porConfirmar}` })])
          : el('dd', { class: 'datos-valor', texto: valor })
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
    // Iconos propios que el estándar no trae: candado (cuenta bloqueada) y cierre (trámite cerrado)
    if (!document.querySelector('[data-sprite-propio]')) {
      const propio = document.createElement('div');
      propio.setAttribute('data-sprite-propio', '');
      propio.hidden = true;
      propio.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="i-candado" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>'
        + '<symbol id="i-fin" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol></svg>';
      document.body.prepend(propio);
    }
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

  global.APD = {
    CONTRASENA_FICTICIA, ESTADOS, VIGENCIA, TIPOS, MODALIDADES, FINALES,
    cargar, cargadoTras, fecha, fechaHora, sumaDias, sumaMeses, hoy, diaDe, pausaVencida, cerradaPorInasistencia, diasParaVencer, textoVence,
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, nombreCompleto, nombreDeArchivo,
    solicitudesDe, acreditacionesDe, situacion, parametro, curso, sede, activa, limpia, opciones,
    el, meta, estado, estadoSolicitud, nombrePersonal, sigueEn, hhmm, icono, familia, aviso, pintaAviso, datosLista, pintaSesion, pintaCorte, ADSCRIPCIONES, adscripcionTexto, adscripcionPares, adscripcionDe,
    perfilAcademico, SUPERIORES, correoEnUso, CORREO_EN_USO, avisa, materialPublico, tamano
  };
}(window));
