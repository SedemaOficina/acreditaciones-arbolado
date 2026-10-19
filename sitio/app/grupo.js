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
  const plural = APD.plural;
  const params = new URLSearchParams(location.search);
  // «Inscrita»: el curso está en marcha, no terminado (auditoría 2026-10-18, D6)
  const ESTADO_SOLICITUD = { inscrita: ['Inscrita', 'marcha'], aprobada: ['Aprobada', 'ok'], acreditada: ['Acreditada', 'ok'], no_acreditada: ['No acreditada', 'error'], sin_derecho_examen: ['Sin derecho a examen', 'error'] };

  /* Aviso de lo que se acaba de hacer (llega en la dirección desde la espera o tras guardar aquí) */
  function avisoHecho() {
    const hecho = params.get('hecho');
    const n = Number(params.get('n')) || 0;
    // [tono, título, texto]: aviso con título e icono (propuesta «Avisos y confirmaciones», 2026-10-17)
    const textos = {
      creado: ['ok', `Grupo creado con ${plural(n, 'persona', 'personas')}`, { texto: 'Todavía no está confirmado.', pasos: [
        'Complete al menos el mínimo de personas.', 'Elija el primer día, la hora de entrada y el instructor.', 'Confirme el grupo: cada persona ve las fechas en «Mis trámites».'] }],
      // Las que de verdad entraron; las que no, aparte (auditoría «intentar romperlo», F3 M1)
      agregadas: [params.get('no') ? 'pend' : 'ok', `${n === 1 ? 'Se agregó 1 persona' : `Se agregaron ${n} personas`} al grupo`,
        params.get('no') ? `${params.get('no').split(',').length === 1 ? '1 de las que eligió no entró: ya tenía grupo o el grupo se llenó' : `${params.get('no').split(',').length} de las que eligió no entraron: ya tenían grupo o el grupo se llenó`}.` : ''],
      confirmado: ['ok', 'Grupo confirmado', 'Cada persona ya ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.'],
      baja: ['ok', 'La persona salió del grupo', 'Regresó a la espera con su antigüedad.'],
      baja_integracion: ['pend', 'El grupo dejó de estar confirmado', { texto: 'La persona salió y el grupo quedó por debajo del mínimo. Conserva su fecha, hora e instructor como propuesta.', pasos: [
        'Agregue personas hasta completar el mínimo.', 'Vuelva a confirmar el grupo.'] }],
      cancelado: ['info', 'Grupo cancelado', 'Las personas regresaron a la espera con su antigüedad.']
    };
    if (!textos[hecho]) return;
    const [tono, titulo, texto] = textos[hecho];
    APD.pintaAviso($('[data-hecho]'), tono, titulo, texto, true);
    // Que recargar la página no repita el aviso
    params.delete('hecho'); params.delete('n'); params.delete('no');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }
  const vuelve = (folio, hecho) => { location.href = `grupo.html?folio=${encodeURIComponent(folio)}&hecho=${hecho}`; };
  /* Un cambio que la base no aplicó (bloque 2): el aviso del formulario lo dice, con el enlace para ver el grupo como está */
  const noSeHizo = (titulo, motivo) => APD.rechazo(titulo, `${motivo.charAt(0).toLocaleUpperCase('es-MX')}${motivo.slice(1)}. Lo que escribió sigue aquí.`,
    { href: location.pathname.split('/').pop() + location.search, texto: 'Ver el grupo como está ahora' }, 'conflicto');

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const g0 = datos.grupo.find((g) => g.folio === params.get('folio'));
    if (!g0) { $('[data-bajada]').textContent = 'No se encontró el grupo. Vuelva a «Grupos».'; return; }
    avisoHecho();
    const x = P.grupo(datos, g0);
    const { g, c } = x;
    const deAhora = (d) => d.grupo.find((y) => y.id === g.id);
    const hoy = APD.hoy(datos);
    const abierto = ['en_integracion', 'confirmado'].includes(g.estado);
    const antesDeIniciar = g.estado === 'en_integracion' || (g.estado === 'confirmado' && hoy < g.fecha_inicio);
    // Nombre calculado y, debajo, el folio en chico (propuesta D, 2026-10-18): el folio no cambia
    document.title = `${x.calculado} · ${g.folio} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-grupo').replaceChildren(APD.grupoTitulo(g, datos));
    $('[data-bajada]').replaceChildren(APD.lineaDatos([x.nombre, g.integracion === 'especifico' ? `grupo de ${x.integracion.replace('De una organización · ', '')}` : 'grupo combinado', `creado el ${fecha(g.creado_en)}`]));
    $('[data-situacion]').replaceChildren(estado(x.situacion.texto, x.situacion.tono));

    /* Cupo */
    if (g.estado !== 'cancelado') {
      const falta = g.cupo_minimo - x.n;
      $('[data-cupo]').hidden = false;
      // Hasta cuándo recibe y cuántos lugares quedan (auditoría de tareas, M10)
      const hasta = x.recibe && g.estado === 'confirmado' ? ` Recibe personas hasta el ${fecha(APD.sumaDias(g.fecha_inicio, -1))}; ${x.lugar === 1 ? 'queda 1 lugar' : `quedan ${x.lugar} lugares`}.` : '';
      $('[data-cupo-texto]').textContent = `${x.n} de ${g.cupo_maximo} personas.${falta > 0 && abierto ? ` ${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para el mínimo de ${g.cupo_minimo}.` : ''}${hasta}`;
      $('[data-cupo-lleno]').style.width = `${Math.min(100, Math.round((x.n / g.cupo_maximo) * 100))}%`;
    }

    /* Datos del curso */
    const sede = APD.sede(datos).nombre;
    const pares = [];
    if (g.fecha_inicio) {
      pares.push(['Primer día', fecha(g.fecha_inicio)], ['Último día (examen)', fecha(x.ultimo)],
        ['Hora de entrada', APD.hhmm(g.hora_entrada)], ['Hora de salida', 'Por definir', 'el área la define (P91)'],
        ['Instructor', P.nombreInstructor(g.instructor)],
        ['Lugar del curso', `Aula de capacitación del ${sede}`], ['Lugar del examen', 'Salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio']);
      // Texto neutro: la fecha puede venir de «Guardar sin confirmar» o de un grupo que dejó de estar confirmado
      // (auditoría «intentar romperlo», F3 M7)
      if (g.estado === 'en_integracion') pares.unshift(['Propuesta', 'Fecha, hora e instructor propuestos, todavía sin confirmar; se confirman abajo']);
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
      if (conSituacion) { const e = ESTADO_SOLICITUD[s.estado] || [APD.nombrePersonal(s.estado), (APD.ESTADOS[s.estado] || {}).tono || '']; celdas.push(el('td', {}, [estado(e[0], e[1])])); }
      if (puedeBaja) {
        const b = el('button', { type: 'button', class: 'btn-enlace sin-corte', 'aria-label': `Dar de baja a ${quien}`, texto: 'Dar de baja' });
        b.addEventListener('click', () => {
          bajaDe = { folio: s.folio, quien, boton: b };
          const queda = x.n - 1;
          $('[data-baja-titulo]').textContent = `¿Dar de baja a ${quien}?`;
          $('[data-baja-de]').replaceChildren(...[`Regresa a la espera con su antigüedad y deja de ver el grupo en «Mis trámites».`,
            g.estado === 'confirmado' && queda < g.cupo_minimo ? `El grupo queda con ${plural(queda, 'persona', 'personas')}, menos del mínimo de ${g.cupo_minimo}: deja de estar confirmado y conserva su fecha como propuesta.` : '']
            .filter(Boolean).map((t) => el('li', { texto: t })));
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
    // Asistencia de conjunto: una columna por día, en curso o concluido (pedido de Liber 2026-10-18)
    $('[data-concentrado-bloque]').hidden = !conSituacion;
    if (conSituacion) P.pintaConcentrado($('[data-concentrado]'), datos, x);
    $('[data-baja-ayuda]').hidden = !puedeBaja;

    /* Acciones del grupo */
    const acciones = [];
    if (x.recibe) {
      // Un grupo de una organización sólo recibe a su gente: se cuenta sólo a ella (auditoría de tareas, M1)
      const propia = g.integracion === 'especifico';
      const org = propia ? x.integracion.replace('De una organización · ', '') : '';
      const espera = P.enEspera(datos, g.tipo_acreditacion, g.modalidad).filter((y) => !propia || y.s.organizacion_id === g.organizacion_id).length;
      if (espera) acciones.push(el('a', { class: 'btn btn-secundario', href: `grupos.html?curso=${P.claveCurso(g.tipo_acreditacion, g.modalidad)}&grupo=${encodeURIComponent(g.folio)}`,
        texto: propia ? `Agregar personas de ${org} (${espera} en espera)` : `Agregar personas de la espera (${espera} en espera)` }));
      else acciones.push(el('p', { class: 'texto-gris', texto: propia ? `Nadie de ${org} espera grupo en este curso por ahora.` : 'Nadie espera grupo en este curso por ahora.' }));
    } else if (abierto && x.n >= g.cupo_maximo) {
      acciones.push(el('p', { class: 'texto-gris', texto: `El grupo está lleno: ${g.cupo_maximo} personas.` }));
    } else if (g.estado === 'confirmado') {
      acciones.push(el('p', { class: 'texto-gris', texto: 'El curso ya empezó: el grupo no recibe más personas.' }));
    }
    if (g.estado === 'en_curso') {
      acciones.push(el('a', { class: 'btn btn-secundario', href: `asistencia.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Ver la asistencia' }));
      if (hoy === x.ultimo) acciones.push(el('a', { class: 'btn btn-secundario', href: `aplicar.html?folio=${encodeURIComponent(g.folio)}`, texto: 'Aplicar el examen' }));
    }
    let cancelar = null;
    if (antesDeIniciar) {
      cancelar = el('button', { type: 'button', class: 'btn btn-peligro-contorno', texto: 'Cancelar el grupo' });
      cancelar.addEventListener('click', () => {
        $('[data-cancelar-titulo]').textContent = `¿Cancelar el grupo ${g.folio} (${x.calculado})?`;
        $('[data-cancelar-de]').replaceChildren(...[x.n ? `${x.n === 1 ? 'La persona regresa' : `Las ${x.n} personas regresan`} a la espera, con su antigüedad.` : 'El grupo no tiene personas.',
          x.n && g.estado === 'confirmado' ? 'Dejan de ver fechas y sede en «Mis trámites».' : ''].filter(Boolean).map((t) => el('li', { texto: t })));
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
      const maximo = P.ultimoDiaPosible(datos); // un año después de hoy (decisión 3, auditoría 2026-10-19)
      const fi = $('#fecha_inicio');
      // Fecha día/mes/año (formato «fecha-dma», D9): el estándar lee el mínimo de data-min del campo (AAAA-MM-DD) y lo
      // dice en día/mes/año; la página trabaja con AAAA-MM-DD
      $('[data-campo="fecha_inicio"]').dataset.min = minimo;
      $('[data-campo="fecha_inicio"]').dataset.max = maximo;
      const iso = () => (window.FORMKIT_VALIDACIONES && FORMKIT_VALIDACIONES.isoDeDma(fi.value)) || '';
      // La propuesta de un grupo que regresó a integración se ofrece de nuevo
      if (g.fecha_inicio && g.fecha_inicio >= minimo && g.fecha_inicio <= maximo) fi.value = fecha(g.fecha_inicio);
      if (g.hora_entrada) $('#hora_entrada').value = APD.hhmm(g.hora_entrada);
      if (g.instructor) $('#instructor').value = g.instructor;
      const ayudaFecha = () => {
        const base = `El curso empieza al menos ${anticipacion} días después de confirmar: desde el ${fecha(minimo)} y hasta el ${fecha(maximo)}, un año después de hoy. Dura ${plural(c.dias_duracion, 'día', 'días seguidos')}`;
        $('[data-ayuda-fecha]').textContent = iso() && iso() >= minimo && iso() <= maximo ? `${base}: del ${fecha(iso())} al ${fecha(APD.sumaDias(iso(), c.dias_duracion - 1))}.` : `${base}. Escríbalo como día/mes/año o elíjalo en el calendario.`;
      };
      fi.addEventListener('input', ayudaFecha);
      fi.addEventListener('change', ayudaFecha);
      ayudaFecha();
      $('[data-lugar]').replaceChildren(document.createTextNode('Lugar: aula de capacitación del '), el('strong', { texto: sede }),
        document.createTextNode('; el examen, en el salón de cómputo del PILARES Vivero Nezahualcóyotl, en el mismo predio.'));
      FormKit.iniciar(form, {
        enviar(payload) {
          const d = Object.assign({}, payload.datos, { fecha_inicio: (window.FORMKIT_VALIDACIONES && FORMKIT_VALIDACIONES.isoDeDma(payload.datos.fecha_inicio)) || payload.datos.fecha_inicio });
          if (d.fecha_inicio < minimo) return Promise.reject({ errores: [{ campo: 'fecha_inicio', mensaje: `El curso debe empezar al menos ${anticipacion} días después de confirmar el grupo: desde el ${fecha(minimo)}.` }] });
          if (d.fecha_inicio > maximo) return Promise.reject({ errores: [{ campo: 'fecha_inicio', mensaje: `El curso empieza a más tardar un año después de hoy: hasta el ${fecha(maximo)}.` }] });
          // Como la API: con lo guardado de ahora (otra pestaña pudo dar de baja a alguien) y comprobando después que quedó
          // confirmado (auditoría «intentar romperlo», F3 M2: «Grupo confirmado» aunque seguía por confirmar). Lo escrito
          // se conserva.
          return P.guardaGrupoComprobado({
            antes: (d1) => P.razonNoConfirma(d1, deAhora(d1), d.fecha_inicio),
            eventos: () => ({ tipo: 'confirmar', grupo_id: g.id, fecha_inicio: d.fecha_inicio, hora_entrada: d.hora_entrada, instructor: d.instructor, por: P.REVISORA.usuario }),
            comprueba: (d2) => (deAhora(d2) && deAhora(d2).estado === 'confirmado' ? null : P.razonNoConfirma(d2, deAhora(d2), d.fecha_inicio) || 'la base no lo confirmó')
          }).catch((e) => Promise.reject(e && e.motivo ? noSeHizo('No se confirmó el grupo', e.motivo) : e));
        },
        alEnviar() { vuelve(g.folio, 'confirmado'); },
        alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
      });
    }

    /* Dar de baja y cancelar: formularios del estándar en diálogos, con motivo */
    function dialogoConMotivo(id, alGuardar) {
      const form = $(`#${id}`);
      const dlg = $(`#dlg-${id}`);
      const inst = FormKit.iniciar(form, {
        enviar(payload) { return alGuardar(payload.datos.motivo); },
        alFallar(err) { if (APD.muestraRechazo(err, form)) return; const a = $('[data-estado-envio] .aviso-texto', form); if (err && err.mensaje && a) a.textContent = err.mensaje; }
      });
      dlg.addEventListener('close', () => { form.reset(); inst.ctx.limpia('motivo'); });
      return dlg;
    }
    // Lo mismo que confirmar: se comprueba después que la base lo aplicó (otra pestaña pudo haberla dado de baja o haber
    // cancelado el grupo); si no, se dice y no se anuncia un éxito
    const inscritaEn = (d, folio) => { const s = d.solicitud.find((y) => y.folio === folio); return Boolean(s) && d.inscripcion.some((i) => i.grupo_id === g.id && i.activa && i.solicitud_id === s.id); };
    dialogoConMotivo('baja', (motivo) => P.guardaGrupoComprobado({
      eventos: () => ({ tipo: 'baja', grupo_id: g.id, folio: bajaDe.folio, motivo, por: P.REVISORA.usuario }),
      antes: (d1) => (inscritaEn(d1, bajaDe.folio) ? null : `${bajaDe.quien} ya no está en el grupo`),
      comprueba: (d2) => (inscritaEn(d2, bajaDe.folio) ? `${bajaDe.quien} sigue en el grupo: ya presentó el examen o el grupo cambió` : null)
    }).then(({ datos: d2 }) => vuelve(g.folio, deAhora(d2).estado === 'en_integracion' && g.estado === 'confirmado' ? 'baja_integracion' : 'baja'),
      (e) => Promise.reject(e && e.motivo ? noSeHizo('No se dio de baja', e.motivo) : e)))
      .addEventListener('close', () => { if (bajaDe && bajaDe.boton.isConnected) bajaDe.boton.focus(); });
    dialogoConMotivo('cancelar', (motivo) => P.guardaGrupoComprobado({
      eventos: () => ({ tipo: 'cancelar', grupo_id: g.id, motivo, por: P.REVISORA.usuario }),
      antes: (d1) => (deAhora(d1) && ['en_integracion', 'confirmado'].includes(deAhora(d1).estado) ? null : `el grupo ya está «${deAhora(d1) ? P.grupo(d1, deAhora(d1)).situacion.texto : 'sin datos'}»`),
      comprueba: (d2) => (deAhora(d2) && deAhora(d2).estado === 'cancelado' ? null : 'el grupo no se canceló')
    }).then(() => vuelve(g.folio, 'cancelado'), (e) => Promise.reject(e && e.motivo ? noSeHizo('No se canceló el grupo', e.motivo) : e)))
      .addEventListener('close', () => { if (cancelar && cancelar.isConnected) cancelar.focus(); });
  }).catch(() => {
    $('[data-bajada]').textContent = 'No se pudo cargar el grupo. Intente de nuevo más tarde.';
  });
}());
