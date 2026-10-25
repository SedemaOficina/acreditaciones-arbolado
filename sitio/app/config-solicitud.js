/* =========================================================
   config-solicitud.js · Ajustes del formulario de solicitud (por pasos)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de
   validaciones.config.js:
     · archivos: 5 MB por archivo (parámetro tamano_maximo_archivo_bytes de
       la base) y sólo PDF (apd.requisito.formatos de lo que carga la persona; decisión 2026-10-15).
   Los catálogos de empresas y carreras los da datos/catalogos.js (generado de apd.organizacion y apd.carrera).

   Adscripción (decisiones 2026-10-15). La API convierte las respuestas en solicitud.adscripcion y
   solicitud.organizacion_id (catálogo apd.organizacion, buscado por clave o, si es un nombre escrito, por
   nombre normalizado; si no existe, lo agrega con su tipo):
     · adscrito = no                                   → sin adscripción ni institución;
     · privada + empresa_nombre                        → institución «privada» con ese nombre;
     · dependencia_cdmx = sobse | paot                 → la de esa clave;
     · dependencia_cdmx = sedema + direccion_sedema    → clave sedema_<siglas> (lista cerrada);
     · dependencia_cdmx = otro + dependencia_cdmx_otra → institución con ese nombre;
     · alcaldia                                        → la de esa clave (lista de las 16);
     · dependencia_federal = cfe | otro (+ nombre)     → la de clave cfe o la del nombre escrito;
     · educativa = unam | chapingo | otro (+ nombre)   → la de clave unam o chapingo, o la del nombre escrito.
   Estudios, en los dos tipos: nivel_estudios; con licenciatura o posgrado, carrera; en dictaminador con licenciatura,
   estatus_estudios (en poda no se pregunta, sesión de trabajo del 23/10/2026: lo dice el auxiliar pedir_situacion); con
   carrera técnica, carrera_tecnica (escrita, sin catálogo).
   Van tal cual; en dictaminador la base calcula
   perfil_academico y experiencia_minima (apd.perfil_academico) y liga la carrera a apd.carrera.

   El envío es una SIMULACIÓN: asigna un folio con la forma de la base
   (APD-S-AAAA-NNNNN) y no guarda nada fuera de esta pestaña. En la etapa 3
   se sustituye por la API del proyecto: crea la solicitud en borrador,
   sube cada documento, la pasa a «enviada» y la base aplica sus reglas
   (elegibilidad, documentos obligatorios, perfil). El servidor revalida
   todo con codigo/servidor/validar.mjs y el esquema derivado de
   solicitud.html.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
/* Experiencia mínima según el perfil (data-min-segun="experiencia", estándar 1.1.0, P61): la misma regla en la
   página y en el servidor (app/perfil-academico.js). El catálogo de carreras llega cuando la página carga los datos
   (APD_SOLICITUD.usaCatalogo); antes, el mínimo es 0. */
let catalogoCarreras = null;
const global_archivos = () => typeof APD_ARCHIVOS_PRUEBA !== 'undefined';
/* Borrador en este dispositivo (auditoría 2026-10-18, B2): el del núcleo (data-borrador, estándar 1.5.0, P148), uno por
   persona y por solicitud (la nueva o la del folio que se continúa). La clave se pone aquí, antes de que el núcleo inicie
   el formulario. Con el prefijo «apd.», la caducidad de 7 días y «Empezar de cero» lo borran como todo lo de la prueba.
   El núcleo lo empieza con el primer gesto de la persona: lo que la página precarga al continuar una solicitud no lo
   crea. Lo propio del trámite al recuperarlo (las declaraciones se vuelven a marcar, el curso se recalcula) está en
   app/solicitud.js. */
const sesionBorrador = typeof APD !== 'undefined' ? APD.leeSesion() : null;
/* Registro asistido (decisión de Liber del 25/10/2026; ?asistida=<persona>): la captura el personal por la persona; el
   borrador es de esa persona, no de la sesión */
