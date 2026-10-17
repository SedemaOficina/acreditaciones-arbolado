/* grupo.js · Un grupo (personal, etapa 2; maqueta aprobada y decisiones del 2026-10-17). ?folio=APD-G-…
   Situación, cupo, datos del curso y personas inscritas. Según la situación:
     · en integración: agregar personas de la espera, dar de baja, confirmar (con el mínimo: primer día al menos
       dias_anticipacion_grupo días después, hora de entrada e instructor) o cancelar;
     · confirmado: agregar personas hasta el día anterior al inicio (sin pasar del máximo), dar de baja (si queda por
       debajo del mínimo regresa a integración, con su fecha) o cancelar;
     · en curso: asistencia (instructor) y, el último día, el examen;
     · concluido o cancelado: sólo consulta.
   Dar de baja y cancelar piden motivo; las personas regresan a la espera con su antigüedad. La base vuelve a aplicar
   todo (apd.grupo_cambio, apd.inscripcion_alta, apd.inscripcion_cambio); en la prueba, app/archivos-prueba.js. */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);
  const params = new URLSearchParams(location.search);
  const ESTADO_SOLICITUD = { inscrita: ['Inscrita', ''], aprobada: ['Aprobada', 'ok'], acreditada: ['Acreditada', 'ok'], no_acreditada: ['No acreditada', 'error'], sin_derecho_examen: ['Sin derecho a examen', 'error'] };

  /* Aviso de lo que se acaba de hacer (llega en la dirección desde la espera o tras guardar aquí) */
  function avisoHecho() {
    const hecho = params.get('hecho');
    const n = Number(params.get('n')) || 0;
    const textos = {
      creado: `Grupo creado con ${plural(n, 'persona', 'personas')}. Todavía no está confirmado: se confirma cuando tenga al menos el mínimo de personas, con su fecha, hora de entrada e instructor.`,
      agregadas: `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} al grupo.`,
      confirmado: 'Grupo confirmado. Cada persona ya ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.',
      baja: 'La persona salió del grupo y regresó a la espera con su antigüedad.',
      baja_integracion: 'La persona salió del grupo. El grupo quedó por debajo del mínimo y dejó de estar confirmado; conserva su fecha, hora e instructor como propuesta. Vuelva a confirmarlo cuando se complete.',
      cancelado: 'Grupo cancelado. Las personas regresaron a la espera con su antigüedad.'
    };
    if (!textos[hecho]) return;
    const caja = $('[data-hecho]');
    $('.aviso-texto', caja).textContent = textos[hecho];
    caja.hidden = false;
    // Que recargar la página no repita el aviso
    params.delete('hecho'); params.delete('n');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }
  const vuelve = (folio, hecho) => { location.href = `grupo.html?folio=${encodeURIComponent(folio)}&hecho=${hecho}`; };

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const g0 = datos.grupo.find((g) => g.folio === params.get('folio'));
    if (!g0) { $('[data-bajada]').textContent = 'No se encontró el grupo. Vuelva a «Grupos».'; return; }
    avisoHecho();
    const x = P.grupo(datos, g0);
    const { g, c } = x;
    const hoy = APD.hoy(datos);
    const abierto = ['en_integracion', 'confirmado'].includes(g.estado);
    const antesDeIniciar = g.estado === 'en_integracion' || (g.estado === 'confirmado' && hoy < g.fecha_inicio);
    document.title = `Grupo ${g.folio} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-grupo').replaceChildren(document.createTextNode('Grupo '), el('span', { class: 'mono', texto: g.folio }));
    $('[data-bajada]').textContent = `${x.nombre} · ${g.integracion === 'especifico' ? `grupo de ${x.integracion.replace('De una organización · ', '')}` : 'grupo combinado'} · creado el ${fecha(g.creado_en)}`;
    $('[data-situacion]').replaceChildren(estado(x.situacion.texto, x.situacion.tono));

    /* Cupo */
    if (g.estado !== 'cancelado') {
      const falta = g.cupo_minimo - x.n;
      $('[data-cupo]').hidden = false;
      $('[data-cupo-texto]').textContent = `${x.n} de ${g.cupo_maximo} personas.${falta > 0 && abierto ? ` ${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.` : ''}`;
      $('[data-cupo-lleno]').style.width = `${Math.min(100, Math.round((x.n / g.cupo_maximo) * 100))}%`;
    }

    /* Datos del curso */
    const sede = APD.sede(datos).nombre;
    const pares = [];
    if (g.fecha_inicio) {
      pares.push(['Primer día', fecha(g.fecha_inicio)], ['Último día (examen)', fecha(x.ultimo)],
        ['Hora de entrada', g.hora_entrada || ''], ['Hora de salida', 'Por definir', 'el área la define (P91)'],
        ['Instructor', P.nombreInstructor(g.instructor)],
        ['Lugar del curso', `Aula de capacitación del ${sede}`], ['Lugar del examen', 'Salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio']);
      if (g.estado === 'en_integracion') pares.unshift(['Propuesta', 'Fecha, hora e instructor que tenía el grupo cuando dejó de estar confirmado; se confirman de nuevo abajo']);
    }
    if (g.estado === 'cancelado') pares.push(['Motivo de la cancelación', g.motivo_cancelacion || ''], ['Cancelado el', fecha(g.estado_desde)]);
    $('[data-datos]').replaceChildren(pares.length ? APD.datosLista(pares) : '');

    /* Personas */
    const conSituacion = ['en_curso', 'concluido'].includes(g.estado);
    const puedeBaja = antesDeIniciar;
    $('[data-encabezado]').replaceChildren(...['Persona', 'Folio de la solicitud', 'Adscripción', 'En el grupo desde', ...(conSituacion ? ['Situación'] : []), ...(puedeBaja ? ['Acción'] : [])]
      .map((t) => el('th', { scope: 'col' }, t === 'Acción' ? [el('span', { class: 'solo-lector', texto: t })] : [document.createTextNode(t)])));
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    // Un grupo cancelado muestra a quienes estaban al cancelarse
    const lista = g.estado === 'cancelado'
      ? datos.inscripcion.filter((i) => i.grupo_id === g.id && String(i.motivo_baja || '').startsWith('Grupo cancelado'))
      : x.inscritas;
    let bajaDe = null;
    const filas = lista.map((i) => {
      const s = sols[i.solicitud_id] || {};
      const p = persona[s.solicitante_id] || {};
      const quien = APD.nombreCompleto(p);
      const celdas = [
        el('td', { texto: quien }),
        el('td', {}, [el('span', { class: 'mono', texto: s.folio || '' })]),
        el('td', { texto: P.organizacionDe(datos, s) }),
        el('td', { texto: fecha(i.inscrita_en) })
      ];
      if (conSituacion) { const e = ESTADO_SOLICITUD[s.estado] || [APD.ESTADOS[s.estado] ? APD.ESTADOS[s.estado].texto : s.estado, '']; celdas.push(el('td', {}, [estado(e[0], e[1])])); }
      if (puedeBaja) {
        const b = el('button', { type: 'button', class: 'btn-enlace sin-corte', 'aria-label': `Dar de baja a ${quien}`, texto: 'Dar de baja' });
        b.addEventListener('click', () => {
          bajaDe = { folio: s.folio, quien, boton: b };
          const queda = x.n - 1;
          $('[data-baja-de]').textContent = `${quien} regresa a la espera con su antigüedad.${g.estado === 'confirmado' && queda < g.cupo_minimo ? ` El grupo queda con ${plural(queda, 'persona', 'personas')}, menos del mínimo de ${g.cupo_minimo}: deja de estar confirmado y conserva su fecha como propuesta.` : ''}`;
          $('#dlg-baja').showModal();
        });
        celdas.push(el('td', {}, [b]));
      }
      return el('tr', { 'data-folio': s.folio }, celdas);
    });
    $('[data-filas]').replaceChildren(...filas);
    $('[data-tabla-vacia]').hidden = filas.length > 0;
    $('[data-leyenda]').textContent = g.estado === 'cancelado' ? `Personas que estaban en el grupo ${g.folio} al cancelarse` : `Personas inscritas en el grupo ${g.folio}`;
    $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));
    $('[data-baja-ayuda]').hidden = !puedeBaja;

    /* Acciones del grupo */
    const acciones = [];
    if (x.recibe) {
      const espera = P.enEspera(datos, g.tipo_acreditacion, g.modalidad).length;
      if (espera) acciones.push(el('a', { class: 'btn btn-secundario', href: `espera.html?curso=${P.claveCurso(g.tipo_acreditacion, g.modalidad)}&grupo=${encodeURIComponent(g.folio)}`, texto: `Agregar personas de la espera (${espera} en espera)` }));
      else acciones.push(el('p', { class: 'texto-gris', texto: 'Nadie espera grupo en este curso por ahora.' }));
    } else if (abierto && x.n >= g.cupo_maximo) {
      acciones.push(el('p', { class: 'texto-gris', texto: `El grupo está lleno: ${g.cupo_maximo} personas.` }));
    } else if (g.estado === 'confirmado') {
      acciones.push(el('p', { class: 'texto-gris', texto: 'El curso ya empezó: el grupo no recibe más personas.' }));
    }
    if (g.estado === 'en_curso') {
      acciones.push(el('a', { class: 'btn btn-secundario', href: `asistencia.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Ver la asistencia' }));
      if (hoy === x.ultimo) acciones.push(el('a', { class: 'btn btn-secundario', href: 'aplicar.html', texto: 'Aplicar el examen' }));
    }
    let cancelar = null;
    if (antesDeIniciar) {
      cancelar = el('button', { type: 'button', class: 'btn btn-secundario', texto: 'Cancelar el grupo' });
      cancelar.addEventListener('click', () => {
        $('[data-cancelar-de]').textContent = `${x.n ? `${plural(x.n, 'persona regresa', 'personas regresan')} a la espera con su antigüedad.` : 'El grupo no tiene personas.'} Esta acción no se deshace.`;
        $('#dlg-cancelar').showModal();
      });
      acciones.push(cancelar);
    }
    $('[data-acciones]').replaceChildren(...acciones);

    /* Confirmar (en integración) */
    if (g.estado === 'en_integracion') {
      $('[data-confirmar]').hidden = false;
      const falta = g.cupo_minimo - x.n;
      const form = $('#confirmar');
      if (falta > 0) {
        $('[data-falta]').hidden = false;
        $('[data-falta] .aviso-texto').textContent = `${falta === 1 ? 'Falta 1 persona' : `Faltan ${falta} personas`} para el mínimo de ${g.cupo_minimo}: el grupo todavía no se puede confirmar. Ningún grupo abre con menos del mínimo.`;
        form.hidden = true;
      }
      const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
      const minimo = APD.sumaDias(hoy, anticipacion);
      const fi = $('#fecha_inicio');
      fi.setAttribute('min', minimo);
      // La propuesta de un grupo que regresó a integración se ofrece de nuevo
      if (g.fecha_inicio && g.fecha_inicio >= minimo) fi.value = g.fecha_inicio;
      if (g.hora_entrada) $('#hora_entrada').value = g.hora_entrada;
      if (g.instructor) $('#instructor').value = g.instructor;
      const ayudaFecha = () => {
        const base = `El curso empieza al menos ${anticipacion} días después de confirmar: desde el ${fecha(minimo)}. Dura ${plural(c.dias_duracion, 'día', 'días seguidos')}`;
        $('[data-ayuda-fecha]').textContent = fi.value && fi.value >= minimo ? `${base}: del ${fecha(fi.value)} al ${fecha(APD.sumaDias(fi.value, c.dias_duracion - 1))}.` : `${base}.`;
      };
      fi.addEventListener('input', ayudaFecha);
      fi.addEventListener('change', ayudaFecha);
      ayudaFecha();
      $('[data-lugar]').replaceChildren(document.createTextNode('Lugar: aula de capacitación del '), el('strong', { texto: sede }),
        document.createTextNode('; el examen, en el salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio.'));
      FormKit.iniciar(form, {
        enviar(payload) {
          const d = payload.datos;
          if (d.fecha_inicio < minimo) return Promise.reject({ errores: [{ campo: 'fecha_inicio', mensaje: `El curso debe empezar al menos ${anticipacion} días después de confirmar el grupo: desde el ${fecha(minimo)}.` }] });
          return P.guardaGrupo({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: d.fecha_inicio, hora_entrada: d.hora_entrada, instructor: d.instructor, por: P.REVISORA.usuario });
        },
        alEnviar() { vuelve(g.folio, 'confirmado'); },
        alFallar(err) { const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
      });
    }

    /* Dar de baja y cancelar: formularios del estándar en diálogos, con motivo */
    function dialogoConMotivo(id, alGuardar) {
      const form = $(`#${id}`);
      const dlg = $(`#dlg-${id}`);
      const inst = FormKit.iniciar(form, {
        enviar(payload) { return alGuardar(payload.datos.motivo); },
        alFallar(err) { const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
      });
      dlg.addEventListener('close', () => { form.reset(); inst.ctx.limpia('motivo'); });
      return dlg;
    }
    dialogoConMotivo('baja', (motivo) => P.guardaGrupo({ tipo: 'baja', grupo_id: g.id, folio: bajaDe.folio, motivo, por: P.REVISORA.usuario })
      .then(() => vuelve(g.folio, g.estado === 'confirmado' && x.n - 1 < g.cupo_minimo ? 'baja_integracion' : 'baja')))
      .addEventListener('close', () => { if (bajaDe && bajaDe.boton.isConnected) bajaDe.boton.focus(); });
    dialogoConMotivo('cancelar', (motivo) => P.guardaGrupo({ tipo: 'cancelar', grupo_id: g.id, motivo, por: P.REVISORA.usuario })
      .then(() => vuelve(g.folio, 'cancelado')))
      .addEventListener('close', () => { if (cancelar && cancelar.isConnected) cancelar.focus(); });
  }).catch(() => {
    $('[data-bajada]').textContent = 'No se pudo cargar el grupo. Intente de nuevo más tarde.';
  });
}());
