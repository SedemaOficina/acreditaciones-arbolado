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
    cerrar: { boton: 'Cerrar la solicitud', clase: 'btn-peligro' },
    no_es_la_persona: { boton: 'No atender y avisar a la Dirección', clase: 'btn-peligro' },
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
      return falla(`Esta solicitud no tiene una cita de cotejo por atender: su estado es «${(APD.ESTADOS[s.estado] || { texto: s.estado }).texto}».`);
    }
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && req[d.requisito] && req[d.requisito].momento === 'en_linea');
    const pausa = s.cotejo_pausa || null;
    const retoma = Boolean(pausa);
    const nuevos = new Set(P.cargadosEnPausa(datos, s).map((d) => d.requisito));
    // En el orden de la pantalla (el del catálogo de requisitos)
    const aCotejar = $$('[data-doc]', form).map((a) => a.dataset.doc).filter((k) => docs.some((d) => d.requisito === k) && (!retoma || pausa.docs.includes(k)));
    const inasistencias = s.inasistencias || 0;
    const expediente = p.numero_expediente || P.siguienteExpediente(datos);
    const anterior = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
    const nombre = APD.nombreCompleto(p);

    /* ----- Cabeza: la cita, la solicitud y la persona ----- */
    $('[data-titulo]').textContent = `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}`;
    $('[data-bajada]').replaceChildren(
      document.createTextNode('Folio de la solicitud '), el('strong', { class: 'mono', texto: s.folio }),
      document.createTextNode(` · cita del ${fechaHora(s.cita_en)} · validada en línea el ${fecha(s.estado_desde)}`)
    );
    $('[data-estado]').replaceChildren(APD.estado(retoma ? 'Cita en pausa' : 'Cita asignada', 'pend'));
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
      ['Número de expediente', p.numero_expediente || 'Se abre al terminar este cotejo: es su primer trámite'],
      ['Adscripción', APD.adscripcionTexto(datos, s).replace(/^Independiente: .*/, 'Independiente')],
      ['Acreditación que renueva', anterior ? `${anterior.numero}, vence el ${fecha(anterior.vence_en)}` : '']
    ])])]));
    if (retoma) {
      const nombres = pausa.docs.map((k) => (req[k] ? req[k].nombre : k));
      const faltan = pausa.docs.filter((k) => !nuevos.has(k)).map((k) => (req[k] ? req[k].nombre : k));
      $('[data-retoma-texto]').replaceChildren(
        el('p', {}, [el('strong', { texto: `Cotejo en pausa desde las ${P.horaDe(pausa.real)}.` }), document.createTextNode(` No coincidió: ${lista(nombres)}. La identidad y los demás documentos ya se cotejaron.`)]),
        el('p', { texto: faltan.length
          ? `La persona todavía no carga: ${lista(faltan)}. Si no lo carga hoy, marque «No coincide» y «No: regresa con observaciones».`
          : 'La persona ya cargó el documento nuevo: compárelo con el que trae.' })
      );
      $('[data-retoma]').hidden = false;
    }
    if (inasistencias || s.cita_motivo === 'sin_pago') {
      $('[data-antecedente-texto]').replaceChildren(el('p', { texto: s.cita_motivo === 'sin_pago'
        ? `En su cita del ${fechaHora(s.cita_anterior)} no presentó el comprobante de pago; ésta es su cita nueva.`
        : `No se presentó a su cita del ${fechaHora(s.cita_anterior)}; ésta es su cita nueva. Si tampoco se presenta, la solicitud se cierra.` }));
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
        ? { url: URL.createObjectURL(d.blob), titulo: req[k].nombre, archivo: nombreArchivo, nota: 'Versión de prueba: es el archivo que se cargó en este navegador.' }
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
      if (presente === 'no') resultado = inasistencias >= 1 ? 'cerrar' : 'no_se_presento';
      else if (presente === 'si' && ident === 'no_es') resultado = 'no_es_la_persona';
      else if (presente === 'si' && noCoinciden) resultado = { si: 'pausa', no: 'con_observaciones' }[elegido('hoy_documento')] || '';
      else if (presente === 'si') resultado = { si: 'terminado', no: 'otra_cita' }[elegido('pago')] || '';
      ponValor('resultado', resultado);

      // Estado de cada documento, a la vista
      for (const art of $$('[data-doc]', form)) {
        const v = elegido(`coincide_${art.dataset.doc}`);
        const chip = $('[data-doc-estado]', art);
        chip.textContent = v === 'si' ? 'Coincide' : v === 'no' ? 'No coincide' : 'Por cotejar';
        if (v) chip.dataset.tono = v === 'si' ? 'ok' : 'error'; else chip.removeAttribute('data-tono');
      }

      // Lo que falta, y lo que pasará al registrar
      const faltan = [];
      if (!presente) faltan.push('si la persona se presentó');
      if (presente === 'si' && !ident) faltan.push('la identidad');
      const sinCotejar = conDocs ? coinciden.filter((x) => !x).length : 0;
      if (sinCotejar) faltan.push(`el cotejo de ${sinCotejar === 1 ? 'un documento' : `${sinCotejar} documentos`}`);
      if (conDocs && noCoinciden && !elegido('hoy_documento')) faltan.push('si puede traer hoy el documento correcto');
      if (conDocs && !noCoinciden && !elegido('pago')) faltan.push('el pago');
      const nuevo = p.numero_expediente ? `la solicitud se agrega a su expediente ${expediente}` : `se abre el expediente ${expediente}`;
      const TEXTOS = {
        terminado: `Todo coincide y el pago está verificado. Al terminar, ${nuevo} y la solicitud pasa a «En espera de grupo».`,
        pausa: `${noCoinciden === 1 ? 'Un documento no coincide' : `${noCoinciden} documentos no coinciden`}: la cita queda en pausa. La persona carga hoy en «Mis trámites» el documento correcto y usted retoma el cotejo cuando regrese.`,
        con_observaciones: `${noCoinciden === 1 ? 'Un documento no coincide' : `${noCoinciden} documentos no coinciden`}: la solicitud regresa con observaciones. La persona corrige en línea y, después de una nueva revisión, recibe otra cita. El pago y la factura se ven en esa cita.`,
        otra_cita: 'Sin el comprobante de pago no se termina el cotejo: se le da otra cita y conserva el monto que se le indicó.',
        no_se_presento: 'Es su primera inasistencia: se le da una cita nueva, una sola vez. Si tampoco se presenta, la solicitud se cierra.',
        cerrar: 'Es su segunda inasistencia: la solicitud se cierra como «concluida sin atender». La persona puede iniciar una solicitud nueva.',
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
      boton.classList.toggle('btn-peligro', r.clase === 'btn-peligro');
    }

    /* Ver documento: en el visor, con todas sus hojas; el que se ve queda señalado en la lista */
    const hayVisor = () => typeof APD_VISOR !== 'undefined';
    function ver(k, boton) {
      if (!archivos[k] || !hayVisor()) return;
      for (const a of $$('[data-doc]', form)) a.toggleAttribute('data-viendo', a.dataset.doc === k);
      APD_VISOR.abre(archivos[k], boton);
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
      if (hayVisor() && APD_VISOR.enComputadora()) ver(siguiente, null);
      $(`[data-doc="${siguiente}"]`, form).scrollIntoView({ behavior: suave, block: 'start' });
      FormKit.anuncia(`Siguiente documento: ${archivos[siguiente].titulo}.`);
    });

    // La cita nueva, desde el día siguiente al de hoy (fecha simulada del corte)
    document.getElementById('cita_fecha').setAttribute('min', APD.sumaDias(datos.fecha_corte, 1));

    form.hidden = false;
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
        const HECHO = {
          terminado: ['El cotejo quedó terminado', `${p.numero_expediente ? 'Agregue esta solicitud a la carpeta física' : 'Anote el número de expediente en la carpeta física'} de ${nombre}. La persona ya ve en «Mis trámites» que espera grupo y su número de expediente.`],
          pausa: ['La cita quedó en pausa', `${nombre} ve en «Mis trámites» qué no coincidió y puede cargar el documento correcto. Cuando regrese, búsquela en las citas del día y retome el cotejo.`],
          con_observaciones: ['La solicitud regresó con observaciones', `${nombre} ve en «Mis trámites» qué no coincidió. Cuando corrija y reenvíe, vuelve a la revisión documental como reenviada.`],
          otra_cita: ['Se le dio otra cita', `Cita nueva: ${cita}. ${nombre} la ve en «Mis trámites», con los mismos datos para pagar.`],
          no_se_presento: ['Se registró la inasistencia', `Cita nueva: ${cita}. ${nombre} la ve en «Mis trámites». Si tampoco se presenta, la solicitud se cierra.`],
          cerrar: ['La solicitud quedó cerrada', `${nombre} ve en «Mis trámites» que su solicitud se cerró por no presentarse a su cita. Puede iniciar una solicitud nueva.`],
          no_es_la_persona: ['La cita no se atendió', `La cuenta de ${nombre} queda bloqueada y se avisa a la Dirección para aclararlo.`]
        };
        const [titulo, texto] = HECHO[resultado];
        form.hidden = true;
        $('[data-hecho-titulo]').textContent = titulo;
        $('[data-hecho-texto]').textContent = texto;
        $('[data-hecho-datos]').replaceChildren(resultado === 'terminado' ? datosLista([
          ['Número de expediente', expediente],
          ['Situación', `En espera de grupo · ${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}`]
        ]) : document.createTextNode(''));
        if (resultado === 'terminado') { const v = $('[data-hecho-datos] .datos-valor'); if (v) v.classList.add('mono'); }
        if (resultado === 'no_es_la_persona') $('[data-hecho-texto]').after(el('p', { class: 'pendiente', texto: 'Pendiente (P79): a quién de la Dirección se avisa y por qué medio.' }));
        // La siguiente cita del mismo día que falta atender
        APD.cargar().then((nuevos) => {
          const dia = P.diaDe(s.cita_en);
          const sig = P.citas(nuevos).find((x) => x.pendiente && x.s.folio !== s.folio && P.diaDe(x.en) === dia && x.situacion !== 'en_pausa');
          if (sig) $('[data-hecho-acciones]').append(el('a', { class: 'btn btn-primario', href: `cotejo.html?folio=${encodeURIComponent(sig.s.folio)}`,
            texto: `Atender la siguiente: ${P.horaDe(sig.en)} · ${APD.nombreCompleto(sig.p)}` }));
        });
        const visor = $('[data-visor]');
        if (visor && visor.open) visor.close();
        const hecho = $('[data-hecho]');
        hecho.hidden = false;
        hecho.focus();
        hecho.scrollIntoView({ block: 'start' });
      }
    });

    /* Cerrar la solicitud o no atender a la persona no tiene vuelta atrás: se confirma (módulo modal del estándar) */
    FormKit.ganchos.submit = (f, enviar) => {
      const resultado = document.getElementById('resultado').value;
      if (f !== form || !['cerrar', 'no_es_la_persona'].includes(resultado)) return false;
      if (instancia.valida().length) return false; // con errores, el núcleo muestra el resumen
      const boton = $('[data-accion="enviar"]', form);
      const CONFIRMA = {
        cerrar: { titulo: '¿Cerrar la solicitud?', texto: `${nombre} no se presentó por segunda vez. La solicitud ${s.folio} queda «concluida sin atender» y no se puede reabrir.`, si: 'Cerrar la solicitud' },
        no_es_la_persona: { titulo: '¿No atender la cita?', texto: `La cuenta de ${nombre} queda bloqueada hasta que la Dirección lo aclare. La persona no podrá entrar a su cuenta.`, si: 'No atender y avisar' }
      }[resultado];
      FormKit.confirma(boton, Object.assign({ no: 'Cancelar', peligro: true }, CONFIRMA)).then((si) => { if (si) enviar(); });
      return true;
    };

    // En computadora el visor abre de entrada el primer documento por cotejar
    if (aCotejar[0] && hayVisor() && APD_VISOR.enComputadora()) ver(aCotejar.find((k) => archivos[k]), null);
    form.addEventListener('change', recalcula);
    form.addEventListener('input', (e) => { if (e.target.type === 'radio') recalcula(); });
    recalcula();
  }).catch(() => falla('No se pudo cargar la cita. Intente de nuevo más tarde.'));
}());
