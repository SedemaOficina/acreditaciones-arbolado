/* cotejo.js · «Atender una cita de cotejo» (personal, etapa 2).

   Reglas del cotejo presencial (decisiones 2026-10-17, Liber; la base las vuelve a aplicar, 03-apd-reglas.sql):
     · Si la persona no se presenta: se le da una cita nueva una sola vez; a la segunda inasistencia la solicitud se
       cierra como «concluida sin atender».
     · Si no es la persona de la fotografía ni de la identificación: no se atiende la cita, se avisa a la Dirección y
       la cuenta queda bloqueada hasta aclararlo.
     · Si un documento no coincide con el que cargó: si la persona puede conseguir hoy el correcto, la cita queda en
       pausa; lo carga en «Mis trámites» y aquí se retoma el cotejo de ese documento. Si no, la solicitud regresa con
       observaciones, la persona corrige en línea y, tras una nueva revisión, recibe otra cita.
     · Si no presenta el comprobante de pago: no se termina el cotejo; se le da otra cita y conserva el monto.
     · Con todo en orden y la factura cargada, la solicitud pasa a «En espera de grupo» y se abre el expediente de la
       persona (si es su primer trámite).
   Una sola acción principal, cuyo texto cambia con el resultado. Cerrar la solicitud o no atender a la persona piden
   confirmación.

   Campos auxiliares que calcula la página (y el servidor por su cuenta, con apd.cita y los documentos):
   pedir_llegada, pedir_identidad, pedir_documentos, cotejar_<requisito>, pedir_hoy, pedir_pago, pedir_factura y resultado.

   El registro es una SIMULACIÓN: se recuerda en este navegador (APD_PERSONAL.guardaCotejo; la factura, en IndexedDB). En la etapa 3 lo sustituye la API del personal. */
