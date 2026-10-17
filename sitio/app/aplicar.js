/* =========================================================
   aplicar.js · «Aplicar el examen» (personal, etapa 2): quien aplica el examen
   en el salón de cómputo del PILARES genera el código de cada persona, sigue
   su avance al momento, repone un código perdido y, si hace falta, suspende
   un examen con su motivo (decisiones 2026-10-17, P75 a P78).

   A las personas del personal se les habla de usted. Perfil simulado
   «instructor» (P27): en la etapa 3 lo da el acceso del SIA.

   Lee los datos ficticios (APD.cargar) y los códigos del servidor simulado
   (APD_EXAMEN_API). El avance se actualiza solo: al cambiar lo guardado en
   otra pestaña (evento storage) y cada pocos segundos.
   ========================================================= */
(function () {
  'use strict';
  const { el, estado, datosLista } = APD;
  const API = APD_EXAMEN_API;
  const G = APD_EXAMEN_GRUPO;
  const $ = (s, c = document) => c.querySelector(s);

  /* Perfil ficticio de quien aplica el examen (no es una persona real) */
  const INSTRUCTOR = { usuario: 'instructor.ficticio', nombre: 'Laura Ejemplo Instructora', perfil: 'Instructor' };

  function pintaSesion(contenedor) {
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(`${INSTRUCTOR.nombre} `), estado(`Perfil: ${INSTRUCTOR.perfil.toLowerCase()}`)]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, [
        el('a', { class: 'btn-enlace', href: 'revision.html', texto: 'Revisión documental' }),
        el('a', { class: 'btn-enlace', href: 'citas.html', texto: 'Citas de cotejo' }),
        el('a', { class: 'btn-enlace', href: 'aplicar.html', 'aria-current': 'page', texto: 'Aplicar el examen' }),
        el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' })
      ])
    );
  }
  const decimal = (n) => Number(n).toFixed(1);
  const minutos = (ms) => { const m = Math.ceil(ms / 60000); return m === 1 ? 'queda 1 minuto' : `quedan ${m} minutos`; };
  const veces = (n) => (n === 1 ? '1 vez' : `${n} veces`);
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });

  APD.cargar().then((datos) => {
    pintaSesion($('[data-sesion-personal]'));
    const g = G.grupos(datos)[0];
    if (!g) { $('[data-sin-grupo]').hidden = false; return; }
    $('[data-con-grupo]').hidden = false;
    const c = G.curso(datos, g);
    const ex = APD_EXAMEN_BANCO.examenes[`${g.tipo_acreditacion}_${g.modalidad}`];
    $('[data-grupo]').replaceChildren(datosLista([
      ['Grupo', g.folio],
      ['Curso', `${APD.TIPOS[g.tipo_acreditacion]} · ${APD.MODALIDADES[g.modalidad].toLowerCase()}`],
      ['Fecha del examen', `${APD.fecha(G.fechaExamen(datos, g))} · último día del curso (inició el ${APD.fecha(g.fecha_inicio)})`],
      ['Lugar', G.LUGAR],
      ['Examen', `${ex.preguntas} preguntas · ${ex.minutos} minutos · calificación mínima ${decimal(c.calificacion_minima)}`]
    ]));
    const filas = G.personas(datos, g);

    let firma = '';
    let codigos = [];
    function pinta(forzar) {
      codigos = API.delGrupo(g.id);
      const vigente = (f) => codigos.find((r) => r.inscripcion_id === f.inscripcion.id && r.situacion !== 'reemplazado');
      const nueva = JSON.stringify(filas.map((f) => { const r = vigente(f); return r ? [r.codigo, r.situacion, r.contestadas, Math.ceil(r.restante_ms / 60000), r.salidas, r.calificacion] : null; }));
      if (nueva === firma && !forzar) return;
      firma = nueva;
      // Se conserva el foco en el botón de la misma persona al volver a pintar
      const enfocado = document.activeElement && document.activeElement.closest('[data-tabla]') ? [document.activeElement.dataset.accion, document.activeElement.dataset.ins] : null;

      const cuenta = { derecho: 0, terminaron: 0, aprobadas: 0, contestando: 0, sinEmpezar: 0, sinCodigo: 0, suspendidas: 0 };
      $('[data-filas]').replaceChildren(...filas.map((f) => {
        const nombre = APD.nombreCompleto(f.persona);
        const r = vigente(f);
        const asistencia = el('td', {}, [document.createTextNode(`${f.asistidos} de ${f.dias} ${f.dias === 1 ? 'día' : 'días'}`)]);
        let codigo = el('td', { class: 'texto-gris', texto: '—' });
        let avance = el('td', { class: 'texto-gris', texto: '—' });
        const acciones = el('td', { class: 'examen-acciones-fila' });
        if (!f.derecho) {
          asistencia.append(document.createTextNode(' '), estado('Sin derecho a examen', 'error'));
        } else {
          cuenta.derecho += 1;
          if (!r) {
            cuenta.sinCodigo += 1;
            acciones.append(el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'data-accion': 'generar', 'data-ins': f.inscripcion.id, 'aria-label': `Generar el código de ${nombre}`, texto: 'Generar código' }));
          } else {
            codigo = el('td', {}, [el('span', { class: 'mono examen-codigo', texto: r.codigo })]);
            const partes = [];
            if (r.situacion === 'sin_empezar') { cuenta.sinEmpezar += 1; partes.push(estado('Sin empezar', '')); }
            if (r.situacion === 'contestando') {
              cuenta.contestando += 1;
              partes.push(estado(`Contestando · ${r.contestadas} de ${r.total}`, 'pend'), el('span', { class: 'examen-nota', texto: minutos(r.restante_ms) }));
            }
            if (r.situacion === 'terminado') {
              cuenta.terminaron += 1;
              if (r.aprobado) cuenta.aprobadas += 1;
              partes.push(estado(`${decimal(r.calificacion)} · ${r.aprobado ? 'aprobado' : 'no aprobado'}`, r.aprobado ? 'ok' : 'error'),
                el('span', { class: 'examen-nota', texto: `${r.motivo_fin === 'tiempo' ? 'Se acabó el tiempo' : 'Envió'} a las ${hora(r.terminado_en)}` }));
            }
            if (r.situacion === 'suspendido') { cuenta.suspendidas += 1; partes.push(estado('Suspendido', 'error'), el('span', { class: 'examen-nota', texto: r.suspendido.motivo })); }
            if (r.salidas && r.situacion !== 'terminado') partes.push(el('span', { class: 'examen-nota examen-nota-alerta', texto: `Salió de la ventana del examen ${veces(r.salidas)}` }));
            avance = el('td', {}, [el('div', { class: 'examen-avance-celda' }, partes)]);
            if (['sin_empezar', 'contestando'].includes(r.situacion)) {
              acciones.append(
                el('button', { type: 'button', class: 'btn-enlace', 'data-accion': 'reponer', 'data-ins': f.inscripcion.id, 'aria-label': `Reponer el código de ${nombre}`, texto: 'Reponer código' }),
                el('button', { type: 'button', class: 'btn-enlace examen-enlace-peligro', 'data-accion': 'suspender', 'data-ins': f.inscripcion.id, 'aria-label': `Suspender el examen de ${nombre}`, texto: 'Suspender' })
              );
            }
          }
        }
        if (!acciones.childNodes.length) acciones.append(el('span', { class: 'texto-gris', texto: '—' }));
        return el('tr', { 'data-ins': f.inscripcion.id, class: r && ['terminado', 'suspendido'].includes(r.situacion) ? 'fila-hecha' : null }, [
          el('td', {}, [el('span', { class: 'examen-nombre', texto: nombre }), el('span', { class: 'examen-nota mono', texto: f.solicitud.folio })]),
          asistencia, codigo, avance, acciones
        ]);
      }));
      $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

      const n = filas.length;
      const partes = [];
      if (cuenta.terminaron) partes.push(`${cuenta.terminaron} ${cuenta.terminaron === 1 ? 'terminó' : 'terminaron'} (${cuenta.aprobadas} ${cuenta.aprobadas === 1 ? 'aprobada' : 'aprobadas'})`);
      if (cuenta.contestando) partes.push(`${cuenta.contestando} contestando`);
      if (cuenta.sinEmpezar) partes.push(`${cuenta.sinEmpezar} con código sin empezar`);
      if (cuenta.sinCodigo) partes.push(`${cuenta.sinCodigo} sin código`);
      if (cuenta.suspendidas) partes.push(`${cuenta.suspendidas} ${cuenta.suspendidas === 1 ? 'suspendida' : 'suspendidas'}`);
      $('[data-cuenta]').textContent = `${n} personas inscritas, ${cuenta.derecho} con derecho a examen${partes.length ? `: ${partes.slice(0, -1).join(', ')}${partes.length > 1 ? ' y ' : ''}${partes[partes.length - 1]}` : ''}.`;
      $('[data-todos]').hidden = !(cuenta.derecho && cuenta.terminaron + cuenta.suspendidas === cuenta.derecho);

      if (enfocado) {
        const b = $(`[data-tabla] [data-accion="${enfocado[0]}"][data-ins="${enfocado[1]}"]`) || $(`[data-tabla] tr[data-ins="${enfocado[1]}"] button`);
        if (b) b.focus();
      }
      pintaPapeletas(filas, vigente);
    }

    /* Papeletas para imprimir: nombre, grupo y código de cada persona con examen por presentar */
    function pintaPapeletas(lista, vigente) {
      $('[data-papeletas]').replaceChildren(...lista.map((f) => [f, vigente(f)]).filter(([, r]) => r && ['sin_empezar', 'contestando'].includes(r.situacion)).map(([f, r]) =>
        el('div', { class: 'papeleta' }, [
          el('p', { class: 'papeleta-nombre', texto: APD.nombreCompleto(f.persona) }),
          el('p', { class: 'papeleta-dato', texto: `Examen ${APD.TIPOS[g.tipo_acreditacion].toLowerCase()} · grupo ${g.folio} · ${APD.fecha(G.fechaExamen(datos, g))}` }),
          el('p', { class: 'papeleta-codigo mono', texto: r.codigo }),
          el('p', { class: 'papeleta-dato', texto: 'Escribe este código en la computadora, en «Entra a tu examen». Sólo sirve para tu examen.' })
        ])));
    }

    const fila = (ins) => filas.find((f) => f.inscripcion.id === ins);
    const codigoDe = (ins) => codigos.find((r) => r.inscripcion_id === ins && r.situacion !== 'reemplazado');

    /* Acciones por persona */
    let suspenderA = null;
    $('[data-filas]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      const f = fila(b.dataset.ins);
      const nombre = APD.nombreCompleto(f.persona);
      if (b.dataset.accion === 'generar') {
        G.generarPara(datos, g, f, INSTRUCTOR.usuario).then((r) => { pinta(true); FormKit.anuncia(`Código de ${nombre}: ${r.codigo.split('').join(' ')}.`); });
      } else if (b.dataset.accion === 'reponer') {
        const r = codigoDe(f.inscripcion.id);
        FormKit.confirma(b, { titulo: '¿Reponer el código?', texto: `El código ${r.codigo} de ${nombre} deja de servir. El examen sigue igual con el código nuevo: mismas preguntas, respuestas guardadas y el tiempo que le quede.`, si: 'Reponer el código', no: 'Cancelar' })
          .then((si) => { if (si) API.reponer(r.codigo, INSTRUCTOR.usuario).then((nuevo) => { pinta(true); FormKit.anuncia(`Código nuevo de ${nombre}: ${nuevo.codigo.split('').join(' ')}.`); }); });
      } else if (b.dataset.accion === 'suspender') {
        suspenderA = { codigo: codigoDe(f.inscripcion.id).codigo, nombre, boton: b };
        $('[data-suspender-de]').textContent = `${nombre} ya no podrá contestar. Lo contestado no se califica. Esta acción no se deshace.`;
        $('#dlg-suspender').showModal();
        $('#motivo').focus();
      }
    });

    /* Suspender: formulario del estándar dentro de un diálogo */
    const formSusp = $('#suspender');
    const dialogo = $('#dlg-suspender');
    const instSusp = FormKit.iniciar(formSusp, {
      enviar(payload) { return API.suspender(suspenderA.codigo, payload.datos.motivo, INSTRUCTOR.usuario); },
      alEnviar() {
        const { nombre } = suspenderA;
        dialogo.close();
        formSusp.reset();
        instSusp.ctx.limpia('motivo');
        pinta(true);
        FormKit.anuncia(`El examen de ${nombre} quedó suspendido.`);
      },
      alFallar(err) { const a = $('[data-estado-envio] .aviso-texto', formSusp); if (err && err.mensaje && a) a.textContent = err.mensaje; }
    });
    dialogo.addEventListener('close', () => { if (suspenderA && suspenderA.boton.isConnected) suspenderA.boton.focus(); });

    /* Imprimir sólo las papeletas */
    $('[data-imprimir]').addEventListener('click', () => {
      if (!$('[data-papeletas]').children.length) { FormKit.anuncia('No hay códigos por imprimir: genere primero los códigos.'); $('[data-cuenta]').textContent = 'No hay códigos por imprimir: genere primero el código de cada persona presente.'; return; }
      document.body.classList.add('imprime-papeletas');
      window.print();
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('imprime-papeletas'));

    window.addEventListener('storage', (e) => { if (e.key === API.CLAVE) pinta(); });
    setInterval(() => pinta(), 2000);
    pinta(true);

    /* ----- Menú de pruebas: «En esta pantalla» (app/pruebas.js) ----- */
    window.APD_PRUEBAS_AQUI = () => [
      ['Generar los códigos de todas las personas con derecho', async () => {
        for (const f of filas.filter((x) => x.derecho)) await G.generarPara(datos, g, f, INSTRUCTOR.usuario);
        pinta(true);
        return 'Códigos generados.';
      }],
      ['Simular que todas contestan y envían', async () => {
        const abiertos = API.delGrupo(g.id).filter((r) => ['sin_empezar', 'contestando'].includes(r.situacion));
        if (!abiertos.length) return 'No hay exámenes por contestar: genere primero los códigos.';
        for (const r of abiertos) { API.pruebas.iniciar(r.codigo); API.pruebas.contestar(r.codigo, 'azar'); await API.terminar(r.codigo, 'enviado'); }
        pinta(true);
        return `${abiertos.length} ${abiertos.length === 1 ? 'examen enviado' : 'exámenes enviados'} con respuestas al azar.`;
      }]
    ];
  }).catch(() => {
    $('[data-sin-grupo]').hidden = false;
    $('[data-sin-grupo] p').textContent = 'No se pudo cargar el grupo. Intente de nuevo más tarde.';
  });
}());
