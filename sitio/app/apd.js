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
    con_observaciones: { texto: 'Corrige y reenvía', personal: 'Con observaciones', tono: 'pend', sigue: 'Corrige lo que se indica abajo y vuelve a enviar tu solicitud.' },
    validada_en_linea: { texto: 'Acude a tu cita', personal: 'Cita asignada', tono: 'pend', icono: 'fecha', sigue: 'Acude a tu cita con los mismos documentos que cargaste, impresos, y con tu comprobante de pago.' },
    lista_para_curso: { texto: 'En espera de grupo', tono: 'marcha', sigue: 'Tu cotejo terminó. El siguiente paso es que la Secretaría te asigne un grupo del curso; te avisará las fechas y la sede.' },
    inscrita: { texto: 'Con grupo asignado', tono: 'ok', sigue: 'Asiste a tu curso en las fechas indicadas.' },
    aprobada: { texto: 'Aprobada', tono: 'ok', sigue: 'La Secretaría emite tu acreditación.' },
    acreditada: { texto: 'Acreditación emitida', tono: 'ok', sigue: 'Recoge tu acreditación en persona.' },
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
    return promesa.then((d) => (global.APD_ARCHIVOS_PRUEBA ? global.APD_ARCHIVOS_PRUEBA.mezcla(d) : d));
  }

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
  /* ----- Mensajes de resultado (propuesta «Avisos y confirmaciones», aprobada por Liber el 2026-10-17) -----
     Un icono por familia, para que el color nunca sea la única señal. Los iconos son los del estándar (sprite del
     núcleo) más dos propios (candado y cierre), que se agregan aquí. */
  const ICONO_TONO = { ok: 'palomita', pend: 'alerta', error: 'cerrar', marcha: 'reloj', cerrado: 'fin', info: 'info' };
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
  /* Etiqueta de estado: texto + icono de su familia (o el que se indique) */
  function estado(texto, tono, nombreIcono) {
    const n = nombreIcono || ICONO_TONO[tono];
    return el('span', { class: 'estado', 'data-tono': tono || null }, [n ? icono(n, 'icono icono-estado') : null, document.createTextNode(texto)]);
  }
  /* Etiqueta del estado de una solicitud; para el personal, con su nombre de personal */
  function estadoSolicitud(s, paraPersonal) {
    const e = ESTADOS[s.estado] || { texto: s.estado, tono: '' };
    return estado(paraPersonal ? e.personal || e.texto : e.texto, e.tono, e.icono);
  }
  /* Aviso con título: tono ok (hecho), error (no se pudo), pend (atención), info. Devuelve el elemento. */
  const CLASE_AVISO = { ok: 'aviso-ok', error: 'aviso-bloqueo', pend: 'aviso-advertencia', info: '' };
  const ICONO_AVISO = { ok: 'ok', error: 'error', pend: 'alerta', info: 'info' };
  function aviso(tono, titulo, texto, extra) {
    return el('div', { class: `aviso ${CLASE_AVISO[tono] || ''}`.trim(), 'data-aviso': tono }, [
      icono(ICONO_AVISO[tono] || 'info'),
      el('div', { class: 'aviso-texto' }, [titulo ? el('p', { class: 'aviso-titulo', texto: titulo }) : null, texto ? el('p', { texto }) : null].concat(extra || []))
    ]);
  }
  /* Pinta un aviso en un contenedor existente (lo crea dentro si hace falta), lo muestra y, si se pide, le da el foco */
  function pintaAviso(contenedor, tono, titulo, texto, enfoca) {
    const a = aviso(tono, titulo, texto);
    a.setAttribute('role', tono === 'error' ? 'alert' : 'status');
    a.tabIndex = -1;
    contenedor.replaceChildren(a);
    contenedor.hidden = false;
    if (enfoca) { a.focus({ preventScroll: true }); a.scrollIntoView({ block: 'nearest' }); }
    return a;
  }
  /* Resultado de una decisión: «Quedó guardado» (lo hizo el sistema) y, en el título, el desenlace del trámite con su
     color e icono. seccion: la tarjeta [data-hecho] con [data-hecho-titulo] y [data-hecho-texto]. */
  const horaCorta = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });
  function pintaDesenlace(seccion, { tono, titulo, texto, cita, quien, icono: nombreIcono }) {
    seccion.classList.add('desenlace');
    seccion.dataset.tono = tono;
    let guardado = seccion.querySelector('[data-desenlace-guardado]');
    if (!guardado) { guardado = el('p', { class: 'desenlace-guardado', 'data-desenlace-guardado': '' }); seccion.prepend(guardado); }
    guardado.replaceChildren(icono('ok'), document.createTextNode(`Quedó guardado a las ${horaCorta(new Date())}${quien ? ` · ${quien}` : ''}`));
    const t = seccion.querySelector('[data-hecho-titulo]');
    if (t) t.replaceChildren(el('span', { class: 'desenlace-marca' }, [icono(nombreIcono || ICONO_TONO[tono] || 'info')]), document.createTextNode(titulo));
    const p = seccion.querySelector('[data-hecho-texto]');
    if (p && texto !== undefined) p.textContent = texto;
    const previa = seccion.querySelector('[data-desenlace-cita]');
    if (previa) previa.remove();
    if (cita && t) t.after(el('blockquote', { class: 'desenlace-cita', 'data-desenlace-cita': '', texto: cita }));
    seccion.hidden = false;
    seccion.focus();
    seccion.scrollIntoView({ block: 'start' });
  }
  /* Confirmar antes de actuar (sustituye a FormKit.confirma mientras el estándar no lo trae, hallazgo P113): pregunta
     con lo que se afecta, consecuencias en lista y en texto normal, «No se puede deshacer» con icono, botón con el
     verbo exacto (rojo relleno si es de peligro) y «Volver sin cambios», que recibe el foco. */
  function confirma(ancla, cfg) {
    return new Promise((resolve) => {
      const d = el('dialog', { class: 'dialogo dialogo-confirma confirmacion', role: 'alertdialog' });
      const idT = `conf-t-${Date.now()}`;
      d.setAttribute('aria-labelledby', idT);
      const no = el('button', { type: 'button', class: 'btn btn-secundario', 'data-r': 'no', texto: cfg.no || 'Volver sin cambios' });
      const si = el('button', { type: 'button', class: `btn ${cfg.peligro ? 'btn-peligro' : 'btn-primario'}`, 'data-r': 'si', texto: cfg.si });
      const lista = (cfg.consecuencias || []).filter(Boolean);
      d.append(
        el('div', { class: 'confirmacion-cabeza' }, [el('span', { class: 'desenlace-marca', 'data-tono': cfg.peligro ? 'error' : 'info' }, [icono(cfg.peligro ? 'alerta' : 'info')]),
          el('h2', { class: 'titulo-bloque dialogo-titulo', id: idT, texto: cfg.titulo })]),
        lista.length ? el('ul', { class: 'confirmacion-lista' }, lista.map((c) => el('li', { texto: c }))) : null,
        cfg.irreversible ? el('p', { class: 'confirmacion-irreversible' }, [icono('alerta'), document.createTextNode('No se puede deshacer.')]) : null,
        el('div', { class: 'acciones dialogo-acciones' }, [no, si])
      );
      document.body.appendChild(d);
      const termina = (ok) => { if (d.open) d.close(); d.remove(); if (ancla && ancla.focus) ancla.focus(); resolve(ok); };
      no.addEventListener('click', () => termina(false));
      si.addEventListener('click', () => termina(true));
      d.addEventListener('cancel', (e) => { e.preventDefault(); termina(false); });
      d.showModal();
      no.focus();
      if (global.FormKit) global.FormKit.anuncia(`${cfg.titulo} ${lista.join(' ')}${cfg.irreversible ? ' No se puede deshacer.' : ''}`, true);
    });
  }
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

  /* Avisa al núcleo que la página cambió el valor de un control (input y change, como al escribir). El combo del
     estándar abre su lista con cualquier «input», también al llenar un borrador o un perfil sin que la persona esté en
     el campo, y la lista tapa la pregunta siguiente (hallazgo P99): si el combo no tiene el foco, se cierra. */
  function avisa(c) {
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
    if (c.getAttribute('role') === 'combobox' && document.activeElement !== c) c.dispatchEvent(new Event('blur'));
  }

  global.APD = {
    CONTRASENA_FICTICIA, ESTADOS, VIGENCIA, TIPOS, MODALIDADES, FINALES,
    cargar, fecha, fechaHora, sumaDias, sumaMeses, hoy, diasParaVencer, textoVence,
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, nombreCompleto, nombreDeArchivo,
    solicitudesDe, acreditacionesDe, situacion, parametro, curso, sede, activa, limpia, opciones,
    el, estado, estadoSolicitud, nombrePersonal, icono, aviso, pintaAviso, pintaDesenlace, confirma, datosLista, pintaSesion, pintaCorte, ADSCRIPCIONES, adscripcionTexto, adscripcionDe,
    perfilAcademico, SUPERIORES, correoEnUso, CORREO_EN_USO, avisa
  };
}(window));
