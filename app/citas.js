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

  /* La búsqueda no se envía: Enter no hace nada más que filtrar */
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  FormKit.iniciar(form, {});

  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const diaLargo = (dia) => {
    const t = new Date(`${dia}T12:00:00-06:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'citas');
    for (const n of document.querySelectorAll('[data-sede]')) n.textContent = APD.sede(datos).nombre;
    const citas = P.citas(datos);
    const dias = [...new Set(citas.map((c) => P.diaDe(c.en)))].sort();
    const hoy = APD.hoy(datos);
    // De entrada, hoy si tiene citas; si no, el siguiente día con citas (o el último, si ya pasaron todas)
    const pedido = new URLSearchParams(location.search).get('dia');
    let dia = dias.includes(pedido) ? pedido : dias.find((d) => d >= hoy) || dias[dias.length - 1] || hoy;

    const filas = citas.map((c) => {
      const s = c.s;
      const p = c.p || {};
      const sit = P.SITUACION[c.situacion] || { texto: c.situacion, tono: '' };
      const texto = c.situacion === 'atendida' && p.numero_expediente ? `${sit.texto} · ${p.numero_expediente}` : sit.texto;
      const accion = c.pendiente
        ? el('a', { class: 'btn btn-secundario btn-chico', href: `cotejo.html?folio=${encodeURIComponent(s.folio)}`,
          'aria-label': `${c.situacion === 'pendiente' ? 'Atender' : 'Retomar'} la cita de ${APD.nombreCompleto(p)}`, texto: c.situacion === 'pendiente' ? 'Atender' : 'Retomar' })
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
      return { tr, hora, c, dia: P.diaDe(c.en), texto: norm([APD.nombreCompleto(p), p.curp, s.folio, p.numero_expediente].join(' ')) };
    });
    $('[data-filas]').replaceChildren(...filas.map((f) => f.tr));
    // El módulo tabla copia el encabezado a cada celda para leerla como ficha en teléfono
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

    const botones = Array.from(document.querySelectorAll('[data-ir]'));
    function pinta() {
      const q = norm(document.getElementById('buscar').value);
      let n = 0;
      let atendidas = 0;
      for (const f of filas) {
        const ve = q ? f.texto.includes(q) : f.dia === dia;
        f.tr.hidden = !ve;
        // Al buscar en todos los días, la hora lleva también la fecha
        f.hora.textContent = q ? `${APD.fecha(f.dia)} ${P.horaDe(f.c.en)}` : P.horaDe(f.c.en);
        if (ve) { n += 1; if (!f.c.pendiente) atendidas += 1; }
      }
      $('[data-col-hora]').textContent = q ? 'Fecha y hora' : 'Hora';
      $('[data-dia]').textContent = q ? 'Resultados en todos los días' : diaLargo(dia);
      $('[data-leyenda]').textContent = q ? 'Citas de cotejo que coinciden con la búsqueda' : `Citas de cotejo del ${diaLargo(dia).toLowerCase()}`;
      $('[data-flechas]').hidden = Boolean(q);
      const i = dias.indexOf(dia);
      botones[0].disabled = i <= 0;
      botones[1].disabled = i < 0 || i >= dias.length - 1;
      // El módulo tabla vuelve a leer los encabezados (la columna de la hora cambia de nombre)
      $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));
      $('[data-tabla-vacia]').hidden = !(q && n === 0);
      $('[data-cuenta]').textContent = q
        ? (n ? `${n === 1 ? 'Una cita coincide' : `${n} citas coinciden`} con la búsqueda.` : 'Ninguna cita coincide con la búsqueda.')
        : !n ? 'No hay citas este día.'
          : `${n === 1 ? '1 cita' : `${n} citas`}: ${atendidas === 1 ? '1 atendida' : `${atendidas} atendidas`} y ${n - atendidas} por atender.`;
    }
    for (const b of botones) {
      b.addEventListener('click', () => {
        const i = dias.indexOf(dia) + Number(b.dataset.ir);
        if (i < 0 || i >= dias.length) return;
        dia = dias[i];
        pinta();
      });
    }
    form.addEventListener('input', pinta);
    pinta();
  }).catch(() => {
    $('[data-cuenta]').textContent = 'No se pudieron cargar las citas. Intente de nuevo más tarde.';
  });
}());
