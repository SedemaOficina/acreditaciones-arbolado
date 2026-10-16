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

  /* Qué ve la persona en cada estado de su solicitud y qué sigue. */
  const ESTADOS = {
    borrador: { texto: 'Borrador', tono: 'pend', sigue: 'Termina de cargar tus documentos y envía tu solicitud.' },
    enviada: { texto: 'En revisión documental', tono: '', sigue: 'La Secretaría hace la revisión documental de tu solicitud: revisa que tus documentos estén completos y correctos.' },
    con_observaciones: { texto: 'Con observaciones', tono: 'pend', sigue: 'Corrige lo que se indica abajo y vuelve a enviar tu solicitud.' },
    validada_en_linea: { texto: 'Cita asignada', tono: 'pend', sigue: 'Acude a tu cita con los mismos documentos que cargaste, impresos, y con tu comprobante de pago.' },
    lista_para_curso: { texto: 'En espera de grupo', tono: '', sigue: 'Tu expediente está completo. La Secretaría te asignará un grupo de curso.' },
    inscrita: { texto: 'Con grupo asignado', tono: 'ok', sigue: 'Asiste a tu curso en las fechas indicadas.' },
    aprobada: { texto: 'Aprobada', tono: 'ok', sigue: 'La Secretaría emite tu acreditación.' },
    acreditada: { texto: 'Acreditación emitida', tono: 'ok', sigue: 'Recoge tu acreditación en persona.' },
    no_acreditada: { texto: 'No acreditada', tono: 'error', sigue: 'No alcanzaste la calificación mínima. Puedes iniciar una solicitud nueva.' },
    sin_derecho_examen: { texto: 'Sin derecho a examen', tono: 'error', sigue: 'No alcanzaste la asistencia mínima. Puedes iniciar una solicitud nueva.' },
    cancelada: { texto: 'Cancelada', tono: '', sigue: '' },
    concluida_sin_atender: { texto: 'Concluida sin atender', tono: '', sigue: 'Las observaciones no se atendieron a tiempo. Puedes iniciar una solicitud nueva.' },
    rechazada: { texto: 'Rechazada', tono: 'error', sigue: 'Tu perfil no cumple los requisitos de esta acreditación. Abajo está el motivo. Puedes iniciar una solicitud nueva si cuentas con otro grado de estudios.' }
  };
  const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'];

  /* Situación de una acreditación, tal como la calcula la base. */
  const VIGENCIA = {
    vigente: { texto: 'Vigente', tono: 'ok' },
    por_vencer: { texto: 'Vigente · por vencer', tono: 'pend' },
    vencida_renovable: { texto: 'No vigente', tono: 'error' },
    vencida_no_renovable: { texto: 'No vigente', tono: 'error' },
    no_emitida: { texto: 'Todavía no vigente', tono: '' }
  };

  const TIPOS = { poda: 'Poda y derribo', dictaminador: 'Dictaminador técnico' };
  const MODALIDADES = { nueva: 'Solicitud nueva', renovacion: 'Renovación' };

  let promesa = null;
  function cargar() {
    if (!promesa) {
      promesa = fetch('datos/ficticios.json', { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('datos'); return r.json(); });
    }
    return promesa;
  }

  /* ----- Fechas: todo en hora de la Ciudad de México ----- */
  function aFecha(iso) { return iso ? new Date(iso.length === 10 ? `${iso}T12:00:00-06:00` : iso) : null; }
  function fecha(iso) {
    const d = aFecha(iso);
    return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' }) : '';
  }
  function fechaHora(iso) {
    const d = aFecha(iso);
    return d ? d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }) : '';
  }
  function sumaDias(iso, dias) { const d = aFecha(iso); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
  function sumaMeses(iso, meses) { const d = aFecha(iso); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); }

  /* ----- Sesión simulada ----- */
  function leeSesion() { try { return JSON.parse(global.sessionStorage.getItem(CLAVE_SESION) || 'null'); } catch (e) { return null; } }
  function guardaSesion(s) { try { global.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function cierraSesion() { try { global.sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* sin almacenamiento: nada que borrar */ } }

  /* La persona de la sesión: del padrón ficticio, o una cuenta recién creada en esta pestaña. */
  function personaDeSesion(datos) {
    const s = leeSesion();
    if (!s) return null;
    // Lo que la persona cambió en «Mis datos» durante la prueba (s.datos) se aplica encima de lo guardado
    if (s.nueva) return Object.assign({ id: 'nueva', estado: 'activa' }, s.nueva, s.datos || {});
    const p = datos.solicitante.find((x) => x.id === s.id);
    return p ? Object.assign({}, p, s.datos || {}) : null;
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
  /* Mismo criterio que apd.normalizar en la base: sin acentos, minúsculas, sólo letras, números y espacios. */
  function normaliza(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  /* Perfil del dictaminador: el mismo cálculo que apd.perfil_academico y apd.experiencia_minima en la base
     (decisión 2026-10-15). Devuelve { perfil, minimo } o null si aún faltan respuestas. */
  const BASICOS = ['ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria'];
  const SUPERIORES = ['licenciatura', 'maestria', 'doctorado'];
  const MINIMOS = { licenciatura_afin: 2, disciplina_afin: 5, pasante: 5, tecnica: 5 };
  function perfilAcademico(datos, nivel, estatus, carrera) {
    if (!nivel) return null;
    let perfil;
    if (BASICOS.includes(nivel)) perfil = 'no_cumple';
    else if (nivel === 'tecnica') perfil = 'tecnica';
    else if (!estatus) return null;
    else if (nivel === 'licenciatura' && ['en_curso', 'trunco'].includes(estatus)) perfil = 'no_cumple';
    else {
      if (!normaliza(carrera)) return null;
      const c = (datos.carrera || []).find((x) => x.nombre_normalizado === normaliza(carrera));
      const grupo = c ? c.grupo : null;
      if (!grupo) perfil = 'por_clasificar';
      else if (grupo === 'no_afin') perfil = 'no_cumple';
      else if (nivel === 'licenciatura' && estatus === 'concluido') perfil = 'pasante';
      else perfil = ['principal', 'afin'].includes(grupo) ? 'licenciatura_afin' : 'disciplina_afin';
    }
    return { perfil, minimo: MINIMOS[perfil] || 5 }; // lo que decide el personal también pide 5 (decisión 2026-10-15)
  }
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
  function estado(texto, tono) { return el('span', { class: 'estado', 'data-tono': tono || null, texto }); }
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
        el('a', { class: 'btn-enlace', href: 'datos.html', texto: 'Mis datos' }),
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
  /* Hallazgo para el estándar (P47): el núcleo pone aria-required="true" en todos los controles de un campo
     obligatorio, también en el botón de la zona de carga, y un botón no admite ese atributo (axe:
     aria-allowed-attr). Se quita sólo ahí; lo obligatorio ya lo dicen el asterisco y el mensaje de error. */
  new MutationObserver((cambios) => {
    for (const c of cambios) if (c.target.matches && c.target.matches('button.zona-carga[aria-required]')) c.target.removeAttribute('aria-required');
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['aria-required'] });

  document.addEventListener('DOMContentLoaded', () => {
    ponIconos();
    cargar().then(pintaCorte).catch(() => { /* sin datos: cada pantalla lo dice en su lugar */ });
  });

  global.APD = {
    CONTRASENA_FICTICIA, ESTADOS, VIGENCIA, TIPOS, MODALIDADES, FINALES,
    cargar, fecha, fechaHora, sumaDias, sumaMeses,
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, nombreCompleto, nombreDeArchivo,
    solicitudesDe, acreditacionesDe, situacion, parametro, curso, sede, activa, limpia, opciones,
    el, estado, datosLista, pintaSesion, pintaCorte, ADSCRIPCIONES, adscripcionTexto, adscripcionDe,
    perfilAcademico, SUPERIORES
  };
}(window));