const asistidaBorrador = new URLSearchParams(location.search).get('asistida');
const personaBorrador = asistidaBorrador ? `asistida-${asistidaBorrador}` : sesionBorrador && sesionBorrador.id ? sesionBorrador.id : 'sin-sesion';
const folioBorrador = new URLSearchParams(location.search).get('folio') || 'nueva';
document.getElementById('formulario').dataset.borrador = `apd.borrador.solicitud.${personaBorrador}.${folioBorrador}`;
document.getElementById('formulario').dataset.borradorVersion = '1';
/* Los documentos del borrador: proveedor de archivos del núcleo (FormKit.iniciar(form, { borradorArchivos }), P148). Van al
   almacén de la prueba (app/archivos-prueba.js) con un folio propio del borrador («borrador:<persona>:<folio>»), que la
   mezcla de la prueba no aplica a ninguna solicitud y el menú cuenta como borrador; uno por campo, el último que eligió la
   persona. Las escrituras van en fila, una a la vez. Si el navegador no deja guardar un documento, se avisa antes de salir
   de la página. En la etapa 3, la API guarda los documentos de la solicitud en borrador. */
const borradorArchivos = (() => {
  const P = global_archivos() ? APD_ARCHIVOS_PRUEBA : null;
  const folio = `borrador:${personaBorrador}:${folioBorrador}`;
  const guardados = new Map(); // campo → el archivo que ya está guardado (o null)
  const sinGuardar = new Set();
  let fila = Promise.resolve();
  let lectura = null;
  let borrado = null;
  const enFila = (fn) => { fila = fila.then(fn, fn); return fila; };
  window.addEventListener('beforeunload', (e) => { if (sinGuardar.size) { e.preventDefault(); e.returnValue = ''; } });
  return {
    folio,
    guarda(campo, archivos) {
      const f = archivos[0] || null;
      if ((guardados.has(campo) ? guardados.get(campo) : null) === f) return null;
      guardados.set(campo, f);
      if (!P) { if (f) sinGuardar.add(campo); return null; }
      return enFila(() => P.documentos(folio)
        .then((lista) => Promise.all(lista.filter((d) => d.requisito === campo).map((d) => P.quitaDocumento(folio, campo, d.cargado_en))))
        .then(() => f && P.guardaDocumento(folio, campo, { blob: f, nombre: f.name, tipo: f.type, size: f.size }))
        .then(() => sinGuardar.delete(campo), () => sinGuardar.add(campo)));
    },
    // El último documento guardado de cada campo, como File; el que se devuelve ya está guardado (no se escribe otra vez)
    lee(campo) {
      if (!P) return [];
      lectura = lectura || enFila(() => P.documentos(folio));
      return lectura.then((lista) => {
        const d = (lista || []).filter((x) => x.requisito === campo && x.blob).sort((a, b) => String(a.cargado_en).localeCompare(String(b.cargado_en))).pop();
        if (!d) return [];
        const f = new File([d.blob], d.nombre_original, { type: d.tipo_mime || d.blob.type });
        guardados.set(campo, f);
        return [f];
      });
    },
    // Al descartar, al vencer o al enviar: el núcleo avisa por cada campo; se borran todos una sola vez
    borra() {
      guardados.clear();
      sinGuardar.clear();
      lectura = null;
      if (!P) return null;
      const listo = () => { borrado = null; };
      borrado = borrado || enFila(() => P.borraDocumentos(folio)).then(listo, listo);
      return borrado;
    },
    // Lo que se está leyendo al recuperar (app/solicitud.js espera a que lleguen los documentos)
    leyendo: () => lectura || Promise.resolve([])
  };
})();
window.APD_SOLICITUD = { usaCatalogo(datos) { catalogoCarreras = datos; }, borradorArchivos };
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, extensiones: ['pdf'], max: 1 },
  // Formato propio «carrera» (app/formatos-propios.js): la carrera escrita lleva letras (auditoría «intentar romperlo», F1 12)
  formatos: window.APD_FORMATOS,
  // «pesa 5.0 MB y el máximo es 5 MB» parecía que sí cabía (redondeo del estándar; F4 B6)
  mensajes: { archRechazoPeso: 'pasa del máximo de {mb} MB (pesa {peso}). Reduce su tamaño o elige otro.' },
  limitesSegun: { experiencia: (r) => APD_PERFIL_ACADEMICO.minimoExperiencia(catalogoCarreras, r) }
};