(function () {
  'use strict';
  const { el, fecha, fechaHora, datosLista } = APD;
  const P = APD_PERSONAL;
  const $ = (s, raiz) => (raiz || document).querySelector(s);
  const $$ = (s, raiz) => Array.from((raiz || document).querySelectorAll(s));
  const form = document.getElementById('formulario');
  const folio = new URLSearchParams(location.search).get('folio') || '';

  const RESULTADOS = {
    terminado: { boton: 'Terminar el cotejo', clase: 'btn-primario' },
    pausa: { boton: 'Poner la cita en pausa', clase: 'btn-primario' },
    con_observaciones: { boton: 'Regresar con observaciones', clase: 'btn-primario' },
    otra_cita: { boton: 'Darle otra cita', clase: 'btn-primario' },
    no_se_presento: { boton: 'Registrar la inasistencia y la cita nueva', clase: 'btn-primario' },
    cerrar: { boton: 'Cerrar la solicitud', clase: 'btn-peligro-contorno' },
    no_es_la_persona: { boton: 'No atender y avisar a la Dirección', clase: 'btn-peligro-contorno' },
    '': { boton: 'Registrar la cita', clase: 'btn-primario' }
  };

  function ponValor(id, valor) {
    const c = document.getElementById(id);
    if (!c || c.value === valor) return;
    c.value = valor;
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const elegido = (nombre) => { const r = $(`input[name="${nombre}"]:checked`, form); return r ? r.value : ''; };
  const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');
  const falla = (texto) => { $('[data-cargando]').textContent = texto; };

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'citas');
    const s = datos.solicitud.find((x) => x.folio === folio);
    if (!s) return falla('No se encontró esa cita. Vuelva a las citas de cotejo y elíjala de nuevo.');
    const p = datos.solicitante.find((x) => x.id === s.solicitante_id);
    if (p.estado === 'bloqueada' || s.cotejo_bloqueado) return falla('Esta cita no se atendió: no era la persona de la fotografía. La cuenta está bloqueada hasta que la Dirección lo aclare.');
    if (s.estado !== 'validada_en_linea' || !s.cita_en) {
      return falla(`Esta solicitud no tiene una cita de cotejo por atender. Su situación actual es «${APD.nombrePersonal(s.estado)}».`);
    }
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && req[d.requisito] && req[d.requisito].momento === 'en_linea');
    const pausa = s.cotejo_pausa || null;
    const retoma = Boolean(pausa);
    const nuevos = new Set(P.cargadosEnPausa(datos, s).map((d) => d.requisito));
    // En el orden de la pantalla (el del catálogo de requisitos)
    const aCotejar = $$('[data-doc]', form).map((a) => a.dataset.doc).filter((k) => docs.some((d) => d.requisito === k) && (!retoma || pausa.docs.includes(k)));
    // Inasistencias de esta solicitud, como las cuenta la base: todas sus citas en que no se presentó, aunque la
    // solicitud se haya vuelto a validar (auditoría de tareas, A4; decisión 2026-10-14 «a la segunda se cierra»)
    const inasistencias = Math.max(s.inasistencias || 0, (datos.cita || []).filter((c) => c.solicitud_id === s.id && c.resultado === 'no_se_presento').length);
    const maxInasistencias = Number(APD.parametro(datos, 'inasistencias_cotejo_maximas')) || 2;
    const expediente = p.numero_expediente || P.siguienteExpediente(datos);
    const anterior = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
    const nombre = APD.nombreCompleto(p);

    /* ----- Cabeza: la cita, la solicitud y la persona ----- */
    $('[data-titulo]').textContent = `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}`;
    $('[data-bajada]').replaceChildren(...APD.meta([
      [document.createTextNode('Folio de la solicitud '), el('strong', { class: 'mono', texto: s.folio })],
      `cita del ${fechaHora(s.cita_en)}`,
      `documentos validados en línea el ${fecha(s.estado_desde)}`
    ]));
    $('[data-estado]').replaceChildren(retoma ? APD.estado('Cita en pausa', 'marcha') : APD.estado('Cita asignada', 'pend', 'fecha'));
    const iniciales = `${(p.nombre || '').charAt(0)}${(p.primer_apellido || '').charAt(0)}`;
    const foto = el('div', { class: 'perfil-foto perfil-foto-chica' }, [el('span', { class: 'perfil-iniciales', 'aria-hidden': 'true', texto: iniciales })]);
    $('[data-iniciales]').textContent = iniciales;
    if (typeof APD_ARCHIVOS_PRUEBA !== 'undefined') APD_ARCHIVOS_PRUEBA.foto(p.curp).then((r) => {
      if (!r || !r.blob) return;
      const url = URL.createObjectURL(r.blob);
      foto.append(el('img', { class: 'perfil-imagen', src: url, alt: `Fotografía de ${nombre}` }));
      const grande = $('[data-foto-grande]');
      grande.dataset.conImagen = 'si';
      grande.append(el('img', { class: 'perfil-imagen', src: url, alt: `Fotografía de la cuenta de ${nombre}` }));
    });
    $('[data-persona]').replaceChildren(el('div', { class: 'persona-con-foto' }, [foto, el('div', { class: 'datos-dos-columnas' }, [datosLista([
      ['Persona', nombre],
      ['CURP', p.curp],
      ['Número de expediente', p.numero_expediente || 'Todavía no tiene: el expediente físico se abre al terminar este cotejo (es su primer trámite)'],
      ...APD.adscripcionPares(datos, s, 'Adscripción'),
      ['Acreditación que renueva', anterior ? `${anterior.numero}, vence el ${fecha(anterior.vence_en)}` : '']
    ])])]));
    // Una pausa sólo dura el día de la cita: después la base la rechaza y la solicitud regresa con observaciones
    // (auditoría de tareas, M6; P80)
    const diaPausa = retoma ? P.diaDe(pausa.cita_en || s.cita_en) : null;
    const pausaVencida = retoma && diaPausa < APD.hoy(datos);
    if (pausaVencida) {
      $('[data-retoma]').replaceWith(APD.aviso('error', `La pausa venció el ${fecha(diaPausa)}`,
        `Una cita en pausa sólo se retoma el mismo día. La solicitud regresa con observaciones para que ${nombre} cargue el documento correcto; no se retoma aquí.`));
      $('[data-estado]').replaceChildren(APD.estado('Pausa vencida', 'cerrado'));
    } else if (retoma) {
      const nombres = pausa.docs.map((k) => (req[k] ? req[k].nombre : k));
      const faltan = pausa.docs.filter((k) => !nuevos.has(k)).map((k) => (req[k] ? req[k].nombre : k));
      $('[data-retoma-texto]').replaceChildren(
        el('p', { class: 'aviso-titulo', texto: `Cotejo en pausa desde el ${fecha(diaPausa)} a las ${P.horaDe(pausa.real)}` }),
        el('p', { texto: `No coincidió: ${lista(nombres)}. La identidad y los demás documentos ya se cotejaron.` }),
        el('p', { texto: faltan.length
          ? `La persona todavía no carga: ${lista(faltan)}. Si no lo carga hoy, marque «No coincide» y «No: regresa con observaciones».`
          : 'La persona ya cargó el documento nuevo: compárelo con el que trae.' })
      );
      $('[data-retoma]').hidden = false;
    }
    if (inasistencias || s.cita_motivo === 'sin_pago') {
      $('[data-antecedente-texto]').replaceChildren(...(s.cita_motivo === 'sin_pago'
        ? [el('p', { class: 'aviso-titulo', texto: 'Cita nueva por falta de pago' }), el('p', { texto: `En su cita del ${fechaHora(s.cita_anterior)} no presentó el comprobante de pago.` })]
        : [el('p', { class: 'aviso-titulo', texto: 'Es su segunda cita' }), el('p', { texto: `No se presentó a su cita del ${fechaHora(s.cita_anterior)}. Si tampoco se presenta a ésta, la solicitud se cierra.` })]));
      $('[data-antecedente]').hidden = false;
    }
    $('[data-cabeza]').hidden = false;

    /* ----- Documentos: lo que cargó, para compararlo con lo que trae ----- */
    const archivos = {};
    for (const art of $$('[data-doc]', form)) {
      const k = art.dataset.doc;
      const d = docs.find((x) => x.requisito === k);
      if (!d) continue;
      const nombreArchivo = d.nombre_archivo || APD.nombreDeArchivo((req[k] && req[k].nombre_archivo) || k.toUpperCase(), p, d.nombre_original);
      archivos[k] = d.blob
        ? { url: URL.createObjectURL(d.blob), tipo: d.blob.type, titulo: req[k].nombre, archivo: nombreArchivo, nota: 'Versión de prueba: es el archivo que se cargó en este navegador.' }
        : { url: `datos/documentos/${k}.pdf`, titulo: req[k].nombre, archivo: nombreArchivo, nota: 'Versión de prueba: documento ficticio, el mismo para todas las solicitudes con este requisito.' };
      const pie = [el('span', { class: 'mono', texto: nombreArchivo }), document.createTextNode(` · lo cargó el ${fecha(d.cargado_en)}`)];
      if (retoma && nuevos.has(k)) pie.push(el('span', { class: 'doc-corregido' }, [APD.estado('Cargado de nuevo hoy', 'pend')]));
      if (retoma && pausa.docs.includes(k) && !nuevos.has(k)) pie.push(el('span', { class: 'doc-corregido' }, [APD.estado('Todavía no carga el nuevo', 'error')]));
      $('[data-doc-archivo]', art).replaceChildren(...pie);
    }
    if (retoma) {
      const ya = docs.map((d) => d.requisito).filter((k) => !pausa.docs.includes(k)).map((k) => req[k].nombre);
      if (ya.length) { $('[data-ya-coincidieron]').textContent = `Ya coincidieron en la cita: ${lista(ya)}.`; $('[data-ya-coincidieron]').hidden = false; }
      $('[data-docs-titulo]').textContent = '1. Documentos que no coincidieron';
      $('#t-pago').textContent = '2. Pago';
      $('#t-factura').textContent = '3. Factura';
    }

    /* ----- Pago: lo que se le indicó al darle la cita ----- */
    const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad);
    const importe = s.pago_monto != null ? s.pago_monto : c && c.pago_monto;
    $('[data-pago-datos]').replaceChildren(datosLista([
      ['Concepto', c ? c.pago_concepto : '', 'texto oficial del concepto de pago.'],
      ['Monto que se le indicó', importe != null ? Number(importe).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : 'Sin monto', 'lo fija la Gaceta Oficial.'],
      ['Referencia', s.pago_referencia || s.folio.replace(/-/g, ''), 'formato de la referencia de pago.']
    ]));

    /* ----- Lo que calcula la página ----- */
    let calculando = false;
    function recalcula() {
      if (calculando) return; // los auxiliares que se ajustan aquí disparan «change»: no se recalcula dentro
      calculando = true;
      try { calcula(); } finally { calculando = false; }
    }
    function calcula() {
      ponValor('pedir_llegada', retoma ? 'no' : 'si');
      const presente = retoma ? 'si' : elegido('se_presento');
      const ident = retoma ? 'misma' : elegido('identidad');
      ponValor('pedir_identidad', presente === 'si' && !retoma ? 'si' : 'no');
      const conDocs = presente === 'si' && ident !== 'no_es';
      ponValor('pedir_documentos', conDocs ? 'si' : 'no');
      for (const k of $$('[data-doc]', form).map((a) => a.dataset.doc)) ponValor(`cotejar_${k}`, conDocs && aCotejar.includes(k) ? 'si' : 'no');
      const coinciden = aCotejar.map((k) => elegido(`coincide_${k}`));
      const noCoinciden = coinciden.filter((x) => x === 'no').length;
      ponValor('pedir_hoy', conDocs && noCoinciden ? 'si' : 'no');
      ponValor('pedir_pago', conDocs && !noCoinciden ? 'si' : 'no');
      ponValor('pedir_factura', conDocs && !noCoinciden && elegido('pago') === 'si' ? 'si' : 'no');

      let resultado = '';
      if (presente === 'no') resultado = inasistencias + 1 >= maxInasistencias ? 'cerrar' : 'no_se_presento';
      else if (presente === 'si' && ident === 'no_es') resultado = 'no_es_la_persona';
      else if (presente === 'si' && noCoinciden) resultado = { si: 'pausa', no: 'con_observaciones' }[elegido('hoy_documento')] || '';
      else if (presente === 'si') resultado = { si: 'terminado', no: 'otra_cita' }[elegido('pago')] || '';
      ponValor('resultado', resultado);

      // Estado de cada documento, a la vista
      for (const art of $$('[data-doc]', form)) {
        const v = elegido(`coincide_${art.dataset.doc}`);
        // Etiqueta con icono de su familia: por cotejar (en marcha), coincide (logro), no coincide (atención)
        $('[data-doc-estado]', art).replaceWith(APD.estado(v === 'si' ? 'Coincide' : v === 'no' ? 'No coincide' : 'Por cotejar', v === 'si' ? 'ok' : v === 'no' ? 'pend' : 'marcha'));
        $('.doc-cabeza .estado', art).setAttribute('data-doc-estado', '');
      }

      // Lo que falta, y lo que pasará al registrar
      const faltan = [];
      if (!presente) faltan.push('si la persona se presentó');
      if (presente === 'si' && !ident) faltan.push('la identidad');
      const sinCotejar = conDocs ? coinciden.filter((x) => !x).length : 0;
      if (sinCotejar) faltan.push(`el cotejo de ${sinCotejar === 1 ? 'un documento' : `${sinCotejar} documentos`}`);
      if (conDocs && noCoinciden && !elegido('hoy_documento')) faltan.push('si puede traer hoy el documento correcto');
      if (conDocs && !noCoinciden && !elegido('pago')) faltan.push('el pago');
      const nuevo = p.numero_expediente ? `esta solicitud se agrega a su expediente físico ${expediente}` : `se abre el expediente físico ${expediente}`;
      const TEXTOS = {
        terminado: `Todo coincide y el pago está verificado. Al terminar, ${nuevo} y el siguiente paso es asignarle un grupo del curso.`,
        pausa: `${noCoinciden === 1 ? 'Un documento no coincide' : `${noCoinciden} documentos no coinciden`}: la cita queda en pausa. La persona carga hoy en «Mis trámites» el documento correcto y usted retoma el cotejo cuando regrese.`,
        con_observaciones: `${noCoinciden === 1 ? 'Un documento no coincide' : `${noCoinciden} documentos no coinciden`}: la solicitud regresa con observaciones. La persona corrige en línea y, después de una nueva revisión, recibe otra cita. El pago y la factura se ven en esa cita.`,
        otra_cita: 'Sin el comprobante de pago no se termina el cotejo: se le da otra cita y conserva el monto que se le indicó.',
        no_se_presento: 'Es su primera inasistencia: se le da una cita nueva, una sola vez. Si tampoco se presenta, la solicitud se cierra.',
        cerrar: 'Es su segunda inasistencia: la solicitud se cierra y el trámite termina sin acreditación. La persona puede iniciar una solicitud nueva.',
        no_es_la_persona: 'No se atiende la cita. La cuenta queda bloqueada y se avisa a la Dirección para aclararlo.'
      };
      $('[data-resumen]').textContent = faltan.length && ['', 'terminado', 'otra_cita'].includes(resultado)
        ? `Falta: ${lista(faltan)}.` : TEXTOS[resultado] || '';
      $('[data-cita-ayuda]').textContent = resultado === 'otra_cita'
        ? 'Asígnele una cita nueva para que presente su comprobante. Conserva el monto que se le indicó.'
        : 'Asígnele una cita nueva, una sola vez. Conserva el monto que se le indicó.';
      const r = RESULTADOS[resultado];
      const boton = $('[data-accion="enviar"]', form);
      if (boton.getAttribute('aria-busy') !== 'true') boton.textContent = r.boton;
      boton.classList.toggle('btn-primario', r.clase === 'btn-primario');
      boton.classList.toggle('btn-peligro-contorno', r.clase === 'btn-peligro-contorno');
    }

    /* Ver documento: en el visor, con todas sus hojas; el que se ve queda señalado en la lista */
    const hayVisor = () => Boolean(window.FormKit && FormKit.visor);
    function ver(k, boton) {
      if (!archivos[k] || !hayVisor()) return;
      for (const a of $$('[data-doc]', form)) a.toggleAttribute('data-viendo', a.dataset.doc === k);
      FormKit.visor.abre(archivos[k], boton);
    }
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ver]');
      if (b) ver(b.dataset.ver, b);
    });

    /* Al marcar que un documento coincide, se pasa al siguiente sin cotejar (como en la revisión documental) */
    const suave = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    form.addEventListener('change', (e) => {
      const r = e.target;
      if (!e.isTrusted || !r.name || !r.name.startsWith('coincide_') || r.value !== 'si') return;
      const actual = r.name.slice(9);
      const orden = aCotejar.filter((k) => archivos[k]);
      const i = orden.indexOf(actual);
      const siguiente = orden.slice(i + 1).find((k) => !elegido(`coincide_${k}`)) || orden.slice(0, i).find((k) => !elegido(`coincide_${k}`));
      if (!siguiente) return;
      if (hayVisor() && FormKit.visor.enComputadora()) ver(siguiente, null);
      $(`[data-doc="${siguiente}"]`, form).scrollIntoView({ behavior: suave, block: 'start' });
      FormKit.anuncia(`Siguiente documento: ${archivos[siguiente].titulo}.`);
    });

    // La cita nueva, desde el día siguiente al de hoy (fecha simulada del corte)
    document.getElementById('cita_fecha').setAttribute('min', APD.sumaDias(datos.fecha_corte, 1));
    P.pintaCargaCitas(datos, $('[data-carga-cita]'));

    form.hidden = pausaVencida;
    $('[data-cargando]').hidden = true;
    const instancia = FormKit.iniciar(form, {
      enviar(payload, { signal }) {
        return new Promise((ok, mal) => {
          const t = setTimeout(() => {
            const d = payload.datos;
            const resultado = document.getElementById('resultado').value;
            const en = new Date().toISOString();
            const archivo = (campo) => (payload.archivos || []).find((a) => a.campo === campo && a.blob);
            const guardados = [];
            const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
            // La factura queda en el expediente. En la cita no se toma otra fotografía (decisión 2026-10-17, Liber)
            if (A && resultado === 'terminado' && archivo('factura_pago')) {
              guardados.push(A.guardaDocumento(s.folio, 'factura_pago', archivo('factura_pago'), { en, estado: 'aceptado', cargado_por: P.REVISORA.usuario }).catch(() => {}));
            }
            Promise.all(guardados).then(() => {
              P.guardaCotejo(s.folio, { resultado, datos: d, en, cita_en: s.cita_en, expediente: resultado === 'terminado' ? expediente : null, atendio: P.REVISORA.usuario });
              ok({ resultado, d });
            });
          }, 400);
          signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
        });
      },
      alEnviar({ resultado, d }) {
        const cita = d.cita_fecha ? `${fecha(d.cita_fecha)} a las ${d.cita_hora}` : '';
        // Resultado de la cita con el módulo «resultado» del estándar (1.4.0, P113): [familia, título, texto, pasos]; lo
        // que sigue en varias acciones va en la secuencia «Qué sigue» (P119)
        const curso = `${APD.TIPOS[s.tipo_acreditacion].toLowerCase()} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}`;
        const HECHO = {
          terminado: ['ok', `Cotejo terminado: expediente físico ${expediente}`, `Número de expediente: ${expediente}. ${nombre} ya lo ve en «Mis trámites».`, [
            `${p.numero_expediente ? 'Agregue esta solicitud al expediente físico' : 'Abra el expediente físico'} de ${nombre} con el número ${expediente}.`,
            `Asígnele un grupo del curso de ${curso}: ya aparece en «Grupos», entre las personas en espera.`,
            'Al confirmar el grupo, la persona ve en «Mis trámites» las fechas, la hora de entrada y dónde presentarse.']],
          pausa: ['proceso', 'En pausa: espera el documento correcto', `${nombre} ya ve en «Mis trámites» qué no coincidió.`, [
            `${nombre} carga el documento correcto desde «Mis trámites».`,
            'Cuando regrese, búsquela en las citas del día.',
            'Retome el cotejo: sólo se coteja el documento que no coincidió.']],
          con_observaciones: ['atencion', 'Regresa con observaciones', `${nombre} ya ve en «Mis trámites» qué no coincidió.`, [
            `${nombre} corrige y reenvía su solicitud.`,
            'La solicitud aparece de nuevo en «Revisión documental», marcada como reenviada.']],
          otra_cita: ['atencion', `Sin pago: cita nueva el ${cita}`, `${nombre} la ve en «Mis trámites», con los mismos datos para pagar.`],
          no_se_presento: ['atencion', `No se presentó: cita nueva el ${cita}`, `${nombre} la ve en «Mis trámites». Si tampoco se presenta, la solicitud se cierra.`],
          cerrar: ['rechazo', 'Solicitud cerrada: no se presentó por segunda vez', `${nombre} ve en «Mis trámites» que su solicitud se cerró. Puede iniciar una solicitud nueva.`],
          no_es_la_persona: ['rechazo', 'No se atendió: la cuenta quedó bloqueada', `${nombre} no puede entrar a su cuenta hasta que se aclare su identidad. Se avisa a la Dirección.`]
        };
        const [tono, titulo, texto, pasos] = HECHO[resultado];
        form.hidden = true;
        // Lo de la cita que ya no es cierto se quita (el aviso de pausa no queda encima del resultado)
        $('[data-retoma]').hidden = true;
        $('[data-antecedente]').hidden = true;
        // La siguiente cita del mismo día que falta atender
        APD.cargar().then((nuevos) => {
          const dia = P.diaDe(s.cita_en);
          const sig = P.citas(nuevos).find((x) => x.pendiente && x.s.folio !== s.folio && P.diaDe(x.en) === dia && x.situacion !== 'en_pausa');
          if (sig) $('[data-hecho-acciones]').append(el('a', { class: 'btn btn-primario', href: `cotejo.html?folio=${encodeURIComponent(sig.s.folio)}`,
            texto: `Atender la siguiente: ${P.horaDe(sig.en)} · ${APD.nombreCompleto(sig.p)}` }));
        });
        const visor = $('[data-visor]');
        if (visor && visor.open) visor.close();
        $('[data-estado]').replaceChildren(APD.estado({ ok: 'Atendida', proceso: 'En pausa', atencion: 'Cita nueva', rechazo: 'Cerrada' }[tono], tono));
        FormKit.resultado($('[data-hecho]'), { tono, titulo, texto, pasos, quien: P.REVISORA.nombre });
        if (resultado === 'no_es_la_persona') $('[data-hecho] [data-resultado-acciones]').before(el('p', { class: 'pendiente', texto: 'Pendiente (P79): a quién de la Dirección se avisa y por qué medio.' }));
      }
    });

    /* Cerrar la solicitud o no atender a la persona no tiene vuelta atrás: se confirma (módulo modal del estándar) */
    FormKit.ganchos.submit = (f, enviar) => {
      const resultado = document.getElementById('resultado').value;
      if (f !== form || !['cerrar', 'no_es_la_persona'].includes(resultado)) return false;
      if (instancia.valida().length) return false; // con errores, el núcleo muestra el resumen
      const boton = $('[data-accion="enviar"]', form);
      const CONFIRMA = {
        cerrar: { titulo: `¿Cerrar la solicitud ${s.folio}?`, si: 'Sí, cerrar la solicitud',
          consecuencias: [`${nombre} no se presentó por segunda vez.`, 'La solicitud se cierra sin acreditación; la persona podrá iniciar una solicitud nueva.'] },
        no_es_la_persona: { titulo: `¿No atender a ${nombre}?`, si: 'Sí, no atender y bloquear la cuenta',
          consecuencias: ['La cuenta queda bloqueada: la persona no podrá entrar hasta que se aclare su identidad.', 'Se avisa a la Dirección con su nota.'] }
      }[resultado];
      FormKit.confirma(boton, Object.assign({ peligro: true, irreversible: resultado === 'cerrar' }, CONFIRMA)).then((si) => { if (si) enviar(); });
      return true;
    };

    // En computadora el visor abre de entrada el primer documento por cotejar
    if (aCotejar[0] && hayVisor() && FormKit.visor.enComputadora()) ver(aCotejar.find((k) => archivos[k]), null);
    form.addEventListener('change', recalcula);
    form.addEventListener('input', (e) => { if (e.target.type === 'radio') recalcula(); });
    recalcula();
  }).catch(() => falla('No se pudo cargar la cita. Intente de nuevo más tarde.'));
}());
