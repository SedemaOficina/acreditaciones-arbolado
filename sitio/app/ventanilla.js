/* ventanilla.js · «Ventanilla» del personal (registro asistido, decisión de Liber del 25/10/2026)

   Busca a una persona por CURP, nombre, folio de solicitud o número de expediente, y muestra en qué va cada trámite y qué
   sigue, en lenguaje sencillo y de tú, para decírselo de palabra (APD_ASISTIDO.queDecir, con los estados de «Mis
   trámites»). Para una persona del registro asistido, desde aquí se sigue capturando su solicitud, se le leen sus
   observaciones y se cargan por ella los documentos corregidos (solicitud.html?asistida=…&folio=…), o se captura una
   solicitud nueva. ?buscar=… abre con la búsqueda hecha; ?persona=<id>, con la ficha de esa persona.
   Lee los datos ficticios; en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el } = APD;
  const $ = (s) => document.querySelector(s);
  const form = document.getElementById('buscar-persona');
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  FormKit.iniciar(form, {});
  const entrada = document.getElementById('buscar');
  const norm = APD.normalizaBusqueda;

  function coincide(datos, p, q) {
    if (!q) return false;
    const folios = datos.solicitud.filter((s) => s.solicitante_id === p.id).map((s) => s.folio);
    const campos = [APD.nombreCompleto(p), p.curp, p.numero_expediente, ...folios].map(norm);
    return campos.some((c) => c && c.includes(q));
  }
  function buscar(datos) {
    const q = norm(entrada.value);
    const lista = $('[data-resultados]');
    if (q.length < 3) { APD.escribe($('[data-cuenta]'), 'Escriba al menos 3 caracteres para buscar.'); lista.hidden = true; lista.replaceChildren(); return []; }
    const halladas = datos.solicitante.filter((p) => coincide(datos, p, q)).slice(0, 10);
    APD.escribe($('[data-cuenta]'), halladas.length ? `${APD.plural(halladas.length, 'persona encontrada', 'personas encontradas')}.` : 'Nadie coincide con la búsqueda. Revise lo que escribió.');
    lista.replaceChildren(...halladas.map((p) => {
      const b = el('button', { type: 'button', class: 'btn btn-secundario' }, [document.createTextNode('Ver su trámite'), el('span', { class: 'solo-lector', texto: `: ${APD.nombreCompleto(p)}` })]);
      b.addEventListener('click', () => ficha(datos, p, true));
      return el('li', { class: 'ficha' }, [
        el('div', { class: 'ficha-cabeza' }, [el('h3', { class: 'ficha-titulo', texto: APD.nombreCompleto(p) }), cuentaDe(p)]),
        APD.lineaDatos([p.curp, p.telefono ? `Teléfono ${APD.telefonoTexto(p.telefono)}` : null]),
        el('div', { class: 'ficha-acciones' }, [b])
      ]);
    }));
    lista.hidden = !halladas.length;
    return halladas;
  }
  /* Qué cuenta tiene: del registro asistido (sin activar o activada), en línea o del registro anterior sin activar */
  function cuentaDe(p) {
    if (APD.asistidaSinActivar(p)) return APD.estado('Registro asistido · avisos por teléfono', 'marcha');
    if (APD.esAsistida(p)) return APD.estado('Registro asistido · ya activó su cuenta', 'ok');
    if (p.estado === 'sin_activar') return APD.estado('Registro anterior · sin cuenta en línea', 'cerrado');
    if (p.estado === 'bloqueada') return APD.estado('Cuenta bloqueada', 'error');
    return APD.estado('Cuenta en línea', 'ok');
  }
  const enlace = (href, texto, extra) => el('a', { class: 'btn btn-primario', href }, [document.createTextNode(texto), el('span', { class: 'solo-lector', texto: extra })]);

  function tramite(datos, p, s) {
    const asistida = APD.esAsistida(p) && p.estado === 'activa';
    const destino = `solicitud.html?asistida=${encodeURIComponent(p.id)}&folio=${encodeURIComponent(s.folio)}`;
    const accion = !asistida ? null
      : s.estado === 'con_observaciones' ? enlace(destino, 'Leerle lo que falta y cargar lo corregido', `: solicitud ${s.folio}`)
        : s.estado === 'borrador' ? enlace(destino, 'Seguir capturando su solicitud', `: ${s.folio}`) : null;
    const dichos = APD_ASISTIDO.queDecir(datos, s);
    return el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [el('h3', { class: 'ficha-titulo', texto: APD.TIPOS[s.tipo_acreditacion] || s.tipo_acreditacion }), APD.estadoSolicitud(s, true)]),
      APD.lineaDatos([s.folio, APD.MODALIDADES[s.modalidad], s.enviada_en ? `Enviada el ${APD.fechaCorta(s.enviada_en)}` : 'Sin enviar',
        s.capturada_por ? 'Capturada en el Vivero' : null]),
      el('div', { class: 'ficha-sigue' }, [el('p', {}, [el('strong', { texto: 'Qué decirle:' })]), ...dichos.map((t) => el('p', { texto: t }))]),
      accion ? el('div', { class: 'ficha-acciones' }, [accion]) : null
    ]);
  }
  function ficha(datos, p, enfoca) {
    const caja = $('[data-ficha]');
    $('[data-ficha-nombre]').textContent = APD.nombreCompleto(p);
    $('[data-ficha-datos]').replaceChildren(el('p', {}, [cuentaDe(p)]), APD.datosLista([
      ['CURP', p.curp], ['Teléfono', APD.telefonoTexto(p.telefono)], ['Correo electrónico', p.correo || 'No tiene'],
      ['Expediente', p.numero_expediente || ''], ['Registrada en el Vivero', p.registro_asistido_en ? APD.fechaCorta(p.registro_asistido_en, { hora: true }) : '']
    ]));
    // Los avisos por teléfono que tiene pendientes: si está en la ventanilla, se le dicen aquí
    const pend = APD.asistidaSinActivar(p) ? APD_ASISTIDO.pendientes(datos).filter((a) => a.solicitante_id === p.id) : [];
    $('[data-ficha-avisos]').replaceChildren(...(pend.length ? [el('div', { class: 'aviso aviso-advertencia' }, [APD.icono('alerta'), el('div', { class: 'aviso-texto' }, [
      el('strong', { class: 'aviso-titulo', texto: pend.length === 1 ? 'Tiene un aviso por teléfono pendiente' : `Tiene ${pend.length} avisos por teléfono pendientes` }),
      el('p', {}, [document.createTextNode('Si está aquí, dígaselo y regístrelo en la lista de '), el('a', { href: 'revision.html#t-avisos-tel', texto: 'avisos por teléfono pendientes' }), document.createTextNode('.')])])])] : []));
    const sols = APD.solicitudesDe(datos, p);
    const activas = sols.filter((s) => APD.activa(s));
    const cajaTramites = $('[data-ficha-tramites]');
    const hijos = sols.length ? sols.map((s) => tramite(datos, p, s)) : [el('p', { class: 'vacio', texto: 'No tiene solicitudes.' })];
    // Una persona del registro asistido sin trámite en curso de algún tipo que pueda pedir hoy: capturar una nueva
    if (APD.esAsistida(p) && p.estado === 'activa') {
      const op = APD.opciones(datos, p);
      const puede = ['poda', 'dictaminador'].filter((t) => op[t] && op[t].disponible && !activas.some((s) => s.tipo_acreditacion === t));
      if (puede.length) hijos.push(el('div', { class: 'acciones acciones-izq' }, [el('a', { class: 'btn btn-secundario', href: `solicitud.html?asistida=${encodeURIComponent(p.id)}` }, [document.createTextNode('Capturar una solicitud nueva'), el('span', { class: 'solo-lector', texto: `: ${APD.nombreCompleto(p)}` })])]));
    }
    cajaTramites.replaceChildren(...hijos);
    caja.hidden = false;
    if (enfoca) $('[data-ficha-nombre]').focus();
  }

  APD.cargar().then((datos) => {
    APD_PERSONAL.pintaSesion($('[data-sesion-personal]'), 'ventanilla');
    const u = new URLSearchParams(location.search);
    if (u.get('buscar')) { entrada.value = u.get('buscar'); APD.avisa(entrada); }
    let ultimos = buscar(datos);
    const porId = u.get('persona') && datos.solicitante.find((p) => p.id === u.get('persona'));
    if (porId) ficha(datos, porId, false);
    else if (ultimos.length === 1 && u.get('buscar')) ficha(datos, ultimos[0], false);
    let t = 0;
    entrada.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => APD.cargar().then((d) => { ultimos = buscar(d); }), 150); });
  }).catch(() => APD.escribe($('[data-cuenta]'), 'No se pudo cargar la información. Recargue la página.'));
}());