window.FORMKIT_OPCIONES = {
  borradorArchivos,
  // Un rechazo como el de la API (la sesión cambió, la solicitud ya no se puede enviar): su mensaje y su enlace, en lugar
  // del «No se pudo enviar» general (bloque 2)
  alFallar(e, form) { APD.muestraRechazo(e, form); },
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        /* Lo guardado más reciente, justo antes de guardar (auditoría «intentar romperlo», bloque 2): la sesión sigue siendo
           la de quien abrió la página (F1 1 y 2), la persona todavía puede enviar esta solicitud (una sola activa por tipo,
           F1 3) y, si continúa una, ésta sigue en borrador o con observaciones (F1 4: una pestaña vieja deshacía una
           validación). Son las reglas de la base (apd.solicitud_alta, apd.solicitud_cambio); la API responderá lo mismo. */
        const enviaCon = (datos, intento) => {
          const d = payload.datos;
          // El curso no viaja (campo auxiliar): el servidor lo determina del tipo y del historial
          const [tipo, modalidad] = document.getElementById('tramite').value.split('_');
          const continua = new URLSearchParams(location.search).get('folio');
          const ahora = new Date().toISOString();
          // Registro asistido: la envía el personal por la persona, con la marca de que se le leyó lo capturado (en la base,
          // apd.lectura_aceptada = lo_capturado; sólo el perfil de revisión y cotejo, registro_asistido_sin_permiso)
          const asistida = asistidaBorrador;
          // Sin sesión, lo capturado sigue en el borrador de este dispositivo (B6-01): se recupera al volver a entrar
          const sesion = asistida ? null : APD.sesionCambio('No se envió nada, pero lo que capturaste sigue en este dispositivo: vuelve a entrar y continúa.');
          if (sesion) return Promise.reject(sesion);
          const p = asistida ? APD_ASISTIDO.personaAsistida(datos, asistida) : APD.personaDeSesion(datos);
          if (!p && asistida) return Promise.reject(APD.rechazo('No se envió la solicitud', 'La persona ya no está entre las registradas en el Vivero.', { href: 'ventanilla.html', texto: 'Ir a la ventanilla' }, 'sesion_cambio'));
          if (!p) return Promise.reject(APD.rechazo('Tu cuenta no está activa', 'No se envió tu solicitud. Vuelve a entrar; si no puedes, pide ayuda a la Secretaría.', { href: 'entrar.html', texto: 'Entrar' }, 'sesion_cambio'));
          const previa = continua ? datos.solicitud.find((x) => x.folio === continua) : null;
          const aTramites = asistida ? { href: `ventanilla.html?persona=${encodeURIComponent(asistida)}`, texto: 'Ir a la ventanilla' } : { href: 'tramites.html', texto: 'Ir a «Mis trámites»' };
          if (continua && (!previa || previa.solicitante_id !== p.id)) {
            return Promise.reject(APD.rechazo('No se envió tu solicitud', `La solicitud ${continua} no es de tu cuenta.`, aTramites, 'solicitud_ajena'));
          }
          if (previa && !['borrador', 'con_observaciones'].includes(previa.estado)) {
            const ahoraEs = (APD.ESTADOS[previa.estado] || {}).texto || previa.estado;
            return Promise.reject(APD.rechazo('Tu solicitud ya no se puede enviar', `Su situación cambió a «${ahoraEs}» (en otra pestaña o en la Secretaría). No se envió nada: revisa en «Mis trámites» lo que sigue.`, aTramites, 'transicion_invalida'));
          }
          if (!continua) {
            const op = APD.opciones(datos, p)[tipo];
            if (!op || !op.disponible || op.modalidad !== modalidad) {
              return Promise.reject(APD.rechazo('No se envió tu solicitud', op && op.motivo ? op.motivo : 'Tu situación cambió desde que abriste esta página.', aTramites, op && /trámite en curso/.test(op.motivo || '') ? 'solicitud_activa' : 'no_elegible'));
            }
          }
          let folio = continua;
          if (!continua) {
            // El folio se calcula al guardar, con lo guardado más reciente (datos ya trae lo enviado en este navegador), y
            // nunca repite uno que ya existe; en la etapa 3 lo asigna la base
            const anio = datos.fecha_corte.slice(0, 4);
            const usados = datos.solicitud.map((x) => String(x.folio).match(new RegExp(`^APD-S-${anio}-(\\d+)$`))).filter(Boolean).map((m) => Number(m[1]));
            const n = Math.max(datos.solicitud.length, ...usados) + 1;
            folio = `APD-S-${anio}-${String(n).padStart(5, '0')}`;
          }
          // Versión de prueba: los archivos reales y un resumen de la solicitud se guardan sólo en este navegador, para
          // verlos en «Mis trámites» y en la revisión del personal (app/archivos-prueba.js). Si el navegador no lo permite
          // (modo privado, almacenamiento bloqueado o lleno), no se envía: se dice y no se da folio (auditoría «intentar
          // romperlo», F4 A1: el acuse salía con un folio que no existía en ninguna parte).
          const prefijo = `doc_${tipo}_${modalidad}_`;
          const archivos = (payload.archivos || []).filter((a) => a.campo.startsWith(prefijo) && a.blob)
            .map((a) => ({ requisito: a.campo.slice(prefijo.length), blob: a.blob, nombre: a.nombre, tipo: a.tipo, size: a.size }));
          const ant = d.anterior ? datos.acreditacion.find((a) => a.numero === d.anterior) : null;
          const R = asistida && window.APD_PERSONAL ? APD_PERSONAL.REVISORA : null;
          const registro = {
            folio, existente: Boolean(previa), tipo_acreditacion: tipo, modalidad,
            // Registro asistido: quién la capturó (al darla de alta) y la marca de lectura de este envío
            ...(R ? { capturada_por: previa ? previa.capturada_por || R.usuario : R.usuario, lectura_lo_capturado: { por: R.usuario, en: ahora } } : {}),
            acreditacion_anterior_id: ant ? ant.id : (previa ? previa.acreditacion_anterior_id : null),
            enviada_en: previa ? previa.enviada_en : ahora, estado_desde: ahora,
            nivel_estudios: d.nivel_estudios || null, carrera: d.carrera || null, carrera_tecnica: d.carrera_tecnica || null, estatus_estudios: d.estatus_estudios || null,
            anios_experiencia: d.anios_experiencia ? Number(d.anios_experiencia) : null,
            persona: { id: p.id, nombre: p.nombre, primer_apellido: p.primer_apellido, segundo_apellido: p.segundo_apellido || null, curp: p.curp,
              correo: p.correo, telefono: p.telefono, adscripcion: p.adscripcion, organizacion_id: p.organizacion_id || null,
              organizacion_nombre: p.organizacion_nombre || '', numero_expediente: p.numero_expediente || null }
          };
          // Un PDF con contraseña no se acepta (auditoría «intentar romperlo», F1 8): la página lo rechaza al cargarlo y aquí,
          // como lo hará la API, se vuelve a revisar al enviar
          return Promise.all(archivos.map((a) => APD.pdfConContrasena(a.blob))).then((protegidos) => {
            const i = protegidos.indexOf(true);
            if (i >= 0) {
              const mensaje = 'Tu PDF tiene contraseña o protección. Guárdalo sin protección y vuelve a cargarlo.';
              return Promise.reject({ mensaje, errores: [{ campo: `${prefijo}${archivos[i].requisito}`, mensaje }] });
            }
            // guardado: la hora con que quedó en este navegador. Si no quedó, se rechaza sin acuse (F4 A1); si otra pestaña
            // tomó el mismo folio en ese instante, se calcula otro con lo de ahora
            const guarda = global_archivos()
              ? APD_ARCHIVOS_PRUEBA.guardaEnvio(registro, archivos).then((hora) => hora || true, (e) => { if (e && e.codigo === 'folio_ocupado') throw e; return false; })
              : Promise.resolve(false);
            return guarda.then((guardado) => {
              if (!guardado) throw APD.noGuardo('No se envió tu solicitud', 'tu solicitud de prueba');
              return guardado;
            }).then((guardado) => APD.cargar().then((despues) => {
              // Después de guardar, lo que quedó (como la respuesta de la API): si la base no lo habría aplicado (otra pestaña
              // envió primero), se retira y se dice, sin acuse
              const s = despues.solicitud.find((x) => x.folio === folio);
              if (!(s && s.solicitante_id === p.id && s.estado === 'enviada')) {
                const op = APD.opciones(despues, p)[tipo];
                return APD_ARCHIVOS_PRUEBA.retiraEnvio(folio, guardado).catch(() => {}).then(() => Promise.reject(APD.rechazo('No se envió tu solicitud',
                  op && op.motivo ? op.motivo : 'Tu solicitud cambió en otra pestaña mientras la enviabas.', aTramites, 'conflicto')));
              }
              // Enviada: el núcleo borra el borrador y el proveedor, sus documentos (F1 7 y F4 M6: se quedaban en este
              // navegador y el menú los contaba como «documentos cargados aparte»)
              // El acuse dice el día simulado de la prueba, como el resto del trámite (F4 M7); con la API, la hora del servidor
              const fecha = global_archivos() ? APD_ARCHIVOS_PRUEBA.alCorte(datos, ahora) : ahora;
              return { folio, fecha };
            }), (e) => {
              if (e && e.codigo === 'folio_ocupado' && intento < 3) return APD.cargar().then((d2) => enviaCon(d2, intento + 1));
              throw e;
            });
          });
        };
        APD.cargar().then((datos) => enviaCon(datos, 1)).then(ok, mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
