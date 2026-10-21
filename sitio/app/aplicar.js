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
  const { el, estado, datosLista, plural } = APD;
  const API = APD_EXAMEN_API;
  const G = APD_EXAMEN_GRUPO;
  const $ = (s, c = document) => c.querySelector(s);

  /* Perfil ficticio de quien aplica el examen (no es una persona real): el mismo de «Asistencia» (app/personal.js) */
  const INSTRUCTOR = APD_PERSONAL.INSTRUCTORA;

  /* Cabecera del perfil «instructor»: asistencia y examen (app/personal.js) */
  const pintaSesion = (contenedor) => APD_PERSONAL.pintaSesion(contenedor, 'aplicar', 'instructor');
  const decimal = (n) => Number(n).toFixed(1);
  const minutos = (ms) => { const m = Math.ceil(ms / 60000); return m === 1 ? 'queda 1 minuto' : `quedan ${m} minutos`; };
  const veces = (n) => (n === 1 ? '1 vez' : `${n} veces`);
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });

  APD.cargar().then((datos) => {
    pintaSesion($('[data-sesion-personal]'));
    /* El grupo: el del enlace o, sin enlace, el que presenta examen hoy (último día de su curso); si no, el primero en
       curso (auditoría de tareas, A2). Un enlace a un grupo que no está en curso o no existe no abre otro: se dice y se
       ofrecen los grupos en curso, como en «Asistencia» (auditoría 2026-10-18, B4). */
    // El instructor sólo abre y opera sus propios grupos, también con ?folio= (decisión 12 de la auditoría del 2026-10-19,
    // Liber; E1-01): los de otra persona no se abren ni se ofrecen. En el SIA, la API lo compara con la sesión.
    const todosEnCurso = G.grupos(datos);
    const enCurso = todosEnCurso.filter((x) => x.instructor === INSTRUCTOR.usuario);
    const hoy = APD.hoy(datos);
    const pedido = new URLSearchParams(location.search).get('folio');
    // Sin enlace, «Mis grupos de hoy» del instructor (propuesta D, 2026-10-18): con uno solo hoy se entra directo; con
    // varios (o ninguno), se eligen por su nombre calculado
    const misDeHoy = APD_PERSONAL.gruposDeHoy(datos, INSTRUCTOR.usuario);
    const g = pedido ? enCurso.find((x) => x.folio === pedido) : misDeHoy.length === 1 ? enCurso.find((x) => x.id === misDeHoy[0].id) : null;
    if (!g) {
      $('[data-sin-grupo]').hidden = false;
      if (!pedido) {
        $('#t-sin-grupo').textContent = 'Mis grupos de hoy';
        $('[data-sin-grupo-texto]').textContent = misDeHoy.length ? `Hoy, ${APD.fechaConDia(hoy)}, tiene ${misDeHoy.length} grupos. El examen se aplica el último día del curso; elija el grupo:`
          : `Hoy, ${APD.fechaConDia(hoy)}, no tiene grupos con clase ni examen.`;
        const caja = $('[data-mis-grupos-hoy]');
        caja.hidden = false;
        APD_PERSONAL.pintaMisGrupos(caja, datos, INSTRUCTOR.usuario);
      }
      if (pedido) {
        const existe = datos.grupo.some((x) => x.folio === pedido);
        const ajeno = todosEnCurso.some((x) => x.folio === pedido);
        $('[data-sin-grupo-texto]').textContent = ajeno ? 'Este grupo lo da otra persona: sólo puede aplicar el examen en sus grupos.'
          : existe ? `El grupo ${pedido} no está en curso: el examen se aplica el último día de un curso en marcha.`
            : `No hay un grupo con el folio ${pedido}.`;
        $('[data-mis-grupos]').replaceChildren(...enCurso.map((x) => el('li', {}, [el('a', { href: `aplicar.html?folio=${encodeURIComponent(x.folio)}`,
          texto: `${APD.nombreGrupo(x, datos)} · ${x.folio} · examen el ${APD.fecha(G.fechaExamen(datos, x))}` })])));
        $('[data-mis-grupos-titulo]').hidden = !enCurso.length;
        if (enCurso.length) $('[data-mis-grupos-titulo]').textContent = 'Sus grupos en curso:';
      }
      return;
    }
    $('[data-con-grupo]').hidden = false;
    const prueba = Boolean(datos.fecha_corte);
    const avisosGrupo = [];
    // Otros grupos en curso, con la fecha de su examen, para cambiar de grupo
    const otros = enCurso.filter((x) => x.id !== g.id);
    if (otros.length) {
      // Dos grupos del mismo curso con las mismas fechas se llaman igual (y la sede es una sola): el que se repite lleva
      // su folio y cuántas personas tiene, como el aviso de «Grupos» con dos grupos sin fecha (auditoría 2026-10-20, C1-06)
      const nombres = [g].concat(otros).map((x) => APD.nombreGrupo(x, datos));
      const repetido = (x) => nombres.filter((n) => n === APD.nombreGrupo(x, datos)).length > 1;
      const personas = (x) => APD.plural(datos.inscripcion.filter((i) => i.grupo_id === x.id && i.activa).length, 'persona', 'personas');
      avisosGrupo.push(el('p', { class: 'otros-grupos' }, [document.createTextNode('Otros grupos en curso: ')].concat(otros.flatMap((x, i) => [
        i ? document.createTextNode(' · ') : null,
        el('a', { href: `aplicar.html?folio=${encodeURIComponent(x.folio)}`, texto: `${APD.nombreGrupo(x, datos)}${repetido(x) ? ` · ${x.folio} · ${personas(x)}` : ''} (examen el ${APD.fecha(G.fechaExamen(datos, x))})` })
      ]).filter(Boolean))));
    }
    // El examen es el último día del curso: otro día no se generan códigos (en la prueba se permite, para probar)
    const fueraDeDia = G.fechaExamen(datos, g) !== hoy;
    if (fueraDeDia) {
      avisosGrupo.push(FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'advertencia', titulo: `El examen de este grupo es el ${APD.fecha(G.fechaExamen(datos, g))}, no hoy`,
        texto: prueba ? 'Versión de prueba: se puede pasar lista para probar. En el sistema, los códigos sólo se generan el día del examen.'
          : 'Los códigos se generan el día del examen. Si hoy presenta otro grupo, elíjalo arriba.' }));
    }
    // Días del curso sin capturar: la base los cuenta como falta (auditoría de tareas, A1)
    const conHuecos = G.personas(datos, g).filter((f) => f.simulada).length;
    if (conHuecos) {
      avisosGrupo.push(FormKit.aviso(el('div', { class: 'aviso' }), { tono: 'bloqueo', titulo: 'Faltan días del curso por capturar en «Asistencia»',
        texto: prueba ? 'Sin esos días, el sistema los cuenta como falta y nadie tendría derecho a examen. Versión de prueba: aquí se cuentan como asistidos para poder probar el examen.'
          : 'Sin esos días, el sistema los cuenta como falta y nadie tendría derecho a examen. Captúrelos antes de pasar lista.' }));
    }
    const c = G.curso(datos, g);
    const ex = APD_EXAMEN_BANCO.examenDe(g.tipo_acreditacion, g.modalidad);
    $('[data-grupo]').replaceChildren(datosLista([
      // El grupo por su nombre calculado; el folio, que no cambia, debajo en chico (propuesta D, 2026-10-18)
      ['Grupo', APD.grupoTitulo(g, datos)],
      ['Curso', `${APD.TIPOS[g.tipo_acreditacion]} · ${APD.MODALIDADES[g.modalidad].toLowerCase()}`],
      ['Fecha del examen', `${APD.fecha(G.fechaExamen(datos, g))} · último día del curso (inició el ${APD.fecha(g.fecha_inicio)})`],
      ['Lugar', G.LUGAR],
      ['Examen', `${ex.preguntas} preguntas · ${ex.minutos} minutos · calificación mínima ${decimal(c.calificacion_minima)}`]
    ]), ...avisosGrupo);
    // Fuera del sistema de prueba no se pasa lista otro día ni con días sin capturar
    if (!prueba && (fueraDeDia || conHuecos)) { $('[data-tabla]').hidden = true; $('[data-imprimir]').hidden = true; }
    const filas = G.personas(datos, g);
    // Códigos repuestos hace poco (inscripción → hora), para señalarlos en su fila
    const recientes = {};
    // Fotografías ampliadas (inscripción), para que sigan así al volver a pintar la lista (C1-02)
    const ampliadas = new Set();
    // Fotografías de la cuenta (las confirmadas en el cotejo), para pasar lista
    const fotos = {};
    Promise.all(filas.map((f) => G.fotoDe(f.persona.curp, APD.nombreCompleto(f.persona)).then((u) => { fotos[f.inscripcion.id] = u; })))
      .then(() => pinta(true));

    let firma = '';
    let codigos = [];
    let lista = {};
    function pinta(forzar) {
      codigos = API.delGrupo(g.id);
      lista = API.lista();
      const vigente = (f) => codigos.find((r) => r.inscripcion_id === f.inscripcion.id && r.situacion !== 'reemplazado');
      const nueva = JSON.stringify(filas.map((f) => { const r = vigente(f); const l = lista[f.inscripcion.id]; return [l ? l.presente : null, r ? [r.codigo, r.situacion, r.contestadas, Math.ceil(r.restante_ms / 60000), r.salidas, r.otro_equipo, r.calificacion] : null]; }));
      if (nueva === firma && !forzar) return;
      firma = nueva;
      // Se conserva el foco en el botón de la misma persona al volver a pintar
      // (la fotografía es un botón [data-ampliar], no una acción del pase de lista: C1-02)
      const activo = document.activeElement;
      const enfocado = activo && activo.closest('[data-tabla]') ? [activo.hasAttribute('data-ampliar') ? null : activo.dataset.accion, activo.dataset.ins] : null;

      const cuenta = { registradas: 0, derecho: 0, presentes: 0, ausentes: 0, porLista: 0, terminaron: 0, aprobadas: 0, contestando: 0, sinEmpezar: 0, suspendidas: 0 };
      $('[data-filas]').replaceChildren(...filas.map((f) => {
        const nombre = APD.nombreCompleto(f.persona);
        const r = vigente(f);
        const l = lista[f.inscripcion.id];
        const id = f.inscripcion.id;
        let foto = el('div', { class: 'perfil-foto examen-foto-lista' }, [el('span', { class: 'perfil-iniciales', 'aria-hidden': 'true', texto: nombre.split(' ').slice(0, 2).map((x) => x[0]).join('') })]);
        if (fotos[id]) {
          foto.append(el('img', { class: 'perfil-imagen', src: fotos[id], alt: `Fotografía de ${nombre}` }));
          /* Con la fotografía se confirma la identidad (DECISIONES, 17/10): miniatura de 96 px que se amplía a unos 320 px
             ahí mismo, junto a «Presente» y «No llegó», con clic, toque, Intro o Espacio (decisión 14 a de Liber,
             auditoría 2026-10-20, C1-02). Sigue ampliada al volver a pintar la lista. */
          const amplia = ampliadas.has(id);
          foto = el('button', { type: 'button', class: 'examen-foto-boton', 'data-ampliar': '', 'data-ins': id, 'data-ampliada': amplia ? '' : null,
            'aria-label': `${amplia ? 'Reducir' : 'Ampliar'} la fotografía de ${nombre}` }, [foto, el('span', { class: 'examen-foto-accion', 'aria-hidden': 'true', texto: amplia ? 'Reducir' : 'Ampliar' })]);
        }
        const persona = el('td', {}, [el('div', { class: 'examen-persona-fila' }, [foto, el('div', {}, [el('span', { class: 'examen-nombre', texto: nombre }), el('span', { class: 'examen-nota mono', texto: f.solicitud.folio })])])]);
        const asistencia = el('td', {}, [document.createTextNode(f.anteriores ? `${f.previos} de ${f.anteriores} ${f.anteriores === 1 ? 'día anterior' : 'días anteriores'}` : 'Curso de un día')]);
        let paseLista = el('td', { class: 'texto-gris', texto: '—' });
        let avance = el('td', { class: 'texto-gris', texto: '—' });
        const acciones = el('td', { class: 'examen-acciones-fila' });
        if (f.examen && !r) {
          // Ya tiene su calificación capturada: no se le pasa lista ni se le da código (C 2.5)
          paseLista = el('td', {}, [estado(`${decimal(f.examen.calificacion)} · calificación registrada`, Number(f.examen.calificacion) >= Number(c.calificacion_minima) ? 'ok' : 'error')]);
          cuenta.registradas += 1;
          avance = el('td', { class: 'texto-gris', texto: 'Ya presentó el examen' });
        } else if (!f.puede) {
          asistencia.append(el('span', { class: 'examen-nota' }, [estado('Sin derecho a examen', 'error')]), el('span', { class: 'examen-nota', texto: `Necesita ${f.minimo} de ${f.dias} días` }));
        } else if (!l) {
          cuenta.derecho += 1; cuenta.porLista += 1;
          paseLista = el('td', {}, [el('div', { class: 'examen-lista-botones' }, [
            // Las dos respuestas del pase de lista con el mismo peso (auditoría 2026-10-18, D29)
            el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'data-accion': 'presente', 'data-ins': id, 'aria-label': `${nombre}: presente, generar su código`, texto: 'Presente' }),
            el('button', { type: 'button', class: 'btn btn-secundario btn-chico', 'data-accion': 'ausente', 'data-ins': id, 'aria-label': `${nombre}: no llegó`, texto: 'No llegó' })
          ])]);
        } else if (!l.presente) {
          cuenta.derecho += 1; cuenta.ausentes += 1;
          paseLista = el('td', {}, [el('div', { class: 'examen-avance-celda' }, [estado('No llegó al examen', 'error'),
            el('button', { type: 'button', class: 'btn-enlace', 'data-accion': 'presente', 'data-ins': id, 'aria-label': `Llegó: marcar presente a ${nombre}`, texto: 'Llegó: marcar presente' })])]);
        } else {
          cuenta.derecho += 1; cuenta.presentes += 1;
          // Un código recién repuesto se señala en su fila durante un minuto, para que se vea el cambio (hallazgo P117)
          const repuesto = recientes[id] && Date.now() - recientes[id] < 60000;
          paseLista = el('td', {}, [el('div', { class: `examen-avance-celda${repuesto ? ' recien-cambiado' : ''}` }, [estado('Presente', 'ok'),
            r ? el('span', { class: 'mono examen-codigo', texto: r.codigo }) : null, repuesto ? estado('Código nuevo: el anterior ya no sirve', 'ok') : null])]);
          if (r) {
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
            if (r.otro_equipo && r.situacion !== 'terminado') partes.push(el('span', { class: 'examen-nota examen-nota-alerta', texto: `Su código se intentó abrir en otra computadora ${veces(r.otro_equipo)}` }));
            avance = el('td', {}, [el('div', { class: 'examen-avance-celda' }, partes)]);
            if (['sin_empezar', 'contestando'].includes(r.situacion)) {
              acciones.append(
                el('button', { type: 'button', class: 'btn-enlace', 'data-accion': 'reponer', 'data-ins': id, 'aria-label': `Reponer el código de ${nombre}`, texto: 'Reponer código' }),
                el('button', { type: 'button', class: 'btn-enlace examen-enlace-peligro', 'data-accion': 'suspender', 'data-ins': id, 'aria-label': `Suspender el examen de ${nombre}`, texto: 'Suspender' })
              );
            }
          }
        }
        // Sin acciones la celda queda vacía, como en las demás tablas; en teléfono no se muestra (auditoría 2026-10-17)
        return el('tr', { 'data-ins': id, class: (r && ['terminado', 'suspendido'].includes(r.situacion)) || (l && !l.presente) || !f.puede || f.examen ? 'fila-hecha' : null }, [
          persona, asistencia, paseLista, avance, acciones
        ]);
      }));
      $('[data-tabla]').dispatchEvent(new CustomEvent('formkit:tabla'));

      const n = filas.length;
      const partes = [];
      if (cuenta.porLista) partes.push(`${cuenta.porLista} por pasar lista`);
      if (cuenta.ausentes) partes.push(`${cuenta.ausentes} no ${cuenta.ausentes === 1 ? 'llegó' : 'llegaron'}`);
      if (cuenta.terminaron) partes.push(`${cuenta.terminaron} ${cuenta.terminaron === 1 ? 'terminó' : 'terminaron'} (${cuenta.aprobadas} ${cuenta.aprobadas === 1 ? 'aprobada' : 'aprobadas'})`);
      if (cuenta.contestando) partes.push(`${cuenta.contestando} contestando`);
      if (cuenta.sinEmpezar) partes.push(`${cuenta.sinEmpezar} con código sin empezar`);
      if (cuenta.registradas) partes.push(`${cuenta.registradas} ya ${cuenta.registradas === 1 ? 'lo presentó' : 'lo presentaron'}, con la calificación registrada`);
      if (cuenta.suspendidas) partes.push(`${cuenta.suspendidas} ${cuenta.suspendidas === 1 ? 'suspendida' : 'suspendidas'}`);
      // Quien ya presentó también tenía derecho: se cuenta ahí (auditoría «intentar romperlo», F3 B8: «0 con derecho a
      // examen: 5 con la calificación ya registrada» parecía que nadie tenía derecho)
      const conDerecho = cuenta.derecho + cuenta.registradas;
      $('[data-cuenta]').textContent = cuenta.registradas === n && n
        ? `${plural(n, 'persona inscrita', 'personas inscritas')}: ${n === 1 ? 'ya presentó' : `las ${n} ya presentaron`} el examen.`
        : `${plural(n, 'persona inscrita', 'personas inscritas')}, ${conDerecho} con derecho a examen${partes.length ? `: ${partes.slice(0, -1).join(', ')}${partes.length > 1 ? ' y ' : ''}${partes[partes.length - 1]}` : ''}.`;
      $('[data-todos]').hidden = !(cuenta.derecho && !cuenta.porLista && cuenta.presentes && cuenta.terminaron + cuenta.suspendidas === cuenta.presentes);

      if (enfocado) {
        const b = enfocado[0] === null ? $(`[data-tabla] [data-ampliar][data-ins="${enfocado[1]}"]`)
          : $(`[data-tabla] [data-accion="${enfocado[0]}"][data-ins="${enfocado[1]}"]`) || $(`[data-tabla] tr[data-ins="${enfocado[1]}"] [data-accion]`);
        if (b) b.focus();
      }
      pintaPapeletas(filas, vigente);
    }

    /* Papeletas para imprimir: nombre, grupo y código de cada persona con examen por presentar */
    function pintaPapeletas(lista, vigente) {
      $('[data-papeletas]').replaceChildren(...lista.map((f) => [f, vigente(f)]).filter(([, r]) => r && ['sin_empezar', 'contestando'].includes(r.situacion)).map(([f, r]) =>
        el('div', { class: 'papeleta' }, [
          el('p', { class: 'papeleta-nombre', texto: APD.nombreCompleto(f.persona) }),
          el('p', { class: 'papeleta-dato', texto: `Examen ${APD.TIPOS[g.tipo_acreditacion].toLowerCase()} · ${APD.nombreGrupo(g, datos)} · grupo ${g.folio} · ${APD.fecha(G.fechaExamen(datos, g))}` }),
          el('p', { class: 'papeleta-codigo mono', texto: r.codigo }),
          el('p', { class: 'papeleta-dato', texto: 'Escribe este código en la computadora, en «Entra a tu examen». Sólo sirve para tu examen.' })
        ])));
    }

    const fila = (ins) => filas.find((f) => f.inscripcion.id === ins);
    const codigoDe = (ins) => codigos.find((r) => r.inscripcion_id === ins && r.situacion !== 'reemplazado');

    /* Acciones por persona. Si el navegador no guardó el pase de lista o el código (almacenamiento bloqueado o lleno), se
       dice: la fila quedaba igual, sin código ni aviso (auditoría «intentar romperlo», F4 M3) */
    const noSeHizo = (nombre) => (err) => {
      pinta(true);
      APD.pintaAviso($('[data-aviso-accion]'), 'error', `No se registró a ${nombre}`, (err && err.mensaje) || 'No se pudo registrar. Intente de nuevo.', true);
    };
    let suspenderA = null;
    $('[data-filas]').addEventListener('click', (e) => {
      const fb = e.target.closest('[data-ampliar]');
      if (fb) {
        // La fotografía se amplía o se reduce ahí mismo; el foco sigue en el botón (C1-02)
        const amplia = !fb.hasAttribute('data-ampliada');
        if (amplia) ampliadas.add(fb.dataset.ins); else ampliadas.delete(fb.dataset.ins);
        fb.toggleAttribute('data-ampliada', amplia);
        fb.setAttribute('aria-label', `${amplia ? 'Reducir' : 'Ampliar'} la fotografía de ${APD.nombreCompleto(fila(fb.dataset.ins).persona)}`);
        $('.examen-foto-accion', fb).textContent = amplia ? 'Reducir' : 'Ampliar';
        return;
      }
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      const f = fila(b.dataset.ins);
      const nombre = APD.nombreCompleto(f.persona);
      if (b.dataset.accion === 'presente') {
        G.pasarLista(datos, g, f, true, INSTRUCTOR.usuario).then((r) => { pinta(true); FormKit.anuncia(`${nombre}, presente. Su código: ${r.codigo.split('').join(' ')}.`); }, noSeHizo(nombre));
      } else if (b.dataset.accion === 'ausente') {
        G.pasarLista(datos, g, f, false, INSTRUCTOR.usuario).then(() => { pinta(true); FormKit.anuncia(`${nombre}: no llegó. Si llega después, márquela presente.`); }, noSeHizo(nombre));
      } else if (b.dataset.accion === 'reponer') {
        const r = codigoDe(f.inscripcion.id);
        FormKit.confirma(b, { titulo: `¿Reponer el código de ${nombre}?`,
          consecuencias: [`El código ${r.codigo} deja de servir.`, 'El examen sigue igual con el código nuevo: mismas preguntas, respuestas guardadas y el tiempo que le quede.'],
          si: 'Sí, reponer el código' })
          .then((si) => { if (si) API.reponer(r.codigo, INSTRUCTOR.usuario).then((nuevo) => { recientes[f.inscripcion.id] = Date.now(); pinta(true); FormKit.anuncia(`Código nuevo de ${nombre}: ${nuevo.codigo.split('').join(' ')}.`); }, noSeHizo(nombre)); });
      } else if (b.dataset.accion === 'suspender') {
        suspenderA = { codigo: codigoDe(f.inscripcion.id).codigo, nombre, boton: b };
        $('[data-suspender-titulo]').textContent = `¿Suspender el examen de ${nombre}?`;
        $('[data-suspender-de]').replaceChildren(...['Ya no podrá contestar y lo contestado no se califica.', 'La persona lee el motivo en su pantalla.'].map((t) => el('li', { texto: t })));
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
        APD.pintaAviso($('[data-aviso-accion]'), 'info', `Examen de ${nombre} suspendido`, 'Queda registrado con su motivo; lo contestado no se califica.', false);
      },
      alFallar(err) { const a = $('[data-estado-envio] .aviso-texto', formSusp); if (err && err.mensaje && a) a.textContent = err.mensaje; }
    });
    dialogo.addEventListener('close', () => { if (suspenderA && suspenderA.boton.isConnected) suspenderA.boton.focus(); });

    /* Imprimir sólo las papeletas */
    $('[data-imprimir]').addEventListener('click', () => {
      if (!$('[data-papeletas]').children.length) { APD.pintaAviso($('[data-aviso-accion]'), 'error', 'No hay códigos por imprimir', 'Primero pase lista: el código sale al marcar a cada persona «Presente».', true); return; }
      document.body.classList.add('imprime-papeletas');
      window.print();
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('imprime-papeletas'));

    window.addEventListener('storage', (e) => { if (e.key && (e.key.startsWith(API.PREFIJO) || e.key === API.LISTA)) pinta(); });
    setInterval(() => pinta(), 2000);
    pinta(true);

    /* ----- Menú de pruebas: «En esta pantalla» (app/pruebas.js) ----- */
    window.APD_PRUEBAS_AQUI = () => [
      ['Pasar lista: todas presentes', async () => {
        for (const f of filas.filter((x) => x.puede && !x.examen && !API.lista()[x.inscripcion.id])) await G.pasarLista(datos, g, f, true, INSTRUCTOR.usuario);
        pinta(true);
        return 'Lista pasada: todas presentes, con su código.';
      }],
      ['Simular que todas contestan y envían', async () => {
        const abiertos = API.delGrupo(g.id).filter((r) => ['sin_empezar', 'contestando'].includes(r.situacion));
        if (!abiertos.length) return 'No hay exámenes por contestar: primero pase lista.';
        for (const r of abiertos) { API.pruebas.iniciar(r.codigo); API.pruebas.contestar(r.codigo, 'azar'); await API.terminar(r.codigo, 'enviado'); }
        pinta(true);
        return `${abiertos.length} ${abiertos.length === 1 ? 'examen enviado' : 'exámenes enviados'} con respuestas al azar.`;
      }]
    ];
  }).catch(() => {
    $('[data-sin-grupo]').hidden = false;
    $('[data-sin-grupo-texto]').textContent = 'No se pudo cargar el grupo. Intente de nuevo más tarde.';
  });
}());
