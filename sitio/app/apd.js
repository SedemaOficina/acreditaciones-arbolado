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
    enviada: { texto: 'En revisión', tono: '', sigue: 'La Secretaría revisa tus documentos.' },
    con_observaciones: { texto: 'Con observaciones', tono: 'pend', sigue: 'Corrige lo que se indica abajo y vuelve a enviar tu solicitud.' },
    validada_en_linea: { texto: 'Cita asignada', tono: 'pend', sigue: 'Acude a tu cita con los mismos documentos que cargaste, impresos, y con tu comprobante de pago.' },
    lista_para_curso: { texto: 'En espera de grupo', tono: '', sigue: 'Tu expediente está completo. La Secretaría te asignará un grupo de curso.' },
    inscrita: { texto: 'Con grupo asignado', tono: 'ok', sigue: 'Asiste a tu curso en las fechas indicadas.' },
    aprobada: { texto: 'Aprobada', tono: 'ok', sigue: 'La Secretaría emite tu acreditación.' },
    acreditada: { texto: 'Acreditación emitida', tono: 'ok', sigue: 'Recoge tu acreditación en persona.' },
    no_acreditada: { texto: 'No acreditada', tono: 'error', sigue: 'No alcanzaste la calificación mínima. Puedes iniciar una solicitud nueva.' },
    sin_derecho_examen: { texto: 'Sin derecho a examen', tono: 'error', sigue: 'No alcanzaste la asistencia mínima. Puedes iniciar una solicitud nueva.' },
    cancelada: { texto: 'Cancelada', tono: '', sigue: '' },
    concluida_sin_atender: { texto: 'Concluida sin atender', tono: '', sigue: 'Las observaciones no se atendieron a tiempo. Puedes iniciar una solicitud nueva.' }
  };
  const FINALES = ['acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender'];

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
    if (s.nueva) return Object.assign({ id: 'nueva', estado: 'activa' }, s.nueva);
    return datos.solicitante.find((p) => p.id === s.id) || null;
  }
  function requiereSesion(datos) {
    const p = personaDeSesion(datos);
    if (!p) { global.location.replace(`entrar.html?volver=${encodeURIComponent(global.location.pathname.split('/').pop())}`); return null; }
    return p;
  }
  function nombreCompleto(p) { return [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '); }

  /* ----- Consultas sobre los datos exportados ----- */
  const deTabla = (datos, tabla, campo, valor) => datos[tabla].filter((f) => f[campo] === valor);
  function solicitudesDe(datos, persona) { return deTabla(datos, 'solicitud', 'solicitante_id', persona.id).sort((a, b) => (b.creada_en || '').localeCompare(a.creada_en || '')); }
  function acreditacionesDe(datos, persona) { return deTabla(datos, 'acreditacion', 'solicitante_id', persona.id).sort((a, b) => b.emitida_en.localeCompare(a.emitida_en)); }
  function situacion(datos, acreditacion) { return datos.estado_acreditacion[acreditacion.numero]; }
  function parametro(datos, clave) { const p = datos.parametro.find((x) => x.clave === clave); return p ? Number(p.valor) : null; }
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
  function datosLista(pares) {
    return el('dl', { class: 'datos' }, pares.filter((p) => p[1]).map(([etq, valor]) =>
      el('div', { class: 'datos-par' }, [el('dt', { class: 'datos-etq', texto: etq }), el('dd', { class: 'datos-valor', texto: valor })])));
  }

  /* Cabecera de sesión en las pantallas con cuenta */
  function pintaSesion(contenedor, persona) {
    if (!contenedor) return;
    const salir = el('button', { type: 'button', class: 'btn-enlace', texto: 'Salir' });
    salir.addEventListener('click', () => { cierraSesion(); global.location.href = 'index.html'; });
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre', texto: nombreCompleto(persona) }),
      el('div', { class: 'sesion-enlaces' }, [el('a', { class: 'btn-enlace', href: 'tramites.html', texto: 'Mis trámites' }), salir])
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
    leeSesion, guardaSesion, cierraSesion, personaDeSesion, requiereSesion, nombreCompleto,
    solicitudesDe, acreditacionesDe, situacion, parametro, curso, activa, limpia, opciones,
    el, estado, datosLista, pintaSesion, pintaCorte
  };
}(window));
