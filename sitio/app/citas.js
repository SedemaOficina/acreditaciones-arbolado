/* citas.js · «Citas de cotejo» (personal, etapa 2): la agenda del día, por hora, con la situación de cada cita.
   Se pasa de un día con citas al anterior o al siguiente; la búsqueda (nombre, CURP, folio o expediente) busca en
   todos los días. «Atender» lleva a cotejo.html; una cita en pausa se retoma cuando la persona cargó el documento.
   Lee los datos ficticios y lo registrado en la prueba (APD.cargar); en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el, estado } = APD;
  const P = APD_PERSONAL;
  const form = document.getElementById('filtros');
  const $ = (s) => document.querySelector(s);

  /* La búsqueda no se envía: Enter no hace nada más que filtrar (en ese momento, sin esperar la pausa: D4-04) */
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); filtraYa(); }, true);
  FormKit.iniciar(form, {});

  const norm = APD.normalizaBusqueda;
  /* El día de la agenda es su encabezado: fecha larga (decisión 16 b), «Miércoles 14 de octubre de 2026» */
  const diaLargo = (dia) => APD.fechaLarga(dia, { mayuscula: true });

  /* La agenda se vuelve a leer cuando la persona carga un documento en otra pestaña, cuando otra pestaña guarda algo o al
     volver a esta (auditoría «intentar romperlo», F2 B1: seguía «En pausa · esperando el documento» hasta recargar). Se
     conservan el día y la búsqueda. */
  let dia = null;
  let filas = [];
  let dias = [];
  let primera = true;
  const botones = Array.from(document.querySelectorAll('[data-ir]'));
  function carga() {
    return APD.cargar().then((datos) => {
      if (primera) {
        P.pintaSesion($('[data-sesion-personal]'), 'citas');
        for (const n of document.querySelectorAll('[data-sede]')) n.textContent = APD.sede(datos).nombre;
      }
      const citas = P.citas(datos);
      dias = [...new Set(citas.map((c) => P.diaDe(c.en)))].sort();
      const hoy = APD.hoy(datos);
      // De entrada, hoy si tiene citas; si no, el siguiente día con citas (o el último, si ya pasaron todas)
      if (primera) {
        const pedido = new URLSearchParams(location.search).get('dia');
        dia = dias.includes(pedido) ? pedido : dias.find((d) => d >= hoy) || dias[dias.length - 1] || hoy;
      }
      primera = false;

      filas = citas.map((c) => {
        const s = c.s;
        const p = c.p || {};
        const sit = P.SITUACION[c.situacion] || { texto: c.situacion, tono: '' };
        const texto = c.situacion === 'atendida' && p.numero_expediente ? `${sit.texto} · ${p.numero_expediente}` : sit.texto;
        // Una cita de un día que todavía no llega se atiende ese día (F2 A6): «Ver la cita», no «Atender»
        const futura = P.diaDe(c.en) > hoy;
        const verbo = futura ? 'Ver la cita' : ['pendiente', 'sin_registrar'].includes(c.situacion) ? 'Atender' : 'Retomar';
        const accion = c.pendiente
          ? el('a', { class: 'btn btn-secundario btn-chico', href: `cotejo.html?folio=${encodeURIComponent(s.folio)}`,
            'aria-label': futura ? `Ver la cita de ${APD.nombreCompleto(p)}: se atiende el ${APD.fechaCorta(c.en)}` : `${verbo} la cita de ${APD.nombreCompleto(p)}`, texto: verbo })
          : el('span', { class: 'texto-gris', texto: '—' });
        const hora = el('td', { texto: P.horaDe(c.en) });
        const tr = el('tr', { 'data-folio': s.folio, class: c.pendiente ? null : 'fila-hecha' }, [
          hora,
          el('td', { texto: APD.nombreCompleto(p) }),
          el('td', {}, [el('span', { class: 'mono', texto: s.folio })]),
          el('td', { texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${s.modalidad === 'renovacion' ? 'renovación' : 'nueva'}` }),
          el('td', {}, [estado(texto, sit.tono)]),
          el('td', {}, [accion])
        ]);
        // Las dos formas de la hora se arman una vez, no en cada tecla (D4-04)
        return { tr, hora, c, dia: P.diaDe(c.en), texto: norm([APD.nombreCompleto(p), p.curp, s.folio, p.numero_expediente].join(' ')),
          horaSola: APD.hora(c.en), horaConFecha: APD.fechaCorta(c.en, { hora: true }), conFecha: false };
      });
      $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));

      /* Citas de días anteriores sin registrar (auditoría de tareas, A3): arriba, con un botón por día. Sin registrar si
         la persona se presentó, no recibe cita nueva ni cuenta su inasistencia. */
      const previa = document.querySelector('[data-atrasadas]');
      if (previa) previa.remove();
      const sinRegistrar = citas.filter((c) => c.situacion === 'sin_registrar');
      const porDia = [...new Set(sinRegistrar.map((c) => P.diaDe(c.en)))].sort();
      if (sinRegistrar.length) {
        const caja = el('div', { 'data-atrasadas': '' });
        $('[data-cuenta]').before(caja);
        const ir = porDia.map((d) => {
          const n = sinRegistrar.filter((c) => P.diaDe(c.en) === d).length;
          const b = el('button', { type: 'button', class: 'btn btn-secundario', texto: `Ver el ${APD.fechaCorta(d)} (${n})` });
          b.addEventListener('click', () => { document.getElementById('buscar').value = ''; dia = d; pinta('dia'); $('[data-dia]').scrollIntoView({ block: 'start' }); });
          return b;
        });
        // Es un estado de la página, no una alerta (auditoría 2026-10-20, como RI-09 en «Asistencia»): se ve igual, pero sin
        // role="alert", que lo hacía sonar en cada carga y cada vez que la agenda se vuelve a pintar. FormKit.aviso da el rol
        // por el tono y no tiene uno de bloqueo sin anuncio (nota del revisor independiente sobre el estándar).
        const atrasadas = FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'bloqueo', titulo: `${sinRegistrar.length === 1 ? '1 cita de un día anterior está' : `${sinRegistrar.length} citas de días anteriores están`} sin registrar`,
          texto: [el('p', { texto: 'Registre si cada persona se presentó: sin eso no recibe cita nueva y su inasistencia no cuenta.' }), el('div', { class: 'acciones-grupo' }, ir)] });
        atrasadas.removeAttribute('role');
        caja.append(atrasadas);
      }
      // El módulo tabla copia el encabezado a cada celda para leerla como ficha en teléfono
      $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));
      pinta();
    });
  }
  /* Encabezado del día por resultado de la cita (decisión 7 de la auditoría del 2026-10-19, Liber; B2-01): «8 citas: 7
     atendidas, 1 no se presentó». «Atendida» es sólo la cita con ese resultado (apd.cita.resultado), no toda la que ya se
     cerró; las abiertas (también las de un día anterior sin registrar) van «por atender». */
  const DESGLOSE_DE = { cerrada: 'no_se_presento' };
  const DESGLOSE = [
    ['atendida', '1 atendida', (k) => `${k} atendidas`],
    ['con_observaciones', '1 regresó con observaciones', (k) => `${k} regresaron con observaciones`],
    ['no_se_presento', '1 no se presentó', (k) => `${k} no se presentaron`],
    ['sin_pago', '1 sin pago', (k) => `${k} sin pago`],
    ['pausa_vencida', '1 pausa vencida', (k) => `${k} pausas vencidas`],
    ['no_es_la_persona', '1 no era la persona', (k) => `${k} no eran la persona`],
    ['cancelada', '1 cancelada', (k) => `${k} canceladas`],
    ['pendiente', '1 por atender', (k) => `${k} por atender`],
    // Una cita en pausa espera el documento de la persona: no se cuenta «por atender» (auditoría 2026-10-20, C4-08)
    ['en_pausa', '1 en pausa', (k) => `${k} en pausa`]
  ];
  const desglose = (cuenta) => DESGLOSE.filter(([k]) => cuenta[k]).map(([k, uno, varios]) => (cuenta[k] === 1 ? uno : varios(cuenta[k])))
    .concat(Object.keys(cuenta).filter((k) => !DESGLOSE.some(([x]) => x === k)).map((k) => `${cuenta[k]} ${(P.SITUACION[k] || { texto: k }).texto.toLowerCase()}`))
    .join(', ');
  /* Un anuncio por acción (auditoría 2026-10-20, B4-03 y RI-04): el título del día y la cuenta se ven, pero no son
     regiones vivas; al cambiar de día se anuncia una sola vez el día con su cuenta y, al buscar, la cuenta cuando se deja
     de escribir (una pausa, no en cada tecla). Al cargar no se anuncia nada. */
  const PAUSA_BUSQUEDA = 700;
  const CLAVE_BUSQUEDA = 'apd.citas.buscar';
  /* Lo que se trae de la dirección y de esta pestaña: «Por atender» (?ver=) y la búsqueda (C1-07, C4-03) */
  {
    const ver = new URLSearchParams(location.search).get('ver');
    if (ver === 'por-atender') document.getElementById('ver').value = ver;
    // Sólo al volver con «Atrás» o al recargar; si se llega de nuevo (desde el menú), la agenda empieza sin búsqueda
    const nav = (performance.getEntriesByType('navigation')[0] || {}).type;
    try { const b = sessionStorage.getItem(CLAVE_BUSQUEDA); if (b && ['back_forward', 'reload'].includes(nav)) document.getElementById('buscar').value = b; } catch (e) { /* sin almacenamiento */ }
  }
  let esperaBusqueda = null;
  /* Mientras se escribe, se filtra cuando se deja de teclear 150 ms (auditoría 2026-10-20, D4-04; propuesta del revisor):
     así cada tecla responde enseguida y la agenda se vuelve a pintar una vez, no en cada letra. El anuncio sigue llegando
     700 ms después de la última tecla (B4-03 y RI-04): al filtrar se espera lo que falta de esa pausa. La búsqueda se
     guarda en la pestaña en cada tecla (C4-03), sin esperar. */
  const ESPERA_FILTRO = 150;
  let esperaFiltro = null;
  function guardaBusqueda() {
    const v = document.getElementById('buscar').value;
    try { if (norm(v)) sessionStorage.setItem(CLAVE_BUSQUEDA, v); else sessionStorage.removeItem(CLAVE_BUSQUEDA); } catch (e) { /* sin almacenamiento */ }
  }
  function alEscribir() {
    guardaBusqueda();
    clearTimeout(esperaFiltro);
    esperaFiltro = setTimeout(() => { esperaFiltro = null; pinta('busqueda', PAUSA_BUSQUEDA - ESPERA_FILTRO); }, ESPERA_FILTRO);
  }
  function filtraYa() { if (esperaFiltro) { clearTimeout(esperaFiltro); esperaFiltro = null; pinta('busqueda'); } }
  function pinta(origen, pausaAnuncio = PAUSA_BUSQUEDA) {
    // Un filtro pendiente se cancela: esta vuelta ya pinta lo último (un cambio de día, «Por atender» o una recarga)
    clearTimeout(esperaFiltro);
    esperaFiltro = null;
    const q = norm(document.getElementById('buscar').value);
    const porAtender = document.getElementById('ver').value === 'por-atender';
    // El día elegido queda en la dirección (?dia=): al volver del cotejo, con «Atrás» o al recargar, la agenda sigue en
    // ese día (auditoría 2026-10-18, B8); también «Por atender» (?ver=, C1-07)
    const url = new URL(location.href);
    const antes = url.search;
    url.searchParams.set('dia', dia);
    if (porAtender) url.searchParams.set('ver', 'por-atender'); else url.searchParams.delete('ver');
    if (url.search !== antes) history.replaceState(null, '', url);
    // La búsqueda se conserva en esta pestaña (sessionStorage), no en la dirección: puede llevar un nombre o una CURP, que
    // no deben quedar en el historial ni en el registro del servidor (auditoría 2026-10-20, C4-03)
    guardaBusqueda();
    /* Cada tecla de la búsqueda sólo cambia lo que cambió (auditoría 2026-10-20, D4-04: con 70 citas y el procesador 4×
       más lento tardaba de 472 a 568 ms en pintarse). Antes, en cada tecla se reescribía la hora de todas las filas y el
       módulo tabla volvía a leer los encabezados y a preparar todas las celdas; ahora la hora se reescribe y la tabla se
       vuelve a preparar sólo cuando se pasa del día a la búsqueda o de regreso (la columna cambia de nombre). */
    let n = 0;
    const cuenta = {};
    const conFecha = Boolean(q);
    for (const f of filas) {
      const ve = (q ? f.texto.includes(q) : f.dia === dia) && (!porAtender || f.c.pendiente);
      if (f.tr.hidden !== !ve) f.tr.hidden = !ve;
      // Al buscar en todos los días, la hora lleva también la fecha. El módulo tabla pone el contenido de cada celda en
      // .tabla-valor: el texto va ahí, para no quitarlo
      if (f.conFecha !== conFecha || !f.horaPintada) {
        const destino = f.hora.firstElementChild && f.hora.firstElementChild.classList.contains('tabla-valor') ? f.hora.firstElementChild : f.hora;
        destino.textContent = conFecha ? f.horaConFecha : f.horaSola;
        f.conFecha = conFecha;
        f.horaPintada = true;
      }
      // En pausa por su resultado (apd.cita.resultado), también con el documento ya cargado («retomar»); la pausa vencida va
      // aparte (C4-08)
      if (ve) { n += 1; const k = f.c.pendiente && f.c.cita.resultado === 'en_pausa' ? 'en_pausa' : f.c.pendiente ? 'pendiente' : (DESGLOSE_DE[f.c.situacion] || f.c.situacion); cuenta[k] = (cuenta[k] || 0) + 1; }
    }
    const columna = q ? 'Fecha y hora' : 'Hora';
    const cambiaColumna = $('[data-col-hora]').textContent !== columna;
    if (cambiaColumna) $('[data-col-hora]').textContent = columna;
    pon($('[data-dia]'), q ? 'Resultados en todos los días' : diaLargo(dia));
    pon($('[data-leyenda]'), q ? 'Citas de cotejo que coinciden con la búsqueda' : `Citas de cotejo del ${APD.fechaLarga(dia)}`);
    $('[data-flechas]').hidden = Boolean(q);
    const i = dias.indexOf(dia);
    // En el primer o el último día con citas el botón queda inactivo con aria-disabled, no con disabled: conserva el foco
    // y el lector lo dice «no disponible» (auditoría 2026-10-20, RI-02; como programar.js con sus botones de envío)
    inactivo(botones[0], i <= 0);
    inactivo(botones[1], i < 0 || i >= dias.length - 1);
    // El módulo tabla vuelve a leer los encabezados cuando la columna de la hora cambia de nombre (sólo entonces: D4-04)
    if (cambiaColumna) $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));
    $('[data-tabla-vacia]').hidden = n > 0 || !(q || porAtender);
    pon($('[data-tabla-vacia]'), q ? 'Ninguna cita coincide con la búsqueda. Revise lo que escribió.' : 'Todas las citas de este día ya tienen resultado.');
    const textoCuenta = q
      ? (n ? `${n === 1 ? 'Una cita coincide' : `${n} citas coinciden`} con la búsqueda${porAtender ? ' y está por atender' : ''}.` : `Ninguna cita${porAtender ? ' por atender' : ''} coincide con la búsqueda.`)
      : !n ? (porAtender ? 'No quedan citas por atender este día.' : 'No hay citas este día.')
        : `${n === 1 ? '1 cita' : `${n} citas`}${porAtender ? ' sin resultado' : ''}: ${desglose(cuenta)}.`;
    pon($('[data-cuenta]'), textoCuenta);
    clearTimeout(esperaBusqueda);
    if (origen === 'dia') FormKit.anuncia(`${diaLargo(dia)}: ${textoCuenta}`);
    else if (origen === 'busqueda') esperaBusqueda = setTimeout(() => FormKit.anuncia(q ? textoCuenta : `${diaLargo(dia)}: ${textoCuenta}`), pausaAnuncio);
  }
  /* Un texto sólo se escribe si cambió (D4-04) */
  function pon(nodo, texto) { if (nodo.textContent !== texto) nodo.textContent = texto; }
  function inactivo(b, si) { if (si) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }
  for (const b of botones) {
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      const i = dias.indexOf(dia) + Number(b.dataset.ir);
      if (i < 0 || i >= dias.length) return;
      dia = dias[i];
      pinta('dia');
    });
  }
  form.addEventListener('input', (e) => { if (e.target.id === 'ver') pinta('dia'); else alEscribir(); });
  APD.alCambiar(() => { carga().catch(() => {}); });

  carga().catch(() => {
    FormKit.anuncia('No se pudieron cargar las citas. Intente de nuevo más tarde.', { visible: $('[data-cuenta]') });
  });
}());
